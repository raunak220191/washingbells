"""Stores — store locations with vendor codes."""

from fastapi import APIRouter, HTTPException, Query, status
from app.core.database import get_db
from app.core.utils import haversine_km
from app.services.geo_service import find_serviceable_stores, DEFAULT_SERVICE_RADIUS_KM
from app.schemas.phase1_schemas import NearbyStoreResponse, StoreResponse
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(prefix="/stores", tags=["stores"])

SEED_STORE = {
    "vendor_code": "WB001",
    "name": "WashingBells Ludhiana Central",
    "address": "Shop 12, Model Town, Ludhiana, Punjab 141002",
    "city": "Ludhiana",
    "state": "Punjab",
    "pincode": "141002",
    "phone": "+911234567890",
    "whatsapp": "+911234567890",
    "latitude": 30.9010,
    "longitude": 75.8573,
    "geo_radius_km": 15,
    "status": "active",
    "operator_user_id": None,
}


def _format_store(s: dict) -> dict:
    return {
        "id": str(s["_id"]),
        "vendor_code": s["vendor_code"],
        "name": s["name"],
        "address": s["address"],
        "city": s["city"],
        "phone": s["phone"],
        "whatsapp": s["whatsapp"],
        "latitude": s["latitude"],
        "longitude": s["longitude"],
        "status": s.get("status", "active"),
    }


@router.get("", response_model=list[StoreResponse])
async def list_stores():
    """List all active stores."""
    db = get_db()
    cursor = db.stores.find({"status": "active"})
    stores = await cursor.to_list(length=50)

    if not stores:
        now = datetime.now(timezone.utc)
        SEED_STORE["created_at"] = now
        from app.services.geo_service import location_point
        SEED_STORE["location"] = location_point(SEED_STORE["latitude"], SEED_STORE["longitude"])
        await db.stores.insert_one(SEED_STORE)
        stores = await db.stores.find({"status": "active"}).to_list(length=50)

    return [_format_store(s) for s in stores]


@router.get("/fees-config")
async def get_fees_config(store_id: str = Query(None, description="Optional store for per-store overrides")):
    """Effective delivery/platform fees for checkout display (D10). The
    server recomputes these at order time — this is display-only. Declared
    before /{store_id} so 'fees-config' isn't swallowed as a store id."""
    from app.services.fee_service import get_fee_config
    return await get_fee_config(get_db(), store_id)


@router.get("/nearby", response_model=list[NearbyStoreResponse])
async def get_nearby_stores(
    lat: float = Query(..., description="Customer latitude"),
    lng: float = Query(..., description="Customer longitude"),
    radius: float = Query(None, description="DEPRECATED — serviceability is decided by each store's own geo_radius_km; this parameter is ignored"),
):
    """Active stores whose serviceable radius covers the customer, nearest
    first (B1). A store with geo_radius_km=30 matches a customer 20 km away
    regardless of what the app passes — the old client-radius filter is what
    made configured stores invisible.
    """
    db = get_db()
    try:
        stores = await find_serviceable_stores(db, lat, lng)
    except Exception:
        # $geoNear needs the 2dsphere index — degrade to the linear scan
        # rather than emptying the store list (B4).
        stores = []
        for s in await db.stores.find({"status": "active"}).to_list(length=100):
            if s.get("latitude") is None or s.get("longitude") is None:
                continue
            dist = haversine_km(lat, lng, s["latitude"], s["longitude"])
            if dist <= (s.get("geo_radius_km") or DEFAULT_SERVICE_RADIUS_KM):
                stores.append({**s, "dist_km": dist})
        stores.sort(key=lambda s: s["dist_km"])
    out = []
    for s in stores:
        formatted = _format_store(s)
        formatted["distance_km"] = round(s["dist_km"], 2)
        formatted["is_open"] = s.get("is_open", False)
        out.append(formatted)
    return out


@router.get("/{store_id}", response_model=StoreResponse)
async def get_store(store_id: str):
    """Get store details by ID."""
    db = get_db()
    try:
        store = await db.stores.find_one({"_id": ObjectId(store_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Store not found")
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return _format_store(store)


@router.get("/{store_id}/slots")
async def get_store_slots(store_id: str, date: str = None):
    """Return available pickup/delivery slots for a store on a given date.
    Public endpoint — used by the customer checkout slot picker.

    Query: ?date=YYYY-MM-DD (defaults to today). Pass `range=7` for the next
    7 days as a convenience for multi-day pickers.
    """
    from datetime import date as date_cls, datetime as dt
    from app.services.store_hours_service import get_available_slots, ensure_hours
    db = get_db()
    try:
        store = await db.stores.find_one({"_id": ObjectId(store_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid store id")
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    target = date_cls.today()
    if date:
        try:
            target = dt.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    await ensure_hours(db, store)
    return await get_available_slots(db, store, target)
