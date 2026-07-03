"""Store Operations — Store owner order management, processing, rider booking."""

import random
from datetime import datetime, timezone
from dateutil.parser import isoparse
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.utils import haversine_km
from app.schemas.phase2_schemas import (
    OTPVerifyRequest, StoreToggleRequest, StoreDeliveryTimeRequest,
    RejectOrderRequest, BookRiderRequest,
)
from app.services.push_service import notify_customer_order_update, notify_rider_trip_assigned
from app.services.email_service import send_event as send_email_event

RIDER_PICKUP_FEE = 40.0  # credited when the store confirms the rider's drop-off


async def _email_customer_order_update(db, order: dict, event: str, extra_context: dict | None = None):
    """Helper: render & send a customer order email. Pulls user email from DB."""
    try:
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        if not customer:
            return
        ctx = {
            "customer_name": customer.get("name") or "Customer",
            "order_number": order.get("order_number", ""),
            "total_amount": f"{order.get('total_amount', 0):.0f}",
            "pickup_slot": (order.get("pickup_slot") or {}).get("slot", ""),
            "store_name": "",
        }
        if order.get("store_id"):
            store = await db.stores.find_one({"_id": ObjectId(order["store_id"])})
            if store:
                ctx["store_name"] = store.get("name", "")
        if extra_context:
            ctx.update(extra_context)
        await send_email_event(
            event,
            to_email=customer.get("email"),
            audience="customer",
            user_id=str(customer["_id"]),
            order_id=str(order["_id"]),
            context=ctx,
        )
    except Exception:
        pass

router = APIRouter(prefix="/store-ops", tags=["Store Operations"])

RIDER_FEE = 40.0


def _require_store_owner(current_user: dict):
    if current_user.get("role") not in ("store_owner", "admin"):
        raise HTTPException(status_code=403, detail="Store owner access only")


async def _get_store(db, user_id: str):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("store_id"):
        raise HTTPException(status_code=404, detail="No store linked to this user")
    store = await db.stores.find_one({"_id": ObjectId(user["store_id"])})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


# ── Store Profile ────────────────────────────────────────────

@router.get("/my-store")
async def get_my_store(current_user: dict = Depends(get_current_user)):
    """Get the store owner's store details."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    # Legacy stores (created before profile_complete was introduced) default to True
    # so they aren't blocked. New admin-created stores get explicit False.
    return {
        "id": str(store["_id"]), "vendor_code": store["vendor_code"],
        "name": store["name"], "address": store["address"],
        "city": store["city"], "pincode": store.get("pincode"),
        "phone": store["phone"],
        "latitude": store["latitude"], "longitude": store["longitude"],
        "status": store["status"], "is_open": store.get("is_open", False),
        "opening_time": store.get("opening_time", "09:00"),
        "closing_time": store.get("closing_time", "21:00"),
        "total_earnings": store.get("total_earnings", 0.0),
        "pending_payout": store.get("pending_payout", 0.0),
        "approved": store.get("approved", False),
        "profile_complete": store.get("profile_complete", True),
        "store_photos": store.get("store_photos", []),
        "gst_number": store.get("gst_number"),
        "bank_account_number": store.get("bank_account_number"),
        "bank_ifsc": store.get("bank_ifsc"),
        "bank_account_holder": store.get("bank_account_holder"),
    }


@router.post("/complete-profile")
async def complete_store_profile(body: dict, current_user: dict = Depends(get_current_user)):
    """Store owner completes profile after admin-created accounts.
    Body: { store_photos: [base64...], gst_number, bank_account_number,
            bank_ifsc, bank_account_holder, latitude, longitude,
            opening_time, closing_time, address }
    All sections required to flip `profile_complete` to True.
    """
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])

    update = {"updated_at": datetime.now(timezone.utc)}

    # Merge any provided fields
    for k in ("address", "city", "pincode", "phone", "opening_time", "closing_time", "gst_number",
              "bank_account_number", "bank_ifsc", "bank_account_holder"):
        if k in body and body[k] is not None:
            update[k] = body[k]
    if "latitude" in body and "longitude" in body and body["latitude"] is not None:
        update["latitude"] = float(body["latitude"])
        update["longitude"] = float(body["longitude"])
    if "store_photos" in body and isinstance(body["store_photos"], list):
        update["store_photos"] = body["store_photos"]

    # Compute completeness based on merged state
    merged = {**store, **update}
    has_photos = bool(merged.get("store_photos"))
    has_gps = bool(merged.get("latitude") and merged.get("longitude"))
    has_gst = bool(merged.get("gst_number"))
    has_bank = bool(merged.get("bank_account_number") and merged.get("bank_ifsc") and merged.get("bank_account_holder"))
    update["profile_complete"] = has_photos and has_gps and has_gst and has_bank

    await db.stores.update_one({"_id": store["_id"]}, {"$set": update})
    return {
        "profile_complete": update["profile_complete"],
        "has_photos": has_photos, "has_gps": has_gps,
        "has_gst": has_gst, "has_bank": has_bank,
        "message": "Profile complete! Your store can now receive orders." if update["profile_complete"]
                   else "Profile updated. Complete the remaining sections to start receiving orders.",
    }


@router.put("/toggle")
async def toggle_store(body: StoreToggleRequest, current_user: dict = Depends(get_current_user)):
    """Turn store open/closed."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    await db.stores.update_one({"_id": store["_id"]}, {"$set": {"is_open": body.is_open}})
    return {"is_open": body.is_open}


