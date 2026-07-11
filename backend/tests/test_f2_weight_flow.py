"""F2 — Weight-based orders (upgrade_last TASK 2).

Customer orders a tentative kg qty → rider/store confirms on a scale via
PATCH /orders/{id}/items/{line_id}/weight → totals recompute + audit trail.
Live-stack tests (see conftest).
"""

import asyncio

import pytest
from bson import ObjectId

from conftest import STORE_ID, find_bookable_slot, login

RIDER_PHONE = "+919100000002"


def _db_run(fn):
    """Run one async DB op on a fresh Motor client — Motor binds a client to
    the first loop it runs on, so a shared client can't hop across the fresh
    loops each sync test call creates."""
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


@pytest.fixture(scope="module")
def rider():
    return login(RIDER_PHONE)


def place_kg_order(customer, extra_piece_item=False):
    """COD order with one kg line (tentative 3.0 kg), optionally + a piece line."""
    customer.client.delete("/cart")
    services = customer.get("/services").json()
    kg_svc = next(s for s in services if s.get("pricing_unit") == "kg" and s["items"])
    kg_item = kg_svc["items"][0]
    r = customer.post("/cart/items", json={"service_id": kg_svc["id"],
                                           "item_id": kg_item["id"], "quantity": 3.0})
    assert r.status_code == 200, r.text[:200]
    if extra_piece_item:
        piece_svc = next(s for s in services if s.get("pricing_unit") == "piece" and s["items"])
        r = customer.post("/cart/items", json={"service_id": piece_svc["id"],
                                               "item_id": piece_svc["items"][0]["id"], "quantity": 2})
        assert r.status_code == 200, r.text[:200]
    addr = customer.get("/addresses").json()[0]
    on_date, slot = find_bookable_slot(customer, STORE_ID)
    r = customer.post("/orders", json={
        "address_id": addr["id"],
        "pickup_slot": {"date": on_date, "slot": slot},
        "delivery_slot": {"date": on_date, "slot": slot},
        "payment_method": "cod", "store_id": STORE_ID,
    })
    assert r.status_code == 201, r.text[:300]
    return r.json(), kg_item


def to_rider_assigned(order_id, store_owner, rider_id):
    """placed → confirmed → rider_assigned_pickup (trip created)."""
    r = store_owner.post(f"/store-ops/orders/{order_id}/accept")
    assert r.status_code == 200, r.text[:200]
    _db_run(lambda d: d.users.update_one(
        {"_id": ObjectId(rider_id)},
        {"$set": {"rider_status": "online", "rider_approved": True}}))
    r = store_owner.post(f"/store-ops/orders/{order_id}/assign-pickup-rider",
                         json={"rider_id": rider_id})
    assert r.status_code == 200, r.text[:300]
    return r.json()["trip_id"]


@pytest.fixture(scope="module")
def rider_id():
    doc = _db_run(lambda d: d.users.find_one({"phone": RIDER_PHONE}))
    assert doc, "seeded rider missing — run scripts/seed_dummy_data.py"
    return str(doc["_id"])


def kg_line(order):
    return next(i for i in order["items"] if i["unit"] == "kg")


def test_kg_line_carries_weight_fields(customer):
    order, _ = place_kg_order(customer)
    line = kg_line(order)
    assert line["line_id"]
    assert line["tentative_qty"] == 3.0
    assert line["actual_qty"] is None
    assert line["quantity"] == 3.0


def test_rider_weighs_and_totals_recalculate(customer, store_owner, rider, rider_id):
    order, kg_item = place_kg_order(customer)
    to_rider_assigned(order["id"], store_owner, rider_id)
    line = kg_line(order)

    r = rider.client.patch(f"/orders/{order['id']}/items/{line['line_id']}/weight",
                           json={"actual_qty": 3.6})
    assert r.status_code == 200, r.text[:300]
    updated = r.json()
    uline = kg_line(updated)
    assert uline["actual_qty"] == 3.6 and uline["quantity"] == 3.6
    assert uline["tentative_qty"] == 3.0
    assert uline["weighed_by"]["role"] == "rider"
    assert uline["subtotal"] == round(kg_item["price"] * 3.6, 2)
    assert updated["subtotal"] == round(
        sum(i["subtotal"] for i in updated["items"]), 2)
    expected_total = round(max(
        updated["subtotal"] + updated["delivery_fee"] + updated.get("platform_fee_charged", 0)
        - updated["discount"] - updated.get("wallet_applied", 0), 0), 2)
    assert updated["total_amount"] == expected_total
    assert updated["total_amount"] > order["total_amount"]

    # customer sees the confirmed weight
    cust_view = customer.get(f"/orders/{order['id']}").json()
    assert kg_line(cust_view)["actual_qty"] == 3.6

    # GST/bill audit trail entry written
    doc = _db_run(lambda d: d.orders.find_one({"_id": ObjectId(order["id"])}))
    revs = [rv for rv in doc.get("bill_revisions", []) if rv.get("kind") == "weight_update"]
    assert revs and revs[-1]["before"]["quantity"] == 3.0 and revs[-1]["after"]["quantity"] == 3.6
    assert revs[-1]["by_role"] == "rider"


