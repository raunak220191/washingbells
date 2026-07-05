"""Email Service — SendGrid integration with template rendering and audit log.

Safe degradation:
  - If EMAIL_ENABLED is False or SENDGRID_API_KEY is empty, emails are logged
    to console + written to email_log with status="dev_logged" instead of sent.
  - If a recipient has no email on file, the send is skipped with status="no_address".
  - If SendGrid returns an error, it's logged with status="failed" and the
    triggering operation does not raise — push notifications still work.

Per-event toggles live in the `email_settings` collection. Each event document:
  {
    "event":            "order_placed",      # unique key
    "name":             "Order Placed",       # display label
    "audience":         "customer" | "store" | "rider" | "admin",
    "enabled":          true,
    "subject_template": "Order {{order_number}} placed",
    "body_html":        "<p>Hi {{customer_name}}, ...</p>",
    "body_text":        "Hi {{customer_name}}, ...",
    "updated_at":       datetime,
  }

Template syntax: Jinja2. Pass a `context` dict when calling send_event(...).
"""

import asyncio
import logging
import hmac
import hashlib
import base64
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from jinja2 import Environment, BaseLoader, TemplateError, select_autoescape
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, ReplyTo
from app.core.config import get_settings
from app.core.database import get_db

logger = logging.getLogger(__name__)
settings = get_settings()

# Jinja env shared across renders — autoescape protects HTML body, the
# subject + plain-text body are explicitly NOT escaped (we strip tags
# separately if a user pastes HTML into the subject).
_jinja_env_html = Environment(
    loader=BaseLoader(),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)
_jinja_env_text = Environment(
    loader=BaseLoader(),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)


def _is_configured() -> bool:
    return bool(settings.EMAIL_ENABLED and settings.SENDGRID_API_KEY and settings.EMAIL_FROM_ADDRESS)


# ── Unsubscribe tokens ─────────────────────────────────────────

# Audiences that we honour unsubscribe for. Transactional emails to riders /
# store owners / admin still send even if the address is on the suppression
# list (legally permitted in India for service notifications).
SUPPRESSIBLE_AUDIENCES = {"customer"}


def _unsub_secret() -> bytes:
    return (settings.JWT_SECRET_KEY or "dev-secret").encode("utf-8")


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def make_unsubscribe_token(email: str) -> str:
    """Sign the address so a click-to-unsubscribe link can't be forged."""
    e = (email or "").strip().lower().encode("utf-8")
    sig = hmac.new(_unsub_secret(), e, hashlib.sha256).digest()[:16]
    return _b64url(e) + "." + _b64url(sig)


