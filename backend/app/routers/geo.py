"""Geo — server-side forward-geocoding proxy (upgrade_last TASK 3.2).

The Google key lives only in backend env (GOOGLE_MAPS_API_KEY) and is never
shipped in an app bundle. The customer app calls this to pre-center the map
pin after the user types an address. Rate-limited per user with the same
TTL-collection pattern as the OTP limiter (see auth.py / main.py indexes).
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.services.geocoding_service import geocode_address

router = APIRouter(prefix="/geo", tags=["Geo"])

GEO_MAX_PER_WINDOW = 30  # per user per TTL window (10 min, see main.py index)


async def _check_geo_rate_limit(db, user_id: str):
    count = await db.geo_requests.count_documents({"user_id": user_id})
    if count >= GEO_MAX_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many location lookups — please wait a few minutes.",
        )
    await db.geo_requests.insert_one(
        {"user_id": user_id, "created_at": datetime.now(timezone.utc)})


@router.get("/forward")
async def forward_geocode(q: str, current_user: dict = Depends(get_current_user)):
    """Free-text address → coordinates. 200 {found, latitude?, longitude?}."""
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="q (address text) is required")
    db = get_db()
    await _check_geo_rate_limit(db, current_user["user_id"])
    if not get_settings().GOOGLE_MAPS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Geocoding is not configured on this server (GOOGLE_MAPS_API_KEY).")
    coords = await geocode_address(q)
    if not coords:
        return {"found": False}
    return {"found": True, "latitude": coords[0], "longitude": coords[1]}
