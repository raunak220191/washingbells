"""B1 — store matching honours the STORE's serviceable radius via 2dsphere.

Client repro: store radius set to 30 km, customer well within it, store never
matched (the app's hardcoded 15 km search radius overrode it). Boundary tests
use a throwaway store at a known point with geo_radius_km=30.

1° of latitude ≈ 111.32 km, so 0.25° ≈ 27.8 km (inside) and 0.30° ≈ 33.4 km
(outside) — clean boundary probes without geodesy in the test.
"""

import asyncio
import uuid

import pytest

BASE_LAT, BASE_LNG = 26.50, 74.50  # empty patch of Rajasthan — no seeded stores


@pytest.fixture()
def geo_store(db):
    """Throwaway active store with a 30 km serviceable radius."""
    name = f"GeoTest-{uuid.uuid4().hex[:6]}"

    async def make():
        res = await db.stores.insert_one({
            "vendor_code": name, "name": name,
            "address": "x", "city": "x", "phone": "x", "whatsapp": "x",
            "latitude": BASE_LAT, "longitude": BASE_LNG,
            "location": {"type": "Point", "coordinates": [BASE_LNG, BASE_LAT]},
            "geo_radius_km": 30, "status": "active", "is_open": True,
        })
        return res.inserted_id

    async def cleanup(_id):
        await db.stores.delete_one({"_id": _id})

    loop = asyncio.new_event_loop()
    _id = loop.run_until_complete(make())
    yield str(_id)
    loop.run_until_complete(cleanup(_id))
    loop.close()


def _nearby(customer, lat, lng):
    r = customer.get("/stores/nearby", params={"lat": lat, "lng": lng})
    assert r.status_code == 200, r.text[:200]
    return r.json()


def test_customer_inside_30km_is_matched(customer, geo_store):
    # ~27.8 km north of the store — inside its 30 km radius
    stores = _nearby(customer, BASE_LAT + 0.25, BASE_LNG)
    match = next((s for s in stores if s["id"] == geo_store), None)
    assert match, "store with 30km radius must match a customer ~28km away"
    assert 26 < match["distance_km"] < 30


def test_customer_outside_30km_is_not_matched(customer, geo_store):
    # ~33.4 km north — outside the 30 km radius
    stores = _nearby(customer, BASE_LAT + 0.30, BASE_LNG)
    assert all(s["id"] != geo_store for s in stores)


def test_results_sorted_nearest_first(customer):
    # Seeded Gurgaon cluster — verifies ordering and that lat/lng aren't swapped
    stores = _nearby(customer, 28.4635, 77.0306)
    assert stores, "seeded Gurgaon stores should match their own location"
    dists = [s["distance_km"] for s in stores]
    assert dists == sorted(dists)
    assert dists[0] < 1.0  # the co-located store is first


def test_client_radius_param_is_ignored(customer, geo_store):
    # Old app builds send radius=15 — it must NOT hide a 30km-radius store
    r = customer.get("/stores/nearby",
                     params={"lat": BASE_LAT + 0.25, "lng": BASE_LNG, "radius": 15})
    assert r.status_code == 200
    assert any(s["id"] == geo_store for s in r.json())
