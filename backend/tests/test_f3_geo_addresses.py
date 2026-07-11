"""F3 — map-pin addresses + geocode proxy (upgrade_last TASK 3).

Regression contract: an address WITH coordinates finds nearby stores through
the 2dsphere path; an address WITHOUT coordinates is rejected clearly at
creation (never a silent empty match). The Google key lives server-side only,
behind GET /geo/forward.
"""

import asyncio

import httpx
from bson import ObjectId

from conftest import BASE, CUSTOMER_PHONE, STORE_ID


def _db_run(fn):
    from motor.motor_asyncio import AsyncIOMotorClient
    loop = asyncio.new_event_loop()
    try:
        client = AsyncIOMotorClient("mongodb://localhost:27017", io_loop=loop)
        try:
            return loop.run_until_complete(fn(client.washingbells))
        finally:
            client.close()
    finally:
        loop.close()


def _addr_body(**over):
    return {
        "label": "other", "full_address": "88, Sector 40",
        "city": "Gurugram", "state": "Haryana", "pincode": "122001",
        **over,
    }


def test_pinned_address_stores_geojson_and_matches_stores(customer):
    store = _db_run(lambda d: d.stores.find_one({"_id": ObjectId(STORE_ID)}))
    lat, lng = store["latitude"] + 0.01, store["longitude"] + 0.01  # ~1.5 km away

    r = customer.post("/addresses", json=_addr_body(
        latitude=lat, longitude=lng, location_source="map_pin"))
    assert r.status_code == 201, r.text[:300]
    created = r.json()
    assert created["location_source"] == "map_pin"

    # GeoJSON Point persisted ([lng, lat], same convention as stores)
    doc = _db_run(lambda d: d.addresses.find_one({"_id": ObjectId(created["id"])}))
    assert doc["location"] == {"type": "Point", "coordinates": [lng, lat]}

    # the pinned coordinates find the seeded store via the geo query
    nearby = customer.get("/stores/nearby", params={"lat": lat, "lng": lng}).json()
    assert any(s["id"] == STORE_ID for s in nearby), \
        "pinned address coordinates must match the nearby store"
    customer.client.delete(f"/addresses/{created['id']}")


def test_moving_pin_on_update_syncs_geojson(customer):
    r = customer.post("/addresses", json=_addr_body(
        latitude=28.47, longitude=77.03, location_source="gps"))
    assert r.status_code == 201, r.text[:300]
    aid = r.json()["id"]
    r = customer.put(f"/addresses/{aid}", json={
        "latitude": 28.5, "longitude": 77.1, "location_source": "map_pin"})
    assert r.status_code == 200, r.text[:300]
    doc = _db_run(lambda d: d.addresses.find_one({"_id": ObjectId(aid)}))
    assert doc["location"]["coordinates"] == [77.1, 28.5]
    assert doc["location_source"] == "map_pin"
    customer.client.delete(f"/addresses/{aid}")


def test_geo_forward_requires_auth():
    r = httpx.get(f"{BASE}/geo/forward", params={"q": "Sector 14 Gurugram"}, timeout=30)
    assert r.status_code in (401, 403)


def test_geo_forward_clear_error_or_result(customer):
    """Without GOOGLE_MAPS_API_KEY the proxy must say so (503), never return
    an empty-but-200 that reads like 'no such place'. With a key it returns
    found+coords."""
    r = customer.get("/geo/forward", params={"q": "MG Road, Gurugram"})
    assert r.status_code in (200, 503), r.text[:300]
    if r.status_code == 503:
        assert "GOOGLE_MAPS_API_KEY" in r.json()["detail"]
    else:
        body = r.json()
        assert body["found"] is True and isinstance(body["latitude"], float)


def test_geo_forward_rate_limited(customer):
    user = _db_run(lambda d: d.users.find_one({"phone": CUSTOMER_PHONE}))
    uid = str(user["_id"])
    _db_run(lambda d: d.geo_requests.delete_many({"user_id": uid}))
    last = None
    for _ in range(31):
        last = customer.get("/geo/forward", params={"q": "Sector 14"})
        if last.status_code == 429:
            break
    assert last.status_code == 429, "31 rapid lookups must trip the limiter"
    _db_run(lambda d: d.geo_requests.delete_many({"user_id": uid}))
