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
        max_disc = coupon.get("max_discount", 9999)
        return min(discount, max_disc)
    else:  # flat
        return min(coupon["value"], cart_total)


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
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc)

    coupon = await db.coupons.find_one({
        "code": body.code.upper(),
        "active": True,
    })

    if not coupon:
        return {"valid": False, "code": body.code, "discount_amount": 0, "message": "Invalid coupon code"}

    # Check expiry (MongoDB datetimes are naive — coerce before comparing)
    if _aware(coupon.get("valid_to")) and _aware(coupon["valid_to"]) < now:
        return {"valid": False, "code": body.code, "discount_amount": 0, "message": "Coupon has expired"}

    if _aware(coupon.get("valid_from")) and _aware(coupon["valid_from"]) > now:
        return {"valid": False, "code": body.code, "discount_amount": 0, "message": "Coupon is not yet active"}

    # Check usage limit
    if coupon.get("usage_limit") and coupon.get("used_count", 0) >= coupon["usage_limit"]:
        return {"valid": False, "code": body.code, "discount_amount": 0, "message": "Coupon usage limit reached"}

    # Check per-user limit
    if coupon.get("per_user_limit"):
        user_uses = await db.orders.count_documents({
            "user_id": user_id,
            "coupon_code": body.code.upper(),
        })
        if user_uses >= coupon["per_user_limit"]:
            return {"valid": False, "code": body.code, "discount_amount": 0, "message": "You have already used this coupon"}

    # Check user-specific coupon
    if coupon.get("assigned_user_id") and coupon["assigned_user_id"] != user_id:
        return {"valid": False, "code": body.code, "discount_amount": 0, "message": "This coupon is not valid for your account"}

    # Check minimum order
    min_order = coupon.get("min_order", 0)
    if body.cart_total < min_order:
        return {
            "valid": False,
            "code": body.code,
            "discount_amount": 0,
            "message": f"Minimum order of ₹{min_order} required",
        }

    discount = _calculate_discount(coupon, body.cart_total)

    return {
        "valid": True,
        "code": body.code.upper(),
        "discount_amount": round(discount, 2),
        "message": f"₹{round(discount, 2)} off applied!",
    }
