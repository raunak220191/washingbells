"""A7 — delivery slot is distinct from pickup and editable.

Client repro: pickup and delivery date/time showed identical values and
couldn't be edited. New app builds send a customer-picked delivery slot;
orders from OLD builds (delivery == pickup) get the standard turnaround
derived server-side instead of a rejection.
"""

from datetime import datetime, timedelta

from conftest import place_order, next_open_date, first_available_slot, STORE_ID


def test_legacy_identical_slots_get_derived_delivery(customer):
    order = place_order(customer, "cod")  # conftest sends delivery == pickup
    p, d = order["pickup_slot"], order["delivery_slot"]
    assert (d["date"], d["slot"]) != (p["date"], p["slot"]), \
        "delivery slot must never equal pickup slot"
    expected = (datetime.strptime(p["date"], "%Y-%m-%d") + timedelta(days=2)).strftime("%Y-%m-%d")
    assert d["date"] == expected


def test_customer_chosen_delivery_slot_is_preserved(customer):
    on_date = next_open_date()
    slot = first_available_slot(customer, STORE_ID, on_date)
    delivery_date = (datetime.strptime(on_date, "%Y-%m-%d") + timedelta(days=3))
    if delivery_date.weekday() == 6:  # stores closed Sunday
        delivery_date += timedelta(days=1)
    delivery_date = delivery_date.strftime("%Y-%m-%d")

    services = customer.get("/services").json()
    svc = services[0]
    customer.post("/cart/items", json={"service_id": svc["id"],
                                       "item_id": svc["items"][0]["id"], "quantity": 1})
    addr = customer.get("/addresses").json()[0]
    r = customer.post("/orders", json={
        "address_id": addr["id"],
        "pickup_slot": {"date": on_date, "slot": slot},
        "delivery_slot": {"date": delivery_date, "slot": slot},
        "payment_method": "cod",
        "store_id": STORE_ID,
    })
    assert r.status_code == 201, r.text[:300]
    order = r.json()
    assert order["delivery_slot"]["date"] == delivery_date


def test_delivery_slot_is_editable_after_placing(customer):
    order = place_order(customer, "cod")
    new_date = (datetime.strptime(order["pickup_slot"]["date"], "%Y-%m-%d")
                + timedelta(days=4))
    if new_date.weekday() == 6:
        new_date += timedelta(days=1)
    new_date = new_date.strftime("%Y-%m-%d")
    r = customer.put(f"/orders/{order['id']}/reschedule", json={
        "delivery_slot": {"date": new_date, "slot": order["pickup_slot"]["slot"]},
    })
    assert r.status_code == 200, r.text[:300]
    fresh = customer.get(f"/orders/{order['id']}").json()
    assert fresh["delivery_slot"]["date"] == new_date
    # A7: details payload carries payment status + full address
    assert fresh["payment_status"] in ("cod_pending", "pending", "paid")
    assert fresh["address"]["full_address"]
