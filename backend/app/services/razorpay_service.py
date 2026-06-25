"""
Razorpay payments — WashingBells.

Talks to the Razorpay REST API directly via httpx (the official Python SDK
pins pkg_resources, which is removed in Python 3.13). Two operations:
  1. create_razorpay_order — POST /v1/orders with HTTP Basic auth.
  2. verify_razorpay_payment — HMAC-SHA256 signature check (no network).

If keys are not configured, falls back to a dev bypass (mock order +
auto-approve verify) so local flows work without credentials.
"""

import hmac
import hashlib
import base64
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

RAZORPAY_API = "https://api.razorpay.com/v1"


def _is_configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


def _auth_header() -> dict:
    token = base64.b64encode(
        f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}".encode()
    ).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


async def create_razorpay_order(amount_paise: int, receipt: str) -> dict | None:
    """Create a Razorpay order. Amount is in paise (₹100 = 10000 paise)."""
    if not _is_configured():
        # Dev bypass — return a mock order so checkout still works locally.
        logger.info(f"[DEV BYPASS] Razorpay not configured — mock order for {receipt}")
        return {
            "id": f"order_dev_{receipt}",
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "status": "created",
        }

    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,  # auto-capture on success
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{RAZORPAY_API}/orders", json=payload, headers=_auth_header()
            )
        if resp.status_code in (200, 201):
            return resp.json()
        logger.error(f"Razorpay create order failed: {resp.status_code} {resp.text}")
        return None
    except Exception as e:
        logger.error(f"Razorpay create order error: {e}")
        return None


async def verify_razorpay_payment(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify a Razorpay payment signature: HMAC_SHA256(order_id|payment_id, secret)."""
    if not _is_configured():
        # Dev bypass — accept when no keys are configured.
        return True

    if not (order_id and payment_id and signature):
        return False
    try:
        message = f"{order_id}|{payment_id}".encode()
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(), message, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception as e:
        logger.error(f"Razorpay verify error: {e}")
        return False
