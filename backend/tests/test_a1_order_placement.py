"""A1 — order placement succeeds via both payment modes (regression).

Client report (April–June 2026): neither Pay Now nor Pay on Delivery placed
an order. Root causes fixed in earlier commits (opaque 500s from malformed
ObjectIds, percent-coupon crash); this locks the flow green.
"""

from conftest import place_order


def test_cod_order_places_and_enters_store_queue(customer):
    order = place_order(customer, "cod")
    assert order["status"] == "placed"
    assert order["payment_status"] == "cod_pending"
    assert order["order_number"].startswith("WB-")
    assert order["total_amount"] > 0


def test_online_order_places_as_pending_payment(customer):
    order = place_order(customer, "online")
    # A3: an unpaid online order must NOT enter the store queue as "placed"
    assert order["status"] == "pending_payment"
    assert order["payment_status"] == "pending"


def test_order_appears_in_customer_history(customer):
    order = place_order(customer, "cod")
    listed = customer.get("/orders").json()
    assert any(o["id"] == order["id"] for o in listed)
