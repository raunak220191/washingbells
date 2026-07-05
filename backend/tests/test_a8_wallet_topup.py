"""A8 — wallet add-money via Razorpay works end to end.

Client repro: add-money flow was dead. Fixed in an earlier commit (top-up
intent persisted server-side, credited on verified signature); this locks it.
"""

import hashlib
import hmac

import yaml


def _key_secret():
    with open("dev.yaml") as f:
        return (yaml.safe_load(f) or {})["razorpay"]["key_secret"]


def test_wallet_topup_end_to_end(customer):
    before = customer.get("/wallet").json()["balance"]

    r = customer.post("/wallet/topup", json={"amount": 150})
    assert r.status_code == 200, r.text[:200]
    rz_order_id = r.json()["razorpay_order_id"]
    assert r.json()["amount"] == 15000  # paise

    payment_id = "pay_testA8topup"
    sig = hmac.new(_key_secret().encode(), f"{rz_order_id}|{payment_id}".encode(),
                   hashlib.sha256).hexdigest()
    r = customer.post("/wallet/topup/verify", json={
        "razorpay_order_id": rz_order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
    })
    assert r.status_code == 200, r.text[:200]
    assert r.json()["balance"] == before + 150

    # Idempotent: re-verifying the same top-up must not double-credit
    r = customer.post("/wallet/topup/verify", json={
        "razorpay_order_id": rz_order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": sig,
    })
    assert r.json()["balance"] == before + 150


def test_topup_rejects_bad_signature(customer):
    r = customer.post("/wallet/topup", json={"amount": 99})
    rz_order_id = r.json()["razorpay_order_id"]
    r = customer.post("/wallet/topup/verify", json={
        "razorpay_order_id": rz_order_id,
        "razorpay_payment_id": "pay_x",
        "razorpay_signature": "forged",
    })
    assert r.status_code == 400