# ── Incoming Orders ──────────────────────────────────────────

@router.get("/orders")
async def get_store_orders(status_filter: str = None, current_user: dict = Depends(get_current_user)):
    """Get all orders assigned to this store. Optional filter: placed,confirmed,picked_up,at_store,processing,ready_for_delivery,out_for_delivery,delivered"""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    query = {"store_id": str(store["_id"])}
    if status_filter:
        query["status"] = status_filter
    cursor = db.orders.find(query).sort("created_at", -1)
    orders = await cursor.to_list(length=100)
    result = []
    for o in orders:
        customer = await db.users.find_one({"_id": ObjectId(o["user_id"])})
        result.append({
            "id": str(o["_id"]), "order_number": o["order_number"],
            "status": o["status"], "total_amount": o["total_amount"],
            "items_count": sum(i.get("quantity", 1) for i in o.get("items", [])),
            "customer_name": customer.get("name", "Customer") if customer else "Customer",
            "customer_phone": customer.get("phone", "") if customer else "",
            "pickup_slot": o.get("pickup_slot"), "address": o.get("address"),
            "pickup_proof_photos": o.get("pickup_proof_photos", []),
            "expected_delivery_at": o.get("expected_delivery_at"),
            "order_source": o.get("order_source", "app"),
            "fulfillment_mode": o.get("fulfillment_mode", "rider_delivery"),
            "payment_status": o.get("payment_status"),
            "created_at": o["created_at"],
        })
    return result


@router.get("/orders/{order_id}")
async def get_store_order_detail(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get full order detail for store owner."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for this store")
    customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
    return {
        "id": str(order["_id"]), "order_number": order["order_number"],
        "status": order["status"], "items": order.get("items", []),
        "total_amount": order["total_amount"], "subtotal": order["subtotal"],
        "delivery_fee": order["delivery_fee"], "discount": order["discount"],
        "payment_method": order.get("payment_method"),
        "customer_name": customer.get("name", "Customer") if customer else "Customer",
        "customer_phone": customer.get("phone") if customer else "",
        "address": order.get("address"), "pickup_slot": order.get("pickup_slot"),
        "pickup_proof_photos": order.get("pickup_proof_photos", []),
        "pickup_photos_at": order.get("pickup_photos_at"),
        "garment_tags": order.get("garment_tags", []),
        "status_timeline": order.get("status_timeline", []),
        "expected_delivery_at": order.get("expected_delivery_at"),
        "special_instructions": order.get("special_instructions"),
        "store_payout": order.get("store_payout", 0),
        "payment_status": order.get("payment_status"),
        "order_source": order.get("order_source", "app"),
        "fulfillment_mode": order.get("fulfillment_mode", "rider_delivery"),
        "store_photos": order.get("store_photos", []),
        "created_at": order["created_at"],
    }


# ── Accept Order ─────────────────────────────────────────────

@router.post("/orders/{order_id}/accept")
async def accept_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Store owner accepts an incoming order."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "placed":
        raise HTTPException(status_code=400, detail=f"Cannot accept order in '{order['status']}' status")
    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": "confirmed", "timestamp": now.isoformat(), "note": f"Accepted by store {store['vendor_code']}"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "status": "confirmed", "status_timeline": tl, "updated_at": now,
    }})
    await db.notifications.insert_one({
        "type": "order_accepted",
        "order_id": order_id,
        "order_number": order["order_number"],
        "store_id": str(store["_id"]),
        "store_name": store["name"],
        "note": f"Accepted by store {store['vendor_code']}",
        "read": False,
        "created_at": now,
    })
    try:
        await notify_customer_order_update(
            order["user_id"], order["order_number"], "confirmed",
            f"Your order has been confirmed by {store['name']}. A rider will be assigned shortly.",
        )
    except Exception: pass
    await _email_customer_order_update(db, order, "order_confirmed")
    return {"message": "Order accepted", "order_number": order["order_number"]}


# ── Reject Order ─────────────────────────────────────────────

