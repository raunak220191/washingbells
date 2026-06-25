"""Referrals — generate referral codes, apply on signup, earn coupons."""

import random
import string
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.phase1_schemas import ReferralApplyRequest, ReferralStatsResponse

router = APIRouter(prefix="/referrals", tags=["referrals"])


def _generate_referral_code(name: str = None) -> str:
    """Generate a short unique referral code like WB-RAUNAK-X3K."""
    base = (name or "USER").upper()[:6].replace(" ", "")
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"WB-{base}-{suffix}"


@router.get("/me", response_model=ReferralStatsResponse)
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    """Get the current user's referral code and stats."""
    db = get_db()
    user = await db.users.find_one({"_id": __import__("bson").ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Auto-generate referral code if missing
    referral_code = user.get("referral_code")
    if not referral_code:
        referral_code = _generate_referral_code(user.get("name"))
        # Ensure uniqueness
        while await db.users.find_one({"referral_code": referral_code}):
            referral_code = _generate_referral_code(user.get("name"))
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"referral_code": referral_code}}
        )

    # Count referrals
    total_referred = await db.referrals.count_documents({"referrer_id": current_user["user_id"]})

    # Sum earned (20% coupons created for referrer)
    referrer_coupons = await db.referrals.find(
        {"referrer_id": current_user["user_id"], "status": "completed"}
    ).to_list(length=100)
    total_earned = len(referrer_coupons) * 20.0  # each referral = 20% coupon

    return {
        "referral_code": referral_code,
        "total_referred": total_referred,
        "total_earned": total_earned,
        "referral_url": f"https://washingbells.in/refer/{referral_code}",
    }


@router.post("/apply")
async def apply_referral(
    body: ReferralApplyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Apply a referral code. Creates 10% coupon for new user, 20% for referrer."""
    db = get_db()
    user_id = current_user["user_id"]

    # Check if user already used a referral
    user = await db.users.find_one({"_id": __import__("bson").ObjectId(user_id)})
    if user.get("referred_by"):
        raise HTTPException(status_code=400, detail="You have already used a referral code")

    # Find referrer by code
    referrer = await db.users.find_one({"referral_code": body.code.upper()})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    referrer_id = str(referrer["_id"])
    if referrer_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot refer yourself")

    now = datetime.now(timezone.utc)
    valid_to = now + timedelta(days=90)

    # Create 10% coupon for referred user (new user)
    referred_coupon = {
        "code": f"REF10-{user_id[-6:].upper()}",
        "name": "Referral Welcome — 10% Off",
        "type": "percent",
        "value": 10,
        "min_order": 99,
        "max_discount": 200,
        "valid_from": now,
        "valid_to": valid_to,
        "store_ids": [],
        "usage_limit": 1,
        "used_count": 0,
        "per_user_limit": 1,
        "is_referral": True,
        "assigned_user_id": user_id,
        "active": True,
        "created_at": now,
    }
    ref_coupon_result = await db.coupons.insert_one(referred_coupon)

    # Create 20% coupon for referrer
    referrer_coupon = {
        "code": f"REF20-{referrer_id[-6:].upper()}-{user_id[-4:].upper()}",
        "name": f"Referral Reward — 20% Off",
        "type": "percent",
        "value": 20,
        "min_order": 99,
        "max_discount": 500,
        "valid_from": now,
        "valid_to": valid_to,
        "store_ids": [],
        "usage_limit": 1,
        "used_count": 0,
        "per_user_limit": 1,
        "is_referral": True,
        "assigned_user_id": referrer_id,
        "active": True,
        "created_at": now,
    }
    ref_referrer_result = await db.coupons.insert_one(referrer_coupon)

    # Record the referral
    await db.referrals.insert_one({
        "referrer_id": referrer_id,
        "referred_id": user_id,
        "referrer_coupon_id": str(ref_referrer_result.inserted_id),
        "referred_coupon_id": str(ref_coupon_result.inserted_id),
        "status": "completed",
        "created_at": now,
    })

    # Mark user as referred
    await db.users.update_one(
        {"_id": __import__("bson").ObjectId(user_id)},
        {"$set": {"referred_by": body.code.upper()}}
    )

    return {
        "message": "Referral applied! You got a 10% discount coupon.",
        "coupon_code": referred_coupon["code"],
    }
