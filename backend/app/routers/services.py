import os
import yaml
from fastapi import APIRouter, HTTPException
from app.core.database import get_db
from app.core.categories import ITEM_CATEGORIES
from app.schemas.schemas import ServiceResponse, ServiceItemResponse

router = APIRouter(prefix="/services", tags=["Services"])

# Path to the admin-editable rate list
RATE_LIST_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "rate_list.yaml")

# Sort applied at the API boundary so every consumer (apps, admin pickers,
# walk-in) gets a stable order: canonical category first, then name. Without
# this, items render in YAML/$push insertion order and degrade as the catalog
# is edited.
_CATEGORY_RANK = {c: i for i, c in enumerate(ITEM_CATEGORIES)}


def _item_sort_key(item: dict):
    # E3: explicit admin-set sort_order wins; ties fall back to the canonical
    # category rank + name so untouched catalogs keep their stable order.
    return (item.get("sort_order") if item.get("sort_order") is not None else 10**6,
            _CATEGORY_RANK.get(item.get("category", "unisex"), len(ITEM_CATEGORIES)),
            (item.get("name") or "").lower())


def _format_service(svc: dict) -> ServiceResponse:
    items = []
    for item in sorted(svc.get("items", []), key=_item_sort_key):
        items.append(
            ServiceItemResponse(
                id=str(item["_id"]) if "_id" in item else item.get("id", ""),
                name=item["name"],
                price=item["price"],
                icon=item.get("icon"),
                category=item.get("category", "unisex"),
                image_url=item.get("image_url"),
            )
        )
    return ServiceResponse(
        id=str(svc["_id"]),
        name=svc["name"],
        slug=svc["slug"],
        description=svc.get("description", ""),
        icon=svc.get("icon", "shirt-outline"),
        pricing_unit=svc.get("pricing_unit", "piece"),
        service_type=svc.get("service_type", "pickup_drop"),
        items=items,
    )


@router.get("", response_model=list[ServiceResponse])
async def list_services():
    """Get all available laundry services with their items and prices."""
    db = get_db()
    cursor = db.services.find({})
    services = await cursor.to_list(length=50)

    # If no services exist, seed from YAML rate list
    if not services:
        services = await _seed_default_services(db)

    # E3: admin-set sort_order first, then name — deterministic everywhere
    services.sort(key=lambda s: (s.get("sort_order") if s.get("sort_order") is not None else 10**6,
                                 (s.get("name") or "").lower()))
    return [_format_service(s) for s in services]


@router.get("/{slug}", response_model=ServiceResponse)
async def get_service(slug: str):
    """Get a single service by slug."""
    db = get_db()
    service = await db.services.find_one({"slug": slug})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return _format_service(service)


def _load_rate_list() -> list[dict]:
    """Load services and prices from the admin-editable YAML rate list."""
    with open(RATE_LIST_PATH, "r") as f:
        data = yaml.safe_load(f)
    services = []
    for svc in data.get("services", []):
        items = []
        for item in svc.get("items", []):
            items.append({
                "_id": item["id"],
                "name": item["name"],
                "price": item["price"],
                "icon": "shirt",
                "category": item.get("category", "unisex"),
            })
        services.append({
            "name": svc["name"],
            "slug": svc["slug"],
            "description": svc.get("description", ""),
            "icon": svc.get("icon", "shirt-outline"),
            "pricing_unit": svc.get("pricing_unit", "piece"),
            "service_type": svc.get("service_type", "pickup_drop"),
            "items": items,
        })
    return services


async def _seed_default_services(db) -> list:
    """Seed services from rate_list.yaml into MongoDB."""
    default_services = _load_rate_list()
    await db.services.insert_many(default_services)
    return await db.services.find({}).to_list(length=50)


async def sync_item_categories(db) -> int:
    """Keep service-item categories aligned with rate_list.yaml.

    - Every startup (non-destructive): fill a `category` on any item missing one.
    - Once per SYNC_VERSION (guarded by an app_config flag): re-tag existing
      items' categories from the YAML by item id (so scheme changes like
      household→home / shoes→footwear land on already-seeded DBs) AND insert any
      new YAML items not in the DB. Existing services keep their ObjectIds, so
      carts/orders referencing them are unaffected. Bumping SYNC_VERSION re-runs
      the one-time block; admin edits made after that are preserved until the
      next version bump.

    Returns the number of items updated or added.
    """
    rate_list = _load_rate_list()
    yaml_categories: dict[str, str] = {}
    for svc in rate_list:
        for item in svc.get("items", []):
            yaml_categories[str(item["_id"])] = item.get("category", "unisex")

    # Bump this string whenever the YAML category scheme changes meaningfully.
    SYNC_VERSION = "items_v3_home_footwear"
    cfg = await db.app_config.find_one({"_id": "catalog_sync"})
    full_sync = not (cfg and cfg.get(SYNC_VERSION))

    touched = 0
    services = await db.services.find({}).to_list(length=200)
    for svc in services:
        items = svc.get("items", [])
        existing_ids = {str(it.get("_id", it.get("id", ""))) for it in items}
        changed = False
        for item in items:
            iid = str(item.get("_id", item.get("id", "")))
            if full_sync and iid in yaml_categories:
                # One-time re-tag to the current YAML scheme
                if item.get("category") != yaml_categories[iid]:
                    item["category"] = yaml_categories[iid]
                    changed = True
                    touched += 1
            elif "category" not in item or not item.get("category"):
                item["category"] = yaml_categories.get(iid, "unisex")
                changed = True
                touched += 1
        # One-time: append YAML items for this service slug that are missing
        if full_sync:
            for y in rate_list:
                if y["slug"] != svc.get("slug"):
                    continue
                for yi in y.get("items", []):
                    if str(yi["_id"]) not in existing_ids:
                        items.append({
                            "_id": yi["_id"], "name": yi["name"], "price": yi["price"],
                            "icon": "shirt", "category": yi.get("category", "unisex"),
                        })
                        changed = True
                        touched += 1
        if changed:
            await db.services.update_one({"_id": svc["_id"]}, {"$set": {"items": items}})

    if full_sync:
        await db.app_config.update_one(
            {"_id": "catalog_sync"}, {"$set": {SYNC_VERSION: True}}, upsert=True
        )
    return touched