@router.post("/orders/{order_id}/reject")
async def reject_order(order_id: str, body: RejectOrderRequest, current_user: dict = Depends(get_current_user)):
    """Store owner rejects an incoming order."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "placed":
        raise HTTPException(status_code=400, detail=f"Cannot reject order in '{order['status']}' status")
    now = datetime.now(timezone.utc)
    note = body.reason or f"Rejected by store {store['vendor_code']}"
    tl = order.get("status_timeline", [])
    tl.append({"status": "rejected", "timestamp": now.isoformat(), "note": note})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "status": "rejected", "status_timeline": tl, "updated_at": now,
    }})
    # Give the customer their money back — same semantics as customer cancel:
    # wallet refunded, coupon use released. (Online payments need a manual
    # Razorpay refund from the admin; flagged in the admin notification.)
    wa = order.get("wallet_applied", 0)
    if wa > 0:
        await db.wallets.update_one({"user_id": order["user_id"]}, {"$inc": {"balance": wa}})
        await db.wallet_txns.insert_one({
            "user_id": order["user_id"], "type": "credit", "amount": wa, "reason": "refund",
            "description": f"Refund for rejected order {order['order_number']}",
            "order_id": order_id, "created_at": now,
        })
    if order.get("coupon_code"):
        await db.coupons.update_one({"code": order["coupon_code"]}, {"$inc": {"used_count": -1}})
    # Write admin notification
    await db.notifications.insert_one({
        "type": "order_rejected",
        "order_id": order_id,
        "order_number": order["order_number"],
        "store_id": str(store["_id"]),
        "store_name": store["name"],
        "note": note,
        "needs_manual_refund": order.get("payment_status") == "paid",
        "read": False,
        "created_at": now,
    })
    try:
        await notify_customer_order_update(
            order["user_id"], order["order_number"], "rejected",
            f"Your order was rejected: {note}."
            + (f" ₹{wa:.0f} was returned to your wallet." if wa > 0 else ""),
        )
    except Exception: pass
    return {"message": "Order rejected", "order_number": order["order_number"]}


# ── Receive Clothes (verify rider drop OTP) ──────────────────

@router.post("/orders/{order_id}/receive")
async def receive_clothes(order_id: str, body: OTPVerifyRequest, current_user: dict = Depends(get_current_user)):
    """Store owner verifies rider's OTP to confirm clothes received."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("store_received_otp") != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": "at_store", "timestamp": now.isoformat(), "note": "Clothes received at store"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "store_received_otp_verified": True, "store_received_at": now,
        "status": "at_store", "status_timeline": tl, "updated_at": now,
    }})

    # The clothes have reached the store — complete the rider's pickup trip and
    # credit the fee now (the trip was kept open from customer-pickup to here).
    pickup_trip = await db.trips.find_one({
        "order_id": order_id, "trip_type": "pickup", "status": {"$ne": "completed"},
    })
    if pickup_trip:
        await db.trips.update_one(
            {"_id": pickup_trip["_id"]},
            {"$set": {"status": "completed", "completed_at": now}},
        )
        rider_id = pickup_trip.get("rider_id")
        if rider_id:
            await db.users.update_one(
                {"_id": ObjectId(rider_id)},
                {"$inc": {"total_trips": 1, "total_earnings": RIDER_PICKUP_FEE},
                 "$set": {"rider_status": "online"}},
            )
            await db.orders.update_one(
                {"_id": ObjectId(order_id)}, {"$set": {"rider_pickup_fee": RIDER_PICKUP_FEE}}
            )

    return {"message": "Clothes received at store", "order_number": order["order_number"]}


# ── Operating Hours & Holiday Closures ───────────────────────

