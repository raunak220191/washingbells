from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
import random, string, math
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import OrderCreate, OrderResponse, RescheduleRequest
from app.routers.cart import _build_cart_response
from app.services.push_service import notify_store_new_order, notify_customer_order_update
from app.services.email_service import send_event as send_email_event

router = APIRouter(prefix="/orders", tags=["Orders"])
FREE_DELIVERY_THRESHOLD = 299.0
DELIVERY_FEE = 40.0

def _safe_oid(value, what):
    """Parse an ObjectId or raise a clean 400. Without this a malformed id (e.g.
    a stale/blank store or address id from the client) makes ObjectId() raise
    InvalidId, which surfaces as an opaque 500 — the app then shows its generic
    'Failed to place order.' fallback instead of a useful message."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid {what}. Please re-select and try again.")


def _generate_order_number():
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"WB-{datetime.now().year}-{suffix}"

def _haversine_km(lat1, lng1, lat2, lng2):
    """Great-circle distance in km between two lat/lng points."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(a))

def _pick_nearest_store(stores, lat, lng):
    """Return the store closest to (lat, lng). Falls back to the first store
    when coordinates are missing so an order still gets assigned."""
    if not stores:
        return None
    if lat is None or lng is None:
        return stores[0]
    def dist(s):
        slat, slng = s.get("latitude"), s.get("longitude")
        if slat is None or slng is None:
            return float("inf")
        return _haversine_km(lat, lng, slat, slng)
    return min(stores, key=dist)

def _generate_garment_tags(order_number, items):
    tags, counter = [], 1
    for item in items:
        # Weight-priced lines (kg) get ONE tag — it's a bag, not N garments.
        n = 1 if item.get("unit") == "kg" else max(1, int(item.get("quantity", 1)))
        for _ in range(n):
            tags.append({"tag_code": f"{order_number}-{counter:03d}", "item_name": item["item_name"], "service_name": item["service_name"], "status": "tagged"})
            counter += 1
    return tags

async def _calc_coupon_discount(db, code, subtotal, user_id):
    if not code: return 0.0
    c = await db.coupons.find_one({"code": code.upper(), "active": True})
    if not c: return 0.0
    now = datetime.now(timezone.utc)
    # MongoDB datetimes are naive — coerce to UTC-aware before comparing.
    valid_to = c.get("valid_to")
    if valid_to is not None and valid_to.tzinfo is None:
        valid_to = valid_to.replace(tzinfo=timezone.utc)
    if valid_to and valid_to < now: return 0.0
    if c.get("min_order", 0) > subtotal: return 0.0
    if c.get("usage_limit") and c.get("used_count", 0) >= c["usage_limit"]: return 0.0
    if c["type"] == "percent":
        return min(subtotal * c["value"] / 100, c.get("max_discount", 9999))
    return min(c["value"], subtotal)

def _format_order(order):
    items = [{"service_name": i["service_name"], "item_name": i["item_name"], "price": i["price"], "quantity": i["quantity"], "subtotal": i["subtotal"], "category": i.get("category", "unisex"), "unit": i.get("unit", "piece")} for i in order.get("items", [])]
    return OrderResponse(
        id=str(order["_id"]), order_number=order["order_number"], user_id=order["user_id"],
        items=items, address=order["address"], pickup_slot=order["pickup_slot"],
        delivery_slot=order["delivery_slot"], special_instructions=order.get("special_instructions"),
        payment_method=order.get("payment_method", "online"), status=order["status"],
        payment_status=order["payment_status"],
        status_timeline=order.get("status_timeline", []),
        garment_tags=order.get("garment_tags", []),
        assigned_agent_id=order.get("assigned_agent_id"),
        agent_info=order.get("agent_info"),
        subtotal=order["subtotal"], delivery_fee=order["delivery_fee"],
        discount=order["discount"], wallet_applied=order.get("wallet_applied", 0.0),
        total_amount=order["total_amount"], coupon_code=order.get("coupon_code"),
        razorpay_order_id=order.get("razorpay_order_id"),
        order_source=order.get("order_source", "app"),
        fulfillment_mode=order.get("fulfillment_mode", "rider_delivery"),
        created_at=order["created_at"], updated_at=order["updated_at"],
    )

