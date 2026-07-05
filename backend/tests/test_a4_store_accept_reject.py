"""A4 — new COD order reaches the store and accept/reject works end to end.

Client repro: customer placed a COD order; store app showed nothing to
accept. Store visibility is immediate on the API (poll fallback tightened to
10s in the store app; push fires at creation).
"""

from conftest import place_order


def test_cod_order_accept_flow(customer, store_owner):
    order = place_order(customer, "cod")

    queue = store_owner.get("/store-ops/orders", params={"status_filter": "placed"}).json()
    assert any(o["id"] == order["id"] for o in queue), "COD order missing from store queue"

    r = store_owner.post(f"/store-ops/orders/{order['id']}/accept")
    assert r.status_code == 200, r.text[:200]

    fresh = customer.get(f"/orders/{order['id']}").json()
    assert fresh["status"] == "confirmed"


def test_cod_order_reject_flow(customer, store_owner):
    order = place_order(customer, "cod")

    r = store_owner.post(f"/store-ops/orders/{order['id']}/reject",
                         json={"reason": "Machine breakdown — cannot take load"})
    assert r.status_code == 200, r.text[:200]

    fresh = customer.get(f"/orders/{order['id']}").json()
    assert fresh["status"] == "rejected"
    assert any(t["status"] == "rejected" for t in fresh["status_timeline"])


def test_accept_requires_placed_status(customer, store_owner):
    order = place_order(customer, "online")  # pending_payment — not accepted yet
    r = store_owner.post(f"/store-ops/orders/{order['id']}/accept")
    assert r.status_code == 400, "store must not accept an unpaid online order"
