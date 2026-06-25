"""Notifications — Push token registration & test endpoints.

Each mobile app calls POST /notifications/register-token after the user grants
notification permission. Tokens are stored on the user document and used by
push_service.send_push_to_user(...) for events.
"""

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.core.security import get_current_user
from app.services.push_service import send_push_to_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post("/register-token")
async def register_push_token(body: dict, current_user: dict = Depends(get_current_user)):
    """Register or update the current user's Expo Push token.
    Body: { token: "ExponentPushToken[...]", platform: "ios" | "android" }
    """
    token = (body.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token required")
    if not (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")):
        raise HTTPException(status_code=400, detail="Invalid Expo push token format")

    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {
            "expo_push_token": token,
            "push_platform": body.get("platform", "unknown"),
            "push_registered_at": datetime.now(timezone.utc),
        }},
    )
    return {"message": "Push token registered", "token": token[:20] + "..."}


@router.delete("/unregister-token")
async def unregister_push_token(current_user: dict = Depends(get_current_user)):
    """Remove the current user's push token (e.g. on logout)."""
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$unset": {"expo_push_token": "", "push_platform": ""}},
    )
    return {"message": "Push token cleared"}


@router.post("/test")
async def send_test_notification(current_user: dict = Depends(get_current_user)):
    """Send a test push notification to the current user. Useful for debugging."""
    success = await send_push_to_user(
        current_user["user_id"],
        title="🧺 WashingBells Test",
        body="Push notifications are working! Tap to dismiss.",
        data={"type": "test"},
    )
    return {"sent": success}