@router.get("/hours")
async def get_my_hours(current_user: dict = Depends(get_current_user)):
    """Return this store's weekly schedule + upcoming holiday closures."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    from app.services.store_hours_service import ensure_hours
    store = await ensure_hours(db, store)
    today_iso = datetime.now(timezone.utc).date().isoformat()
    cursor = db.store_closures.find({
        "store_id": str(store["_id"]),
        "date": {"$gte": today_iso},
    }).sort("date", 1).limit(60)
    closures = await cursor.to_list(length=60)
    return {
        "operating_hours": store["operating_hours"],
        "slot_capacity_per_hour": store.get("slot_capacity_per_hour", 6),
        "closures": [{
            "id": str(c["_id"]),
            "date": c["date"],
            "reason": c.get("reason", ""),
        } for c in closures],
    }


@router.put("/hours")
async def update_my_hours(body: dict, current_user: dict = Depends(get_current_user)):
    """Update this store's weekly schedule + slot capacity.

    Body:
      {
        "operating_hours": { "mon": {"open": "09:00", "close": "21:00", "closed": false}, ... },
        "slot_capacity_per_hour": 6   (optional)
      }
    """
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    update: dict = {"updated_at": datetime.now(timezone.utc)}
    if "operating_hours" in body and isinstance(body["operating_hours"], dict):
        hours = {}
        for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun"):
            entry = body["operating_hours"].get(day) or {}
            hours[day] = {
                "open": str(entry.get("open", "09:00")),
                "close": str(entry.get("close", "21:00")),
                "closed": bool(entry.get("closed", False)),
            }
        update["operating_hours"] = hours
        # Keep legacy flat fields in sync (admin listings still use these)
        first_open = next((h for h in hours.values() if not h.get("closed")), None)
        if first_open:
            update["opening_time"] = first_open["open"]
            update["closing_time"] = first_open["close"]
    if "slot_capacity_per_hour" in body:
        cap = int(body["slot_capacity_per_hour"])
        if cap < 1 or cap > 50:
            raise HTTPException(status_code=400, detail="slot_capacity_per_hour must be 1-50")
        update["slot_capacity_per_hour"] = cap
    await db.stores.update_one({"_id": store["_id"]}, {"$set": update})
    return {"message": "Hours updated", "operating_hours": update.get("operating_hours")}


@router.post("/closures")
async def add_holiday_closure(body: dict, current_user: dict = Depends(get_current_user)):
    """Mark a specific date as closed. Body: { date: 'YYYY-MM-DD', reason?: str }"""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    date_str = (body.get("date") or "").strip()
    if not date_str:
        raise HTTPException(status_code=400, detail="date (YYYY-MM-DD) required")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    doc = {
        "store_id": str(store["_id"]),
        "date": date_str,
        "reason": (body.get("reason") or "Closed").strip()[:120],
        "created_at": datetime.now(timezone.utc),
    }
    # Avoid duplicates for same store+date
    existing = await db.store_closures.find_one({"store_id": doc["store_id"], "date": date_str})
    if existing:
        await db.store_closures.update_one({"_id": existing["_id"]}, {"$set": {"reason": doc["reason"]}})
        return {"id": str(existing["_id"]), "message": "Closure updated"}
    result = await db.store_closures.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Closure added"}


@router.delete("/closures/{closure_id}")
async def delete_holiday_closure(closure_id: str, current_user: dict = Depends(get_current_user)):
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    try:
        await db.store_closures.delete_one({
            "_id": ObjectId(closure_id),
            "store_id": str(store["_id"]),
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid closure id")
    return {"message": "Closure removed"}


# ── Live Rider Tracking ──────────────────────────────────────

@router.get("/orders/{order_id}/rider-location")
async def get_assigned_rider_location(order_id: str, current_user: dict = Depends(get_current_user)):
    """Return the live GPS coordinates of the rider currently assigned to this
    order's active trip. Used by the store app to track pickups/deliveries.
    """
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Find the currently active trip for this order (pickup not yet completed,
    # or delivery in progress)
    trip = await db.trips.find_one({
        "order_id": order_id,
        "status": {"$in": ["assigned", "accepted", "started"]},
    }, sort=[("created_at", -1)])

    if not trip:
        return {"rider_id": None, "location": None, "trip_type": None, "trip_status": None}

    rider = await db.users.find_one({"_id": ObjectId(trip["rider_id"])}, {
        "name": 1, "phone": 1, "vehicle_type": 1, "vehicle_number": 1,
        "current_location": 1, "rider_status": 1, "updated_at": 1,
    })
    if not rider:
        return {"rider_id": None, "location": None, "trip_type": None, "trip_status": None}

    return {
        "rider_id": str(rider["_id"]),
        "rider_name": rider.get("name"),
        "rider_phone": rider.get("phone"),
        "vehicle_type": rider.get("vehicle_type"),
        "vehicle_number": rider.get("vehicle_number"),
        "location": rider.get("current_location"),
        "rider_status": rider.get("rider_status"),
        "trip_type": trip.get("trip_type"),
        "trip_status": trip.get("status"),
        "last_updated": rider.get("updated_at"),
    }


# ── Start Processing ─────────────────────────────────────────

@router.post("/orders/{order_id}/start-processing")
async def start_processing(order_id: str, current_user: dict = Depends(get_current_user)):
    """Store owner starts processing the order."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] not in ("at_store", "confirmed", "picked_up"):
        raise HTTPException(status_code=400, detail=f"Cannot process in '{order['status']}' status")
    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": "processing", "timestamp": now.isoformat(), "note": "Store started processing"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "status": "processing", "processing_started_at": now,
        "status_timeline": tl, "updated_at": now,
    }})
    return {"message": "Processing started", "order_number": order["order_number"]}


# ── Set Expected Delivery Time ───────────────────────────────

@router.put("/orders/{order_id}/delivery-time")
async def set_delivery_time(order_id: str, body: StoreDeliveryTimeRequest, current_user: dict = Depends(get_current_user)):
    """Store owner sets expected delivery time."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        dt = isoparse(body.expected_delivery_at)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "expected_delivery_at": dt, "updated_at": datetime.now(timezone.utc),
    }})
    return {"message": "Delivery time updated", "expected_delivery_at": dt.isoformat()}


# ── Mark Ready for Delivery ──────────────────────────────────

@router.post("/orders/{order_id}/mark-ready")
async def mark_ready(order_id: str, current_user: dict = Depends(get_current_user)):
    """Store owner marks order as ready for delivery."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "processing":
        raise HTTPException(status_code=400, detail=f"Cannot mark ready in '{order['status']}' status")
    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": "ready_for_delivery", "timestamp": now.isoformat(), "note": "Order ready for delivery"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "status": "ready_for_delivery", "ready_at": now,
        "status_timeline": tl, "updated_at": now,
    }})
    await _email_customer_order_update(db, order, "order_ready")
    # Push so the customer learns their order is ready (counter pickup vs delivery)
    try:
        if order.get("fulfillment_mode") == "counter_pickup":
            msg = "Your order is ready for pickup at the store counter."
        else:
            msg = "Your order is ready and will be out for delivery soon."
        await notify_customer_order_update(order["user_id"], order["order_number"], "ready_for_delivery", msg)
    except Exception:
        pass
    # Email: order ready → admin recipients (non-blocking)
    try:
        from app.services.email_service import send_event_to_admins
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        await send_event_to_admins("order_ready_admin", order_id=order_id, context={
            "order_number": order["order_number"],
            "customer_name": (customer or {}).get("name") or "Customer",
            "store_name": store.get("name", ""),
            "total_amount": f"{order.get('total_amount', 0):.0f}",
        })
    except Exception:
        pass
    return {"message": "Order marked as ready for delivery", "order_number": order["order_number"]}


# ── Assign Pickup Rider ──────────────────────────────────────

