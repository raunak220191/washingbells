from fastapi import APIRouter, Depends, HTTPException
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

settings = get_settings()
router = APIRouter(prefix="/payments", tags=["Payments"])


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

    # Mark as paid and confirmed
    now = datetime.now(timezone.utc)
    await db.orders.update_one(
        {"_id": ObjectId(request.order_id)},
        {
            "$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "razorpay_payment_id": request.razorpay_payment_id,
                "updated_at": now,
            }
        },
    )

    return {
        "message": "Payment verified successfully",
        "order_id": request.order_id,
        "status": "confirmed",
    }
