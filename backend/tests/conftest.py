"""Shared fixtures for WashingBells API integration tests.

These tests run against the LIVE local stack (uvicorn on :8000 + mongo on
:27017) — per project rule "test backends through the API". Start it first:
  docker start washingbells-mongo
  cd backend && ./venv/bin/python -m uvicorn main:app --port 8000
Seeded logins (scripts/seed_dummy_data.py): customers +919000000001..50,
store owners +919200000001.., password Test@1234 for all.
"""

from datetime import date, timedelta

import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

BASE = "http://localhost:8000/api/v1"
PASSWORD = "Test@1234"
CUSTOMER_PHONE = "+919000000001"
STORE_OWNER_PHONE = "+919200000001"
STORE_ID = "6a1fe3eba2a430151c6c7bf0"  # WashingBells Store 1 (seeded, Gurugram)


class Api:
    """Thin authenticated wrapper around httpx for one user session."""

    def __init__(self, token: str | None = None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.client = httpx.Client(base_url=BASE, headers=headers, timeout=30)

    def get(self, path, **kw):
        return self.client.get(path, **kw)

    def post(self, path, **kw):
        return self.client.post(path, **kw)

    def put(self, path, **kw):
        return self.client.put(path, **kw)


def login(phone: str) -> Api:
    r = httpx.post(f"{BASE}/auth/login-password",
                   json={"phone": phone, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login {phone} failed: {r.status_code} {r.text[:200]}"
    return Api(r.json()["access_token"])


@pytest.fixture(scope="session")
def customer() -> Api:
    return login(CUSTOMER_PHONE)


@pytest.fixture(scope="session")
def store_owner() -> Api:
    return login(STORE_OWNER_PHONE)


@pytest.fixture()
def db():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    yield client.washingbells
    client.close()


def next_open_date() -> str:
    """Tomorrow, skipping Sunday (seeded stores are closed Sundays)."""
    d = date.today() + timedelta(days=1)
    if d.weekday() == 6:
        d += timedelta(days=1)
    return d.isoformat()


def find_bookable_slot(api: Api, store_id: str) -> tuple[str, str]:
    """(date, slot) with capacity left, scanning up to 14 days ahead —
    repeated test runs book out earlier dates (capacity is 6/slot)."""
    d = date.today() + timedelta(days=1)
    for _ in range(14):
        if d.weekday() != 6:
            r = api.get(f"/stores/{store_id}/slots", params={"date": d.isoformat()})
            assert r.status_code == 200, r.text[:200]
            data = r.json()
            if not data.get("closed"):
                avail = [s for s in data["slots"] if s.get("available")]
                if avail:
                    return d.isoformat(), avail[0]["slot"]
        d += timedelta(days=1)
    raise AssertionError(f"no bookable slot in the next 14 days for store {store_id}")


def first_available_slot(api: Api, store_id: str, on_date: str) -> str:
    r = api.get(f"/stores/{store_id}/slots", params={"date": on_date})
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    assert not data.get("closed"), f"store closed on {on_date}: {data.get('closed_reason')}"
    avail = [s for s in data["slots"] if s.get("available")]
    assert avail, f"no available slots on {on_date}"
    return avail[0]["slot"]


def place_order(api: Api, payment_method: str, on_date: str | None = None,
                store_id: str = STORE_ID, **extra) -> dict:
    """Add one item to the cart and place an order the way the app does."""
    services = api.get("/services").json()
    svc = services[0]
    item = svc["items"][0]
    r = api.post("/cart/items", json={"service_id": svc["id"],
                                      "item_id": item["id"], "quantity": 1})
    assert r.status_code == 200, r.text[:200]
    addr = api.get("/addresses").json()[0]
    if on_date:
        slot = first_available_slot(api, store_id, on_date)
    else:
        on_date, slot = find_bookable_slot(api, store_id)
    r = api.post("/orders", json={
        "address_id": addr["id"],
        "pickup_slot": {"date": on_date, "slot": slot},
        "delivery_slot": {"date": on_date, "slot": slot},
        "payment_method": payment_method,
        "store_id": store_id,
        **extra,
    })
    assert r.status_code == 201, f"order create failed: {r.status_code} {r.text[:300]}"
    return r.json()
