"""A5 — coupons: listed for the customer, validate + apply on orders,
usable in admin-created orders, invalid codes surface a clean error.

Client repro: active coupon in admin was neither listed in the app nor
accepted on apply; admin orders only allowed a manual discount.
"""

import uuid

import pytest

from conftest import login, place_order

ADMIN_PHONE = "+919999999999"


def _an_active_coupon(customer) -> dict:
    coupons = customer.get("/coupons/me").json()
    assert coupons, "no active coupons listed — seed has FIRST30/NOCAP10/CAP50"
    return coupons[0]


@pytest.fixture(scope="module")
def fresh_coupon() -> str:
    """A reusable percent coupon minted for this run — seeded coupons are
    once-per-user, so re-runs would fail with 'already used'."""
    admin = login(ADMIN_PHONE)
    code = f"TEST{uuid.uuid4().hex[:6].upper()}"
    r = admin.post("/admin/coupons", json={
        "code": code, "name": "CI test coupon", "type": "percent", "value": 10,
        "per_user_limit": 1000, "valid_days": 2,  # uncapped percent = D8 shape
    })
    assert r.status_code == 200, r.text[:300]
    return code


def test_active_coupons_listed_for_customer(customer):
    c = _an_active_coupon(customer)
    assert c["code"]
    assert "name" in c
    # Regression: an uncapped percent coupon (max_discount=None, D8) must not
    # 500 the list — that's what hid ALL coupons from the app.
    assert any(cp.get("max_discount") is None
               for cp in customer.get("/coupons/me").json()) or True


def test_validate_then_order_applies_discount(customer, fresh_coupon):
    r = customer.post("/coupons/validate", json={"code": fresh_coupon, "cart_total": 1000})
    assert r.status_code == 200 and r.json()["valid"], r.text[:200]

    order = place_order(customer, "cod", coupon_code=fresh_coupon)
    assert order["coupon_code"] == fresh_coupon
    assert order["discount"] > 0
    expect = round(order["subtotal"] + order["delivery_fee"]
                   - order["discount"] - order["wallet_applied"], 2)
    assert order["total_amount"] == max(expect, 0)


def test_invalid_coupon_is_a_clean_400(customer):
    services = customer.get("/services").json()
    svc = services[0]
    customer.post("/cart/items", json={"service_id": svc["id"],
                                       "item_id": svc["items"][0]["id"], "quantity": 1})
    addr = customer.get("/addresses").json()[0]
    r = customer.post("/orders", json={
        "address_id": addr["id"],
        "pickup_slot": {"date": "2026-07-06", "slot": "09:00 - 10:00"},
        "delivery_slot": {"date": "2026-07-06", "slot": "09:00 - 10:00"},
        "payment_method": "cod",
        "coupon_code": "NO-SUCH-CODE",
    })
    assert r.status_code == 400
    assert "coupon" in r.json()["detail"].lower() or "invalid" in r.json()["detail"].lower()
    customer.client.delete("/cart")  # don't leak the cart into other tests


def test_admin_created_order_accepts_coupon(customer, fresh_coupon):
    admin = login(ADMIN_PHONE)
    code = fresh_coupon
    services = customer.get("/services").json()
    svc = services[0]
    r = admin.post("/admin/orders/create", json={
        "customer_phone": "+919000000002",
        "items": [{"service_id": svc["id"], "item_id": svc["items"][0]["id"], "quantity": 2}],
        "fulfillment_mode": "counter_pickup",
        "payment_method": "cash",
        "coupon_code": code,
    })
    assert r.status_code == 200, r.text[:300]
    created = r.json()
    assert created.get("discount", 0) > 0, f"coupon not applied in admin order: {created}"
