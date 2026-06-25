"""Email Admin — Admin-only management of email_settings + email_log audit.

Endpoints:
  GET    /admin/email/events           — list all configured events
  GET    /admin/email/events/{event}   — get one event's config
  PUT    /admin/email/events/{event}   — update an event (toggle, subject, body)
  POST   /admin/email/seed             — seed defaults (idempotent unless force)
  POST   /admin/email/test             — send a test render to a given address
  GET    /admin/email/log              — recent send history (paginated)
  GET    /admin/email/config-status    — whether SendGrid is configured
"""

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.services.email_service import (
    seed_default_events, send_event, send_custom, DEFAULT_EVENTS,
)

router = APIRouter(prefix="/admin/email", tags=["Admin · Email"])

ALLOWED_AUDIENCES = {"customer", "store", "rider", "admin"}


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")


def _format_event(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "event": doc["event"],
        "name": doc.get("name", doc["event"]),
        "audience": doc.get("audience", "customer"),
        "enabled": doc.get("enabled", False),
        "subject_template": doc.get("subject_template", ""),
        "body_html": doc.get("body_html", ""),
        "body_text": doc.get("body_text", ""),
        "updated_at": doc.get("updated_at"),
    }


@router.get("/config-status")
async def email_config_status(current_user: dict = Depends(get_current_user)):
    """Returns whether the backend is configured to actually send emails.
    Used by the admin UI to show a 'sender not configured' banner.
    """
    _require_admin(current_user)
    s = get_settings()
    return {
        "enabled": bool(s.EMAIL_ENABLED),
        "has_api_key": bool(s.SENDGRID_API_KEY),
        "from_address": s.EMAIL_FROM_ADDRESS or None,
        "from_name": s.EMAIL_FROM_NAME or None,
        "reply_to": s.EMAIL_REPLY_TO or None,
        "admin_address": s.EMAIL_ADMIN_ADDRESS or None,
        "will_actually_send": bool(s.EMAIL_ENABLED and s.SENDGRID_API_KEY and s.EMAIL_FROM_ADDRESS),
    }


