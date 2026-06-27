"""Coupons — validate promo codes, list user's available coupons."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.phase1_schemas import (
    CouponValidateRequest,
    CouponValidateResponse,
    CouponResponse,
)

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _aware(dt):
    """MongoDB returns naive datetimes; coerce to UTC-aware so they can be
    compared against datetime.now(timezone.utc) without a TypeError."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _format_coupon(c: dict) -> dict:
    return {
        "id": str(c["_id"]),
        "code": c["code"],
        "name": c["name"],
        "type": c["type"],
        "value": c["value"],
        "min_order": c.get("min_order", 0),
        "max_discount": c.get("max_discount", 9999),
        "valid_to": c["valid_to"],
        "is_referral": c.get("is_referral", False),
    }


def _calculate_discount(coupon: dict, cart_total: float) -> float:
    """Calculate the actual discount amount for a coupon."""
    if coupon["type"] == "percent":
        discount = cart_total * (coupon["value"] / 100)
        max_disc = coupon.get("max_discount")
        # max_discount is OPTIONAL — only cap when one is actually configured.
        if max_disc not in (None, "", 0):
            discount = min(discount, max_disc)
        return discount
    else:  # flat
        return min(coupon["value"], cart_total)


async def evaluate_coupon(db, code: str, cart_total: float, user_id: str | None) -> dict:
    """Validate a coupon and compute its discount against ``cart_total``.

    Single source of truth for coupon rules (active / expiry / not-yet-active /
    usage-limit / per-user-limit / assigned-user / min-order). Shared by the
    customer ``/coupons/validate`` endpoint and admin order creation so both
    enforce identical business rules. Returns
    ``{valid, code, coupon, discount_amount, message}``.
    """
    now = datetime.now(timezone.utc)
    norm = (code or "").strip().upper()

    coupon = await db.coupons.find_one({"code": norm, "active": True})
    if not coupon:
        return {"valid": False, "code": norm, "coupon": None, "discount_amount": 0, "message": "Invalid coupon code"}

    if _aware(coupon.get("valid_to")) and _aware(coupon["valid_to"]) < now:
        return {"valid": False, "code": norm, "coupon": None, "discount_amount": 0, "message": "Coupon has expired"}

    if _aware(coupon.get("valid_from")) and _aware(coupon["valid_from"]) > now:
        return {"valid": False, "code": norm, "coupon": None, "discount_amount": 0, "message": "Coupon is not yet active"}

    if coupon.get("usage_limit") and coupon.get("used_count", 0) >= coupon["usage_limit"]:
        return {"valid": False, "code": norm, "coupon": None, "discount_amount": 0, "message": "Coupon usage limit reached"}

    if coupon.get("per_user_limit") and user_id:
        user_uses = await db.orders.count_documents({"user_id": user_id, "coupon_code": norm})
        if user_uses >= coupon["per_user_limit"]:
            return {"valid": False, "code": norm, "coupon": None, "discount_amount": 0, "message": "You have already used this coupon"}

    if coupon.get("assigned_user_id") and coupon["assigned_user_id"] != user_id:
        return {"valid": False, "code": norm, "coupon": None, "discount_amount": 0, "message": "This coupon is not valid for this account"}

    min_order = coupon.get("min_order", 0)
    if cart_total < min_order:
        mo = int(min_order) if float(min_order).is_integer() else min_order
        return {"valid": False, "code": norm, "coupon": None, "discount_amount": 0, "message": f"Minimum order of ₹{mo} required"}

    discount = round(_calculate_discount(coupon, cart_total), 2)
    return {"valid": True, "code": norm, "coupon": coupon, "discount_amount": discount,
            "message": f"₹{discount} off applied!"}


@router.get("/me", response_model=list[CouponResponse])
async def list_my_coupons(current_user: dict = Depends(get_current_user)):
    """List all available coupons for the current user."""
    db = get_db()
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc)

    # Find active, non-expired coupons. Guard against legacy docs missing valid_from.
    cursor = db.coupons.find({
        "active": True,
        "$or": [{"valid_from": {"$exists": False}}, {"valid_from": {"$lte": now}}],
        "valid_to": {"$gte": now},
        "$and": [{"$or": [
            {"assigned_user_id": None},
            {"assigned_user_id": {"$exists": False}},
            {"assigned_user_id": user_id},
        ]}],
    })
    coupons = await cursor.to_list(length=50)

    # Filter out fully used coupons
    available = []
    for c in coupons:
        if c.get("usage_limit") and c.get("used_count", 0) >= c["usage_limit"]:
            continue
        available.append(c)

    return [_format_coupon(c) for c in available]


@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon(
    body: CouponValidateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Validate a coupon code against the current cart total."""
    db = get_db()
    result = await evaluate_coupon(db, body.code, body.cart_total, current_user["user_id"])
    return {
        "valid": result["valid"],
        "code": result["code"],
        "discount_amount": result["discount_amount"],
        "message": result["message"],
    }
