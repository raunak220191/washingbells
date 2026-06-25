"""
MSG91 SMS & OTP Service — WashingBells
Replaces the previous Twilio integration.

Two modes:
  1. Configured (MSG91_AUTH_KEY set in dev.yaml) — real OTP/SMS via MSG91.
  2. Dev bypass (auth key empty) — OTP is always 123456 and invitation SMS
     is logged to the console instead of being sent.

OTP codes are generated, sent and verified by the MSG91 OTP service itself,
so the backend never stores or checks codes locally.
"""

import logging
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

DEV_OTP = "123456"


def _is_configured() -> bool:
    """Return True if a MSG91 auth key is configured."""
    return bool(settings.MSG91_AUTH_KEY)


def _normalize_mobile(phone: str) -> str:
    """Convert a stored phone (e.g. '+919876543210') to MSG91 format.

    MSG91 expects digits only, country code first, no leading '+'.
    A bare 10-digit number gets the default country code prepended.
    """
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 10:
        digits = f"{settings.MSG91_DEFAULT_COUNTRY_CODE}{digits}"
    return digits


def _headers() -> dict:
    return {
        "authkey": settings.MSG91_AUTH_KEY,
        "Content-Type": "application/json",
        "accept": "application/json",
    }


async def send_otp(phone: str) -> bool:
    """Send an OTP via the MSG91 OTP service, or use the dev bypass."""
    if not _is_configured():
        logger.info(f"[DEV BYPASS] OTP for {phone} → use code: {DEV_OTP}")
        return True

    mobile = _normalize_mobile(phone)
    params = {
        "mobile": mobile,
        "otp_length": settings.MSG91_OTP_LENGTH,
        "otp_expiry": settings.MSG91_OTP_EXPIRY_MINUTES,
    }
    if settings.MSG91_OTP_TEMPLATE_ID:
        params["template_id"] = settings.MSG91_OTP_TEMPLATE_ID
    if settings.MSG91_SENDER_ID:
        params["sender"] = settings.MSG91_SENDER_ID

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.MSG91_BASE_URL}/otp",
                params=params,
                headers=_headers(),
            )
        data = resp.json() if resp.content else {}
        if resp.status_code == 200 and data.get("type") == "success":
            logger.info(f"OTP sent to {mobile}: request_id={data.get('request_id')}")
            return True
        logger.error(f"MSG91 send_otp failed for {mobile}: {resp.status_code} {data}")
        return False
    except Exception as e:
        logger.error(f"MSG91 send_otp error for {mobile}: {e}")
        return False


async def verify_otp(phone: str, code: str) -> bool:
    """Verify an OTP via the MSG91 OTP service, or use the dev bypass."""
    if not _is_configured():
        return code == DEV_OTP

    mobile = _normalize_mobile(phone)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{settings.MSG91_BASE_URL}/otp/verify",
                params={"mobile": mobile, "otp": code},
                headers=_headers(),
            )
        data = resp.json() if resp.content else {}
        approved = resp.status_code == 200 and data.get("type") == "success"
        logger.info(f"OTP verify for {mobile}: type={data.get('type')} msg={data.get('message')}")
        return approved
    except Exception as e:
        logger.error(f"MSG91 verify_otp error for {mobile}: {e}")
        return False


async def send_invite_sms(phone: str, role: str, name: str | None = None) -> bool:
    """Send an invitation SMS to an admin-created rider or store owner.

    Uses the MSG91 Flow API with a DLT-approved template that exposes the
    variables `name`, `role` and `url`. Falls back to a console log when
    MSG91 is not configured. Returns True on send (or dev-log), False on error.
    """
    role_label = "rider" if role == "rider" else "store owner"
    app_url = (
        settings.STORE_APP_INVITE_URL if role in ("store", "store_owner")
        else settings.RIDER_APP_INVITE_URL
    )
    greeting = name or "there"

    if not _is_configured():
        logger.info(
            f"[DEV BYPASS] Invitation SMS to {phone} ({role}): "
            f"Hi {greeting}, your WashingBells {role_label} account is ready. Login at {app_url}"
        )
        return True

    if not settings.MSG91_INVITE_TEMPLATE_ID:
        logger.warning(
            "No MSG91 invite template configured (set msg91.invite_template_id in "
            f"dev.yaml). Skipping invitation SMS to {phone}."
        )
        return True

    mobile = _normalize_mobile(phone)
    payload = {
        "template_id": settings.MSG91_INVITE_TEMPLATE_ID,
        "short_url": "0",
        "recipients": [
            {
                "mobiles": mobile,
                "name": greeting,
                "role": role_label,
                "url": app_url,
            }
        ],
    }
    if settings.MSG91_SENDER_ID:
        payload["sender"] = settings.MSG91_SENDER_ID

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.MSG91_BASE_URL}/flow",
                json=payload,
                headers=_headers(),
            )
        data = resp.json() if resp.content else {}
        if resp.status_code == 200 and data.get("type") == "success":
            logger.info(f"Invitation SMS sent to {mobile}: {data.get('message')}")
            return True
        logger.error(f"MSG91 send_invite_sms failed for {mobile}: {resp.status_code} {data}")
        return False
    except Exception as e:
        logger.error(f"MSG91 send_invite_sms error for {mobile}: {e}")
        return False