@router.post("/orders/{order_id}/assign-pickup-rider")
async def assign_pickup_rider(order_id: str, body: BookRiderRequest, current_user: dict = Depends(get_current_user)):
    """Store owner assigns a pickup rider to collect clothes from the customer."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Order must be confirmed to assign pickup rider")

    if body.rider_id:
        rider = await db.users.find_one({
            "_id": ObjectId(body.rider_id), "role": "rider",
            "rider_approved": True, "rider_status": "online",
        })
        if not rider:
            raise HTTPException(status_code=404, detail="Selected rider not available")
    else:
        rider = await db.users.find_one({
            "role": "rider", "rider_approved": True, "rider_status": "online",
        })
        if not rider:
            raise HTTPException(status_code=404, detail="No riders available. Try again later.")

    now = datetime.now(timezone.utc)
    customer_addr = order.get("address", {})
    trip_doc = {
        "rider_id": str(rider["_id"]), "order_id": order_id,
        "trip_type": "pickup", "status": "assigned",
        "pickup_address": customer_addr.get("full_address", "Customer address"),
        "drop_address": store["address"],
        "fee": RIDER_FEE, "created_at": now,
    }
    trip_result = await db.trips.insert_one(trip_doc)

    tl = order.get("status_timeline", [])
    tl.append({"status": "rider_assigned_pickup", "timestamp": now.isoformat(),
               "note": f"Pickup rider {rider.get('name', 'Rider')} assigned"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "pickup_rider_id": str(rider["_id"]),
        "status": "rider_assigned_pickup",
        "status_timeline": tl, "updated_at": now,
    }})
    # Push so a backgrounded rider learns about the trip (worklist only polls in-foreground)
    try:
        await notify_rider_trip_assigned(str(rider["_id"]), "pickup", order["order_number"], RIDER_FEE)
    except Exception: pass
    return {
        "message": f"Rider {rider.get('name', 'Rider')} assigned for pickup",
        "trip_id": str(trip_result.inserted_id),
        "rider_name": rider.get("name"),
        "rider_phone": rider.get("phone"),
    }


# ── Nearby Riders ────────────────────────────────────────────

@router.get("/riders/nearby")
async def get_nearby_riders(
    radius: float = Query(10.0, description="Search radius in km"),
    current_user: dict = Depends(get_current_user),
):
    """Return online approved riders near the store, sorted by distance."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    store_lat, store_lng = store["latitude"], store["longitude"]
    riders = await db.users.find({
        "role": "rider", "rider_approved": True, "rider_status": "online",
    }).to_list(length=100)
    nearby = []
    for r in riders:
        loc = r.get("current_location") or {}
        r_lat = loc.get("lat") or loc.get("latitude")
        r_lng = loc.get("lng") or loc.get("longitude")
        if r_lat is None or r_lng is None:
            continue
        dist = haversine_km(store_lat, store_lng, r_lat, r_lng)
        if dist <= radius:
            nearby.append({
                "id": str(r["_id"]),
                "name": r.get("name", "Rider"),
                "phone": r.get("phone"),
                "vehicle_type": r.get("vehicle_type"),
                "vehicle_number": r.get("vehicle_number"),
                "total_trips": r.get("total_trips", 0),
                "distance_km": round(dist, 2),
            })
    nearby.sort(key=lambda x: x["distance_km"])
    return nearby


# ── Book Rider for Delivery ──────────────────────────────────

@router.post("/orders/{order_id}/book-rider")
async def book_rider_for_delivery(order_id: str, body: BookRiderRequest, current_user: dict = Depends(get_current_user)):
    """Store owner books a rider for delivery. Pass rider_id for manual pick, omit for auto-assign."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] not in ("ready_for_delivery",):
        raise HTTPException(status_code=400, detail="Order must be ready_for_delivery to book rider")

    if body.rider_id:
        rider = await db.users.find_one({
            "_id": ObjectId(body.rider_id), "role": "rider",
            "rider_approved": True, "rider_status": "online",
        })
        if not rider:
            raise HTTPException(status_code=404, detail="Selected rider not available")
    else:
        rider = await db.users.find_one({
            "role": "rider", "rider_approved": True, "rider_status": "online",
        })
        if not rider:
            raise HTTPException(status_code=404, detail="No riders available. Try again later.")

    now = datetime.now(timezone.utc)
    customer_addr = order.get("address", {})
    trip_doc = {
        "rider_id": str(rider["_id"]), "order_id": order_id,
        "trip_type": "delivery", "status": "assigned",
        "pickup_address": store["address"],
        "drop_address": customer_addr.get("full_address", "Customer address"),
        "fee": RIDER_FEE, "created_at": now,
    }
    trip_result = await db.trips.insert_one(trip_doc)

    tl = order.get("status_timeline", [])
    tl.append({"status": "rider_assigned_delivery", "timestamp": now.isoformat(),
               "note": f"Delivery rider {rider.get('name', 'Rider')} assigned"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "delivery_rider_id": str(rider["_id"]),
        "status_timeline": tl, "updated_at": now,
    }})
    # Push so a backgrounded rider learns about the trip (worklist only polls in-foreground)
    try:
        await notify_rider_trip_assigned(str(rider["_id"]), "delivery", order["order_number"], RIDER_FEE)
    except Exception: pass
    return {
        "message": f"Rider {rider.get('name', 'Rider')} assigned for delivery",
        "trip_id": str(trip_result.inserted_id),
        "rider_name": rider.get("name"),
        "rider_phone": rider.get("phone"),
    }


# ── Earnings ─────────────────────────────────────────────────

@router.get("/earnings")
async def get_store_earnings(current_user: dict = Depends(get_current_user)):
    """Get store earnings summary."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    # Count completed orders
    completed = await db.orders.count_documents({"store_id": str(store["_id"]), "status": "delivered"})
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = await db.orders.count_documents({
        "store_id": str(store["_id"]), "status": "delivered",
        "delivered_at": {"$gte": today_start},
    })
    return {
        "total_earnings": store.get("total_earnings", 0.0),
        "pending_payout": store.get("pending_payout", 0.0),
        "total_completed_orders": completed,
        "today_completed_orders": today_orders,
        "commission_rate": "80%",
        "platform_fee_rate": "20%",
    }


