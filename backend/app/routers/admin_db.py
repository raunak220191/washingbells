"""Admin MongoDB browser/editor — interactive DB access.

Safety model:
  - ALL_COLLECTIONS    — admin can browse + view documents.
  - EDITABLE_COLLECTIONS — admin can update/insert/delete.
  - User and order documents are intentionally NOT in EDITABLE_COLLECTIONS:
    use the dedicated admin endpoints instead so other side-effects fire
    (push, email, audit). Modifying them here is too risky.

Every write goes into `admin_db_audit` with the actor + before/after diff so
changes are traceable.
"""

import json
import re
from datetime import datetime, timezone
from typing import Any
from bson import ObjectId
from bson.errors import InvalidId
from bson.json_util import dumps as bson_dumps, loads as bson_loads, DEFAULT_JSON_OPTIONS, JSONOptions, JSONMode
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter(prefix="/admin/db", tags=["Admin · Database"])


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")


# Curated set of collections the UI exposes. Read-only by default; only a
# subset accepts writes.
ALL_COLLECTIONS = [
    "users", "orders", "trips", "stores", "addresses", "uploads",
    "services", "coupons", "banners", "testimonials", "wallets",
    "wallet_txns", "carts", "terms_conditions", "email_settings",
    "email_log", "inbound_emails", "store_closures",
    "notifications", "admin_db_audit", "unsubscribed_emails",
]

EDITABLE_COLLECTIONS = {
    "coupons", "services", "banners", "testimonials",
    "terms_conditions", "email_settings", "store_closures",
}

# Fields we always strip out of the document on the way in to a write — these
# can't be set by the admin UI.
STRIP_ON_WRITE = {"_id", "created_at"}


_RELAXED_JSON = JSONOptions(json_mode=JSONMode.RELAXED)


def _to_json(doc: Any) -> str:
    """Serialise BSON doc to relaxed-extended-JSON string."""
    return bson_dumps(doc, json_options=_RELAXED_JSON)


def _parse_doc(raw: dict | str) -> dict:
    """Accept either a JSON string or a dict and return a BSON-safe dict."""
    if isinstance(raw, dict):
        # Round-trip through bson_dumps/loads so $oid / $date hints work
        return bson_loads(json.dumps(raw))
    if isinstance(raw, str):
        return bson_loads(raw)
    raise HTTPException(status_code=400, detail="Document must be an object")


def _check_writable(collection: str):
    if collection not in EDITABLE_COLLECTIONS:
        raise HTTPException(
            status_code=403,
            detail=f"'{collection}' is read-only. Use the dedicated admin endpoint to modify it.",
        )