@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    cart_response = await _build_cart_response(db, user_id)
    if not cart_response.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    address = await db.addresses.find_one({"_id": _safe_oid(order_data.address_id, "address"), "user_id": user_id})
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    subtotal = cart_response.total_amount
    delivery_fee = 0.0 if subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_FEE
    discount = await _calc_coupon_discount(db, order_data.coupon_code, subtotal, user_id)
    wallet_applied = 0.0
    if order_data.wallet_amount > 0:
        w = await db.wallets.find_one({"user_id": user_id})
        avail = w["balance"] if w else 0.0
        wallet_applied = min(order_data.wallet_amount, avail, subtotal + delivery_fee - discount)
    total_amount = max(round(subtotal + delivery_fee - discount - wallet_applied, 2), 0)
    pm = order_data.payment_method or "online"
    ps = "cod_pending" if pm == "cod" else "pending"
    now = datetime.now(timezone.utc)
    order_number = _generate_order_number()
    garment_tags = _generate_garment_tags(order_number, [i.model_dump() for i in cart_response.items])
    order_doc = {
        "order_number": order_number, "user_id": user_id,
        "items": [i.model_dump() for i in cart_response.items],
        "address": {"id": str(address["_id"]), "label": address["label"], "full_address": address["full_address"], "latitude": address["latitude"], "longitude": address["longitude"], "city": address["city"]},
        "pickup_slot": order_data.pickup_slot.model_dump(),
        "delivery_slot": order_data.delivery_slot.model_dump(),
        "special_instructions": order_data.special_instructions,
        "payment_method": pm, "status": "placed", "payment_status": ps,
        "status_timeline": [{"status": "placed", "timestamp": now.isoformat(), "note": "Order placed"}],
        "garment_tags": garment_tags, "assigned_agent_id": None, "agent_info": None,
        "pickup_proof_images": [], "delivery_proof_images": [],
        # Phase 2 fields
        "store_id": None, "pickup_rider_id": None, "delivery_rider_id": None,
        "pickup_otp": None, "pickup_otp_verified": False, "pickup_completed_at": None,
        "store_received_otp": None, "store_received_otp_verified": False, "store_received_at": None,
        "processing_started_at": None, "expected_delivery_at": None, "ready_at": None,
        "delivery_otp": None, "delivery_otp_verified": False, "delivered_at": None,
        "store_payout": 0.0, "platform_fee": 0.0, "rider_pickup_fee": 0.0, "rider_delivery_fee": 0.0,
        "customer_rating": None, "customer_review": None,
        "subtotal": subtotal, "delivery_fee": delivery_fee, "discount": round(discount, 2),
        "wallet_applied": round(wallet_applied, 2), "total_amount": total_amount,
        "coupon_code": order_data.coupon_code.upper() if order_data.coupon_code else None,
        "razorpay_order_id": None, "created_at": now, "updated_at": now,
    }
    # Assign store: use customer-selected store_id if provided, else auto-assign nearest
    if order_data.store_id:
        selected_store = await db.stores.find_one({"_id": _safe_oid(order_data.store_id, "store selection"), "status": "active"})
        if not selected_store:
            raise HTTPException(status_code=404, detail="Selected store not found or inactive")
        order_doc["store_id"] = order_data.store_id
    else:
        # Auto-assign the geographically nearest store to the pickup address.
        # Prefer stores that are currently open; fall back to any active store
        # so the order is still routed if none are marked open.
        active_stores = await db.stores.find({"status": "active"}).to_list(length=500)
        open_stores = [s for s in active_stores if s.get("is_open")]
        candidates = open_stores or active_stores
        nearest_store = _pick_nearest_store(
            candidates, address.get("latitude"), address.get("longitude")
        )
        if nearest_store:
            order_doc["store_id"] = str(nearest_store["_id"])

    # Validate pickup slot against the assigned store's hours (lenient for legacy stores)
    if order_doc.get("store_id"):
        from app.services.store_hours_service import validate_slot_against_hours
        ok, err = await validate_slot_against_hours(
            db, order_doc["store_id"], order_doc.get("pickup_slot"),
        )
        if not ok:
            raise HTTPException(status_code=400, detail=err or "Invalid pickup slot")

    result = await db.orders.insert_one(order_doc)
    if wallet_applied > 0:
        await db.wallets.update_one({"user_id": user_id}, {"$inc": {"balance": -wallet_applied}})
        await db.wallet_txns.insert_one({"user_id": user_id, "type": "debit", "amount": wallet_applied, "reason": "order_payment", "description": f"Payment for {order_number}", "order_id": str(result.inserted_id), "created_at": now})
    if order_data.coupon_code:
        await db.coupons.update_one({"code": order_data.coupon_code.upper()}, {"$inc": {"used_count": 1}})
    await db.carts.delete_one({"user_id": user_id})
    created = await db.orders.find_one({"_id": result.inserted_id})
    # Push notifications + emails — all non-blocking
    customer = await db.users.find_one({"_id": ObjectId(user_id)})
    customer_name = (customer.get("name") if customer else None) or "Customer"
    customer_email = customer.get("email") if customer else None
    store_doc = None
    if created.get("store_id"):
        store_doc = await db.stores.find_one({"_id": ObjectId(created["store_id"])})
        if store_doc and store_doc.get("owner_user_id"):
            try:
                await notify_store_new_order(
                    store_doc["owner_user_id"], created["order_number"],
                    customer_name, created["total_amount"],
                )
            except Exception: pass
    try:
        await notify_customer_order_update(
            user_id, created["order_number"], "placed",
            "Order placed successfully! We'll notify you when a store accepts it.",
        )
    except Exception: pass

    # Email: order placed → customer
    try:
        await send_email_event(
            "order_placed",
            to_email=customer_email,
            audience="customer",
            user_id=user_id,
            order_id=str(created["_id"]),
            context={
                "customer_name": customer_name,
                "order_number": created["order_number"],
                "total_amount": f"{created['total_amount']:.0f}",
                "items_count": str(sum(i.get("quantity", 1) for i in created.get("items", []))),
            },
        )
    except Exception: pass

    # Email: new order → store owner
    if store_doc and store_doc.get("owner_user_id"):
        try:
            owner = await db.users.find_one({"_id": ObjectId(store_doc["owner_user_id"])})
            owner_email = owner.get("email") if owner else None
            await send_email_event(
                "new_order_for_store",
                to_email=owner_email,
                audience="store",
                user_id=store_doc["owner_user_id"],
                order_id=str(created["_id"]),
                context={
                    "owner_name": (owner.get("name") if owner else None) or "Store Owner",
                    "order_number": created["order_number"],
                    "customer_name": customer_name,
                    "total_amount": f"{created['total_amount']:.0f}",
                    "items_count": str(sum(i.get("quantity", 1) for i in created.get("items", []))),
                    "store_name": store_doc.get("name", ""),
                },
            )
        except Exception: pass

    return _format_order(created)