def test_weight_validation_rules(customer, store_owner, rider, rider_id):
    order, _ = place_kg_order(customer, extra_piece_item=True)
    to_rider_assigned(order["id"], store_owner, rider_id)
    line = kg_line(order)
    url = f"/orders/{order['id']}/items/{line['line_id']}/weight"
    assert rider.client.patch(url, json={"actual_qty": 0}).status_code == 400
    assert rider.client.patch(url, json={"actual_qty": 101}).status_code == 400
    assert rider.client.patch(url, json={"actual_qty": 3.65}).status_code == 400
    piece = next(i for i in order["items"] if i["unit"] != "kg")
    r = rider.client.patch(f"/orders/{order['id']}/items/{piece['line_id']}/weight",
                           json={"actual_qty": 2.0})
    assert r.status_code == 400  # piece lines are untouched by the weight flow
    assert rider.client.patch(f"/orders/{order['id']}/items/nope/weight",
                              json={"actual_qty": 2.0}).status_code == 404


def test_role_and_status_guards(customer, store_owner, rider):
    order, _ = place_kg_order(customer)
    line = kg_line(order)
    url = f"/orders/{order['id']}/items/{line['line_id']}/weight"
    # customer can never set weights
    assert customer.client.patch(url, json={"actual_qty": 3.0}).status_code == 403
    # order still 'placed' — outside the weighable window (store owner is on
    # the order's store, so the status check is what rejects)
    assert store_owner.client.patch(url, json={"actual_qty": 3.0}).status_code == 409
    # rider without a trip on this order
    assert rider.client.patch(url, json={"actual_qty": 3.0}).status_code == 403


def test_pickup_blocked_until_weighed_then_store_corrects(customer, store_owner, rider, rider_id):
    order, kg_item = place_kg_order(customer)
    trip_id = to_rider_assigned(order["id"], store_owner, rider_id)
    rider.post(f"/delivery/{trip_id}/accept")  # tolerated if already accepted
    r = rider.post(f"/delivery/{trip_id}/generate-pickup-otp")
    assert r.status_code == 200, r.text[:300]
    otp = _db_run(lambda d: d.orders.find_one({"_id": ObjectId(order["id"])})).get("pickup_otp")
    assert otp

    # OTP verify must refuse while the kg line is unweighed
    r = rider.post(f"/delivery/{trip_id}/verify-pickup-otp", json={"otp": otp})
    assert r.status_code == 400 and "eigh" in r.json()["detail"]

    line = kg_line(order)
    assert rider.client.patch(f"/orders/{order['id']}/items/{line['line_id']}/weight",
                              json={"actual_qty": 2.5}).status_code == 200
    r = rider.post(f"/delivery/{trip_id}/verify-pickup-otp", json={"otp": otp})
    assert r.status_code == 200, r.text[:300]

    # store re-verifies at the counter and corrects — same endpoint, new audit row
    r = store_owner.client.patch(f"/orders/{order['id']}/items/{line['line_id']}/weight",
                                 json={"actual_qty": 2.8})
    assert r.status_code == 200, r.text[:300]
    uline = kg_line(r.json())
    assert uline["actual_qty"] == 2.8 and uline["weighed_by"]["role"] == "store_owner"
    doc = _db_run(lambda d: d.orders.find_one({"_id": ObjectId(order["id"])}))
    revs = [rv for rv in doc.get("bill_revisions", []) if rv.get("kind") == "weight_update"]
    assert len(revs) == 2
    assert r.json()["subtotal"] == round(kg_item["price"] * 2.8, 2)
