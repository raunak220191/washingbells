"""Admin — Super admin dashboard, user/store/rider management, order control."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.services.geo_service import location_point
from app.core.security import get_current_user
from app.core.categories import ITEM_CATEGORIES

# Canonical item sort (category rank, then name) — mirrors services.py so the
# admin console sees the same order as the apps.
_CATEGORY_RANK = {c: i for i, c in enumerate(ITEM_CATEGORIES)}


def _sorted_items(items):
    return sorted(items, key=lambda i: (
        _CATEGORY_RANK.get(i.get("category", "unisex"), len(ITEM_CATEGORIES)),
        (i.get("name") or "").lower(),
    ))
from app.schemas.phase2_schemas import (
    AdminOrderOverride, AdminAssignStoreRequest,
    AdminAssignRiderRequest, ApprovalRequest,
)
from app.services.twilio_service import send_invite_sms
from app.services.push_service import (
    notify_rider_approval, notify_rider_trip_assigned,
)
from app.services.email_service import send_event as send_email_event

router = APIRouter(prefix="/admin", tags=["Admin"])

RIDER_FEE = 40.0


def _require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access only")


# ── Dashboard ────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    """Get admin dashboard stats."""
    _require_admin(current_user)
    db = get_db()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_orders = await db.orders.count_documents({})
    orders_today = await db.orders.count_documents({"created_at": {"$gte": today_start}})
    active_orders = await db.orders.count_documents({"status": {"$nin": ["delivered", "cancelled"]}})

    # Revenue
    pipeline = [{"$match": {"status": "delivered"}}, {"$group": {"_id": None, "total": {"$sum": "$total_amount"}, "platform": {"$sum": "$platform_fee"}}}]
    rev = await db.orders.aggregate(pipeline).to_list(length=1)
    total_revenue = rev[0]["total"] if rev else 0
    platform_earnings = rev[0]["platform"] if rev else 0

    pipeline_today = [{"$match": {"status": "delivered", "delivered_at": {"$gte": today_start}}}, {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}]
    rev_today = await db.orders.aggregate(pipeline_today).to_list(length=1)
    revenue_today = rev_today[0]["total"] if rev_today else 0

    total_customers = await db.users.count_documents({"role": {"$in": ["customer", None]}})
    total_riders = await db.users.count_documents({"role": "rider"})
    total_stores = await db.stores.count_documents({})
    riders_online = await db.users.count_documents({"role": "rider", "rider_status": "online"})
    stores_open = await db.stores.count_documents({"is_open": True})

    # Lifecycle status breakdown across ALL orders, in lifecycle order. Granular
    # statuses are bucketed into the 4 named stages (+ Cancelled) so the dashboard
    # pie and the status counts are computed from the same source and always agree.
    status_buckets = [
        ("placed", "Placed", ["placed", "confirmed"]),
        ("processing", "Processing", ["at_store", "picked_up", "processing", "ready_for_delivery"]),
        ("out_for_delivery", "Out for Delivery", ["out_for_delivery"]),
        ("delivered", "Delivered", ["delivered"]),
        ("cancelled", "Cancelled", ["cancelled"]),
    ]
    raw = await db.orders.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]).to_list(length=200)
    raw_map = {r["_id"]: r["count"] for r in raw}
    status_breakdown = [
        {"key": key, "label": label, "count": sum(raw_map.get(m, 0) for m in members)}
        for key, label, members in status_buckets
    ]
    mapped = {m for _, _, members in status_buckets for m in members}
    other = sum(v for k, v in raw_map.items() if k not in mapped)
    if other:
        status_breakdown.append({"key": "other", "label": "Other", "count": other})

    return {
        "total_orders": total_orders, "orders_today": orders_today,
        "active_orders": active_orders, "total_revenue": total_revenue,
        "revenue_today": revenue_today, "platform_earnings": platform_earnings,
        "total_customers": total_customers, "total_riders": total_riders,
        "total_stores": total_stores, "riders_online": riders_online,
        "stores_open": stores_open, "status_breakdown": status_breakdown,
    }


# ── Orders Management ────────────────────────────────────────

@router.get("/orders")
async def list_all_orders(status_filter: str = None, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """List all orders with optional status filter."""
    _require_admin(current_user)
    db = get_db()
    query = {}
    if status_filter:
        query["status"] = status_filter
    cursor = db.orders.find(query).sort("created_at", -1).limit(limit)
    orders = await cursor.to_list(length=limit)
    result = []
    for o in orders:
        customer = await db.users.find_one({"_id": ObjectId(o["user_id"])})
        result.append({
            "id": str(o["_id"]), "order_number": o["order_number"],
            "status": o["status"], "total_amount": o["total_amount"],
            "payment_method": o.get("payment_method"), "payment_status": o.get("payment_status"),
            "store_id": o.get("store_id"), "pickup_rider_id": o.get("pickup_rider_id"),
            "delivery_rider_id": o.get("delivery_rider_id"),
            "customer_name": customer.get("name", "N/A") if customer else "N/A",
            "customer_phone": customer.get("phone", "") if customer else "",
            "items_count": sum(i.get("quantity", 1) for i in o.get("items", [])),
            "created_at": o["created_at"],
        })
    return result


@router.get("/photos")
async def list_photo_audit(
    limit: int = 60,
    skip: int = 0,
    context: str = "pickup_proof",
    store_id: str = None,
    rider_id: str = None,
    order_number: str = None,
    date_from: str = None,
    date_to: str = None,
    current_user: dict = Depends(get_current_user),
):
    """Cross-order photo audit. Returns lightweight refs (no base64) so the
    admin gallery can paginate. The UI lazy-loads each image from /upload/{id}.

    Filters: context (defaults pickup_proof), store_id, rider_id, order_number,
    date_from/date_to (YYYY-MM-DD).
    """
    _require_admin(current_user)
    db = get_db()
    q: dict = {"context": context} if context else {}
    if rider_id:
        q["user_id"] = rider_id

    # Date range on uploads.created_at
    from datetime import datetime as dt, time as time_cls
    if date_from or date_to:
        date_q: dict = {}
        if date_from:
            try:
                date_q["$gte"] = dt.combine(dt.strptime(date_from, "%Y-%m-%d").date(), time_cls.min).replace(tzinfo=timezone.utc)
            except ValueError:
                raise HTTPException(status_code=400, detail="date_from must be YYYY-MM-DD")
        if date_to:
            try:
                date_q["$lte"] = dt.combine(dt.strptime(date_to, "%Y-%m-%d").date(), time_cls.max).replace(tzinfo=timezone.utc)
            except ValueError:
                raise HTTPException(status_code=400, detail="date_to must be YYYY-MM-DD")
        q["created_at"] = date_q

    # store_id / order_number filters require joining via order_id on the upload doc
    if store_id or order_number:
        order_q: dict = {}
        if store_id:
            order_q["store_id"] = store_id
        if order_number:
            order_q["order_number"] = order_number.upper()
        # Find matching order ids first (limit to a reasonable cap)
        order_cursor = db.orders.find(order_q, {"_id": 1}).limit(1000)
        order_ids = [str(o["_id"]) async for o in order_cursor]
        if not order_ids:
            return {"total": 0, "items": []}
        q["order_id"] = {"$in": order_ids}

    total = await db.uploads.count_documents(q)
    cursor = (
        db.uploads.find(q, {"data": 0})  # exclude base64 from list response
        .sort("created_at", -1)
        .skip(max(0, int(skip)))
        .limit(min(120, max(1, int(limit))))
    )
    docs = await cursor.to_list(length=limit)

    # Resolve uploader names and order numbers in batch
    uploader_ids = list({str(d.get("user_id")) for d in docs if d.get("user_id")})
    order_ids = list({str(d.get("order_id")) for d in docs if d.get("order_id")})
    uploaders: dict[str, dict] = {}
    if uploader_ids:
        cur = db.users.find(
            {"_id": {"$in": [ObjectId(u) for u in uploader_ids if len(u) == 24]}},
            {"name": 1, "phone": 1, "role": 1},
        )
        async for u in cur:
            uploaders[str(u["_id"])] = u
    orders_map: dict[str, dict] = {}
    if order_ids:
        cur = db.orders.find(
            {"_id": {"$in": [ObjectId(o) for o in order_ids if len(o) == 24]}},
            {"order_number": 1, "status": 1, "store_id": 1},
        )
        async for o in cur:
            orders_map[str(o["_id"])] = o

    items = []
    for d in docs:
        uid = str(d.get("user_id")) if d.get("user_id") else None
        oid = str(d.get("order_id")) if d.get("order_id") else None
        u = uploaders.get(uid or "", {})
        o = orders_map.get(oid or "", {})
        items.append({
            "id": str(d["_id"]),
            "url": f"/api/v1/upload/{str(d['_id'])}",
            "context": d.get("context"),
            "size": d.get("size"),
            "filename": d.get("filename"),
            "created_at": d.get("created_at"),
            "uploader": {
                "id": uid, "name": u.get("name"),
                "phone": u.get("phone"), "role": u.get("role"),
            } if uid else None,
            "order": {
                "id": oid, "order_number": o.get("order_number"),
                "status": o.get("status"), "store_id": o.get("store_id"),
            } if oid else None,
        })
    return {"total": total, "items": items, "limit": limit, "skip": skip}


@router.get("/orders/{order_id}")
async def get_admin_order_detail(order_id: str, current_user: dict = Depends(get_current_user)):
    """Full admin view of an order — includes garment tags, pickup photos,
    status timeline, rider + store info.
    """
    _require_admin(current_user)
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
    store = None
    if order.get("store_id"):
        store = await db.stores.find_one({"_id": ObjectId(order["store_id"])})
    pickup_rider = None
    if order.get("pickup_rider_id"):
        pickup_rider = await db.users.find_one({"_id": ObjectId(order["pickup_rider_id"])})
    delivery_rider = None
    if order.get("delivery_rider_id"):
        delivery_rider = await db.users.find_one({"_id": ObjectId(order["delivery_rider_id"])})

    def _rider_brief(r):
        if not r: return None
        return {
            "id": str(r["_id"]), "name": r.get("name"), "phone": r.get("phone"),
            "vehicle_type": r.get("vehicle_type"), "vehicle_number": r.get("vehicle_number"),
        }

    return {
        "id": str(order["_id"]),
        "order_number": order["order_number"],
        "status": order["status"],
        "payment_method": order.get("payment_method"),
        "payment_status": order.get("payment_status"),
        "items": order.get("items", []),
        "subtotal": order.get("subtotal", 0),
        "delivery_fee": order.get("delivery_fee", 0),
        "discount": order.get("discount", 0),
        "wallet_applied": order.get("wallet_applied", 0),
        "total_amount": order.get("total_amount", 0),
        "coupon_code": order.get("coupon_code"),
        "address": order.get("address"),
        "pickup_slot": order.get("pickup_slot"),
        "delivery_slot": order.get("delivery_slot"),
        "special_instructions": order.get("special_instructions"),
        "status_timeline": order.get("status_timeline", []),
        "garment_tags": order.get("garment_tags", []),
        "pickup_proof_photos": order.get("pickup_proof_photos", []),
        "pickup_photos_at": order.get("pickup_photos_at"),
        "store_photos": order.get("store_photos", []),
        "order_source": order.get("order_source", "app"),
        "fulfillment_mode": order.get("fulfillment_mode", "rider_delivery"),
        "customer": {
            "id": str(customer["_id"]) if customer else None,
            "name": customer.get("name") if customer else None,
            "phone": customer.get("phone") if customer else None,
            "email": customer.get("email") if customer else None,
        } if customer else None,
        "store": {
            "id": str(store["_id"]), "name": store["name"], "vendor_code": store.get("vendor_code"),
            "phone": store.get("phone"),
        } if store else None,
        "pickup_rider": _rider_brief(pickup_rider),
        "delivery_rider": _rider_brief(delivery_rider),
        "created_at": order["created_at"],
        "updated_at": order.get("updated_at"),
        "delivered_at": order.get("delivered_at"),
    }


@router.put("/orders/{order_id}/bill")
async def admin_edit_order_bill(order_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Super-admin edits an existing order's BILL: line items, quantities, coupon
    and manual discount. Recomputes subtotal / delivery fee / discount / total
    using the SAME rules as order creation (coupon validation + capped discount).

    FINANCIAL/AUDIT GUARDRAIL: orders generate a GST invoice. Invoices are issued
    once (idempotent) and frozen — this endpoint NEVER mutates an already-issued
    invoice. Every bill edit is recorded as an audit trail entry (before/after,
    who, when) under order.bill_revisions and in admin_db_audit. If an invoice was
    already issued, the order is flagged invoice_stale=true and the response warns
    that a revised invoice must be issued (see ADMIN_AUDIT.md proposal).

    Body: { items:[{service_name,item_name,price,quantity,category?}],
            coupon_code?, discount?, special_instructions? }
    """
    from app.routers.orders import FREE_DELIVERY_THRESHOLD, DELIVERY_FEE
    _require_admin(current_user)
    db = get_db()
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        order = None
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Rebuild line items from the submitted bill (super-admin supplies prices).
    raw_items = body.get("items") or []
    line_items = []
    for ri in raw_items:
        unit = ri.get("unit", "piece")
        try:
            price = round(float(ri.get("price", 0)), 2)
            # kg lines keep fractional quantities; piece lines stay integers
            qty = round(float(ri.get("quantity", 0) or 0), 3) if unit == "kg" else int(ri.get("quantity", 0) or 0)
        except (TypeError, ValueError):
            continue
        name = (ri.get("item_name") or "").strip()
        if not name or price < 0 or qty <= 0:
            continue
        line_items.append({
            "service_name": (ri.get("service_name") or "").strip() or "Service",
            "item_name": name, "price": price, "quantity": qty, "unit": unit,
            "subtotal": round(price * qty, 2),
            "category": ri.get("category", "unisex"),
        })
    if not line_items:
        raise HTTPException(status_code=400, detail="A bill needs at least one valid line item")

    subtotal = round(sum(li["subtotal"] for li in line_items), 2)
    fulfillment_mode = order.get("fulfillment_mode", "counter_pickup")
    if fulfillment_mode == "rider_delivery":
        delivery_fee = 0.0 if subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_FEE
    else:
        delivery_fee = 0.0

    # Discount: same rules as create (coupon validated against the customer +
    # new subtotal, plus optional manual discount, combined and capped).
    coupon_code = (body.get("coupon_code") or "").strip().upper() or None
    coupon_discount = 0.0
    applied_coupon = None
    if coupon_code:
        from app.routers.coupons import evaluate_coupon
        ev = await evaluate_coupon(db, coupon_code, subtotal, order.get("user_id"))
        if not ev["valid"]:
            raise HTTPException(status_code=400, detail=ev["message"])
        coupon_discount = ev["discount_amount"]
        applied_coupon = ev["code"]
    try:
        manual_discount = max(0.0, round(float(body.get("discount") or 0.0), 2))
    except (TypeError, ValueError):
        manual_discount = 0.0
    discount = round(min(coupon_discount + manual_discount, subtotal), 2)
    wallet_applied = round(float(order.get("wallet_applied", 0)), 2)
    total_amount = round(max(subtotal + delivery_fee - discount - wallet_applied, 0), 2)

    # Has an invoice already been issued? If so it stays frozen (never mutated).
    invoice = await db.invoices.find_one({"order_id": order_id})
    invoice_issued = bool(invoice)

    now = datetime.now(timezone.utc)
    before = {
        "items": order.get("items", []), "subtotal": order.get("subtotal", 0),
        "discount": order.get("discount", 0), "coupon_code": order.get("coupon_code"),
        "total_amount": order.get("total_amount", 0),
    }
    revision = {
        "at": now, "by": current_user["user_id"],
        "before": {"subtotal": before["subtotal"], "discount": before["discount"], "total_amount": before["total_amount"]},
        "after": {"subtotal": subtotal, "discount": discount, "total_amount": total_amount},
        "invoice_was_issued": invoice_issued,
        "invoice_number": (invoice or {}).get("invoice_number"),
        "note": body.get("note"),
    }

    set_fields = {
        "items": line_items, "subtotal": subtotal, "delivery_fee": delivery_fee,
        "discount": discount, "coupon_code": applied_coupon,
        "total_amount": total_amount, "updated_at": now,
    }
    if "special_instructions" in body:
        set_fields["special_instructions"] = body.get("special_instructions")
    if invoice_issued:
        set_fields["invoice_stale"] = True
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": set_fields, "$push": {"bill_revisions": revision}},
    )
    await _audit_edit(db, current_user, "orders", order_id, before,
                      {"subtotal": subtotal, "discount": discount, "coupon_code": applied_coupon, "total_amount": total_amount})

    # Keep coupon usage honest when the applied coupon changes on edit.
    old_coupon = order.get("coupon_code")
    if applied_coupon != old_coupon:
        if old_coupon:
            await db.coupons.update_one({"code": old_coupon, "used_count": {"$gt": 0}}, {"$inc": {"used_count": -1}})
        if applied_coupon:
            await db.coupons.update_one({"code": applied_coupon}, {"$inc": {"used_count": 1}})

    return {
        "id": order_id, "subtotal": subtotal, "delivery_fee": delivery_fee,
        "discount": discount, "coupon_code": applied_coupon, "coupon_discount": coupon_discount,
        "total_amount": total_amount,
        "invoice_issued": invoice_issued,
        "invoice_number": (invoice or {}).get("invoice_number"),
        "warning": (
            f"Invoice {invoice['invoice_number']} was already issued and is frozen. "
            "The order total changed — issue a revised invoice / credit note (see ADMIN_AUDIT.md). "
            "This edit is recorded in the audit trail."
        ) if invoice_issued else None,
        "message": "Bill updated",
    }


