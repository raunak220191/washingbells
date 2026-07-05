"""A6 — GST invoice PDF generates for online AND walk-in orders.

Client repro: bill failed to generate for walk-in store orders; on the
customer app the bill wouldn't open/download. The app opens/shares via
expo-print / expo-sharing (lib/invoice.js) — this locks the backend half:
a real PDF for both order sources, customer- and store-authorized.
"""

from conftest import place_order


def _assert_pdf(resp):
    assert resp.status_code == 200, resp.text[:200]
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF", "response is not a PDF"
    assert len(resp.content) > 500


def test_invoice_pdf_for_customer_order(customer, store_owner):
    order = place_order(customer, "cod")
    store_owner.post(f"/store-ops/orders/{order['id']}/accept")
    _assert_pdf(customer.get(f"/orders/{order['id']}/invoice/pdf"))
    # idempotent — second call re-renders the same invoice
    _assert_pdf(customer.get(f"/orders/{order['id']}/invoice/pdf"))


def test_invoice_pdf_for_walk_in_order(customer, store_owner):
    services = store_owner.get("/services").json()
    svc = services[0]
    r = store_owner.post("/store-ops/orders/walk-in", json={
        "customer_phone": "+919888800001",
        "customer_name": "Walk-in Test",
        "items": [{"service_id": svc["id"], "item_id": svc["items"][0]["id"], "quantity": 1}],
        "fulfillment_mode": "counter_pickup",
        "payment_method": "cash",
    })
    assert r.status_code == 200, r.text[:300]
    order_id = r.json().get("id") or r.json().get("order_id")
    assert order_id, f"no order id in walk-in response: {r.json()}"
    _assert_pdf(store_owner.get(f"/orders/{order_id}/invoice/pdf"))


def test_invoice_denied_for_other_customer(customer, store_owner):
    from conftest import login
    order = place_order(customer, "cod")
    other = login("+919000000003")
    r = other.get(f"/orders/{order['id']}/invoice/pdf")
    assert r.status_code == 403