def verify_unsubscribe_token(token: str) -> Optional[str]:
    """Return the email if the token is valid, otherwise None."""
    try:
        parts = (token or "").split(".")
        if len(parts) != 2:
            return None
        email = _b64url_decode(parts[0]).decode("utf-8")
        expected = hmac.new(_unsub_secret(), email.encode("utf-8"), hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(_b64url_decode(parts[1]), expected):
            return None
        return email
    except Exception:
        return None


async def is_unsubscribed(db, email: str) -> bool:
    if not email:
        return False
    doc = await db.unsubscribed_emails.find_one({"email": email.lower()})
    return bool(doc)


async def record_unsubscribe(db, email: str, source: str = "link") -> None:
    if not email:
        return
    now = datetime.now(timezone.utc)
    await db.unsubscribed_emails.update_one(
        {"email": email.lower()},
        {"$set": {"email": email.lower(), "source": source, "unsubscribed_at": now},
         "$setOnInsert": {"created_at": now}},
        upsert=True,
    )


async def record_resubscribe(db, email: str) -> None:
    if not email:
        return
    await db.unsubscribed_emails.delete_one({"email": email.lower()})


def _public_base_url() -> str:
    """Best-effort public URL for unsubscribe links."""
    return (
        getattr(settings, "PUBLIC_BASE_URL", "")
        or getattr(settings, "API_BASE_URL", "")
        or "http://localhost:8000"
    )


def _build_unsubscribe_url(email: str) -> str:
    token = make_unsubscribe_token(email)
    return f"{_public_base_url().rstrip('/')}/api/v1/email/unsubscribe?token={token}"


def _append_unsubscribe_footer(html: str, text: str, email: str) -> tuple[str, str]:
    url = _build_unsubscribe_url(email)
    html_footer = (
        '<hr style="margin-top:32px;border:none;border-top:1px solid #eee" />'
        '<p style="font-size:11px;color:#888;margin-top:12px">'
        f'You received this because you have a WashingBells account. '
        f'<a href="{url}" style="color:#888">Unsubscribe from non-essential emails</a>.'
        '</p>'
    )
    text_footer = (
        "\n\n— — —\n"
        "You received this because you have a WashingBells account.\n"
        f"To unsubscribe: {url}"
    )
    return (html or "") + html_footer, (text or "") + text_footer


def _render(env: Environment, template: str, context: dict) -> str:
    try:
        return env.from_string(template or "").render(**(context or {}))
    except TemplateError as e:
        logger.warning(f"Email template render error: {e}")
        return template or ""


async def _audit(db, *, event: str, audience: str, to_email: Optional[str],
                 subject: str, status: str, error: Optional[str] = None,
                 user_id: Optional[str] = None, order_id: Optional[str] = None) -> None:
    try:
        await db.email_log.insert_one({
            "event": event,
            "audience": audience,
            "to": to_email,
            "subject": subject,
            "status": status,         # sent | dev_logged | no_address | disabled | failed | no_template
            "error": error,
            "user_id": user_id,
            "order_id": order_id,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.error(f"email_log insert failed: {e}")


async def _send_via_sendgrid(to_email: str, subject: str, html: str, text: str) -> tuple[bool, Optional[str]]:
    """Returns (sent_ok, error_message)."""
    try:
        message = Mail(
            from_email=Email(settings.EMAIL_FROM_ADDRESS, settings.EMAIL_FROM_NAME or None),
            to_emails=To(to_email),
            subject=subject or "(no subject)",
            html_content=html or text or "",
            plain_text_content=text or None,
        )
        if settings.EMAIL_REPLY_TO:
            message.reply_to = ReplyTo(settings.EMAIL_REPLY_TO)
        client = SendGridAPIClient(settings.SENDGRID_API_KEY)
        # The SendGrid SDK is synchronous — calling it inline blocked uvicorn's
        # ENTIRE event loop for the full API round-trip (~16s observed), which
        # froze every concurrent request (orders, store accept, everything).
        response = await asyncio.to_thread(client.send, message)
        if 200 <= response.status_code < 300:
            return True, None
        return False, f"SendGrid HTTP {response.status_code}: {response.body}"
    except Exception as e:
        return False, str(e)


async def get_event_settings(event: str) -> Optional[dict]:
    """Fetch the per-event config doc, returning None if not set."""
    db = get_db()
    return await db.email_settings.find_one({"event": event})


async def send_custom(
    *,
    to_email: str,
    subject: str,
    body_html: str = "",
    body_text: str = "",
    sender_user_id: Optional[str] = None,
    audience: str = "admin",
) -> tuple[bool, Optional[str]]:
    """One-off email send (no per-event template). Used by /admin/email/compose.

    Audit row carries event="custom".
    Returns (sent_ok, error_message).
    """
    db = get_db()
    to_email = (to_email or "").strip()
    if not to_email:
        return False, "Recipient email required"
    if not subject:
        subject = "(no subject)"

    if audience in SUPPRESSIBLE_AUDIENCES and await is_unsubscribed(db, to_email):
        await _audit(db, event="custom", audience=audience, to_email=to_email,
                     subject=subject, status="suppressed", user_id=sender_user_id)
        return False, "Recipient has unsubscribed"

    # Auto-append unsubscribe footer for customer audience
    if audience in SUPPRESSIBLE_AUDIENCES:
        body_html, body_text = _append_unsubscribe_footer(body_html, body_text, to_email)

    if not _is_configured():
        logger.info(f"[EMAIL DEV-LOG] custom to={to_email} subject={subject!r}")
        await _audit(db, event="custom", audience=audience, to_email=to_email,
                     subject=subject, status="dev_logged", user_id=sender_user_id)
        return True, None

    sent, err = await _send_via_sendgrid(to_email, subject, body_html, body_text)
    await _audit(db, event="custom", audience=audience, to_email=to_email,
                 subject=subject, status="sent" if sent else "failed",
                 error=err, user_id=sender_user_id)
    return sent, err


async def send_event(
    event: str,
    *,
    to_email: Optional[str],
    context: Optional[dict] = None,
    audience: str = "customer",
    user_id: Optional[str] = None,
    order_id: Optional[str] = None,
    override_enabled: bool = False,
) -> bool:
    """Render and send an event email.

    Looks up `email_settings` by event key. If the event is disabled or has no
    template, returns silently (logged in email_log). Never raises — caller's
    flow is unaffected by email failures.

    Set `override_enabled=True` for an admin-triggered "send test" that
    bypasses the enabled toggle.
    """
    db = get_db()
    cfg = await get_event_settings(event)
    if not cfg:
        await _audit(db, event=event, audience=audience, to_email=to_email,
                     subject="", status="no_template", user_id=user_id, order_id=order_id)
        return False
    if not override_enabled and not cfg.get("enabled", False):
        await _audit(db, event=event, audience=audience, to_email=to_email,
                     subject="", status="disabled", user_id=user_id, order_id=order_id)
        return False
    if not to_email:
        await _audit(db, event=event, audience=audience, to_email=None,
                     subject="", status="no_address", user_id=user_id, order_id=order_id)
        return False

    # Honour the suppression list for customer-facing emails
    if audience in SUPPRESSIBLE_AUDIENCES and await is_unsubscribed(db, to_email):
        await _audit(db, event=event, audience=audience, to_email=to_email,
                     subject="", status="suppressed", user_id=user_id, order_id=order_id)
        return False

    ctx = context or {}
    subject = _render(_jinja_env_text, cfg.get("subject_template", ""), ctx)
    body_html = _render(_jinja_env_html, cfg.get("body_html", ""), ctx)
    body_text = _render(_jinja_env_text, cfg.get("body_text", ""), ctx)

    # Append unsubscribe footer for customer audience
    if audience in SUPPRESSIBLE_AUDIENCES:
        body_html, body_text = _append_unsubscribe_footer(body_html, body_text, to_email)

    if not _is_configured():
        logger.info(f"[EMAIL DEV-LOG] event={event} to={to_email} subject={subject!r}")
        await _audit(db, event=event, audience=audience, to_email=to_email,
                     subject=subject, status="dev_logged", user_id=user_id, order_id=order_id)
        return True  # treat as success in dev so callers don't retry

    sent, err = await _send_via_sendgrid(to_email, subject, body_html, body_text)
    await _audit(db, event=event, audience=audience, to_email=to_email,
                 subject=subject, status="sent" if sent else "failed",
                 error=err, user_id=user_id, order_id=order_id)
    if not sent:
        logger.warning(f"Email send failed event={event} to={to_email}: {err}")
    return sent


def admin_addresses() -> list[str]:
    """EMAIL_ADMIN_ADDRESS supports a comma-separated list of recipients."""
    raw = get_settings().EMAIL_ADMIN_ADDRESS or ""
    return [a.strip() for a in raw.split(",") if a.strip()]


async def send_event_to_admins(event: str, *, context: Optional[dict] = None,
                               order_id: Optional[str] = None) -> bool:
    """Send an admin-audience event to every configured admin address.

    One send_event per recipient so each gets its own email_log row. Returns
    True if at least one send succeeded. Never raises.
    """
    ok = False
    for addr in admin_addresses():
        try:
            if await send_event(event, to_email=addr, context=context,
                                audience="admin", order_id=order_id):
                ok = True
        except Exception as e:
            logger.warning(f"Admin email {event} to {addr} failed: {e}")
    return ok


# ── Default event seed data ────────────────────────────────────

DEFAULT_EVENTS: list[dict] = [
    {
        "event": "order_placed", "audience": "customer", "enabled": True,
        "name": "Order Placed (Customer)",
        "subject_template": "Order {{order_number}} placed — WashingBells",
        "body_html": "<p>Hi {{customer_name}},</p>"
                     "<p>Your laundry order <strong>{{order_number}}</strong> has been placed successfully. "
                     "The total is <strong>₹{{total_amount}}</strong>.</p>"
                     "<p>We'll notify you as soon as a store accepts your order.</p>"
                     "<p>Thanks,<br/>Team WashingBells</p>",
        "body_text": "Hi {{customer_name}},\n\nYour laundry order {{order_number}} has been placed. "
                     "Total: ₹{{total_amount}}.\n\nWe'll notify you when a store accepts it.\n\nThanks,\nTeam WashingBells",
    },
    {
        "event": "order_confirmed", "audience": "customer", "enabled": True,
        "name": "Order Confirmed (Customer)",
        "subject_template": "Order {{order_number}} confirmed",
        "body_html": "<p>Hi {{customer_name}},</p>"
                     "<p>Your order <strong>{{order_number}}</strong> has been confirmed by {{store_name}}. "
                     "A rider will be assigned for pickup at {{pickup_slot}}.</p>"
                     "<p>Thanks,<br/>Team WashingBells</p>",
        "body_text": "Hi {{customer_name}},\n\nYour order {{order_number}} has been confirmed by {{store_name}}. "
                     "Pickup scheduled for {{pickup_slot}}.\n\nThanks,\nTeam WashingBells",
    },
    {
        "event": "order_picked_up", "audience": "customer", "enabled": True,
        "name": "Order Picked Up (Customer)",
        "subject_template": "Your laundry is on its way to {{store_name}}",
        "body_html": "<p>Hi {{customer_name}},</p>"
                     "<p>Your order <strong>{{order_number}}</strong> has been picked up. "
                     "We'll get it processed and delivered back to you soon.</p>"
                     "<p>Thanks,<br/>Team WashingBells</p>",
        "body_text": "Hi {{customer_name}},\n\nYour order {{order_number}} has been picked up.\n\nThanks,\nTeam WashingBells",
    },
    {
        "event": "order_ready", "audience": "customer", "enabled": True,
        "name": "Order Ready for Delivery (Customer)",
        "subject_template": "Your order {{order_number}} is ready",
        "body_html": "<p>Hi {{customer_name}},</p>"
                     "<p>Your order <strong>{{order_number}}</strong> is ready! "
                     "A delivery rider will be assigned shortly to bring it back to you.</p>"
                     "<p>Thanks,<br/>Team WashingBells</p>",
        "body_text": "Hi {{customer_name}},\n\nOrder {{order_number}} is ready. "
                     "Delivery rider will be assigned shortly.\n\nThanks,\nTeam WashingBells",
    },
    {
        "event": "order_delivered", "audience": "customer", "enabled": True,
        "name": "Order Delivered (Customer)",
        "subject_template": "Order {{order_number}} delivered — how was your experience?",
        "body_html": "<p>Hi {{customer_name}},</p>"
                     "<p>Your order <strong>{{order_number}}</strong> has been delivered. "
                     "We hope everything is in great condition!</p>"
                     "<p>Thanks for choosing WashingBells.</p>",
        "body_text": "Hi {{customer_name}},\n\nOrder {{order_number}} has been delivered. "
                     "Thanks for choosing WashingBells.",
    },
    {
        "event": "new_order_for_store", "audience": "store", "enabled": True,
        "name": "New Order (Store Owner)",
        "subject_template": "New order received — {{order_number}}",
        "body_html": "<p>Hi {{owner_name}},</p>"
                     "<p>You've received a new order: <strong>{{order_number}}</strong> from {{customer_name}}. "
                     "Total: ₹{{total_amount}}. Items: {{items_count}}.</p>"
                     "<p>Please accept or reject this order in the store app within 10 minutes.</p>",
        "body_text": "Hi {{owner_name}},\n\nNew order {{order_number}} from {{customer_name}}. "
                     "Total: ₹{{total_amount}}. Items: {{items_count}}.\n\nAccept or reject in the app.",
    },
    {
        "event": "rider_approved", "audience": "rider", "enabled": True,
        "name": "Rider Approved",
        "subject_template": "You're approved as a WashingBells rider 🎉",
        "body_html": "<p>Hi {{rider_name}},</p>"
                     "<p>Great news — your rider account has been approved. "
                     "Open the app and toggle online to start receiving trips.</p>"
                     "<p>Welcome to the team!</p>",
        "body_text": "Hi {{rider_name}},\n\nYour rider account has been approved. "
                     "Open the app and toggle online to start receiving trips.\n\nWelcome to the team!",
    },
    {
        "event": "rider_rejected", "audience": "rider", "enabled": True,
        "name": "Rider Approval Revoked",
        "subject_template": "WashingBells rider account update",
        "body_html": "<p>Hi {{rider_name}},</p>"
                     "<p>Your rider account approval has been revoked. "
                     "Please contact our support team if you believe this is an error.</p>",
        "body_text": "Hi {{rider_name}},\n\nYour rider account approval has been revoked. "
                     "Please contact support if this is an error.",
    },
    {
        "event": "new_store_pending_admin", "audience": "admin", "enabled": True,
        "name": "New Store Awaiting Approval (Admin)",
        "subject_template": "New store registration: {{store_name}}",
        "body_html": "<p>A new store has registered and is awaiting approval.</p>"
                     "<ul>"
                     "<li><strong>Name:</strong> {{store_name}}</li>"
                     "<li><strong>Vendor code:</strong> {{vendor_code}}</li>"
                     "<li><strong>City:</strong> {{city}}</li>"
                     "<li><strong>Owner:</strong> {{owner_name}} ({{owner_phone}})</li>"
                     "</ul>"
                     "<p>Review at the admin panel.</p>",
        "body_text": "New store registration awaiting approval:\n"
                     "  Name: {{store_name}}\n  Vendor: {{vendor_code}}\n  City: {{city}}\n"
                     "  Owner: {{owner_name}} ({{owner_phone}})\n\nReview in the admin panel.",
    },
    {
        "event": "new_order_admin", "audience": "admin", "enabled": True,
        "name": "New Order (Admin)",
        "subject_template": "New order {{order_number}} — ₹{{total_amount}} ({{source}})",
        "body_html": "<p>A new order just came in.</p>"
                     "<ul>"
                     "<li><strong>Order:</strong> {{order_number}}</li>"
                     "<li><strong>Customer:</strong> {{customer_name}} ({{customer_phone}})</li>"
                     "<li><strong>Total:</strong> ₹{{total_amount}}</li>"
                     "<li><strong>Items:</strong> {{items_summary}}</li>"
                     "<li><strong>Source:</strong> {{source}}</li>"
                     "<li><strong>Store:</strong> {{store_name}}</li>"
                     "</ul>",
        "body_text": "New order {{order_number}}\n  Customer: {{customer_name}} ({{customer_phone}})\n"
                     "  Total: ₹{{total_amount}}\n  Items: {{items_summary}}\n"
                     "  Source: {{source}}\n  Store: {{store_name}}\n",
    },
    {
        "event": "order_ready_admin", "audience": "admin", "enabled": True,
        "name": "Order Ready (Admin)",
        "subject_template": "Order {{order_number}} is ready — {{store_name}}",
        "body_html": "<p>Order <strong>{{order_number}}</strong> for {{customer_name}} is ready at "
                     "<strong>{{store_name}}</strong>. Total ₹{{total_amount}}.</p>",
        "body_text": "Order {{order_number}} for {{customer_name}} is ready at {{store_name}}. "
                     "Total ₹{{total_amount}}.",
    },
    {
        "event": "order_delivered_admin", "audience": "admin", "enabled": True,
        "name": "Order Delivered (Admin)",
        "subject_template": "Order {{order_number}} delivered — ₹{{total_amount}}",
        "body_html": "<p>Order <strong>{{order_number}}</strong> was delivered to {{customer_name}}.</p>"
                     "<ul><li><strong>Total:</strong> ₹{{total_amount}}</li>"
                     "<li><strong>Payment:</strong> {{payment_status}} ({{payment_method}})</li>"
                     "<li><strong>Mode:</strong> {{mode}}</li></ul>",
        "body_text": "Order {{order_number}} delivered to {{customer_name}}. Total ₹{{total_amount}}, "
                     "payment {{payment_status}} ({{payment_method}}), mode {{mode}}.",
    },
    {
        "event": "payment_collected", "audience": "customer", "enabled": True,
        "name": "Payment Collected (Customer)",
        "subject_template": "Payment received for order {{order_number}} — WashingBells",
        "body_html": "<p>Hi {{customer_name}},</p>"
                     "<p>We've received your cash payment of <strong>₹{{total_amount}}</strong> "
                     "for order <strong>{{order_number}}</strong>. Thank you!</p>",
        "body_text": "Hi {{customer_name}},\nWe've received your cash payment of ₹{{total_amount}} "
                     "for order {{order_number}}. Thank you!",
    },
    {
        "event": "payment_collected_admin", "audience": "admin", "enabled": True,
        "name": "Cash Collected (Admin)",
        "subject_template": "Cash collected: {{order_number}} — ₹{{total_amount}}",
        "body_html": "<p>Rider <strong>{{rider_name}}</strong> collected <strong>₹{{total_amount}}</strong> "
                     "in cash from {{customer_name}} for order <strong>{{order_number}}</strong>.</p>",
        "body_text": "Rider {{rider_name}} collected ₹{{total_amount}} in cash from {{customer_name}} "
                     "for order {{order_number}}.",
    },
    {
        "event": "weekly_summary_admin", "audience": "admin", "enabled": True,
        "name": "Weekly Summary (Admin)",
        "subject_template": "WashingBells weekly summary — {{week_range}}",
        "body_html": "<h3>WashingBells — week of {{week_range}}</h3>"
                     "<ul>"
                     "<li><strong>New orders:</strong> {{orders_count}}</li>"
                     "<li><strong>Delivered:</strong> {{delivered_count}}</li>"
                     "<li><strong>Revenue (delivered):</strong> ₹{{revenue}}</li>"
                     "<li><strong>Platform fees:</strong> ₹{{platform_fees}}</li>"
                     "<li><strong>New customers:</strong> {{new_customers}}</li>"
                     "<li><strong>Active orders now:</strong> {{active_orders}}</li>"
                     "</ul>"
                     "<p>Status breakdown: {{status_breakdown}}</p>",
        "body_text": "WashingBells weekly summary ({{week_range}})\n"
                     "  New orders: {{orders_count}}\n  Delivered: {{delivered_count}}\n"
                     "  Revenue: ₹{{revenue}}\n  Platform fees: ₹{{platform_fees}}\n"
                     "  New customers: {{new_customers}}\n  Active orders now: {{active_orders}}\n"
                     "  Status breakdown: {{status_breakdown}}\n",
    },
]


async def seed_default_events(force: bool = False) -> int:
    """Seed `email_settings` with default events. Idempotent — won't overwrite
    existing docs unless `force=True`. Returns the number of inserts.
    """
    db = get_db()
    inserts = 0
    now = datetime.now(timezone.utc)
    for default in DEFAULT_EVENTS:
        existing = await db.email_settings.find_one({"event": default["event"]})
        if existing and not force:
            continue
        doc = {**default, "created_at": now, "updated_at": now}
        if existing and force:
            await db.email_settings.update_one(
                {"_id": existing["_id"]},
                {"$set": {**doc, "updated_at": now}},
            )
        else:
            await db.email_settings.insert_one(doc)
            inserts += 1
    return inserts
