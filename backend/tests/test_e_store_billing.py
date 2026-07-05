"""Phase E backend — walk-in billing: fractional kg (E6), coupon/percent
discount (E5), garment-tag PDF (E2), deterministic item order (E3)."""

import uuid

from conftest import login, place_order

STORE_OWNER = "+919200000001"
ADMIN = "+919999999999"


def _kg_service(api):
    for svc in api.get("/services").json():
        if svc["pricing_unit"] == "kg" and svc["items"]:
            return svc
    return None


def test_e6_walk_in_accepts_fractional_kg():
    owner = login(STORE_OWNER)
    svc = _kg_service(owner)
    assert svc, "seed has no kg-priced service — check rate list"
    item = svc["items"][0]
    r = owner.post("/store-ops/orders/walk-in", json={
        "customer_phone": f"+9198765{uuid.uuid4().int % 100000:05d}",
        "customer_name": "Fractional Kg",
        "items": [{"service_id": svc["id"], "item_id": item["id"], "quantity": 1.3}],
        "fulfillment_mode": "counter_pickup",
        "payment_method": "cash",
    })
    assert r.status_code == 200, r.text[:300]
    order = r.json()
    li = order["items"][0] if isinstance(order.get("items"), list) else None
    if li:  # response includes items
        assert li["quantity"] == 1.3
        assert li["subtotal"] == round(item["price"] * 1.3, 2)


def test_e6_customer_cart_fractional_kg_and_whole_piece_rule(customer):
    svc = _kg_service(customer)
    assert svc
    r = customer.post("/cart/items", json={"service_id": svc["id"],
                                           "item_id": svc["items"][0]["id"], "quantity": 2.2})
    assert r.status_code == 200, r.text[:300]
    line = next(i for i in r.json()["items"]
                if i["item_id"] == svc["items"][0]["id"])
    assert line["quantity"] == 2.2
    customer.client.delete("/cart")

    piece = next(s for s in customer.get("/services").json() if s["pricing_unit"] != "kg")
    r = customer.post("/cart/items", json={"service_id": piece["id"],
                                           "item_id": piece["items"][0]["id"], "quantity": 1.5})
    assert r.status_code == 400
    customer.client.delete("/cart")


def test_e5_walk_in_percent_discount():
    owner = login(STORE_OWNER)
    svc = owner.get("/services").json()[0]
    r = owner.post("/store-ops/orders/walk-in", json={
        "customer_phone": f"+9198764{uuid.uuid4().int % 100000:05d}",
        "customer_name": "Discount Test",
        "items": [{"service_id": svc["id"], "item_id": svc["items"][0]["id"], "quantity": 2}],
        "fulfillment_mode": "counter_pickup",
        "payment_method": "cash",
        "discount_pct": 10,
    })
    assert r.status_code == 200, r.text[:300]
    order = r.json()
    assert order["discount"] == round(order["subtotal"] * 0.10, 2)
    assert order["total_amount"] == round(order["subtotal"] - order["discount"], 2)


def test_e2_garment_tags_pdf():
    owner = login(STORE_OWNER)
    admin = login(ADMIN)
    customer = login("+919000000001")
    order = place_order(customer, "cod")
    r = customer.get(f"/orders/{order['id']}/tags/pdf")
    assert r.status_code == 200, r.text[:200]
    assert r.content[:4] == b"%PDF"


def test_e3_items_order_is_deterministic(customer):
    a = [ (s["id"], [i["id"] for i in s["items"]]) for s in customer.get("/services").json() ]
    b = [ (s["id"], [i["id"] for i in s["items"]]) for s in customer.get("/services").json() ]
    assert a == b