@router.put("/orders/{order_id}/override-status")
async def override_order_status(order_id: str, body: AdminOrderOverride, current_user: dict = Depends(get_current_user)):
    """Admin can force any status on an order."""
    _require_admin(current_user)
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": body.status, "timestamp": now.isoformat(), "note": body.note or f"Admin override to {body.status}"})
    update = {"status": body.status, "status_timeline": tl, "updated_at": now}
    if body.status == "delivered":
        update["delivered_at"] = now
        total = order.get("total_amount", 0)
        update["platform_fee"] = round(total * 0.20, 2)
        update["store_payout"] = round(total * 0.80, 2)
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update})
    return {"message": f"Order status set to '{body.status}'", "order_number": order["order_number"]}


@router.post("/orders/{order_id}/assign-store")
async def assign_store(order_id: str, body: AdminAssignStoreRequest, current_user: dict = Depends(get_current_user)):
    """Admin assigns a store to an order."""
    _require_admin(current_user)
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    store = await db.stores.find_one({"_id": ObjectId(body.store_id)})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": "store_assigned", "timestamp": now.isoformat(), "note": f"Assigned to {store['name']} ({store['vendor_code']})"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        "store_id": body.store_id, "status_timeline": tl, "updated_at": now,
    }})
    return {"message": f"Order assigned to store {store['vendor_code']}", "store_name": store["name"]}