# ── Payout history (store view) ──────────────────────────────

@router.get("/payouts")
async def get_store_payouts(current_user: dict = Depends(get_current_user)):
    """Store owner's settlement history + current pending balance."""
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    payouts = await db.payouts.find({"store_id": str(store["_id"])}).sort("created_at", -1).to_list(length=100)
    history = [{
        "id": str(p["_id"]),
        "amount": round(p.get("amount", 0.0), 2),
        "reference": p.get("reference", ""),
        "note": p.get("note", ""),
        "status": p.get("status", "paid"),
        "created_at": p.get("created_at"),
    } for p in payouts]
    total_paid = round(sum(h["amount"] for h in history), 2)
    return {
        "pending_payout": round(store.get("pending_payout", 0.0), 2),
        "total_earnings": round(store.get("total_earnings", 0.0), 2),
        "total_paid_out": total_paid,
        "history": history,
    }


# ── Walk-in / Counter orders ─────────────────────────────────

def _normalize_phone(raw: str) -> str:
    """Normalize an Indian phone to +91XXXXXXXXXX."""
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit phone number")
    return f"+91{digits}"


@router.get("/customers/lookup")
async def lookup_customer(phone: str, current_user: dict = Depends(get_current_user)):
    """Find a customer by phone for walk-in order creation."""
    _require_store_owner(current_user)
    db = get_db()
    normalized = _normalize_phone(phone)
    user = await db.users.find_one({"phone": normalized})
    if not user:
        return {"found": False, "phone": normalized}
    return {
        "found": True,
        "id": str(user["_id"]),
        "name": user.get("name"),
        "phone": user["phone"],
        "email": user.get("email"),
    }


