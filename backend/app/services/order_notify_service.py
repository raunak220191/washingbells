"""New-order confirmation notifications — shared by order creation (COD /
wallet-paid), /payments/verify, and the Razorpay webhook.

An online order is created as `pending_payment` and must NOT alert the store
or email anyone until payment is confirmed (client bug A3: confirmation email
sent for an order that was never paid). COD and zero-due orders notify
immediately. Whoever confirms first wins: the `confirmation_notified_at`
guard makes this idempotent, so verify + webhook can both call it safely.
"""

from datetime import datetime, timezone
from bson import ObjectId

from app.services.push_service import (
    notify_store_new_order,
    notify_customer_order_update,
)
from app.services.email_service import send_event as send_email_event, send_event_to_admins


async def send_new_order_notifications(db, order: dict) -> bool:
    """Push + email fan-out for a newly confirmed (payable) order.

    Returns True if notifications were sent, False if another caller already
    sent them (or the order vanished). Never raises — every channel is
    best-effort.
    """
    now = datetime.now(timezone.utc)
    # Claim the notification atomically; None matches docs missing the field.
    res = await db.orders.update_one(
        {"_id": order["_id"], "confirmation_notified_at": None},
        {"$set": {"confirmation_notified_at": now}},
    )
    if res.modified_count == 0:
        return False

    user_id = order["user_id"]
    customer = await db.users.find_one({"_id": ObjectId(user_id)})
    customer_name = (customer.get("name") if customer else None) or "Customer"
    customer_email = customer.get("email") if customer else None
    customer_phone = (customer.get("phone") if customer else None) or ""
    items_count = str(sum(i.get("quantity", 1) for i in order.get("items", [])))

    store_doc = None
    if order.get("store_id"):
        store_doc = await db.stores.find_one({"_id": ObjectId(order["store_id"])})
        if store_doc and store_doc.get("owner_user_id"):
            try:
                await notify_store_new_order(
                    store_doc["owner_user_id"], order["order_number"],
                    customer_name, order["total_amount"],
                )
            except Exception:
                pass

    try:
        await notify_customer_order_update(
            user_id, order["order_number"], "placed",
            "Order placed successfully! We'll notify you when a store accepts it.",
        )
    except Exception:
        pass

    try:
        await send_email_event(
            "order_placed",
            to_email=customer_email,
            audience="customer",
            user_id=user_id,
            order_id=str(order["_id"]),
            context={
                "customer_name": customer_name,
                "order_number": order["order_number"],
                "total_amount": f"{order['total_amount']:.0f}",
                "items_count": items_count,
            },
        )
    except Exception:
        pass

    if store_doc and store_doc.get("owner_user_id"):
        try:
            owner = await db.users.find_one({"_id": ObjectId(store_doc["owner_user_id"])})
            owner_email = owner.get("email") if owner else None
            await send_email_event(
                "new_order_for_store",
                to_email=owner_email,
                audience="store",
                user_id=store_doc["owner_user_id"],
                order_id=str(order["_id"]),
                context={
                    "owner_name": (owner.get("name") if owner else None) or "Store Owner",
                    "order_number": order["order_number"],
                    "customer_name": customer_name,
                    "total_amount": f"{order['total_amount']:.0f}",
                    "items_count": items_count,
                    "store_name": store_doc.get("name", ""),
                },
            )
        except Exception:
            pass

    try:
        await send_event_to_admins("new_order_admin", order_id=str(order["_id"]), context={
            "order_number": order["order_number"],
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "total_amount": f"{order['total_amount']:.0f}",
            "items_summary": ", ".join(
                f"{i['item_name']} × {i['quantity']}" for i in order.get("items", [])[:6]
            ),
            "source": order.get("order_source", "app").replace("app", "customer app"),
            "store_name": (store_doc or {}).get("name", "auto-assign"),
        })
    except Exception:
        pass

    return True


async def confirm_order_paid(db, order: dict, payment_id: str | None, via: str) -> str:
    """Idempotently mark an order paid and release its notifications.

    Returns the resulting order status. Used by /payments/verify and the
    Razorpay webhook — whichever lands first does the work.
    """
    if order.get("payment_status") == "paid":
        return order.get("status", "placed")

    now = datetime.now(timezone.utc)
    new_status = order.get("status", "placed")
    update = {
        "payment_status": "paid",
        "updated_at": now,
    }
    if payment_id:
        update["razorpay_payment_id"] = payment_id
    if new_status == "pending_payment":
        new_status = "placed"
        update["status"] = new_status
    res = await db.orders.update_one(
        {"_id": order["_id"], "payment_status": {"$ne": "paid"}},
        {
            "$set": update,
            "$push": {"status_timeline": {
                "status": "placed",
                "timestamp": now.isoformat(),
                "note": f"Payment received ({via})",
            }},
        },
    )
    if res.modified_count:
        fresh = await db.orders.find_one({"_id": order["_id"]})
        await send_new_order_notifications(db, fresh)
    return new_status
