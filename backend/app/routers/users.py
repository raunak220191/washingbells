from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import UserProfileUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile."""
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=str(user["_id"]),
        phone=user["phone"],
        name=user.get("name"),
        email=user.get("email"),
        profile_image=user.get("profile_image"),
        referral_code=user.get("referral_code"),
        wallet_balance=user.get("wallet_balance", 0.0),
        created_at=user["created_at"],
    )


@router.put("/me", response_model=UserResponse)
async def update_profile(
    update: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update user profile (name, email)."""
    db = get_db()

    update_data = {
        k: v for k, v in update.model_dump().items() if v is not None
    }
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": update_data},
    )

    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    return UserResponse(
        id=str(user["_id"]),
        phone=user["phone"],
        name=user.get("name"),
        email=user.get("email"),
        profile_image=user.get("profile_image"),
        referral_code=user.get("referral_code"),
        wallet_balance=user.get("wallet_balance", 0.0),
        created_at=user["created_at"],
    )