@router.post("/orders/{order_id}/assign-rider")
async def assign_rider(order_id: str, body: AdminAssignRiderRequest, current_user: dict = Depends(get_current_user)):
    """Admin assigns a rider to an order for pickup or delivery."""
    _require_admin(current_user)
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    rider = await db.users.find_one({"_id": ObjectId(body.rider_id), "role": "rider"})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    now = datetime.now(timezone.utc)
    customer_addr = order.get("address", {})
    store = await db.stores.find_one({"_id": ObjectId(order["store_id"])}) if order.get("store_id") else None

    if body.trip_type == "pickup":
        pickup_addr = customer_addr.get("full_address", "Customer")
        drop_addr = store["address"] if store else "Store"
    else:
        pickup_addr = store["address"] if store else "Store"
        drop_addr = customer_addr.get("full_address", "Customer")

    trip_doc = {
        "rider_id": body.rider_id, "order_id": order_id,
        "trip_type": body.trip_type, "status": "assigned",
        "pickup_address": pickup_addr, "drop_address": drop_addr,
        "fee": RIDER_FEE, "created_at": now,
    }
    trip_result = await db.trips.insert_one(trip_doc)

    rider_field = "pickup_rider_id" if body.trip_type == "pickup" else "delivery_rider_id"
    tl = order.get("status_timeline", [])
    tl.append({"status": f"rider_assigned_{body.trip_type}", "timestamp": now.isoformat(),
               "note": f"{body.trip_type.title()} rider {rider.get('name', 'Rider')} assigned"})
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {
        rider_field: body.rider_id, "status_timeline": tl, "updated_at": now,
    }})
    # Push notify the rider — non-blocking
    try:
        await notify_rider_trip_assigned(
            body.rider_id, body.trip_type, order["order_number"], RIDER_FEE,
        )
    except Exception: pass
    return {"message": f"Rider assigned for {body.trip_type}", "trip_id": str(trip_result.inserted_id),
            "rider_name": rider.get("name"), "rider_phone": rider.get("phone")}


# ── Admin order creation (counter / on-behalf) ───────────────

def _admin_normalize_phone(raw: str) -> str:
    """Normalize an Indian phone to +91XXXXXXXXXX."""
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit phone number")
    return f"+91{digits}"


@router.get("/customers/lookup")
async def admin_lookup_customer(phone: str, current_user: dict = Depends(get_current_user)):
    """Find a customer by phone for admin order creation."""
    _require_admin(current_user)
    db = get_db()
    normalized = _admin_normalize_phone(phone)
    user = await db.users.find_one({"phone": normalized})
    if not user:
        return {"found": False, "phone": normalized}
    return {
        "found": True,
        "id": str(user["_id"]),
        "name": user.get("name"),
        "phone": user["phone"],
        "email": user.get("email"),
        "role": user.get("role"),
        "has_login": bool(user.get("password_hash")),
    }


@router.post("/customers")
async def admin_create_customer(body: dict, current_user: dict = Depends(get_current_user)):
    """Create a standalone customer profile WITHOUT an order.

    Body: {phone (required), name?, email?, password?}. Returns 409 if a customer
    with that phone already exists (the UI can route to edit instead). The
    create-with-order path (`/orders/create`) still lookup-or-creates as before.
    """
    from app.core.security import hash_password
    _require_admin(current_user)
    db = get_db()

    phone = _admin_normalize_phone(body.get("phone", ""))
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower() or None
    password = (body.get("password") or "").strip()
    now = datetime.now(timezone.utc)

    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=409, detail="A customer with this phone already exists")

    doc = {
        "phone": phone, "name": name or "Customer", "email": email,
        "role": "customer", "wallet_balance": 0.0,
        "created_at": now, "updated_at": now,
    }
    if password:
        doc["password_hash"] = hash_password(password)
    res = await db.users.insert_one(doc)
    user = await db.users.find_one({"_id": res.inserted_id})

    return {
        "id": str(user["_id"]), "phone": user["phone"],
        "name": user.get("name"), "email": user.get("email"),
        "role": user.get("role"), "has_login": bool(user.get("password_hash")),
        "message": "Customer created",
    }


@router.post("/orders/create")
async def admin_create_order(body: dict, current_user: dict = Depends(get_current_user)):
    """Admin creates an order on behalf of a customer (phone / counter intake).

    Reuses the proven walk-in order shape; does NOT modify any existing flow.
    Body: {
      customer_phone, customer_name?, customer_password?, customer_email?,
      items: [{service_id, item_id, quantity}],
      fulfillment_mode: "counter_pickup" | "rider_delivery",
      payment_method: "cash" | "upi" | "online",
      store_id?,                 # defaults to the single active store
      address?: {full_address, latitude, longitude, city, label?},  # rider_delivery only
      special_instructions?, discount?
    }
    """
    from app.routers.orders import (
        _generate_order_number, _generate_garment_tags,
        FREE_DELIVERY_THRESHOLD, DELIVERY_FEE,
    )
    from app.core.security import hash_password
    _require_admin(current_user)
    db = get_db()

    phone = _admin_normalize_phone(body.get("customer_phone", ""))
    name = (body.get("customer_name") or "").strip()
    password = (body.get("customer_password") or "").strip()
    email = (body.get("customer_email") or "").strip() or None

    fulfillment_mode = body.get("fulfillment_mode", "counter_pickup")
    if fulfillment_mode not in ("counter_pickup", "rider_delivery"):
        raise HTTPException(status_code=400, detail="Invalid fulfillment_mode")
    payment_method = body.get("payment_method", "cash")
    if payment_method not in ("cash", "upi", "card", "online"):
        raise HTTPException(status_code=400, detail="Invalid payment_method")
    # Payment TIMING is independent of the instrument (method). When a caller
    # doesn't send it, default to the legacy mapping (cash/upi/card collected
    # now -> paid; online -> pending) so existing integrations are unaffected.
    payment_timing = body.get("payment_timing")
    if payment_timing not in ("pay_now", "pay_on_delivery", None):
        raise HTTPException(status_code=400, detail="Invalid payment_timing")
    if payment_timing is None:
        payment_timing = "pay_now" if payment_method in ("cash", "upi", "card") else "pay_on_delivery"

    # Resolve the target store (admin-selected, else the single active store)
    if body.get("store_id"):
        try:
            store = await db.stores.find_one({"_id": ObjectId(body["store_id"])})
        except Exception:
            store = None
        if not store:
            raise HTTPException(status_code=404, detail="Selected store not found")
    else:
        active = await db.stores.find({"status": "active"}).to_list(length=10)
        if not active:
            active = await db.stores.find({}).to_list(length=10)
        if not active:
            raise HTTPException(status_code=400, detail="No store available to assign the order")
        store = active[0]

    # Resolve items against the live catalog
    raw_items = body.get("items") or []
    if not raw_items:
        raise HTTPException(status_code=400, detail="Add at least one item")
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
        # Weight-priced services (pricing_unit == "kg") take fractional
        # quantities (e.g. 2.5 kg); everything else stays a piece count.
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
            "service_name": svc["name"], "item_name": matched["name"],
            "price": price, "quantity": qty, "unit": unit,
            "subtotal": round(price * qty, 2),
            "category": matched.get("category", "unisex"),
        })
    if not line_items:
        raise HTTPException(status_code=400, detail="None of the selected items are valid")

    subtotal = round(sum(li["subtotal"] for li in line_items), 2)
    if fulfillment_mode == "rider_delivery":
        delivery_fee = 0.0 if subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_FEE
    else:
        delivery_fee = 0.0

    now = datetime.now(timezone.utc)

    # Lookup-or-create the customer (optionally with a real app login password)
    user = await db.users.find_one({"phone": phone})
    if not user:
        user_doc = {
            "phone": phone, "name": name or "Customer", "email": email,
            "role": "customer", "wallet_balance": 0.0,
            "created_at": now, "updated_at": now,
        }
        if password:
            user_doc["password_hash"] = hash_password(password)
        else:
            user_doc["is_walk_in"] = True
        res = await db.users.insert_one(user_doc)
        user = await db.users.find_one({"_id": res.inserted_id})
    else:
        updates = {}
        if name and not user.get("name"):
            updates["name"] = name
        if email and not user.get("email"):
            updates["email"] = email
        # Only set a password if the customer doesn't already have one — never overwrite.
        if password and not user.get("password_hash"):
            updates["password_hash"] = hash_password(password)
        if updates:
            updates["updated_at"] = now
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            user = await db.users.find_one({"_id": user["_id"]})
    user_id = str(user["_id"])

    # Discount: optional coupon (same rules as the customer flow) + optional
    # manual admin discount. Both are computed on the subtotal and combined,
    # capped at the subtotal so the total never goes negative.
    coupon_code = (body.get("coupon_code") or "").strip().upper() or None
    coupon_discount = 0.0
    applied_coupon = None
    if coupon_code:
        from app.routers.coupons import evaluate_coupon
        ev = await evaluate_coupon(db, coupon_code, subtotal, user_id)
        if not ev["valid"]:
            raise HTTPException(status_code=400, detail=ev["message"])
        coupon_discount = ev["discount_amount"]
        applied_coupon = ev["code"]
    try:
        manual_discount = max(0.0, round(float(body.get("discount") or 0.0), 2))
    except (TypeError, ValueError):
        manual_discount = 0.0
    discount = round(min(coupon_discount + manual_discount, subtotal), 2)
    total_amount = round(subtotal + delivery_fee - discount, 2)

    # Address — coordinates are never typed by anyone (B2): use what the
    # caller captured, else server-geocode the text, else fall back to the
    # store's area so rider routing still has a target.
    if fulfillment_mode == "rider_delivery":
        addr = body.get("address") or {}
        if not addr.get("full_address"):
            raise HTTPException(status_code=400, detail="Delivery address is required for rider delivery")
        try:
            lat = float(addr["latitude"]) if addr.get("latitude") not in (None, "") else None
            lng = float(addr["longitude"]) if addr.get("longitude") not in (None, "") else None
        except (TypeError, ValueError):
            lat, lng = None, None
        if lat is None or lng is None:
            from app.services.geocoding_service import geocode_address
            coords = await geocode_address(addr.get("full_address"), addr.get("city"))
            if coords:
                lat, lng = coords
            else:
                lat, lng = store.get("latitude"), store.get("longitude")
        address = {
            "id": None, "label": addr.get("label", "Delivery"),
            "full_address": addr["full_address"],
            "latitude": lat, "longitude": lng,
            "city": addr.get("city", store.get("city", "")),
        }
    else:
        address = {
            "id": None, "label": "Counter",
            "full_address": f"Counter pickup at {store.get('name', 'store')}, {store.get('address', '')}",
            "latitude": store.get("latitude"), "longitude": store.get("longitude"),
            "city": store.get("city", ""),
        }

    # Status follows TIMING, not the instrument: collected now -> paid, else pending.
    payment_status = "paid" if payment_timing == "pay_now" else "pending"
    order_number = _generate_order_number()
    garment_tags = _generate_garment_tags(order_number, line_items)
    timeline = [
        {"status": "placed", "timestamp": now.isoformat(), "note": "Order created by admin"},
        {"status": "at_store", "timestamp": now.isoformat(), "note": "Garments received"},
    ]
    slot = {"date": now.strftime("%Y-%m-%d"), "slot": "Admin"}

    order_doc = {
        "order_number": order_number, "user_id": user_id,
        "items": line_items, "address": address,
        "pickup_slot": slot, "delivery_slot": slot,
        "special_instructions": body.get("special_instructions"),
        "payment_method": payment_method, "payment_timing": payment_timing,
        "status": "at_store", "payment_status": payment_status,
        "status_timeline": timeline,
        "garment_tags": garment_tags, "assigned_agent_id": None, "agent_info": None,
        "pickup_proof_images": [], "delivery_proof_images": [], "store_photos": [],
        "order_source": "admin", "fulfillment_mode": fulfillment_mode,
        "created_by_store_id": str(store["_id"]),
        "created_by_admin_id": current_user["user_id"],
        "store_id": str(store["_id"]),
        "pickup_rider_id": None, "delivery_rider_id": None,
        "pickup_otp": None, "pickup_otp_verified": False, "pickup_completed_at": None,
        "store_received_otp": None, "store_received_otp_verified": True, "store_received_at": now,
        "processing_started_at": None, "expected_delivery_at": None, "ready_at": None,
        "delivery_otp": None, "delivery_otp_verified": False, "delivered_at": None,
        "store_payout": 0.0, "platform_fee": 0.0, "rider_pickup_fee": 0.0, "rider_delivery_fee": 0.0,
        "customer_rating": None, "customer_review": None,
        "subtotal": subtotal, "delivery_fee": delivery_fee, "discount": discount,
        "wallet_applied": 0.0, "total_amount": total_amount,
        "coupon_code": applied_coupon, "razorpay_order_id": None,
        "created_at": now, "updated_at": now,
    }
    result = await db.orders.insert_one(order_doc)

    # Mirror the customer flow: count a coupon use once the order is created.
    if applied_coupon:
        await db.coupons.update_one({"code": applied_coupon}, {"$inc": {"used_count": 1}})

    # Notify the customer (non-blocking)
    try:
        from app.services.push_service import notify_customer_order_update
        await notify_customer_order_update(
            user_id, order_number, "at_store",
            f"Order {order_number} was created for you. Total ₹{total_amount:.0f}.",
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
            "source": "admin console",
            "store_name": store.get("name", ""),
        })
    except Exception:
        pass

    return {
        "id": str(result.inserted_id),
        "order_number": order_number,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "discount": discount,
        "coupon_code": applied_coupon,
        "coupon_discount": coupon_discount,
        "total_amount": total_amount,
        "payment_status": payment_status,
        "payment_method": payment_method,
        "payment_timing": payment_timing,
        "fulfillment_mode": fulfillment_mode,
        "customer_id": user_id,
        "customer_name": user.get("name"),
        "customer_has_login": bool(user.get("password_hash")),
        "store_name": store.get("name"),
        "tag_count": len(garment_tags),
        "message": "Order created",
    }


