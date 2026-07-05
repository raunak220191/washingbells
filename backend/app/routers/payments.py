import hmac
import hashlib
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.schemas.schemas import (
    PaymentCreateRequest,
    PaymentCreateResponse,
    PaymentVerifyRequest,
)
from app.services.razorpay_service import (
    create_razorpay_order,
    verify_razorpay_payment,
)
from app.services.order_notify_service import confirm_order_paid

settings = get_settings()
router = APIRouter(prefix="/payments", tags=["Payments"])
logger = logging.getLogger(__name__)


@router.post("/create", response_model=PaymentCreateResponse)
async def create_payment(
    request: PaymentCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Razorpay order for payment."""
    db = get_db()
    order = await db.orders.find_one(
        {"_id": ObjectId(request.order_id), "user_id": current_user["user_id"]}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")

    amount_paise = int(order["total_amount"] * 100)

    rz_order = await create_razorpay_order(
        amount_paise=amount_paise,
        receipt=order["order_number"],
    )
    if not rz_order:
        raise HTTPException(status_code=500, detail="Failed to create payment order")

    # Save razorpay_order_id on the order
    await db.orders.update_one(
        {"_id": ObjectId(request.order_id)},
        {"$set": {"razorpay_order_id": rz_order["id"]}},
    )

    return PaymentCreateResponse(
        razorpay_order_id=rz_order["id"],
        razorpay_key_id=settings.RAZORPAY_KEY_ID or "rzp_test_placeholder",
        amount=amount_paise,
        currency="INR",
        order_id=request.order_id,
    )


@router.post("/verify")
async def verify_payment(
    request: PaymentVerifyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Verify Razorpay payment signature and mark order as paid."""
    db = get_db()
    order = await db.orders.find_one(
        {"_id": ObjectId(request.order_id), "user_id": current_user["user_id"]}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Already paid — idempotent success; never downgrade a paid order.
    if order.get("payment_status") == "paid":
        return {"message": "Payment already verified", "order_id": request.order_id, "status": order.get("status", "confirmed")}

    is_valid = await verify_razorpay_payment(
        order_id=request.razorpay_order_id,
        payment_id=request.razorpay_payment_id,
        signature=request.razorpay_signature,
    )

    if not is_valid:
        await db.orders.update_one(
            {"_id": ObjectId(request.order_id)},
            {
                "$set": {
                    "payment_status": "failed",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Mark as paid — and ONLY paid. "confirmed" means the STORE accepted the
    # order; flipping it here made prepaid orders skip the store's
    # accept/reject step entirely (store UI only offers Accept on "placed").
    # A pending_payment order does move to "placed" so it enters the queue,
    # and the deferred new-order notifications (store push + emails) fire now.
    new_status = await confirm_order_paid(
        db, order, request.razorpay_payment_id, via="checkout"
    )

    return {
        "message": "Payment verified successfully",
        "order_id": request.order_id,
        "status": new_status,
    }


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Razorpay server-to-server webhook — the authoritative payment signal.

    Client-side /verify can be skipped (app killed mid-checkout), so
    `payment.captured` / `order.paid` here is what guarantees the order flips
    to paid. Signature = HMAC-SHA256(raw_body, RAZORPAY_WEBHOOK_SECRET) in the
    X-Razorpay-Signature header. Unauthenticated by design; the signature IS
    the auth.
    """
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not secret:
        logger.warning("Razorpay webhook hit but RAZORPAY_WEBHOOK_SECRET is not set")
        raise HTTPException(status_code=503, detail="Webhook not configured")

    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not (signature and hmac.compare_digest(expected, signature)):
        logger.warning("Razorpay webhook signature mismatch")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_name = event.get("event", "")
    if event_name not in ("payment.captured", "order.paid"):
        return {"status": "ignored", "event": event_name}

    payment = (
        event.get("payload", {}).get("payment", {}).get("entity", {})
    )
    rz_order_id = payment.get("order_id")
    rz_payment_id = payment.get("id")
    if not rz_order_id:
        return {"status": "ignored", "reason": "no order_id in payload"}

    db = get_db()
    order = await db.orders.find_one({"razorpay_order_id": rz_order_id})
    if not order:
        logger.warning(f"Razorpay webhook: no order for razorpay_order_id={rz_order_id}")
        return {"status": "ignored", "reason": "order not found"}

    new_status = await confirm_order_paid(db, order, rz_payment_id, via="webhook")
    logger.info(
        f"Razorpay webhook: order {order['order_number']} paid via {event_name}, status={new_status}"
    )
    return {"status": "ok", "order_status": new_status}
