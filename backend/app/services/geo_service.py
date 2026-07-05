"""Store geo-matching (B1).

Serviceability is decided by the STORE's own radius (`geo_radius_km`, set by
the admin), never by a client-supplied search radius — the old /stores/nearby
let the app's hardcoded 15 km override a store configured to serve 30 km,
which is exactly the client's "store radius is 30 km but no store found" bug.

Stores carry a GeoJSON mirror of latitude/longitude:
    location: {"type": "Point", "coordinates": [lng, lat]}
with a 2dsphere index (created at startup) so matching uses $geoNear.
"""

import logging

logger = logging.getLogger(__name__)

# Store didn't configure a radius → assume it serves this far (km).
DEFAULT_SERVICE_RADIUS_KM = 15.0
# Hard search cap — no store serves beyond this (km).
MAX_SEARCH_RADIUS_KM = 100.0


def location_point(latitude, longitude) -> dict | None:
    """GeoJSON Point for a store doc. GeoJSON order is [lng, lat] — the
    classic swap bug the 2dsphere index would otherwise hide until queries
    silently return nothing."""
    if latitude is None or longitude is None:
        return None
    return {"type": "Point", "coordinates": [float(longitude), float(latitude)]}


async def sync_missing_store_locations(db) -> int:
    """Backfill `location` on stores that predate the geo index. Idempotent,
    cheap when there's nothing to do. Returns number migrated."""
    n = 0
    cursor = db.stores.find(
        {"location": {"$exists": False}},
        {"latitude": 1, "longitude": 1},
    )
    async for s in cursor:
        point = location_point(s.get("latitude"), s.get("longitude"))
        if not point:
            continue
        await db.stores.update_one({"_id": s["_id"]}, {"$set": {"location": point}})
        n += 1
    if n:
        logger.info(f"geo: backfilled location on {n} store(s)")
    return n


async def find_serviceable_stores(db, lat: float, lng: float, limit: int = 50) -> list[dict]:
    """Active stores whose OWN serviceable radius covers (lat, lng),
    nearest first. Each result carries `dist_km`."""
    await sync_missing_store_locations(db)
    pipeline = [
        {"$geoNear": {
            "near": {"type": "Point", "coordinates": [float(lng), float(lat)]},
            "distanceField": "dist_m",
            "maxDistance": MAX_SEARCH_RADIUS_KM * 1000,
            "query": {"status": "active"},
            "spherical": True,
        }},
        {"$addFields": {"dist_km": {"$divide": ["$dist_m", 1000.0]}}},
        {"$match": {"$expr": {"$lte": [
            "$dist_km",
            {"$ifNull": ["$geo_radius_km", DEFAULT_SERVICE_RADIUS_KM]},
        ]}}},
        {"$limit": limit},
    ]
    return await db.stores.aggregate(pipeline).to_list(length=limit)