@router.post("/orders/walk-in")
async def create_walk_in_order(body: dict, current_user: dict = Depends(get_current_user)):
    """Create an order for a walk-in customer at the store counter.

    Body: {
      customer_phone, customer_name,
      items: [{service_id, item_id, quantity}],
      fulfillment_mode: "counter_pickup" | "rider_delivery",
      payment_method: "cash" | "upi" | "online",
      address: {full_address, latitude, longitude, city, label?}  # required for rider_delivery
      special_instructions?
    }
    """
    from app.routers.orders import _generate_order_number, _generate_garment_tags, FREE_DELIVERY_THRESHOLD, DELIVERY_FEE
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])

    phone = _normalize_phone(body.get("customer_phone", ""))
    name = (body.get("customer_name") or "").strip()
    fulfillment_mode = body.get("fulfillment_mode", "counter_pickup")
    if fulfillment_mode not in ("counter_pickup", "rider_delivery"):
        raise HTTPException(status_code=400, detail="Invalid fulfillment_mode")
    payment_method = body.get("payment_method", "cash")
    if payment_method not in ("cash", "upi", "online"):
        raise HTTPException(status_code=400, detail="Invalid payment_method")

    raw_items = body.get("items") or []
    if not raw_items:
        raise HTTPException(status_code=400, detail="Add at least one item")

    # Resolve items against the catalog
    line_items = []
    service_cache = {}
    for ri in raw_items:
        sid = ri.get("service_id")
        item_id = ri.get("item_id")
        if not sid or not item_id:
            continue
        if sid not in service_cache:
            try:
                service_cache[sid] = await db.services.find_one({"_id": ObjectId(sid)})
            except Exception:
                service_cache[sid] = None
        svc = service_cache.get(sid)
        if not svc:
            continue
        matched = next((it for it in svc.get("items", []) if str(it.get("_id", "")) == item_id), None)
        if not matched:
            continue
        # kg-priced services accept fractional quantities (weight)
        unit = svc.get("pricing_unit", "piece")
        try:
            if unit == "kg":
                qty = round(float(ri.get("quantity", 0) or 0), 3)
            else:
                qty = int(ri.get("quantity", 0) or 0)
        except (TypeError, ValueError):
            continue
        if qty <= 0:
            continue
        price = float(matched["price"])
        line_items.append({
            "service_name": svc["name"],
            "item_name": matched["name"],
            "price": price,
            "quantity": qty,
            "unit": unit,
            "subtotal": round(price * qty, 2),
            "category": matched.get("category", "unisex"),
        })
    if not line_items:
        raise HTTPException(status_code=400, detail="None of the selected items are valid")

    subtotal = round(sum(li["subtotal"] for li in line_items), 2)

    # Delivery fee only applies when finished goods go out via rider
    if fulfillment_mode == "rider_delivery":
        delivery_fee = 0.0 if subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_FEE
    else:
        delivery_fee = 0.0
    total_amount = round(subtotal + delivery_fee, 2)

    # Lookup-or-create the customer
    user = await db.users.find_one({"phone": phone})
    now = datetime.now(timezone.utc)
    if not user:
        user_doc = {
            "phone": phone, "name": name or "Walk-in Customer", "email": None,
            "role": "customer", "is_walk_in": True,
            "created_at": now, "updated_at": now,
        }
        res = await db.users.insert_one(user_doc)
        user = await db.users.find_one({"_id": res.inserted_id})
    elif name and not user.get("name"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"name": name, "updated_at": now}})
    user_id = str(user["_id"])

    # Address — coordinates optional; riders navigate by the address text, so
    # missing coords just fall back to the store's location.
    if fulfillment_mode == "rider_delivery":
        addr = body.get("address") or {}
        if not addr.get("full_address"):
            raise HTTPException(status_code=400, detail="Delivery address is required for rider delivery")
        try:
            lat = float(addr["latitude"]) if addr.get("latitude") not in (None, "") else store.get("latitude")
            lng = float(addr["longitude"]) if addr.get("longitude") not in (None, "") else store.get("longitude")
        except (TypeError, ValueError):
            lat, lng = store.get("latitude"), store.get("longitude")
        address = {
            "id": None,
            "label": addr.get("label", "Delivery"),
            "full_address": addr["full_address"],
            "latitude": lat,
            "longitude": lng,
            "city": addr.get("city", store.get("city", "")),
        }
    else:
        address = {
            "id": None,
            "label": "Walk-in / Counter",
            "full_address": f"Counter pickup at {store.get('name', 'store')}, {store.get('address', '')}",
            "latitude": store.get("latitude"),
            "longitude": store.get("longitude"),
            "city": store.get("city", ""),
        }

    payment_status = "paid" if payment_method in ("cash", "upi") else "pending"
    order_number = _generate_order_number()
    garment_tags = _generate_garment_tags(order_number, line_items)
    # Clothes are already physically at the store → start at "at_store"
    timeline = [
        {"status": "placed", "timestamp": now.isoformat(), "note": f"Walk-in order created at store {store.get('vendor_code', '')}"},
        {"status": "at_store", "timestamp": now.isoformat(), "note": "Garments received at counter"},
    ]
    slot = {"date": now.strftime("%Y-%m-%d"), "slot": "Walk-in"}

    order_doc = {
        "order_number": order_number, "user_id": user_id,
        "items": line_items,
        "address": address,
        "pickup_slot": slot, "delivery_slot": slot,
        "special_instructions": body.get("special_instructions"),
        "payment_method": payment_method, "status": "at_store", "payment_status": payment_status,
        "status_timeline": timeline,
        "garment_tags": garment_tags, "assigned_agent_id": None, "agent_info": None,
        "pickup_proof_images": [], "delivery_proof_images": [], "store_photos": [],
        # Walk-in / source fields
        "order_source": "walk_in", "fulfillment_mode": fulfillment_mode,
        "created_by_store_id": str(store["_id"]),
        "store_id": str(store["_id"]),
        "pickup_rider_id": None, "delivery_rider_id": None,
        "pickup_otp": None, "pickup_otp_verified": False, "pickup_completed_at": None,
        "store_received_otp": None, "store_received_otp_verified": True, "store_received_at": now,
        "processing_started_at": None, "expected_delivery_at": None, "ready_at": None,
        "delivery_otp": None, "delivery_otp_verified": False, "delivered_at": None,
        "store_payout": 0.0, "platform_fee": 0.0, "rider_pickup_fee": 0.0, "rider_delivery_fee": 0.0,
        "customer_rating": None, "customer_review": None,
        "subtotal": subtotal, "delivery_fee": delivery_fee, "discount": 0.0,
        "wallet_applied": 0.0, "total_amount": total_amount,
        "coupon_code": None, "razorpay_order_id": None,
        "created_at": now, "updated_at": now,
    }
    result = await db.orders.insert_one(order_doc)
    # Notify the customer that a counter order was created for them (non-blocking)
    try:
        handoff = "for pickup at the counter" if fulfillment_mode == "counter_pickup" else "for delivery"
        await notify_customer_order_update(
            user_id, order_number, "at_store",
            f"{store.get('name', 'The store')} created order {order_number} {handoff}.",
        )
    except Exception:
        pass
    # Email: new order → admin recipients (non-blocking)
    try:
        from app.services.email_service import send_event_to_admins
        await send_event_to_admins("new_order_admin", order_id=str(result.inserted_id), context={
            "order_number": order_number,
            "customer_name": user.get("name") or "Customer",
            "customer_phone": user.get("phone", ""),
            "total_amount": f"{total_amount:.0f}",
            "items_summary": ", ".join(f"{li['item_name']} × {li['quantity']}" for li in line_items[:6]),
            "source": "store walk-in",
            "store_name": store.get("name", ""),
        })
    except Exception:
        pass
    return {
        "id": str(result.inserted_id),
        "order_number": order_number,
        "total_amount": total_amount,
        "payment_status": payment_status,
        "fulfillment_mode": fulfillment_mode,
        "customer_name": user.get("name"),
        "message": "Walk-in order created",
    }