@router.post("/admins/upsert")
async def admin_upsert_admin(body: dict, current_user: dict = Depends(get_current_user)):
    """Create or promote a user to super admin (admin-gated, audited).

    Body: {phone, name?, password?}. Idempotent — if the phone already exists it
    is promoted to role 'admin' (clearing any store-owner linkage); otherwise a
    fresh admin user is created. Sets the password when provided.
    """
    from app.core.security import hash_password
    _require_admin(current_user)
    db = get_db()
    phone = _admin_normalize_phone(body.get("phone", ""))
    name = (body.get("name") or "").strip() or None
    password = (body.get("password") or "").strip()
    now = datetime.now(timezone.utc)

    existing = await db.users.find_one({"phone": phone})
    if existing:
        before = {
            "role": existing.get("role"), "store_id": existing.get("store_id"),
            "had_password": bool(existing.get("password_hash")),
        }
        set_fields = {"role": "admin", "updated_at": now}
        if name:
            set_fields["name"] = name
        if password:
            set_fields["password_hash"] = hash_password(password)
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": set_fields, "$unset": {"store_id": "", "is_walk_in": "", "is_dummy": ""}},
        )
        user_id = str(existing["_id"])
        action = "promoted"
    else:
        before = None
        doc = {
            "phone": phone, "name": name or "Admin", "email": None,
            "role": "admin", "wallet_balance": 0.0,
            "created_at": now, "updated_at": now,
        }
        if password:
            doc["password_hash"] = hash_password(password)
        res = await db.users.insert_one(doc)
        user_id = str(res.inserted_id)
        action = "created"

    try:
        await db.admin_db_audit.insert_one({
            "actor_id": current_user["user_id"], "collection": "users",
            "action": f"admin_{action}", "doc_id": user_id, "before": before,
            "after": {"role": "admin", "phone": phone, "password_set": bool(password)},
            "created_at": now,
        })
    except Exception:
        pass

    return {"id": user_id, "phone": phone, "role": "admin", "action": action,
            "password_set": bool(password), "name": name}


# ── Users Management ─────────────────────────────────────────

@router.get("/users")
async def list_users(role: str = None, limit: int = 200, current_user: dict = Depends(get_current_user)):
    """List all users with optional role filter. Returns wallet balance,
    referral code, and lightweight order stats per user so the admin customer
    page can show them without N+1 queries.
    """
    _require_admin(current_user)
    db = get_db()
    query: dict = {}
    if role:
        # Treat missing/null role as 'customer' so the filter doesn't miss legacy users
        if role == "customer":
            query["$or"] = [{"role": "customer"}, {"role": None}, {"role": {"$exists": False}}]
        else:
            query["role"] = role
    cursor = db.users.find(query).sort("created_at", -1).limit(limit)
    users = await cursor.to_list(length=limit)
    if not users:
        return []

    user_ids = [str(u["_id"]) for u in users]

    # Batch wallet balances
    wallets_map: dict[str, float] = {}
    async for w in db.wallets.find({"user_id": {"$in": user_ids}}, {"user_id": 1, "balance": 1}):
        wallets_map[w["user_id"]] = w.get("balance", 0.0)

    # Batch order counts + spend
    pipeline = [
        {"$match": {"user_id": {"$in": user_ids}}},
        {"$group": {
            "_id": "$user_id",
            "order_count": {"$sum": 1},
            "total_spend": {"$sum": {"$cond": [{"$eq": ["$status", "delivered"]}, "$total_amount", 0]}},
            "last_order_at": {"$max": "$created_at"},
        }},
    ]
    stats_map: dict[str, dict] = {}
    async for s in db.orders.aggregate(pipeline):
        stats_map[s["_id"]] = s

    out = []
    for u in users:
        uid = str(u["_id"])
        s = stats_map.get(uid, {})
        out.append({
            "id": uid, "phone": u["phone"], "name": u.get("name"),
            "role": u.get("role") or "customer", "email": u.get("email"),
            "rider_approved": u.get("rider_approved"),
            "rider_status": u.get("rider_status"),
            "vehicle_type": u.get("vehicle_type"),
            "store_id": u.get("store_id"),
            "referral_code": u.get("referral_code"),
            "wallet_balance": wallets_map.get(uid, 0.0),
            "order_count": s.get("order_count", 0),
            "total_spend": s.get("total_spend", 0.0),
            "last_order_at": s.get("last_order_at"),
            "created_at": u["created_at"],
        })
    return out


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, current_user: dict = Depends(get_current_user)):
    """Full admin view of a user — profile, wallet, recent orders, addresses,
    referral stats, T&C acceptance, KYC documents if rider.
    """
    _require_admin(current_user)
    db = get_db()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    wallet = await db.wallets.find_one({"user_id": user_id})
    txns_cursor = db.wallet_txns.find({"user_id": user_id}).sort("created_at", -1).limit(10)
    txns = await txns_cursor.to_list(length=10)
    orders_cursor = db.orders.find({"user_id": user_id}).sort("created_at", -1).limit(20)
    orders = await orders_cursor.to_list(length=20)
    addresses_cursor = db.addresses.find({"user_id": user_id}).sort("created_at", -1)
    addresses = await addresses_cursor.to_list(length=20)

    referrals_count = 0
    if user.get("referral_code"):
        referrals_count = await db.users.count_documents({"referred_by": user["referral_code"]})

    # Aggregate stats
    delivered_orders = sum(1 for o in orders if o.get("status") == "delivered")
    total_spend = sum(o.get("total_amount", 0) for o in orders if o.get("status") == "delivered")

    return {
        "id": str(user["_id"]),
        "phone": user["phone"],
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role") or "customer",
        "profile_image": user.get("profile_image"),
        "referral_code": user.get("referral_code"),
        "referred_by": user.get("referred_by"),
        "referrals_made": referrals_count,
        "terms_accepted_version": user.get("terms_accepted_version", 0),
        "terms_accepted_at": user.get("terms_accepted_at"),
        "created_at": user["created_at"],
        "updated_at": user.get("updated_at"),
        # Wallet
        "wallet": {
            "balance": (wallet or {}).get("balance", 0.0),
            "txns": [{
                "id": str(t["_id"]),
                "type": t.get("type"),
                "amount": t.get("amount"),
                "reason": t.get("reason"),
                "description": t.get("description"),
                "created_at": t.get("created_at"),
            } for t in txns],
        },
        # Orders
        "orders": [{
            "id": str(o["_id"]),
            "order_number": o.get("order_number"),
            "status": o.get("status"),
            "total_amount": o.get("total_amount", 0),
            "items_count": sum(i.get("quantity", 1) for i in o.get("items", [])),
            "payment_method": o.get("payment_method"),
            "created_at": o.get("created_at"),
        } for o in orders],
        "delivered_count": delivered_orders,
        "total_spend": total_spend,
        # Addresses
        "addresses": [{
            "id": str(a["_id"]),
            "label": a.get("label"),
            "full_address": a.get("full_address"),
            "city": a.get("city"),
            "pincode": a.get("pincode"),
            "is_default": a.get("is_default", False),
        } for a in addresses],
        # Rider-specific bits (only meaningful if role == rider)
        "rider": {
            "approved": user.get("rider_approved", False),
            "status": user.get("rider_status"),
            "vehicle_type": user.get("vehicle_type"),
            "vehicle_number": user.get("vehicle_number"),
            "documents_uploaded": user.get("documents_uploaded", False),
            "has_dl": bool(user.get("dl_image")),
            "has_aadhaar": bool(user.get("aadhaar_image") or user.get("id_proof_image")),
            "has_selfie": bool(user.get("selfie_image")),
            "total_trips": user.get("total_trips", 0),
            "total_earnings": user.get("total_earnings", 0.0),
            "current_location": user.get("current_location"),
        } if user.get("role") == "rider" else None,
        # Store-specific bits
        "store_id": user.get("store_id"),
    }


