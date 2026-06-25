"""Terms & Conditions — versioned per role (customer/rider/store).

Public endpoints let apps fetch the latest active T&C for their role and check
whether the current user needs to (re-)accept. Admin endpoints manage versions.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter(prefix="/terms", tags=["Terms & Conditions"])

ALLOWED_ROLES = ("customer", "rider", "store")


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")


def _normalize_role(role: str) -> str:
    role = (role or "").lower()
    # Map store_owner → store
    if role == "store_owner":
        role = "store"
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {ALLOWED_ROLES}")
    return role


def _format(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "role": doc["role"],
        "version": doc["version"],
        "content_html": doc.get("content_html", ""),
        "summary": doc.get("summary", ""),
        "active": doc.get("active", True),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


# ── PUBLIC: Get latest T&C for a role ────────────────────────

@router.get("/{role}")
async def get_latest_terms(role: str):
    """Return the latest active T&C for a given role. No auth required."""
    role = _normalize_role(role)
    db = get_db()
    doc = await db.terms_conditions.find_one(
        {"role": role, "active": True},
        sort=[("version", -1)],
    )
    if not doc:
        # Return an empty default so apps don't break before any T&C is published
        return {"id": None, "role": role, "version": 0, "content_html": "",
                "summary": "Terms & Conditions not yet published.", "active": True,
                "created_at": None, "updated_at": None}
    return _format(doc)


# ── AUTHENTICATED: Check / accept ────────────────────────────

@router.get("/me/status")
async def get_my_acceptance_status(current_user: dict = Depends(get_current_user)):
    """Returns whether the current user needs to (re-)accept T&C."""
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = _normalize_role(user.get("role", "customer"))
    latest = await db.terms_conditions.find_one(
        {"role": role, "active": True},
        sort=[("version", -1)],
    )
    latest_version = latest["version"] if latest else 0
    accepted_version = user.get("terms_accepted_version", 0)
    return {
        "role": role,
        "latest_version": latest_version,
        "accepted_version": accepted_version,
        "needs_acceptance": latest_version > accepted_version and latest_version > 0,
        "terms_id": str(latest["_id"]) if latest else None,
    }


@router.post("/accept")
async def accept_terms(body: dict, current_user: dict = Depends(get_current_user)):
    """Mark current user as having accepted the given T&C version."""
    version = int(body.get("version", 0))
    if version <= 0:
        raise HTTPException(status_code=400, detail="Invalid version")

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = _normalize_role(user.get("role", "customer"))
    # Make sure that version exists for this role
    terms = await db.terms_conditions.find_one({"role": role, "version": version, "active": True})
    if not terms:
        raise HTTPException(status_code=404, detail="Terms version not found")

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {
            "terms_accepted_version": version,
            "terms_accepted_role": role,
            "terms_accepted_at": now,
            "updated_at": now,
        }},
    )
    return {"accepted_version": version, "role": role, "accepted_at": now}


# ── ADMIN: Manage T&C versions ───────────────────────────────

@router.get("/admin/list")
async def admin_list_terms(role: str = None, current_user: dict = Depends(get_current_user)):
    """List all T&C versions, optionally filtered by role."""
    _require_admin(current_user)
    db = get_db()
    query = {}
    if role:
        query["role"] = _normalize_role(role)
    cursor = db.terms_conditions.find(query).sort([("role", 1), ("version", -1)])
    docs = await cursor.to_list(length=200)
    return [_format(d) for d in docs]


@router.post("/admin/publish")
async def admin_publish_terms(body: dict, current_user: dict = Depends(get_current_user)):
    """Create a new T&C version for a role. Auto-increments the version number
    and deactivates older versions so only the newest is 'active'.
    Body: { role, content_html, summary? }
    """
    _require_admin(current_user)
    role = _normalize_role(body.get("role"))
    content_html = (body.get("content_html") or "").strip()
    if not content_html:
        raise HTTPException(status_code=400, detail="content_html required")

    db = get_db()
    # Find latest version for this role
    latest = await db.terms_conditions.find_one(
        {"role": role}, sort=[("version", -1)]
    )
    next_version = (latest["version"] if latest else 0) + 1

    # Deactivate any previously active version for this role
    await db.terms_conditions.update_many(
        {"role": role, "active": True},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc)}},
    )

    now = datetime.now(timezone.utc)
    doc = {
        "role": role,
        "version": next_version,
        "content_html": content_html,
        "summary": body.get("summary", ""),
        "active": True,
        "updated_by": current_user.get("user_id"),
        "created_at": now,
        "updated_at": now,
    }
    result = await db.terms_conditions.insert_one(doc)
    return {"id": str(result.inserted_id), "role": role, "version": next_version,
            "message": f"Published {role} T&C v{next_version}. All existing users will need to re-accept."}


@router.delete("/admin/{terms_id}")
async def admin_delete_terms(terms_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a T&C version (use with caution — only for cleanup)."""
    _require_admin(current_user)
    db = get_db()
    result = await db.terms_conditions.delete_one({"_id": ObjectId(terms_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Terms version not found")
    return {"message": "Terms version deleted"}