@router.get("", response_model=list[OrderResponse])
async def list_orders(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.orders.find({"user_id": current_user["user_id"]}).sort("created_at", -1)
    orders = await cursor.to_list(length=50)
    return [_format_order(o) for o in orders]

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": current_user["user_id"]})
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    return _format_order(order)

@router.get("/{order_id}/tags/pdf")
async def get_garment_tags_pdf(order_id: str, current_user: dict = Depends(get_current_user)):
    """Render the order's garment tags as a printable PDF.
    Each tag carries a QR + Code128 barcode + the human-readable tag code.
    Accessible by the order's customer, the assigned store owner, or admin.
    """
    from fastapi.responses import Response
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Authorization: customer who placed it, admin, or assigned store owner
    role = current_user.get("role")
    user_id = current_user["user_id"]
    is_owner = order.get("user_id") == user_id
    is_admin = role == "admin"
    is_assigned_store = False
    if role == "store_owner" and order.get("store_id"):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        is_assigned_store = bool(user and user.get("store_id") == order["store_id"])
    if not (is_owner or is_admin or is_assigned_store):
        raise HTTPException(status_code=403, detail="Not authorized to print these tags")

    tags = order.get("garment_tags") or []
    from app.services.tag_pdf_service import render_tags_pdf
    pdf_bytes = render_tags_pdf(order["order_number"], tags)

    filename = f"{order['order_number']}_tags.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/{order_id}/invoice/pdf")
