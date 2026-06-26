"""
Twilio Verify — SMS & OTP service for WashingBells.

Replaces the previous MSG91 integration. OTP codes are generated, sent and
checked by Twilio Verify server-side, so the backend never stores or compares
codes locally.

Two modes:
  1. Configured (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_VERIFY_SERVICE_SID
     all set) — real OTP via Twilio Verify; invitation SMS via Twilio Messaging
     (needs TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER).
  2. Dev bypass (any Verify credential missing) — OTP is always 123456 and
     invitation SMS is logged to the console instead of being sent.

Credentials are SERVER-SIDE only — never shipped to the mobile apps. The apps
call our /auth/send-otp and /auth/verify-otp endpoints, which call this module.

Implemented against the Twilio REST API directly via httpx (already a project
dependency) to avoid pulling in the full `twilio` SDK.
"""

import logging
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

DEV_OTP = "123456"

VERIFY_BASE = "https://verify.twilio.com/v2"
API_BASE = "https://api.twilio.com/2010-04-01"


def _is_configured() -> bool:
    """True when the Twilio Verify credentials are all present."""
    return bool(
        settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_VERIFY_SERVICE_SID
    )


def _auth() -> tuple[str, str]:
    return (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def _to_e164(phone: str) -> str:
    """Normalize a stored phone to E.164 (+<countrycode><number>).

    Stored numbers are already like '+919876543210'. A bare 10-digit number
    gets the default country code prepended.
    """
    p = phone.strip().replace(" ", "")
    if p.startswith("+"):
        return p
    digits = "".join(ch for ch in p if ch.isdigit())
    if len(digits) == 10:
        digits = f"{settings.TWILIO_DEFAULT_COUNTRY_CODE}{digits}"
    return f"+{digits}"


async def send_otp(phone: str) -> bool:
    """Start a Twilio Verify verification (SMS channel), or use the dev bypass."""
    if not _is_configured():
        logger.info(f"[DEV BYPASS] OTP for {phone} → use code: {DEV_OTP}")
        return True

    to = _to_e164(phone)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{VERIFY_BASE}/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/Verifications",
                data={"To": to, "Channel": "sms"},
                auth=_auth(),
            )
        data = resp.json() if resp.content else {}
        if resp.status_code in (200, 201) and data.get("status") in ("pending", "approved"):
            logger.info(f"OTP sent to {to}: sid={data.get('sid')} status={data.get('status')}")
            return True
        logger.error(f"Twilio send_otp failed for {to}: {resp.status_code} {data}")
        return False
    except Exception as e:
        logger.error(f"Twilio send_otp error for {to}: {e}")
        return False


async def verify_otp(phone: str, code: str) -> bool:
    """Check an OTP via Twilio Verify VerificationCheck, or use the dev bypass."""
    if not _is_configured():
        return code == DEV_OTP

    to = _to_e164(phone)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{VERIFY_BASE}/Services/{settings.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck",
                data={"To": to, "Code": code},
                auth=_auth(),
            )
        data = resp.json() if resp.content else {}
        approved = resp.status_code in (200, 201) and data.get("status") == "approved"
        logger.info(f"OTP verify for {to}: status={data.get('status')}")
        return approved
    except Exception as e:
        # A 404 here means the code expired or was already consumed.
        logger.error(f"Twilio verify_otp error for {to}: {e}")
        return False


async def send_invite_sms(phone: str, role: str, name: str | None = None) -> bool:
    """Send an invitation SMS to an admin-created rider or store owner.

    Uses the Twilio Messaging API. Requires TWILIO_MESSAGING_SERVICE_SID or
    TWILIO_FROM_NUMBER to be set (in addition to account credentials). Falls
    back to a console log when Twilio is not configured for messaging.
    """
    role_label = "rider" if role == "rider" else "store owner"
    app_url = (
        settings.STORE_APP_INVITE_URL if role in ("store", "store_owner")
        else settings.RIDER_APP_INVITE_URL
    )
    greeting = name or "there"
    body = (
        f"Hi {greeting}, your WashingBells {role_label} account is ready. "
        f"Login at {app_url}"
    )

    account_ok = bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)
    sender_ok = bool(settings.TWILIO_MESSAGING_SERVICE_SID or settings.TWILIO_FROM_NUMBER)
    if not (account_ok and sender_ok):
        logger.info(f"[DEV BYPASS] Invitation SMS to {phone} ({role}): {body}")
        return True

    to = _to_e164(phone)
    form = {"To": to, "Body": body}
    if settings.TWILIO_MESSAGING_SERVICE_SID:
        form["MessagingServiceSid"] = settings.TWILIO_MESSAGING_SERVICE_SID
    else:
        form["From"] = settings.TWILIO_FROM_NUMBER

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{API_BASE}/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                data=form,
                auth=_auth(),
            )
        data = resp.json() if resp.content else {}
        if resp.status_code in (200, 201) and data.get("sid"):
            logger.info(f"Invitation SMS sent to {to}: sid={data.get('sid')}")
            return True
        logger.error(f"Twilio send_invite_sms failed for {to}: {resp.status_code} {data}")
        return False
    except Exception as e:
        logger.error(f"Twilio send_invite_sms error for {to}: {e}")
        return False
