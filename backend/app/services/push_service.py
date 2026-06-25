"""Expo Push Notification Service.

Sends notifications via Expo's Push API (https://exp.host/--/api/v2/push/send).
Free, no Firebase required, works with both Expo Go (dev) and standalone builds.

Each app (rider / store / customer) registers its ExponentPushToken[...] via
POST /notifications/register-token. This service looks tokens up by user_id
and sends the payload.
"""

import logging
import httpx
from app.core.database import get_db

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _is_expo_token(token: str) -> bool:
    return token and (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken["))


async def _send_to_expo(messages: list[dict]) -> dict | None:
    """POST a batch of messages to Expo's push API."""
    if not messages:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Expo push send failed: {e}")
        return None


async def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
    sound: str = "default",
    channel_id: str = "default",
    priority: str = "high",
) -> bool:
    """Send a push notification to a single user via their stored Expo token.
    Returns True on success or no-token, False on send error.
    """
    db = get_db()
    from bson import ObjectId
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        logger.warning(f"send_push_to_user: invalid user_id {user_id}")
        return False
    if not user:
        return False
    token = user.get("expo_push_token")
    if not token or not _is_expo_token(token):
        logger.info(f"[DEV] No push token for user {user_id}; notification: {title} — {body}")
        return True

    message = {
        "to": token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": sound,
        "priority": priority,
        "channelId": channel_id,
    }
    result = await _send_to_expo([message])
    if result is None:
        return False

    # Log token errors so we can clean up stale tokens
    for ticket in (result.get("data") or []):
        if ticket.get("status") == "error":
            details = ticket.get("details", {})
            err = details.get("error")
            if err == "DeviceNotRegistered":
                logger.info(f"Removing stale push token for user {user_id}")
                await db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$unset": {"expo_push_token": ""}},
                )
    return True


async def send_push_to_users(
    user_ids: list[str],
    title: str,
    body: str,
    data: dict | None = None,
    sound: str = "default",
    channel_id: str = "default",
) -> bool:
    """Send the same notification to multiple users in one batch."""
    if not user_ids:
        return True
    db = get_db()
    from bson import ObjectId
    obj_ids = []
    for uid in user_ids:
        try: obj_ids.append(ObjectId(uid))
        except Exception: pass
    cursor = db.users.find(
        {"_id": {"$in": obj_ids}, "expo_push_token": {"$exists": True, "$ne": None}},
        {"expo_push_token": 1},
    )
    tokens = []
    async for u in cursor:
        t = u.get("expo_push_token")
        if _is_expo_token(t):
            tokens.append(t)
    if not tokens:
        logger.info(f"[DEV] No push tokens for {len(user_ids)} users; notification: {title}")
        return True

    messages = [{
        "to": t, "title": title, "body": body, "data": data or {},
        "sound": sound, "priority": "high", "channelId": channel_id,
    } for t in tokens]
    result = await _send_to_expo(messages)
    return result is not None


# ── Convenience wrappers for common events ────────────────

async def notify_store_new_order(store_owner_id: str, order_number: str, customer_name: str, total: float):
    await send_push_to_user(
        store_owner_id,
        title="🛎️ New Order Received",
        body=f"Order {order_number} from {customer_name} — ₹{total:.0f}",
        data={"type": "new_order", "order_number": order_number},
        sound="default",
        channel_id="new-orders",
    )


async def notify_rider_trip_assigned(rider_id: str, trip_type: str, order_number: str, fee: float):
    label = "Pickup" if trip_type == "pickup" else "Delivery"
    await send_push_to_user(
        rider_id,
        title=f"📦 New {label} Assigned",
        body=f"Order {order_number} — ₹{fee:.0f}",
        data={"type": "trip_assigned", "trip_type": trip_type, "order_number": order_number},
        sound="default",
        channel_id="new-trips",
    )


async def notify_customer_order_update(customer_id: str, order_number: str, status: str, message: str):
    await send_push_to_user(
        customer_id,
        title=f"Order {order_number}",
        body=message,
        data={"type": "order_update", "order_number": order_number, "status": status},
        sound="default",
        channel_id="order-updates",
    )


async def notify_rider_approval(rider_id: str, approved: bool):
    if approved:
        title = "✅ Account Approved"
        body = "You're approved! Go online to start receiving trips."
    else:
        title = "Account Update"
        body = "Your account approval has been revoked. Contact support for details."
    await send_push_to_user(
        rider_id,
        title=title,
        body=body,
        data={"type": "approval", "approved": approved},
        sound="default",
        channel_id="default",
    )