# ── Rider Approval ───────────────────────────────────────────

@router.put("/riders/{rider_id}/approve")
async def approve_rider(rider_id: str, body: ApprovalRequest, current_user: dict = Depends(get_current_user)):
    """Admin approves or rejects a rider."""
    _require_admin(current_user)
    db = get_db()
    rider = await db.users.find_one({"_id": ObjectId(rider_id), "role": "rider"})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    await db.users.update_one({"_id": ObjectId(rider_id)}, {"$set": {
        "rider_approved": body.approved, "updated_at": datetime.now(timezone.utc),
    }})
    # Push notify the rider (non-blocking)
    try: await notify_rider_approval(rider_id, body.approved)
    except Exception: pass
    # Email the rider (non-blocking)
    try:
        await send_email_event(
            "rider_approved" if body.approved else "rider_rejected",
            to_email=rider.get("email"),
            audience="rider",
            user_id=rider_id,
            context={"rider_name": rider.get("name") or "Rider"},
        )
    except Exception: pass
    return {"message": f"Rider {'approved' if body.approved else 'rejected'}", "rider_id": rider_id}


@router.get("/riders")
async def list_riders(current_user: dict = Depends(get_current_user)):
    """List all riders."""
    _require_admin(current_user)
    db = get_db()
    cursor = db.users.find({"role": "rider"}).sort("created_at", -1)
    riders = await cursor.to_list(length=100)
    return [{
        "id": str(r["_id"]), "phone": r["phone"], "name": r.get("name"),
        "vehicle_type": r.get("vehicle_type"), "vehicle_number": r.get("vehicle_number"),
        "rider_status": r.get("rider_status", "offline"),
        "rider_approved": r.get("rider_approved", False),
        "documents_uploaded": r.get("documents_uploaded", False),
        "has_dl": bool(r.get("dl_image")),
        "has_aadhaar": bool(r.get("aadhaar_image") or r.get("id_proof_image")),
        "has_selfie": bool(r.get("selfie_image")),
        "has_id_proof": bool(r.get("id_proof_image") or r.get("aadhaar_image")),
        "total_trips": r.get("total_trips", 0),
        "total_earnings": r.get("total_earnings", 0.0),
        "current_location": r.get("current_location"),
        "last_seen": r.get("updated_at"),
        "created_at": r["created_at"],
    } for r in riders]


@router.get("/riders/online")
async def list_online_riders(current_user: dict = Depends(get_current_user)):
    """Return all riders who are currently online or on-trip with their last known
    GPS coordinates. Used by the admin live tracking map (polled every 10s).

    NOTE: this static route MUST be declared before the dynamic
    `/riders/{rider_id}` route below, otherwise FastAPI matches "online" as a
    rider_id and 500s on ObjectId('online').
    """
    _require_admin(current_user)
    db = get_db()
    cursor = db.users.find({
        "role": "rider",
        "rider_status": {"$in": ["online", "on_trip"]},
        "current_location": {"$exists": True, "$ne": None},
    }, {
        "name": 1, "phone": 1, "vehicle_type": 1, "vehicle_number": 1,
        "rider_status": 1, "current_location": 1, "location_updated_at": 1, "updated_at": 1,
    })
    riders = await cursor.to_list(length=200)
    return [{
        "id": str(r["_id"]),
        "name": r.get("name"),
        "phone": r.get("phone"),
        "vehicle_type": r.get("vehicle_type"),
        "vehicle_number": r.get("vehicle_number"),
        "rider_status": r.get("rider_status"),
        "location": r.get("current_location"),
        "last_updated": r.get("location_updated_at") or r.get("updated_at"),
    } for r in riders]


@router.get("/riders/{rider_id}")
async def get_rider_detail(rider_id: str, current_user: dict = Depends(get_current_user)):
    """Get full rider details including recent trips."""
    _require_admin(current_user)
    db = get_db()
    rider = await db.users.find_one({"_id": ObjectId(rider_id), "role": "rider"})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    # Recent trips
    trips_cursor = db.trips.find({"rider_id": rider_id}).sort("created_at", -1).limit(20)
    trips = await trips_cursor.to_list(length=20)
    trip_summary = [{
        "id": str(t["_id"]), "order_id": t["order_id"],
        "trip_type": t["trip_type"], "status": t["status"],
        "fee": t.get("fee", 40.0),
        "completed_at": t.get("completed_at"),
        "created_at": t["created_at"],
    } for t in trips]
    return {
        "id": str(rider["_id"]), "phone": rider["phone"],
        "name": rider.get("name"), "email": rider.get("email"),
        "vehicle_type": rider.get("vehicle_type"), "vehicle_number": rider.get("vehicle_number"),
        "rider_status": rider.get("rider_status", "offline"),
        "rider_approved": rider.get("rider_approved", False),
        "documents_uploaded": rider.get("documents_uploaded", False),
        "dl_image": rider.get("dl_image"),
        "aadhaar_image": rider.get("aadhaar_image") or rider.get("id_proof_image"),
        "selfie_image": rider.get("selfie_image"),
        "id_proof_image": rider.get("id_proof_image"),
        "total_trips": rider.get("total_trips", 0),
        "total_earnings": rider.get("total_earnings", 0.0),
        "current_location": rider.get("current_location"),
        "last_seen": rider.get("updated_at"),
        "created_at": rider["created_at"],
        "recent_trips": trip_summary,
    }


@router.get("/riders/{rider_id}/location")
async def get_rider_location(rider_id: str, current_user: dict = Depends(get_current_user)):
    """Get a rider's current GPS coordinates."""
    _require_admin(current_user)
    db = get_db()
    rider = await db.users.find_one({"_id": ObjectId(rider_id), "role": "rider"}, {"current_location": 1, "rider_status": 1, "location_updated_at": 1, "updated_at": 1})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    return {
        "rider_id": rider_id,
        "location": rider.get("current_location"),
        "rider_status": rider.get("rider_status", "offline"),
        "last_updated": rider.get("location_updated_at") or rider.get("updated_at"),
    }


# ── Store Approval ───────────────────────────────────────────

@router.put("/stores/{store_id}/approve")
async def approve_store(store_id: str, body: ApprovalRequest, current_user: dict = Depends(get_current_user)):
    """Admin approves or rejects a store."""
    _require_admin(current_user)
    db = get_db()
    store = await db.stores.find_one({"_id": ObjectId(store_id)})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    new_status = "active" if body.approved else "rejected"
    await db.stores.update_one({"_id": ObjectId(store_id)}, {"$set": {
        "approved": body.approved, "status": new_status,
    }})
    return {"message": f"Store {'approved' if body.approved else 'rejected'}", "store_id": store_id}


@router.get("/stores")
async def list_stores(current_user: dict = Depends(get_current_user)):
    """List all stores."""
    _require_admin(current_user)
    db = get_db()
    cursor = db.stores.find({}).sort("created_at", -1)
    stores = await cursor.to_list(length=100)
    result = []
    for s in stores:
        order_count = await db.orders.count_documents({"store_id": str(s["_id"])})
        owner = await db.users.find_one({"_id": ObjectId(s["owner_user_id"])}) if s.get("owner_user_id") else None
        result.append({
            "id": str(s["_id"]), "vendor_code": s["vendor_code"],
            "name": s["name"], "address": s["address"], "city": s["city"],
            "phone": s.get("phone", ""),
            "status": s["status"], "is_open": s.get("is_open", False),
            "approved": s.get("approved", False),
            "total_earnings": s.get("total_earnings", 0.0),
            "pending_payout": s.get("pending_payout", 0.0),
            "owner_user_id": s.get("owner_user_id"),
            "owner_name": owner.get("name") if owner else None,
            "owner_phone": owner.get("phone") if owner else None,
            "order_count": order_count,
            "opening_time": s.get("opening_time", "09:00"),
            "closing_time": s.get("closing_time", "21:00"),
            "latitude": s.get("latitude"),
            "longitude": s.get("longitude"),
            "created_at": s.get("created_at"),
        })
    return result


