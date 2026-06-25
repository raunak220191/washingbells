"""Inbox — SendGrid Inbound Parse webhook + admin inbox list/detail.

Setup (one-time, on your end):
  1. In SendGrid → Settings → Inbound Parse → Add Host & URL.
  2. Hostname: a subdomain you control, e.g. `mail.washingbells.com`.
  3. URL: https://<your-public-backend>/api/v1/inbox/webhook?key=<SENDGRID_INBOUND_PARSE_KEY>
  4. In your DNS, create an MX record:  mail.washingbells.com  →  mx.sendgrid.net (priority 10)
  5. Set SENDGRID_INBOUND_PARSE_KEY in backend/.env (any random string — used as a
     shared secret in the query param).

Once propagated, mail sent to *@mail.washingbells.com lands here.

SendGrid POSTs a multipart/form-data payload with fields like: from, to, subject,
text, html, attachments. We store the relevant fields in `inbound_emails` and
mark them unread. Attachments are saved to the `uploads` collection.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import get_settings

router = APIRouter(prefix="/inbox", tags=["Email Inbox"])
logger = logging.getLogger(__name__)


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")


def _parse_address(raw: str | None) -> dict:
    """Loose parse of an RFC822-style address like 'Name <a@b.com>'."""
    if not raw:
        return {"name": None, "email": None}
    raw = raw.strip()
    if "<" in raw and ">" in raw:
        try:
            name = raw.split("<", 1)[0].strip().strip('"').strip()
            email = raw.split("<", 1)[1].split(">", 1)[0].strip().lower()
            return {"name": name or None, "email": email}
        except Exception:
            pass
    return {"name": None, "email": raw.lower()}


def _excerpt(text: str | None, n: int = 160) -> str:
    if not text:
        return ""
    t = " ".join(text.split())
    return t[:n] + ("…" if len(t) > n else "")


# ── Webhook receiver ────────────────────────────────────────

@router.post("/webhook")
async def receive_inbound(
    request: Request,
    key: str = Query(default=""),
):
    """Receive a SendGrid Inbound Parse POST.

    Auth: shared secret query parameter `?key=...`. SendGrid doesn't sign
    inbound parse posts, so the URL secret is the recommended approach.
    """
    settings = get_settings()
    expected = settings.SENDGRID_INBOUND_PARSE_KEY
    if not expected:
        logger.error("Inbound Parse received but SENDGRID_INBOUND_PARSE_KEY is unset")
        raise HTTPException(status_code=503, detail="Inbound Parse not configured")
    if not key or key != expected:
        # Don't be chatty about why
        raise HTTPException(status_code=403, detail="Forbidden")

    db = get_db()
    form = await request.form()
    raw_from = form.get("from")
    raw_to = form.get("to")
    subject = form.get("subject") or "(no subject)"
    text = form.get("text") or ""
    html = form.get("html") or ""
    spam_score = form.get("spam_score")
    envelope = form.get("envelope") or "{}"
    try:
        envelope_obj = json.loads(envelope)
    except Exception:
        envelope_obj = {}

    from_parsed = _parse_address(raw_from)
    to_parsed = _parse_address(raw_to)

    # Handle attachments — `attachments` field is an int count; files come as
    # attachment1, attachment2, ... in the form
    attachments = []
    try:
        count = int(form.get("attachments") or 0)
    except Exception:
        count = 0
    now = datetime.now(timezone.utc)
    for i in range(1, count + 1):
        f = form.get(f"attachment{i}")
        if not f or not hasattr(f, "read"):
            continue
        try:
            blob = await f.read()
            import base64
            data_b64 = base64.b64encode(blob).decode("ascii")
            up = await db.uploads.insert_one({
                "filename": f.filename,
                "context": "inbound_email",
                "size": len(blob),
                "data": "data:%s;base64,%s" % (f.content_type or "application/octet-stream", data_b64),
                "created_at": now,
            })
            attachments.append({
                "upload_id": str(up.inserted_id),
                "filename": f.filename,
                "content_type": f.content_type,
                "size": len(blob),
            })
        except Exception as e:
            logger.warning(f"Failed to persist inbound attachment {i}: {e}")

    # Try to spot a related order by scanning the subject + text for an order number
    import re
    order_match = re.search(r"WB-\d{4}-[A-Z0-9]{3,5}(?:-\d{3})?", (subject or "") + " " + (text or ""))
    order_number = order_match.group(0) if order_match else None
    order_id = None
    if order_number:
        order = await db.orders.find_one({"order_number": order_number}, {"_id": 1})
        if order:
            order_id = str(order["_id"])

    # Try to find a known user by from_email
    user_id = None
    if from_parsed["email"]:
        u = await db.users.find_one({"email": from_parsed["email"]}, {"_id": 1, "name": 1, "role": 1})
        if u:
            user_id = str(u["_id"])

    doc = {
        "from_email": from_parsed["email"],
        "from_name": from_parsed["name"],
        "to_email": to_parsed["email"],
        "subject": subject,
        "text": text,
        "html": html,
        "excerpt": _excerpt(text or html),
        "spam_score": float(spam_score) if spam_score else None,
        "envelope": envelope_obj,
        "attachments": attachments,
        "order_number": order_number,
        "order_id": order_id,
        "user_id": user_id,
        "read": False,
        "archived": False,
        "received_at": now,
    }
    result = await db.inbound_emails.insert_one(doc)
    logger.info(f"Inbound email received id={result.inserted_id} from={from_parsed['email']}")
    return {"ok": True, "id": str(result.inserted_id)}


# ── Admin browsing ─────────────────────────────────────────

@router.get("/list")
async def list_inbound(
    limit: int = 50,
    skip: int = 0,
    only_unread: bool = False,
    include_archived: bool = False,
    q: str = "",
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    db = get_db()
    query: dict = {}
    if not include_archived:
        query["archived"] = {"$ne": True}
    if only_unread:
        query["read"] = False
    if q:
        query["$or"] = [
            {"subject": {"$regex": q, "$options": "i"}},
            {"from_email": {"$regex": q, "$options": "i"}},
            {"excerpt": {"$regex": q, "$options": "i"}},
        ]
    total = await db.inbound_emails.count_documents(query)
    cursor = db.inbound_emails.find(query, {"html": 0, "text": 0}).sort("received_at", -1).skip(skip).limit(min(limit, 200))
    docs = await cursor.to_list(length=limit)
    items = [{
        "id": str(d["_id"]),
        "from_email": d.get("from_email"),
        "from_name": d.get("from_name"),
        "to_email": d.get("to_email"),
        "subject": d.get("subject"),
        "excerpt": d.get("excerpt"),
        "read": d.get("read", False),
        "archived": d.get("archived", False),
        "spam_score": d.get("spam_score"),
        "order_number": d.get("order_number"),
        "order_id": d.get("order_id"),
        "user_id": d.get("user_id"),
        "attachments_count": len(d.get("attachments") or []),
        "received_at": d.get("received_at"),
    } for d in docs]
    return {"total": total, "items": items, "limit": limit, "skip": skip}


@router.get("/unread-count")
async def unread_count(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    n = await db.inbound_emails.count_documents({"read": False, "archived": {"$ne": True}})
    return {"count": n}


@router.get("/{email_id}")
async def get_inbound(email_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    try:
        doc = await db.inbound_emails.find_one({"_id": ObjectId(email_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    # Auto-mark as read on first fetch
    if not doc.get("read"):
        await db.inbound_emails.update_one({"_id": doc["_id"]}, {"$set": {"read": True}})

    return {
        "id": str(doc["_id"]),
        "from_email": doc.get("from_email"),
        "from_name": doc.get("from_name"),
        "to_email": doc.get("to_email"),
        "subject": doc.get("subject"),
        "text": doc.get("text"),
        "html": doc.get("html"),
        "spam_score": doc.get("spam_score"),
        "order_number": doc.get("order_number"),
        "order_id": doc.get("order_id"),
        "user_id": doc.get("user_id"),
        "attachments": doc.get("attachments") or [],
        "envelope": doc.get("envelope"),
        "archived": doc.get("archived", False),
        "received_at": doc.get("received_at"),
    }


@router.put("/{email_id}/read")
async def mark_read(email_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    read = bool(body.get("read", True))
    await db.inbound_emails.update_one({"_id": ObjectId(email_id)}, {"$set": {"read": read}})
    return {"read": read}


@router.put("/{email_id}/archive")
async def archive(email_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    archived = bool(body.get("archived", True))
    await db.inbound_emails.update_one({"_id": ObjectId(email_id)}, {"$set": {"archived": archived}})
    return {"archived": archived}


@router.delete("/{email_id}")
async def delete_inbound(email_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    r = await db.inbound_emails.delete_one({"_id": ObjectId(email_id)})
    return {"deleted": r.deleted_count}
