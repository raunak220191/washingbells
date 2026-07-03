"""Wallet — WB currency (1 Rupee = 1 WB), top-up, balance, transactions."""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.phase1_schemas import (
    WalletTopupRequest,
    WalletResponse,
    WalletTransactionResponse,
)
from app.services.razorpay_service import create_razorpay_order, verify_razorpay_payment
from app.core.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/wallet", tags=["wallet"])


async def _get_or_create_wallet(db, user_id: str) -> dict:
    """Get or initialize a wallet document for the user."""
    wallet = await db.wallets.find_one({"user_id": user_id})
    if not wallet:
        wallet = {
            "user_id": user_id,
            "balance": 0.0,
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.wallets.insert_one(wallet)
        wallet["_id"] = result.inserted_id
    return wallet


async def _get_transactions(db, user_id: str, limit: int = 20) -> list:
    """Get recent wallet transactions."""
    cursor = db.wallet_txns.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    txns = await cursor.to_list(length=limit)
    return [
        {
            "id": str(t["_id"]),
            "type": t["type"],
            "amount": t["amount"],
            "reason": t["reason"],
            "description": t["description"],
            "created_at": t["created_at"],
        }
        for t in txns
    ]


async def credit_wallet(db, user_id: str, amount: float, reason: str, description: str, order_id: str = None):
    """Credit amount to user's wallet."""
    now = datetime.now(timezone.utc)
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": amount}},
        upsert=True,
    )
    await db.wallet_txns.insert_one({
        "user_id": user_id,
        "type": "credit",
        "amount": amount,
        "reason": reason,
        "description": description,
        "order_id": order_id,
        "created_at": now,
    })


async def debit_wallet(db, user_id: str, amount: float, reason: str, description: str, order_id: str = None):
    """Debit amount from user's wallet. Raises error if insufficient balance."""
    wallet = await _get_or_create_wallet(db, user_id)
    if wallet["balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    now = datetime.now(timezone.utc)
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"balance": -amount}},
    )
    await db.wallet_txns.insert_one({
        "user_id": user_id,
        "type": "debit",
        "amount": amount,
        "reason": reason,
        "description": description,
        "order_id": order_id,
        "created_at": now,
    })


@router.get("", response_model=WalletResponse)
async def get_wallet(current_user: dict = Depends(get_current_user)):
    """Get wallet balance and recent transactions."""
    db = get_db()
    user_id = current_user["user_id"]
    wallet = await _get_or_create_wallet(db, user_id)
    transactions = await _get_transactions(db, user_id)
    return {
        "balance": wallet["balance"],
        "transactions": transactions,
    }


@router.post("/topup")
async def topup_wallet(
    body: WalletTopupRequest,
    current_user: dict = Depends(get_current_user),
):
    """Initiate wallet top-up. Returns Razorpay order for payment."""
    db = get_db()
    amount_paise = int(body.amount * 100)
    receipt = f"wallet-{current_user['user_id'][-8:]}-{uuid.uuid4().hex[:6]}"

    rz_order = await create_razorpay_order(amount_paise, receipt)
    if not rz_order:
        raise HTTPException(status_code=500, detail="Could not create payment order")

    # Persist the intent so verify credits the SERVER-side amount, never a
    # client-claimed one, and so retries are idempotent.
    await db.wallet_topups.insert_one({
        "user_id": current_user["user_id"],
        "razorpay_order_id": rz_order["id"],
        "amount": float(body.amount),
        "status": "created",
        "created_at": datetime.now(timezone.utc),
    })

    return {
        "razorpay_order_id": rz_order["id"],
        "razorpay_key_id": settings.RAZORPAY_KEY_ID or "dev_key",
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
    }


@router.post("/topup/verify")
async def verify_topup(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Verify top-up payment and credit wallet (amount from the stored intent)."""
    db = get_db()
    user_id = current_user["user_id"]

    order_id = body.get("razorpay_order_id", "")
    payment_id = body.get("razorpay_payment_id", "")
    signature = body.get("razorpay_signature", "")

    topup = await db.wallet_topups.find_one({"razorpay_order_id": order_id, "user_id": user_id})
    if not topup:
        raise HTTPException(status_code=404, detail="Top-up not found")
    if topup.get("status") == "credited":
        wallet = await _get_or_create_wallet(db, user_id)
        return {"message": "Wallet already topped up", "balance": wallet["balance"]}

    # Signature check — verify_razorpay_payment handles the dev-mock
    # (order_dev_*) path when Razorpay isn't configured.
    is_valid = await verify_razorpay_payment(order_id, payment_id, signature)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    amount = float(topup["amount"])
    await _get_or_create_wallet(db, user_id)
    await credit_wallet(
        db, user_id, amount,
        "top_up", f"Wallet top-up of ₹{amount:.0f}"
    )
    await db.wallet_topups.update_one({"_id": topup["_id"]}, {"$set": {
        "status": "credited", "razorpay_payment_id": payment_id,
        "credited_at": datetime.now(timezone.utc),
    }})
    wallet = await _get_or_create_wallet(db, user_id)
    return {"message": "Wallet topped up", "balance": wallet["balance"]}