@router.get("/events")
async def list_events(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    cursor = db.email_settings.find({}).sort("event", 1)
    docs = await cursor.to_list(length=200)
    # Always return the union of stored events + known defaults so the UI
    # shows new defaults even before seeding.
    seen = {d["event"] for d in docs}
    stub_defaults = [{
        "_id": ObjectId(),
        "event": d["event"], "name": d["name"], "audience": d["audience"],
        "enabled": False, "subject_template": d["subject_template"],
        "body_html": d["body_html"], "body_text": d["body_text"],
        "updated_at": None, "_stub": True,
    } for d in DEFAULT_EVENTS if d["event"] not in seen]
    return [_format_event(d) for d in docs] + [_format_event(d) for d in stub_defaults]


@router.get("/events/{event}")
async def get_event(event: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    doc = await db.email_settings.find_one({"event": event})
    if doc:
        return _format_event(doc)
    # Fall back to default if known
    for d in DEFAULT_EVENTS:
        if d["event"] == event:
            return {
                "id": None, "event": d["event"], "name": d["name"],
                "audience": d["audience"], "enabled": False,
                "subject_template": d["subject_template"],
                "body_html": d["body_html"], "body_text": d["body_text"],
                "updated_at": None,
            }
    raise HTTPException(status_code=404, detail="Event not found")


@router.put("/events/{event}")
async def update_event(event: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Upsert an event's configuration."""
    _require_admin(current_user)
    db = get_db()
    audience = body.get("audience")
    if audience and audience not in ALLOWED_AUDIENCES:
        raise HTTPException(status_code=400, detail=f"audience must be one of {ALLOWED_AUDIENCES}")

    update = {"updated_at": datetime.now(timezone.utc)}
    for field in ("name", "audience", "enabled", "subject_template", "body_html", "body_text"):
        if field in body:
            update[field] = body[field]

    # Look up the default for fallback values when upserting a brand-new event
    default = next((d for d in DEFAULT_EVENTS if d["event"] == event), None)
    if default:
        update.setdefault("name", default["name"])
        update.setdefault("audience", default["audience"])

    result = await db.email_settings.update_one(
        {"event": event},
        {"$set": {"event": event, **update}, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    doc = await db.email_settings.find_one({"event": event})
    return {"message": "Saved", "upserted": result.upserted_id is not None, "event": _format_event(doc)}


@router.post("/seed")
async def seed_defaults(force: bool = False, current_user: dict = Depends(get_current_user)):
    """Insert default event templates. Pass ?force=true to overwrite existing."""
    _require_admin(current_user)
    n = await seed_default_events(force=force)
    return {"inserted": n, "force": force}


@router.post("/test")
async def send_test(body: dict, current_user: dict = Depends(get_current_user)):
    """Render and send a test email to the given address (or the admin alerts
    address by default). Bypasses the enabled toggle.

    Body: { event: str, to: str, context?: dict }
    """
    _require_admin(current_user)
    event = body.get("event")
    if not event:
        raise HTTPException(status_code=400, detail="event required")
    to_addr = body.get("to") or get_settings().EMAIL_ADMIN_ADDRESS
    if not to_addr:
        raise HTTPException(status_code=400, detail="to address required (or set EMAIL_ADMIN_ADDRESS)")

    # Provide a fake context so unfilled templates still render meaningfully
    default_ctx = {
        "customer_name": "Test Customer", "order_number": "WB-2026-TEST",
        "total_amount": "499", "items_count": "3",
        "store_name": "WashingBells Test Store", "owner_name": "Test Owner",
        "rider_name": "Test Rider", "pickup_slot": "Today, 4-5 PM",
        "vendor_code": "WB999", "city": "Ludhiana", "owner_phone": "+919999999999",
    }
    ctx = {**default_ctx, **(body.get("context") or {})}

    sent = await send_event(
        event,
        to_email=to_addr,
        context=ctx,
        audience=body.get("audience", "customer"),
        override_enabled=True,
    )
    return {"sent": sent, "to": to_addr, "event": event}


@router.post("/compose")
async def compose_and_send(body: dict, current_user: dict = Depends(get_current_user)):
    """Send a one-off, ad-hoc email to a single recipient. Skips the template
    system. Honours the unsubscribe suppression list when audience=customer.

    Body: { to: str, subject: str, body_html?: str, body_text?: str, audience?: str }
    """
    _require_admin(current_user)
    to_email = (body.get("to") or "").strip()
    subject = (body.get("subject") or "").strip()
    body_html = body.get("body_html") or ""
    body_text = body.get("body_text") or ""
    audience = body.get("audience") or "admin"
    if not to_email:
        raise HTTPException(status_code=400, detail="to required")
    if audience not in ALLOWED_AUDIENCES:
        raise HTTPException(status_code=400, detail=f"audience must be one of {ALLOWED_AUDIENCES}")
    if not subject and not body_html and not body_text:
        raise HTTPException(status_code=400, detail="At least one of subject / body required")
    sent, err = await send_custom(
        to_email=to_email, subject=subject,
        body_html=body_html, body_text=body_text,
        sender_user_id=current_user.get("user_id"),
        audience=audience,
    )
    return {"sent": sent, "to": to_email, "error": err}


@router.get("/recipients")
async def list_recipients(
    q: str = "",
    role: str = None,
    only_with_email: bool = True,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Quick recipient picker for the Compose tab. Searches users by name /
    phone / email. Defaults to users who actually have an email on file.
    """
    _require_admin(current_user)
    db = get_db()
    query: dict = {}
    if only_with_email:
        query["email"] = {"$exists": True, "$ne": None, "$nin": [""]}
    if role:
        if role == "customer":
            query["$or"] = [{"role": "customer"}, {"role": None}, {"role": {"$exists": False}}]
        else:
            query["role"] = role
    if q:
        # Simple OR across name/email/phone substrings
        ors = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q}},
        ]
        if "$or" in query:
            query = {"$and": [query, {"$or": ors}]}
        else:
            query["$or"] = ors
    cursor = db.users.find(query, {"name": 1, "phone": 1, "email": 1, "role": 1}).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [{
        "id": str(d["_id"]),
        "name": d.get("name"),
        "phone": d.get("phone"),
        "email": d.get("email"),
        "role": d.get("role") or "customer",
    } for d in docs]


@router.get("/unsubscribed")
async def list_unsubscribed(limit: int = 100, current_user: dict = Depends(get_current_user)):
    """Show emails on the suppression list (so admin can see who has opted out)."""
    _require_admin(current_user)
    db = get_db()
    cursor = db.unsubscribed_emails.find({}).sort("unsubscribed_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [{
        "id": str(d["_id"]),
        "email": d.get("email"),
        "source": d.get("source"),
        "unsubscribed_at": d.get("unsubscribed_at"),
    } for d in docs]


@router.delete("/unsubscribed/{email}")
async def admin_resubscribe(email: str, current_user: dict = Depends(get_current_user)):
    """Manually remove an email from the suppression list."""
    _require_admin(current_user)
    db = get_db()
    r = await db.unsubscribed_emails.delete_one({"email": email.lower()})
    return {"deleted": r.deleted_count}


@router.get("/log")
async def list_email_log(
    limit: int = Query(50, ge=1, le=200),
    event: str = None,
    status: str = None,
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    db = get_db()
    q: dict = {}
    if event: q["event"] = event
    if status: q["status"] = status
    cursor = db.email_log.find(q).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [{
        "id": str(d["_id"]),
        "event": d.get("event"),
        "audience": d.get("audience"),
        "to": d.get("to"),
        "subject": d.get("subject"),
        "status": d.get("status"),
        "error": d.get("error"),
        "user_id": d.get("user_id"),
        "order_id": d.get("order_id"),
        "created_at": d.get("created_at"),
    } for d in docs]
