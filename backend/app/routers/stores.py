"""Stores — store locations with vendor codes."""

from fastapi import APIRouter, HTTPException, Query, status
from app.core.database import get_db
from app.core.utils import haversine_km
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
        await db.stores.insert_one(SEED_STORE)
        stores = await db.stores.find({"status": "active"}).to_list(length=50)

    return [_format_store(s) for s in stores]


@router.get("/nearby", response_model=list[NearbyStoreResponse])
async def get_nearby_stores(
    lat: float = Query(..., description="Customer latitude"),
    lng: float = Query(..., description="Customer longitude"),
    radius: float = Query(10.0, description="Search radius in km"),
):
    """Return active stores within radius km, sorted by distance."""
    db = get_db()
    stores = await db.stores.find({"status": "active"}).to_list(length=100)
    nearby = []
    for s in stores:
        dist = haversine_km(lat, lng, s["latitude"], s["longitude"])
        if dist <= radius:
            formatted = _format_store(s)
            formatted["distance_km"] = round(dist, 2)
            formatted["is_open"] = s.get("is_open", False)
            nearby.append(formatted)
    nearby.sort(key=lambda x: x["distance_km"])
    return nearby


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
