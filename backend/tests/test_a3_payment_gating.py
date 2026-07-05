"""A3 — no confirmation (store queue / emails) until payment is real.

Client repro: placed a Pay Now order, never paid, still received an order
confirmation email. Now: online orders start `pending_payment`, are hidden
from the store queue, and notifications fire exactly once when Razorpay
confirms — via client /verify or the signed server webhook.
"""

import hashlib
import hmac
import json

import yaml
from bson import ObjectId

from conftest import place_order


def _razorpay_secrets():
    with open("dev.yaml") as f:
        rz = (yaml.safe_load(f) or {}).get("razorpay", {})
    return rz.get("key_secret", ""), rz.get("webhook_secret", "")


def _checkout_signature(rz_order_id: str, payment_id: str, key_secret: str) -> str:
    return hmac.new(key_secret.encode(), f"{rz_order_id}|{payment_id}".encode(),
                    hashlib.sha256).hexdigest()


def _store_queue_ids(store_owner) -> set:
    r = store_owner.get("/store-ops/orders")
    assert r.status_code == 200, r.text[:200]
    return {o["id"] for o in r.json()}


def test_online_order_hidden_until_verified_then_released(customer, store_owner):
    key_secret, _ = _razorpay_secrets()
    order = place_order(customer, "online")
    assert order["status"] == "pending_payment"
    assert order["id"] not in _store_queue_ids(store_owner), \
        "unpaid online order leaked into the store queue"

    # Pay: create a (test-mode) Razorpay order, then verify with a genuine
    # HMAC signature — the same computation Razorpay's checkout returns.
    r = customer.post("/payments/create", json={"order_id": order["id"]})
    assert r.status_code == 200, r.text[:200]
    rz_order_id = r.json()["razorpay_order_id"]
    payment_id = "pay_testA3verify"
    sig = _checkout_signature(rz_order_id, payment_id, key_secret)
    r = customer.post("/payments/verify", json={
        "order_id": order["id"], "razorpay_order_id": rz_order_id,
        "razorpay_payment_id": payment_id, "razorpay_signature": sig})
    assert r.status_code == 200, r.text[:200]
    assert r.json()["status"] == "placed"

    fresh = customer.get(f"/orders/{order['id']}").json()
    assert fresh["payment_status"] == "paid"
    assert fresh["status"] == "placed"
    assert order["id"] in _store_queue_ids(store_owner), \
        "paid order should appear in the store queue"


def test_webhook_confirms_payment_with_valid_signature(customer, store_owner, db):
    import asyncio
    _, webhook_secret = _razorpay_secrets()
    order = place_order(customer, "online")
    r = customer.post("/payments/create", json={"order_id": order["id"]})
    rz_order_id = r.json()["razorpay_order_id"]

    payload = json.dumps({
        "event": "payment.captured",
        "payload": {"payment": {"entity": {
            "id": "pay_testA3webhook", "order_id": rz_order_id,
            "amount": int(order["total_amount"] * 100), "status": "captured",
        }}},
    })
    # Bad signature → rejected, order untouched
    r = customer.post("/payments/webhook", content=payload,
                      headers={"X-Razorpay-Signature": "bogus",
                               "Content-Type": "application/json"})
    assert r.status_code == 400
    assert customer.get(f"/orders/{order['id']}").json()["status"] == "pending_payment"

    # Genuine signature → paid + released to store
    sig = hmac.new(webhook_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    r = customer.post("/payments/webhook", content=payload,
                      headers={"X-Razorpay-Signature": sig,
                               "Content-Type": "application/json"})
    assert r.status_code == 200, r.text[:200]
    assert r.json()["order_status"] == "placed"

    fresh = customer.get(f"/orders/{order['id']}").json()
    assert fresh["payment_status"] == "paid"
    assert order["id"] in _store_queue_ids(store_owner)

    # Notification fan-out is dispatched async — the claim marker lands within
    # moments of the webhook ack; poll briefly instead of asserting instantly.
    async def notified_at():
        doc = await db.orders.find_one({"_id": ObjectId(order["id"])})
        return doc.get("confirmation_notified_at")

    async def wait_notified():
        for _ in range(40):
            if await notified_at() is not None:
                return True
            await asyncio.sleep(0.25)
        return False
    assert asyncio.run(wait_notified()), "notification fan-out never claimed the order"


def test_cod_order_visible_to_store_immediately(customer, store_owner):
    order = place_order(customer, "cod")
    assert order["status"] == "placed"
    assert order["id"] in _store_queue_ids(store_owner)
