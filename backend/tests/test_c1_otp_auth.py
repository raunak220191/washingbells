"""C1/C2 — OTP auth flow and the dev-bypass gate.

Prod root cause (C1): Cloud Run has NO Twilio credentials (only stale MSG91
config) and OTP_DEV_BYPASS=true — no SMS was ever sent, and any account could
be entered with the hardcoded 123456. The bypass is now refused unless DEBUG
is also true, so it can never be active on a production deployment.

Local stack runs with DEBUG=true and Twilio unconfigured-or-401, so the
bypass path is what's exercised here.
"""

import uuid

import httpx

from conftest import BASE


def test_otp_send_and_verify_dev_bypass_registers_user():
    phone = f"+9176543{uuid.uuid4().int % 100000:05d}"
    r = httpx.post(f"{BASE}/auth/send-otp", json={"phone": phone}, timeout=30)
    assert r.status_code == 200, r.text[:200]

    r = httpx.post(f"{BASE}/auth/verify-otp", json={"phone": phone, "code": "123456"}, timeout=30)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    assert data["is_new_user"] is True
    assert data["access_token"]

    # Existing user second time around (C2: flow proceeds for both cases)
    r = httpx.post(f"{BASE}/auth/verify-otp", json={"phone": phone, "code": "123456"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["is_new_user"] is False


def test_wrong_otp_is_a_clean_400():
    phone = f"+9176542{uuid.uuid4().int % 100000:05d}"
    httpx.post(f"{BASE}/auth/send-otp", json={"phone": phone}, timeout=30)
    r = httpx.post(f"{BASE}/auth/verify-otp", json={"phone": phone, "code": "000000"}, timeout=30)
    assert r.status_code == 400
    assert "otp" in r.json()["detail"].lower()


def test_otp_resend_cooldown():
    phone = f"+9176541{uuid.uuid4().int % 100000:05d}"
    r1 = httpx.post(f"{BASE}/auth/send-otp", json={"phone": phone}, timeout=30)
    assert r1.status_code == 200
    r2 = httpx.post(f"{BASE}/auth/send-otp", json={"phone": phone}, timeout=30)
    assert r2.status_code == 429  # 25s resend cooldown


def test_bypass_requires_debug_flag():
    """The gate itself: OTP_DEV_BYPASS without DEBUG must refuse the bypass."""
    from unittest.mock import patch
    import asyncio
    import app.services.twilio_service as ts

    with patch.object(ts.settings, "OTP_DEV_BYPASS", True), \
         patch.object(ts.settings, "DEBUG", False), \
         patch.object(ts.settings, "TWILIO_ACCOUNT_SID", ""):
        assert ts._dev_bypass_active() is False
        assert asyncio.run(ts.verify_otp("+919999911111", "123456")) is False

    with patch.object(ts.settings, "OTP_DEV_BYPASS", True), \
         patch.object(ts.settings, "DEBUG", True), \
         patch.object(ts.settings, "TWILIO_ACCOUNT_SID", ""):
        assert asyncio.run(ts.verify_otp("+919999911111", "123456")) is True