async def _log_audit(db, *, actor_id: str, collection: str, action: str,
                     doc_id: str | None, before: dict | None, after: dict | None):
    try:
        await db.admin_db_audit.insert_one({
            "actor_id": actor_id,
            "collection": collection,
            "action": action,         # insert | update | delete
            "doc_id": doc_id,
            "before": before,
            "after": after,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        # Never fail a write due to audit insert failure
        pass


# ── Collections ────────────────────────────────────────────

@router.get("/collections")
async def list_collections(current_user: dict = Depends(get_current_user)):
    """List the curated set of collections with document counts."""
    _require_admin(current_user)
    db = get_db()
    items = []
    for name in ALL_COLLECTIONS:
        try:
            count = await db[name].estimated_document_count()
        except Exception:
            count = 0
        items.append({
            "name": name,
            "count": count,
            "editable": name in EDITABLE_COLLECTIONS,
        })
    return items


@router.get("/{collection}")
async def find_documents(
    collection: str,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    q: str = Query("", description="JSON filter object, e.g. {\"role\":\"customer\"}"),
    sort: str = Query("-created_at", description="Field name, prefix with - for descending"),
    current_user: dict = Depends(get_current_user),
):
    """Find documents in a collection."""
    _require_admin(current_user)
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown collection")
    db = get_db()
    # Parse filter
    flt: dict = {}
    if q.strip():
        try:
            flt = bson_loads(q)
            if not isinstance(flt, dict):
                raise ValueError("filter must be a JSON object")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid filter JSON: {e}")
    # Parse sort
    sort_field = sort.lstrip("-")
    sort_dir = -1 if sort.startswith("-") else 1
    try:
        total = await db[collection].count_documents(flt)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad filter: {e}")
    cursor = db[collection].find(flt).sort(sort_field, sort_dir).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    # Serialise via bson_dumps -> parse back to plain JSON-safe dict
    return {
        "collection": collection,
        "editable": collection in EDITABLE_COLLECTIONS,
        "total": total,
        "limit": limit,
        "skip": skip,
        "documents": json.loads(_to_json(docs)),
    }


# ── Audit log ──────────────────────────────────────────────
# MUST be declared before the dynamic "/{collection}/{doc_id}" route below,
# or FastAPI matches "/_audit/log" as collection="_audit", doc_id="log".

@router.get("/_audit/log")
async def list_audit(
    limit: int = Query(100, ge=1, le=500),
    collection: str = "",
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    db = get_db()
    q: dict = {}
    if collection:
        q["collection"] = collection
    cursor = db.admin_db_audit.find(q).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    out = []
    for d in docs:
        actor = None
        if d.get("actor_id"):
            try:
                u = await db.users.find_one({"_id": ObjectId(d["actor_id"])}, {"name": 1, "phone": 1})
                if u:
                    actor = {"id": str(u["_id"]), "name": u.get("name"), "phone": u.get("phone")}
            except Exception:
                pass
        out.append({
            "id": str(d["_id"]),
            "actor": actor,
            "collection": d.get("collection"),
            "action": d.get("action"),
            "doc_id": d.get("doc_id"),
            "before": d.get("before"),
            "after": d.get("after"),
            "created_at": d.get("created_at"),
        })
    return out


@router.get("/{collection}/{doc_id}")
async def get_document(collection: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Unknown collection")
    db = get_db()
    try:
        oid = ObjectId(doc_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id format")
    doc = await db[collection].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return json.loads(_to_json(doc))


@router.post("/{collection}")
async def insert_document(collection: str, body: dict, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    _check_writable(collection)
    db = get_db()
    raw = body.get("document")
    if raw is None:
        raise HTTPException(status_code=400, detail="Body must include {document: {...}}")
    doc = _parse_doc(raw)
    for k in STRIP_ON_WRITE:
        doc.pop(k, None)
    doc.setdefault("created_at", datetime.now(timezone.utc))
    doc.setdefault("updated_at", datetime.now(timezone.utc))
    result = await db[collection].insert_one(doc)
    inserted = await db[collection].find_one({"_id": result.inserted_id})
    await _log_audit(
        db, actor_id=current_user.get("user_id", ""), collection=collection,
        action="insert", doc_id=str(result.inserted_id),
        before=None, after=json.loads(_to_json(inserted)),
    )
    return {"id": str(result.inserted_id), "document": json.loads(_to_json(inserted))}


@router.put("/{collection}/{doc_id}")
async def update_document(
    collection: str, doc_id: str, body: dict,
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user)
    _check_writable(collection)
    db = get_db()
    try:
        oid = ObjectId(doc_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id format")
    raw = body.get("document")
    if raw is None:
        raise HTTPException(status_code=400, detail="Body must include {document: {...}}")
    new_doc = _parse_doc(raw)
    for k in STRIP_ON_WRITE:
        new_doc.pop(k, None)
    new_doc["updated_at"] = datetime.now(timezone.utc)

    before = await db[collection].find_one({"_id": oid})
    if not before:
        raise HTTPException(status_code=404, detail="Document not found")
    # Replace the doc but keep the original _id + created_at
    new_doc.setdefault("created_at", before.get("created_at"))
    await db[collection].replace_one({"_id": oid}, new_doc)
    after = await db[collection].find_one({"_id": oid})
    await _log_audit(
        db, actor_id=current_user.get("user_id", ""), collection=collection,
        action="update", doc_id=doc_id,
        before=json.loads(_to_json(before)), after=json.loads(_to_json(after)),
    )
    return {"document": json.loads(_to_json(after))}


@router.delete("/{collection}/{doc_id}")
async def delete_document(collection: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    _check_writable(collection)
    db = get_db()
    try:
        oid = ObjectId(doc_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid id format")
    before = await db[collection].find_one({"_id": oid})
    if not before:
        raise HTTPException(status_code=404, detail="Document not found")
    await db[collection].delete_one({"_id": oid})
    await _log_audit(
        db, actor_id=current_user.get("user_id", ""), collection=collection,
        action="delete", doc_id=doc_id,
        before=json.loads(_to_json(before)), after=None,
    )
    return {"deleted": 1}