@router.get("/stores/{store_id}")
async def get_store_detail(store_id: str, current_user: dict = Depends(get_current_user)):
    """Get full store details."""
    _require_admin(current_user)
    db = get_db()
    store = await db.stores.find_one({"_id": ObjectId(store_id)})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    owner = await db.users.find_one({"_id": ObjectId(store["owner_user_id"])}) if store.get("owner_user_id") else None
    order_count = await db.orders.count_documents({"store_id": store_id})
    active_orders = await db.orders.count_documents({"store_id": store_id, "status": {"$nin": ["delivered", "cancelled"]}})
    return {
        "id": str(store["_id"]), "vendor_code": store["vendor_code"],
        "name": store["name"], "address": store["address"], "city": store["city"],
        "state": store.get("state"), "pincode": store.get("pincode"),
        "phone": store.get("phone", ""), "whatsapp": store.get("whatsapp"),
        "status": store["status"], "is_open": store.get("is_open", False),
        "approved": store.get("approved", False),
        "latitude": store.get("latitude"), "longitude": store.get("longitude"),
        "geo_radius_km": store.get("geo_radius_km", 15),
        "opening_time": store.get("opening_time", "09:00"),
        "closing_time": store.get("closing_time", "21:00"),
        "total_earnings": store.get("total_earnings", 0.0),
        "pending_payout": store.get("pending_payout", 0.0),
        "order_count": order_count,
        "active_orders": active_orders,
        "owner_user_id": store.get("owner_user_id"),
        "owner_name": owner.get("name") if owner else None,
        "owner_phone": owner.get("phone") if owner else None,
        "owner_email": owner.get("email") if owner else None,
        "created_at": store.get("created_at"),
    }


