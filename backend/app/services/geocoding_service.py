"""Server-side geocoding (B2) — Google Geocoding API.

Customers must never be asked for latitude/longitude. The app captures GPS or
geocodes the typed address on-device; this service is the server-side net for
addresses that still arrive without coordinates (old builds, denied location
permission, admin-entered addresses).

Requires GOOGLE_MAPS_API_KEY. Unconfigured → returns None and the caller
stores the address without coordinates (checkout then explains that the
address couldn't be located instead of silently defaulting to a wrong city —
the old client fallback pinned everyone to Ludhiana).
"""

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


async def geocode_address(*parts: str | None) -> tuple[float, float] | None:
    """Geocode free-text address parts → (lat, lng), or None.

    India-biased (region=in). Never raises: geocoding failures must not block
    address creation.
    """
    text = ", ".join(p.strip() for p in parts if p and p.strip())
    if not text:
        return None
    if not settings.GOOGLE_MAPS_API_KEY:
        logger.info(f"[geocode] no GOOGLE_MAPS_API_KEY — skipping for {text!r}")
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(GEOCODE_URL, params={
                "address": text,
                "region": "in",
                "key": settings.GOOGLE_MAPS_API_KEY,
            })
        data = resp.json()
        status = data.get("status")
        if status != "OK" or not data.get("results"):
            logger.warning(f"[geocode] {status} for {text!r}")
            return None
        loc = data["results"][0]["geometry"]["location"]
        return float(loc["lat"]), float(loc["lng"])
    except Exception as e:
        logger.warning(f"[geocode] error for {text!r}: {e}")
        return None