async def get_invoice_pdf(order_id: str, current_user: dict = Depends(get_current_user)):
    """Render the order's GST tax invoice as a printable PDF.

    On first call the invoice record (with a sequential per-store number) is
    created; later calls re-render the same invoice. Accessible by the order's
    customer, the assigned store owner, or admin.
    """
    from fastapi.responses import Response
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Authorization: same gate as garment tags
    role = current_user.get("role")
    user_id = current_user["user_id"]
    is_owner = order.get("user_id") == user_id
    is_admin = role == "admin"
    is_assigned_store = False
    if role == "store_owner" and order.get("store_id"):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        is_assigned_store = bool(user and user.get("store_id") == order["store_id"])
    if not (is_owner or is_admin or is_assigned_store):
        raise HTTPException(status_code=403, detail="Not authorized to view this invoice")

    from app.services.billing_service import build_invoice_for_order
    from app.services.invoice_pdf_service import render_invoice_pdf
    invoice = await build_invoice_for_order(db, order)
    pdf_bytes = render_invoice_pdf(invoice)

    filename = f"{invoice['invoice_number']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.put("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(order_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": current_user["user_id"]})
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] not in ("placed", "pending_payment", "confirmed"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel in \'{order['status']}\' status")
    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": "cancelled", "timestamp": now.isoformat(), "note": "Cancelled by customer"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {"status": "cancelled", "status_timeline": tl, "updated_at": now}})
    # Refund wallet if used
    wa = order.get("wallet_applied", 0)
    if wa > 0:
        await db.wallets.update_one({"user_id": order["user_id"]}, {"$inc": {"balance": wa}})
        await db.wallet_txns.insert_one({"user_id": order["user_id"], "type": "credit", "amount": wa, "reason": "refund", "description": f"Refund for cancelled order {order['order_number']}", "order_id": order_id, "created_at": now})
    updated = await db.orders.find_one({"_id": ObjectId(order_id)})
    return _format_order(updated)


@router.get("/{order_id}/slots")
async def get_order_slots(order_id: str, date: str = None, current_user: dict = Depends(get_current_user)):
    """Available pickup slots for the order's assigned store — used by the
    reschedule pickers in the customer / store / rider apps."""
    from datetime import date as date_cls, datetime as dt
    db = get_db()
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order id")
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    store_id = order.get("store_id")
    if not store_id:
        return {"date": date, "closed": True, "closed_reason": "No store assigned yet", "slots": []}
    store = await db.stores.find_one({"_id": ObjectId(store_id)})
    if not store:
        return {"date": date, "closed": True, "closed_reason": "Store unavailable", "slots": []}
    target = date_cls.today()
    if date:
        try:
            target = dt.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    from app.services.store_hours_service import get_available_slots, ensure_hours
    await ensure_hours(db, store)
    return await get_available_slots(db, store, target)


# Pickup can be rescheduled until the clothes are actually collected.
_PICKUP_RESCHEDULE_OK = ("placed", "pending_payment", "confirmed", "rider_assigned_pickup")


@router.put("/{order_id}/reschedule", response_model=OrderResponse)
async def reschedule_order(order_id: str, body: RescheduleRequest, current_user: dict = Depends(get_current_user)):
    """Reschedule an order's pickup and/or delivery slot.

    Allowed for the order's customer, the assigned store owner, the assigned
    rider, or an admin. Pickup can only be moved before it has been collected.
    """
    db = get_db()
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order id")
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Authorization
    uid = current_user["user_id"]
    role = current_user.get("role")
    is_customer = order.get("user_id") == uid
    is_admin = role == "admin"
    is_rider = uid in (order.get("pickup_rider_id"), order.get("delivery_rider_id"))
    is_store = False
    if role == "store_owner" and order.get("store_id"):
        u = await db.users.find_one({"_id": ObjectId(uid)})
        is_store = bool(u and u.get("store_id") == order["store_id"])
    if not (is_customer or is_admin or is_rider or is_store):
        raise HTTPException(status_code=403, detail="Not authorized to reschedule this order")

    if not body.pickup_slot and not body.delivery_slot:
        raise HTTPException(status_code=400, detail="Provide a pickup_slot and/or delivery_slot")

    now = datetime.now(timezone.utc)
    update = {"updated_at": now}
    tl = order.get("status_timeline", [])

    if body.pickup_slot:
        if order.get("status") not in _PICKUP_RESCHEDULE_OK:
            raise HTTPException(status_code=400, detail="Pickup can no longer be rescheduled for this order")
        new_pickup = body.pickup_slot.model_dump()
        if order.get("store_id"):
            from app.services.store_hours_service import validate_slot_against_hours
            ok, err = await validate_slot_against_hours(db, order["store_id"], new_pickup)
            if not ok:
                raise HTTPException(status_code=400, detail=err or "Invalid pickup slot")
        update["pickup_slot"] = new_pickup
        tl.append({"status": order.get("status"), "timestamp": now.isoformat(),
                   "note": f"Pickup rescheduled to {new_pickup['date']} ({new_pickup['slot']})"})

    if body.delivery_slot:
        new_delivery = body.delivery_slot.model_dump()
        update["delivery_slot"] = new_delivery
        tl.append({"status": order.get("status"), "timestamp": now.isoformat(),
                   "note": f"Delivery rescheduled to {new_delivery['date']} ({new_delivery['slot']})"})

    update["status_timeline"] = tl
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update})

    # Best-effort: notify the customer their slot changed.
    try:
        from app.services.push_service import notify_customer_order_update
        await notify_customer_order_update(order["user_id"], order["order_number"],
                                           order.get("status", ""), "Your pickup schedule was updated.")
    except Exception:
        pass

    updated = await db.orders.find_one({"_id": ObjectId(order_id)})
    return _format_order(updated)