@router.post("/orders/{order_id}/complete-counter")
async def complete_counter_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Hand finished garments to a walk-in customer at the counter → delivered.

    Only valid for counter_pickup orders. Computes the store payout the same way
    rider delivery does, so earnings/settlements stay consistent.
    """
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for this store")
    if order.get("fulfillment_mode") != "counter_pickup":
        raise HTTPException(status_code=400, detail="This order is set for rider delivery, not counter pickup")
    if order.get("status") == "delivered":
        return {"message": "Already completed", "status": "delivered"}
    if order.get("status") not in ("processing", "ready_for_delivery", "at_store"):
        raise HTTPException(status_code=400, detail=f"Cannot complete from '{order.get('status')}' status")

    now = datetime.now(timezone.utc)
    total = order.get("total_amount", 0)
    platform_fee = round(total * 0.20, 2)
    store_payout = round(total - platform_fee, 2)
    tl = order.get("status_timeline", [])
    tl.append({"status": "delivered", "timestamp": now.isoformat(), "note": "Handed to customer at counter"})

    update = {
        "status": "delivered", "status_timeline": tl, "delivered_at": now,
        "store_payout": store_payout, "platform_fee": platform_fee, "updated_at": now,
    }
    # Cash/UPI collected at counter → mark paid on completion if not already
    if order.get("payment_status") != "paid" and order.get("payment_method") in ("cash", "upi"):
        update["payment_status"] = "paid"
    await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    await db.stores.update_one({"_id": store["_id"]}, {
        "$inc": {"total_earnings": store_payout, "pending_payout": store_payout},
    })
    try:
        await notify_customer_order_update(
            order["user_id"], order["order_number"], "delivered",
            f"Order {order['order_number']} completed — thanks for choosing WashingBells!",
        )
    except Exception:
        pass
    # Emails: delivered → customer + admin recipients (non-blocking)
    try:
        from app.services.email_service import send_event, send_event_to_admins
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        await send_event(
            "order_delivered",
            to_email=(customer or {}).get("email"),
            audience="customer", user_id=order["user_id"], order_id=order_id,
            context={
                "customer_name": (customer or {}).get("name") or "Customer",
                "order_number": order["order_number"],
                "total_amount": f"{order.get('total_amount', 0):.0f}",
            },
        )
        await send_event_to_admins("order_delivered_admin", order_id=order_id, context={
            "order_number": order["order_number"],
            "customer_name": (customer or {}).get("name") or "Customer",
            "total_amount": f"{order.get('total_amount', 0):.0f}",
            "payment_status": update.get("payment_status", order.get("payment_status", "pending")),
            "payment_method": order.get("payment_method", ""),
            "mode": "counter pickup",
        })
    except Exception:
        pass
    return {"message": "Order completed", "status": "delivered", "store_payout": store_payout}


# ── Store photo capture ──────────────────────────────────────

@router.post("/orders/{order_id}/photos")
async def upload_store_photos(order_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Capture intake/proof photos at the store and attach them to the order.

    Body: { photos: [base64...], context: "store_intake" | "store_proof" }
    Mirrors the rider pickup-photo upload (delivery.py) — base64 → uploads
    collection, refs appended to order.store_photos.
    """
    _require_store_owner(current_user)
    db = get_db()
    store = await _get_store(db, current_user["user_id"])
    order = await db.orders.find_one({"_id": ObjectId(order_id), "store_id": str(store["_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for this store")

    photos = body.get("photos") or []
    if not isinstance(photos, list) or not photos:
        raise HTTPException(status_code=400, detail="No photos provided")
    if len(photos) > 10:
        raise HTTPException(status_code=400, detail="Max 10 photos per upload")
    context = body.get("context", "store_intake")
    if context not in ("store_intake", "store_proof"):
        context = "store_intake"

    now = datetime.now(timezone.utc)
    refs = []
    for idx, data in enumerate(photos):
        if not isinstance(data, str) or not data:
            continue
        upload_doc = {
            "filename": f"{context}_{order['order_number']}_{idx}_{random.randint(1000, 9999)}",
            "user_id": current_user["user_id"],
            "context": context,
            "order_id": order_id,
            "data": data,
            "size": len(data),
            "created_at": now,
        }
        res = await db.uploads.insert_one(upload_doc)
        refs.append({
            "url": f"/api/v1/upload/{str(res.inserted_id)}",
            "upload_id": str(res.inserted_id),
            "size": len(data),
            "context": context,
            "uploaded_at": now.isoformat(),
            "uploaded_by": current_user["user_id"],
        })
    if not refs:
        raise HTTPException(status_code=400, detail="No valid photos to upload")

    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$push": {"store_photos": {"$each": refs}}, "$set": {"updated_at": now}},
    )
    updated = await db.orders.find_one({"_id": order["_id"]})
    return {"message": f"{len(refs)} photo(s) uploaded", "store_photos": updated.get("store_photos", [])}