@router.put("/stores/{store_id}/toggle-open")
async def toggle_store_open(store_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle a store's open/closed status."""
    _require_admin(current_user)
    db = get_db()
    store = await db.stores.find_one({"_id": ObjectId(store_id)})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    new_status = not store.get("is_open", False)
    await db.stores.update_one({"_id": ObjectId(store_id)}, {"$set": {"is_open": new_status}})
    return {"is_open": new_status, "store_id": store_id}


@router.get("/stores/{store_id}/orders")
async def get_store_orders(store_id: str, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get recent orders for a store."""
    _require_admin(current_user)
    db = get_db()
    cursor = db.orders.find({"store_id": store_id}).sort("created_at", -1).limit(limit)
    orders = await cursor.to_list(length=limit)
    result = []
    for o in orders:
        customer = await db.users.find_one({"_id": ObjectId(o["user_id"])})
        result.append({
            "id": str(o["_id"]), "order_number": o["order_number"],
            "status": o["status"], "total_amount": o["total_amount"],
            "items_count": sum(i.get("quantity", 1) for i in o.get("items", [])),
            "customer_name": customer.get("name", "Customer") if customer else "Customer",
            "payment_method": o.get("payment_method"),
            "created_at": o["created_at"],
        })
    return result


# ════════════════════════════════════════════════════════════
# SERVICES & PRICING MANAGEMENT
# ════════════════════════════════════════════════════════════

import uuid
import re

def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9-]", "", re.sub(r"\s+", "-", text.lower().strip()))


@router.get("/services")
async def admin_list_services(current_user: dict = Depends(get_current_user)):
    """List all services with full item details."""
    _require_admin(current_user)
    db = get_db()
    cursor = db.services.find({})
    services = await cursor.to_list(length=100)
    return [{
        "id": str(s["_id"]),
        "name": s["name"],
        "slug": s["slug"],
        "description": s.get("description", ""),
        "icon": s.get("icon", "shirt-outline"),
        "pricing_unit": s.get("pricing_unit", "piece"),
        "service_type": s.get("service_type", "pickup_drop"),
        "active": s.get("active", True),
        "items": [{"id": str(i.get("_id", i.get("id", ""))), "name": i["name"], "price": i["price"], "category": i.get("category", "unisex")} for i in _sorted_items(s.get("items", []))],
    } for s in services]


@router.post("/services")
async def admin_create_service(body: dict, current_user: dict = Depends(get_current_user)):
    """Create a new service category."""
    _require_admin(current_user)
    db = get_db()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Service name required")
    slug = _slugify(name)
    existing = await db.services.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    doc = {
        "name": name,
        "slug": slug,
        "description": body.get("description", ""),
        "icon": body.get("icon", "shirt-outline"),
        "pricing_unit": body.get("pricing_unit", "piece"),
        "service_type": body.get("service_type", "pickup_drop"),
        "active": True,
        "items": [],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.services.insert_one(doc)
    return {"id": str(result.inserted_id), "slug": slug, "message": "Service created"}


@router.put("/services/{service_id}")
async def admin_update_service(service_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update service category details."""
    _require_admin(current_user)
    db = get_db()
    update = {}
    for field in ["name", "description", "icon", "pricing_unit", "service_type", "active"]:
        if field in body:
            update[field] = body[field]
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.services.update_one({"_id": ObjectId(service_id)}, {"$set": update})
    return {"message": "Service updated"}


@router.delete("/services/{service_id}")
async def admin_delete_service(service_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a service category and all its items."""
    _require_admin(current_user)
    db = get_db()
    result = await db.services.delete_one({"_id": ObjectId(service_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted"}


@router.post("/services/{service_id}/items")
async def admin_add_item(service_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Add a new item to a service."""
    _require_admin(current_user)
    db = get_db()
    name = body.get("name", "").strip()
    price = body.get("price")
    if not name or price is None:
        raise HTTPException(status_code=400, detail="name and price required")
    item_id = f"item_{uuid.uuid4().hex[:8]}"
    from app.core.categories import normalize as _normalize_category
    category = _normalize_category(body.get("category", "unisex"))
    item = {"_id": item_id, "name": name, "price": float(price), "icon": body.get("icon", "shirt"), "category": category}
    await db.services.update_one({"_id": ObjectId(service_id)}, {"$push": {"items": item}})
    return {"message": "Item added", "item_id": item_id}


@router.put("/services/{service_id}/items/{item_id}")
async def admin_update_item(service_id: str, item_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update an item's name or price."""
    _require_admin(current_user)
    db = get_db()
    update_fields = {}
    if "name" in body:
        update_fields["items.$.name"] = body["name"]
    if "price" in body:
        update_fields["items.$.price"] = float(body["price"])
    if "category" in body:
        from app.core.categories import is_valid as _cat_valid
        if _cat_valid(body["category"]):
            update_fields["items.$.category"] = body["category"]
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.services.update_one(
        {"_id": ObjectId(service_id), "items._id": item_id},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item updated"}


@router.delete("/services/{service_id}/items/{item_id}")
async def admin_delete_item(service_id: str, item_id: str, current_user: dict = Depends(get_current_user)):
    """Remove an item from a service."""
    _require_admin(current_user)
    db = get_db()
    await db.services.update_one(
        {"_id": ObjectId(service_id)},
        {"$pull": {"items": {"_id": item_id}}}
    )
    return {"message": "Item deleted"}


# ════════════════════════════════════════════════════════════
# COUPONS MANAGEMENT
# ════════════════════════════════════════════════════════════

@router.get("/coupons")
async def admin_list_coupons(current_user: dict = Depends(get_current_user)):
    """List all coupons."""
    _require_admin(current_user)
    db = get_db()
    cursor = db.coupons.find({}).sort("created_at", -1)
    coupons = await cursor.to_list(length=200)
    return [{
        "id": str(c["_id"]),
        "code": c["code"],
        "name": c.get("name", ""),
        "type": c["type"],
        "value": c["value"],
        "min_order": c.get("min_order", 0),
        "max_discount": c.get("max_discount", 9999),
        "usage_limit": c.get("usage_limit"),
        "used_count": c.get("used_count", 0),
        "valid_to": c.get("valid_to"),
        "active": c.get("active", True),
        "is_referral": c.get("is_referral", False),
        "created_at": c.get("created_at"),
    } for c in coupons]


@router.post("/coupons")
async def admin_create_coupon(body: dict, current_user: dict = Depends(get_current_user)):
    """Create a new coupon."""
    _require_admin(current_user)
    db = get_db()
    code = body.get("code", "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Coupon code required")
    existing = await db.coupons.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    valid_days = int(body.get("valid_days", 30))
    coupon_type = body.get("type", "percent")  # percent | flat
    # Max discount is an OPTIONAL cap for percent coupons; it's meaningless for
    # flat coupons (the value IS the discount). None = no cap.
    raw_max = body.get("max_discount")
    max_discount = None
    if coupon_type == "percent" and raw_max not in (None, "", 0, "0"):
        try:
            max_discount = float(raw_max)
        except (TypeError, ValueError):
            max_discount = None
    doc = {
        "code": code,
        "name": body.get("name", f"Coupon {code}"),
        "type": coupon_type,
        "value": float(body.get("value", 10)),
        "min_order": float(body.get("min_order", 0)),
        "max_discount": max_discount,
        "usage_limit": int(body["usage_limit"]) if body.get("usage_limit") else None,
        "per_user_limit": int(body.get("per_user_limit", 1)),
        "used_count": 0,
        "valid_from": now,
        "valid_to": now + timedelta(days=valid_days),
        "active": True,
        "is_referral": False,
        "store_ids": [],
        "created_at": now,
    }
    result = await db.coupons.insert_one(doc)
    return {"id": str(result.inserted_id), "code": code, "message": "Coupon created"}


@router.put("/coupons/{coupon_id}")
async def admin_update_coupon(coupon_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update coupon active status or value."""
    _require_admin(current_user)
    db = get_db()
    update = {}
    for field in ["name", "value", "min_order", "max_discount", "usage_limit", "active"]:
        if field in body:
            update[field] = body[field]
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.coupons.update_one({"_id": ObjectId(coupon_id)}, {"$set": update})
    return {"message": "Coupon updated"}


@router.delete("/coupons/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a coupon."""
    _require_admin(current_user)
    db = get_db()
    await db.coupons.delete_one({"_id": ObjectId(coupon_id)})
    return {"message": "Coupon deleted"}


# ════════════════════════════════════════════════════════════
# BANNERS & CONTENT MANAGEMENT
# ════════════════════════════════════════════════════════════

@router.get("/banners")
async def admin_list_banners(current_user: dict = Depends(get_current_user)):
    """List all promo banners."""
    _require_admin(current_user)
    db = get_db()
    cursor = db.promo_banners.find({}).sort("position", 1)
    banners = await cursor.to_list(length=50)
    return [{"id": str(b["_id"]), "title": b["title"], "image_url": b.get("image_url", ""),
             "link_type": b.get("link_type", "none"), "link_target": b.get("link_target"),
             "position": b.get("position", 0), "active": b.get("active", True)} for b in banners]


@router.post("/banners")
async def admin_create_banner(body: dict, current_user: dict = Depends(get_current_user)):
    """Create a new promo banner."""
    _require_admin(current_user)
    db = get_db()
    count = await db.promo_banners.count_documents({})
    doc = {
        "title": body.get("title", "New Banner"),
        "image_url": body.get("image_url", ""),
        "link_type": body.get("link_type", "none"),
        "link_target": body.get("link_target"),
        "position": count,
        "active": True,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.promo_banners.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Banner created"}


@router.put("/banners/{banner_id}")
async def admin_update_banner(banner_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update a banner."""
    _require_admin(current_user)
    db = get_db()
    update = {k: v for k, v in body.items() if k in ["title", "image_url", "link_type", "link_target", "position", "active"]}
    await db.promo_banners.update_one({"_id": ObjectId(banner_id)}, {"$set": update})
    return {"message": "Banner updated"}


@router.delete("/banners/{banner_id}")
async def admin_delete_banner(banner_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a banner."""
    _require_admin(current_user)
    db = get_db()
    await db.promo_banners.delete_one({"_id": ObjectId(banner_id)})
    return {"message": "Banner deleted"}


# ── Testimonials ──────────────────────────────────────────────

@router.get("/testimonials")
async def admin_list_testimonials(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    docs = await db.testimonials.find({}).to_list(length=50)
    return [{"id": str(d["_id"]), "customer_name": d["customer_name"], "text": d["text"],
             "rating": d.get("rating", 5), "city": d.get("city")} for d in docs]


@router.post("/testimonials")
async def admin_create_testimonial(body: dict, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    doc = {"customer_name": body.get("customer_name", "Customer"), "text": body.get("text", ""),
           "rating": int(body.get("rating", 5)), "city": body.get("city", ""),
           "created_at": datetime.now(timezone.utc)}
    result = await db.testimonials.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Testimonial created"}


@router.delete("/testimonials/{tid}")
async def admin_delete_testimonial(tid: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_db()
    await db.testimonials.delete_one({"_id": ObjectId(tid)})
    return {"message": "Testimonial deleted"}


# ════════════════════════════════════════════════════════════
# DIRECT CREATE RIDER / STORE
# ════════════════════════════════════════════════════════════

@router.post("/riders/create")
async def admin_create_rider(body: dict, current_user: dict = Depends(get_current_user)):
    """Admin directly creates and approves a rider account."""
    _require_admin(current_user)
    db = get_db()
    phone = body.get("phone", "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone required")
    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="User with this phone already exists")
    now = datetime.now(timezone.utc)
    doc = {
        "phone": phone, "name": body.get("name", "Rider"),
        "role": "rider",
        "vehicle_type": body.get("vehicle_type", "bike"),
        "vehicle_number": body.get("vehicle_number", ""),
        "rider_status": "offline", "rider_approved": False,
        "documents_uploaded": False,
        "total_trips": 0, "total_earnings": 0.0,
        "created_at": now, "updated_at": now,
    }
    result = await db.users.insert_one(doc)
    # Send invitation SMS — non-blocking; never fails the create
    try:
        await send_invite_sms(phone, role="rider", name=doc["name"])
    except Exception:
        pass
    return {"id": str(result.inserted_id), "phone": phone, "message": "Rider created — pending document upload and approval. Invitation SMS sent."}


@router.post("/stores/create")
async def admin_create_store(body: dict, current_user: dict = Depends(get_current_user)):
    """Admin directly creates and approves a store."""
    _require_admin(current_user)
    db = get_db()
    phone = body.get("owner_phone", "").strip()
    store_name = body.get("name", "").strip()
    if not phone or not store_name:
        raise HTTPException(status_code=400, detail="owner_phone and name required")

    # Find or create the owner user
    owner = await db.users.find_one({"phone": phone})
    now = datetime.now(timezone.utc)
    if not owner:
        owner_result = await db.users.insert_one({
            "phone": phone, "name": body.get("owner_name", "Store Owner"),
            "role": "store_owner", "created_at": now, "updated_at": now,
        })
        owner_id = str(owner_result.inserted_id)
    else:
        owner_id = str(owner["_id"])

    count = await db.stores.count_documents({})
    vendor_code = f"WB{count + 1:03d}"
    store_doc = {
        "vendor_code": vendor_code, "name": store_name,
        "owner_user_id": owner_id,
        "address": body.get("address", ""),
        "city": body.get("city", "Ludhiana"),
        "state": body.get("state", "Punjab"),
        "pincode": body.get("pincode", ""),
        "phone": body.get("store_phone", phone),
        "whatsapp": body.get("store_phone", phone),
        "latitude": float(body.get("latitude", 30.9010)),
        "longitude": float(body.get("longitude", 75.8573)),
        "location": location_point(body.get("latitude", 30.9010), body.get("longitude", 75.8573)),
        "geo_radius_km": float(body.get("geo_radius_km", 15)),
        "status": "active", "is_open": False,
        "opening_time": body.get("opening_time", "09:00"),
        "closing_time": body.get("closing_time", "21:00"),
        "total_earnings": 0.0, "pending_payout": 0.0,
        "approved": True,
        "profile_complete": False,  # Owner must complete photos/GST/bank
        "created_at": now,
    }
    store_result = await db.stores.insert_one(store_doc)
    await db.users.update_one({"_id": ObjectId(owner_id)}, {
        "$set": {"role": "store_owner", "store_id": str(store_result.inserted_id)}
    })
    # Invitation SMS to store owner — non-blocking
    try:
        owner_name = body.get("owner_name") or (owner.get("name") if owner else None)
        await send_invite_sms(phone, role="store_owner", name=owner_name)
    except Exception:
        pass
    return {"store_id": str(store_result.inserted_id), "vendor_code": vendor_code,
            "owner_id": owner_id, "message": "Store created. Invitation SMS sent — owner must login and complete profile."}


# ════════════════════════════════════════════════════════════
# PROFILE EDITING (super-admin only) — Bug 6
# ════════════════════════════════════════════════════════════

async def _audit_edit(db, current_user, collection: str, doc_id: str, before: dict, after: dict):
    """Record a super-admin profile/bill edit for the audit trail (best-effort)."""
    try:
        await db.admin_db_audit.insert_one({
            "actor_id": current_user["user_id"], "collection": collection,
            "action": "admin_edit", "doc_id": doc_id,
            "before": before, "after": after,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        pass


async def _check_phone_clash(db, new_phone: str, exclude_id):
    clash = await db.users.find_one({"phone": new_phone, "_id": {"$ne": exclude_id}})
    if clash:
        raise HTTPException(status_code=409, detail="Another user already has this phone")


@router.put("/users/{user_id}")
async def admin_update_user(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Super-admin edits a customer/user profile (name, email, phone)."""
    _require_admin(current_user)
    db = get_db()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if "name" in body:
        updates["name"] = (body.get("name") or "").strip() or None
    if "email" in body:
        updates["email"] = (body.get("email") or "").strip().lower() or None
    if body.get("phone"):
        new_phone = _admin_normalize_phone(body["phone"])
        if new_phone != user["phone"]:
            await _check_phone_clash(db, new_phone, user["_id"])
            updates["phone"] = new_phone
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    before = {k: user.get(k) for k in updates}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    await _audit_edit(db, current_user, "users", user_id, before,
                      {k: v for k, v in updates.items() if k != "updated_at"})
    return {"id": user_id, "message": "User updated"}


@router.put("/riders/{rider_id}")
async def admin_update_rider(rider_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Super-admin edits a rider profile (name, email, phone, vehicle, approval)."""
    _require_admin(current_user)
    db = get_db()
    try:
        rider = await db.users.find_one({"_id": ObjectId(rider_id), "role": "rider"})
    except Exception:
        rider = None
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    updates = {}
    if "name" in body:
        updates["name"] = (body.get("name") or "").strip() or None
    if "email" in body:
        updates["email"] = (body.get("email") or "").strip().lower() or None
    if "vehicle_type" in body:
        updates["vehicle_type"] = (body.get("vehicle_type") or "").strip() or None
    if "vehicle_number" in body:
        updates["vehicle_number"] = (body.get("vehicle_number") or "").strip() or None
    if "rider_approved" in body:
        updates["rider_approved"] = bool(body["rider_approved"])
    if body.get("phone"):
        new_phone = _admin_normalize_phone(body["phone"])
        if new_phone != rider["phone"]:
            await _check_phone_clash(db, new_phone, rider["_id"])
            updates["phone"] = new_phone
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    before = {k: rider.get(k) for k in updates}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": rider["_id"]}, {"$set": updates})
    await _audit_edit(db, current_user, "users", rider_id, before,
                      {k: v for k, v in updates.items() if k != "updated_at"})
    return {"id": rider_id, "message": "Rider updated"}


@router.put("/stores/{store_id}")
async def admin_update_store(store_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Super-admin edits a store profile (name, address, contact, hours, geo, status)."""
    _require_admin(current_user)
    db = get_db()
    try:
        store = await db.stores.find_one({"_id": ObjectId(store_id)})
    except Exception:
        store = None
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    updates = {}
    for f in ["name", "address", "city", "state", "pincode", "phone", "whatsapp",
              "opening_time", "closing_time", "status"]:
        if f in body:
            updates[f] = body[f]
    for f in ["latitude", "longitude", "geo_radius_km"]:
        if body.get(f) not in (None, ""):
            try:
                updates[f] = float(body[f])
            except (TypeError, ValueError):
                pass
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    # Keep the GeoJSON mirror in sync whenever coordinates change (B1)
    if "latitude" in updates or "longitude" in updates:
        updates["location"] = location_point(
            updates.get("latitude", store.get("latitude")),
            updates.get("longitude", store.get("longitude")),
        )
    before = {k: store.get(k) for k in updates}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.stores.update_one({"_id": store["_id"]}, {"$set": updates})
    await _audit_edit(db, current_user, "stores", store_id, before,
                      {k: v for k, v in updates.items() if k != "updated_at"})
    return {"id": store_id, "message": "Store updated"}


# ════════════════════════════════════════════════════════════
# PLATFORM SETTINGS
# ════════════════════════════════════════════════════════════

@router.get("/settings")
async def get_platform_settings(current_user: dict = Depends(get_current_user)):
    """Get platform settings."""
    _require_admin(current_user)
    db = get_db()
    settings = await db.platform_settings.find_one({}) or {}
    return {
        "delivery_fee": settings.get("delivery_fee", 40),
        "free_delivery_threshold": settings.get("free_delivery_threshold", 299),
        "platform_commission_pct": settings.get("platform_commission_pct", 20),
        "rider_pickup_fee": settings.get("rider_pickup_fee", 40),
        "rider_delivery_fee": settings.get("rider_delivery_fee", 40),
        "min_order_value": settings.get("min_order_value", 99),
        "express_surcharge_pct": settings.get("express_surcharge_pct", 50),
        "referral_new_user_pct": settings.get("referral_new_user_pct", 10),
        "referral_referrer_pct": settings.get("referral_referrer_pct", 20),
        "support_phone": settings.get("support_phone", "+911234567890"),
        "support_email": settings.get("support_email", "admin@washingbells.com"),
    }


# ════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ════════════════════════════════════════════════════════════

@router.get("/notifications")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """List store-event notifications (order accepted / rejected)."""
    _require_admin(current_user)
    db = get_db()
    query = {"read": False} if unread_only else {}
    cursor = db.notifications.find(query).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [
        {
            "id": str(d["_id"]),
            "type": d.get("type"),
            "order_id": d.get("order_id"),
            "order_number": d.get("order_number"),
            "store_id": d.get("store_id"),
            "store_name": d.get("store_name"),
            "note": d.get("note"),
            "read": d.get("read", False),
            "created_at": d.get("created_at"),
        }
        for d in docs
    ]


@router.get("/notifications/unread-count")
async def unread_notification_count(current_user: dict = Depends(get_current_user)):
    """Return the count of unread notifications."""
    _require_admin(current_user)
    db = get_db()
    count = await db.notifications.count_documents({"read": False})
    return {"count": count}


@router.post("/notifications/mark-read")
async def mark_notifications_read(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Mark notifications as read. Pass {"ids": [...]} or {} to mark all."""
    _require_admin(current_user)
    db = get_db()
    ids = body.get("ids")
    if ids:
        object_ids = [ObjectId(i) for i in ids]
        await db.notifications.update_many({"_id": {"$in": object_ids}}, {"$set": {"read": True}})
    else:
        await db.notifications.update_many({}, {"$set": {"read": True}})
    return {"message": "Notifications marked as read"}


@router.put("/settings")
async def update_platform_settings(body: dict, current_user: dict = Depends(get_current_user)):
    """Update platform settings."""
    _require_admin(current_user)
    db = get_db()
    allowed = ["delivery_fee", "free_delivery_threshold", "platform_commission_pct",
               "rider_pickup_fee", "rider_delivery_fee", "min_order_value",
               "express_surcharge_pct", "referral_new_user_pct", "referral_referrer_pct",
               "support_phone", "support_email"]
    update = {k: v for k, v in body.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid settings to update")
    await db.platform_settings.update_one({}, {"$set": update}, upsert=True)
    return {"message": "Settings updated", "updated": list(update.keys())}


# ── Billing Settings (GST) ───────────────────────────────────

@router.get("/billing-settings")
async def get_billing_settings_endpoint(current_user: dict = Depends(get_current_user)):
    """Read GST/billing configuration."""
    _require_admin(current_user)
    from app.services.billing_service import get_billing_settings
    return await get_billing_settings(get_db())


@router.put("/billing-settings")
async def update_billing_settings_endpoint(body: dict, current_user: dict = Depends(get_current_user)):
    """Update GST/billing configuration (rate, enabled, prefix, CGST/SGST split)."""
    _require_admin(current_user)
    from app.services.billing_service import update_billing_settings
    settings = await update_billing_settings(get_db(), body)
    return {"message": "Billing settings updated", "settings": settings}


# ── Payout Settlements ───────────────────────────────────────

@router.get("/payouts")
async def admin_list_payouts(current_user: dict = Depends(get_current_user)):
    """List stores with their pending/total earnings + recent settlement history."""
    _require_admin(current_user)
    db = get_db()
    stores = await db.stores.find({}).to_list(length=500)
    store_rows = []
    for s in stores:
        store_rows.append({
            "store_id": str(s["_id"]),
            "vendor_code": s.get("vendor_code", ""),
            "name": s.get("name", ""),
            "pending_payout": round(s.get("pending_payout", 0.0), 2),
            "total_earnings": round(s.get("total_earnings", 0.0), 2),
            "bank_account_number": s.get("bank_account_number"),
            "bank_ifsc": s.get("bank_ifsc"),
            "bank_account_holder": s.get("bank_account_holder"),
        })
    store_rows.sort(key=lambda r: r["pending_payout"], reverse=True)

    payouts = await db.payouts.find({}).sort("created_at", -1).to_list(length=200)
    history = [{
        "id": str(p["_id"]),
        "store_id": p.get("store_id"),
        "store_name": p.get("store_name", ""),
        "vendor_code": p.get("vendor_code", ""),
        "amount": round(p.get("amount", 0.0), 2),
        "reference": p.get("reference", ""),
        "note": p.get("note", ""),
        "status": p.get("status", "paid"),
        "created_at": p.get("created_at"),
    } for p in payouts]

    total_pending = round(sum(r["pending_payout"] for r in store_rows), 2)
    return {"stores": store_rows, "history": history, "total_pending": total_pending}


@router.post("/payouts/{store_id}/settle")
async def admin_settle_payout(store_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Record a payout to a store and reduce its pending balance.

    Body: { amount, reference, note }. Amount defaults to the full pending
    balance and is capped to it so a store can never be over-settled.
    """
    _require_admin(current_user)
    db = get_db()
    store = await db.stores.find_one({"_id": ObjectId(store_id)})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    pending = round(store.get("pending_payout", 0.0), 2)
    if pending <= 0:
        raise HTTPException(status_code=400, detail="No pending payout for this store")

    try:
        amount = round(float(body.get("amount", pending)), 2)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid amount")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    amount = min(amount, pending)  # never over-settle

    now = datetime.now(timezone.utc)
    payout_doc = {
        "store_id": store_id,
        "store_name": store.get("name", ""),
        "vendor_code": store.get("vendor_code", ""),
        "amount": amount,
        "reference": (body.get("reference") or "").strip(),
        "note": (body.get("note") or "").strip(),
        "status": "paid",
        "settled_by": current_user["user_id"],
        "created_at": now,
    }
    result = await db.payouts.insert_one(payout_doc)
    await db.stores.update_one({"_id": store["_id"]}, {"$inc": {"pending_payout": -amount}})
    return {
        "message": "Payout recorded",
        "payout_id": str(result.inserted_id),
        "amount": amount,
        "remaining_pending": round(pending - amount, 2),
    }


# ════════════════════════════════════════════════════════════
# WEEKLY SUMMARY EMAIL (admin recipients)
# ════════════════════════════════════════════════════════════

import hmac as _hmac
from datetime import timedelta
from app.core.config import get_settings as _get_settings


async def _send_weekly_summary(db) -> dict:
    """Compute last-7-days aggregates and email them to all admin recipients."""
    from app.services.email_service import send_event_to_admins, admin_addresses
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    orders_count = await db.orders.count_documents({"created_at": {"$gte": week_ago}})
    delivered_count = await db.orders.count_documents({"delivered_at": {"$gte": week_ago}})
    rev = await db.orders.aggregate([
        {"$match": {"status": "delivered", "delivered_at": {"$gte": week_ago}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total_amount"},
                    "platform_fees": {"$sum": "$platform_fee"}}},
    ]).to_list(1)
    revenue = round((rev[0]["revenue"] if rev else 0) or 0, 2)
    platform_fees = round((rev[0]["platform_fees"] if rev else 0) or 0, 2)
    new_customers = await db.users.count_documents({"role": "customer", "created_at": {"$gte": week_ago}})
    active_orders = await db.orders.count_documents({"status": {"$nin": ["delivered", "cancelled", "rejected"]}})
    breakdown_rows = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {"_id": "$status", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]).to_list(20)
    status_breakdown = ", ".join(f"{r['_id']}: {r['n']}" for r in breakdown_rows) or "no orders"

    context = {
        "week_range": f"{week_ago.strftime('%d %b')} – {now.strftime('%d %b %Y')}",
        "orders_count": str(orders_count),
        "delivered_count": str(delivered_count),
        "revenue": f"{revenue:.0f}",
        "platform_fees": f"{platform_fees:.0f}",
        "new_customers": str(new_customers),
        "active_orders": str(active_orders),
        "status_breakdown": status_breakdown,
    }
    sent = await send_event_to_admins("weekly_summary_admin", context=context)
    return {"sent": sent, "recipients": admin_addresses(), **context}


@router.post("/reports/weekly-email")
async def send_weekly_summary_now(current_user: dict = Depends(get_current_user)):
    """Super-admin console: send the weekly summary right now."""
    _require_admin(current_user)
    return await _send_weekly_summary(get_db())


@router.post("/reports/weekly-email-cron")
async def weekly_summary_cron(key: str = ""):
    """Machine trigger for Cloud Scheduler. Guarded by WEEKLY_REPORT_KEY

    (same shared-secret pattern as the SendGrid inbound webhook)."""
    expected = _get_settings().WEEKLY_REPORT_KEY
    if not expected:
        raise HTTPException(status_code=503, detail="Weekly report key not configured")
    if not _hmac.compare_digest(key, expected):
        raise HTTPException(status_code=403, detail="Invalid key")
    return await _send_weekly_summary(get_db())
