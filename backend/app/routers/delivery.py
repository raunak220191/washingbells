"""Delivery — Rider worklist, pickup flow, store drop, delivery flow."""

import random
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.phase2_schemas import (
    OTPVerifyRequest, PhotoUploadRequest,
    RiderLocationUpdate, RiderStatusUpdate,
    RiderDocumentsUpload,
)
from app.services.push_service import notify_customer_order_update

router = APIRouter(prefix="/delivery", tags=["Delivery (Rider)"])

RIDER_FEE = 40.0  # Per trip fee


async def _require_rider(current_user: dict, require_approved: bool = True):
    """Ensures caller is a rider role. For non-admin riders, also enforces
    approval by default. Pass require_approved=False to allow unapproved
    riders (e.g. for profile, document upload, T&C acceptance).
    """
    if current_user.get("role") not in ("rider", "admin"):
        raise HTTPException(status_code=403, detail="Rider access only")
    if require_approved and current_user.get("role") == "rider":
        db = get_db()
        user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
        if not user or not user.get("rider_approved", False):
            raise HTTPException(status_code=403, detail="Account pending admin approval")


def _gen_otp() -> str:
    return str(random.randint(1000, 9999))


# ── Rider Profile & Status ──────────────────────────────────

@router.get("/me")
async def get_rider_profile(current_user: dict = Depends(get_current_user)):
    """Get rider's own profile with stats. Available even when unapproved."""
    await _require_rider(current_user, require_approved=False)
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    has_dl = bool(user.get("dl_image"))
    has_aadhaar = bool(user.get("aadhaar_image") or user.get("id_proof_image"))
    has_selfie = bool(user.get("selfie_image"))
    return {
        "id": str(user["_id"]), "phone": user["phone"], "name": user.get("name"),
        "role": "rider", "vehicle_type": user.get("vehicle_type"),
        "vehicle_number": user.get("vehicle_number"),
        "rider_status": user.get("rider_status", "offline"),
        "rider_approved": user.get("rider_approved", False),
        "documents_uploaded": user.get("documents_uploaded", False),
        "has_dl": has_dl, "has_aadhaar": has_aadhaar, "has_selfie": has_selfie,
        "total_trips": user.get("total_trips", 0),
        "total_earnings": user.get("total_earnings", 0.0),
        "profile_image": user.get("profile_image"),
        "created_at": user["created_at"],
    }


@router.post("/upload-documents")
async def upload_rider_documents(body: RiderDocumentsUpload, current_user: dict = Depends(get_current_user)):
    """Upload KYC documents (DL, Aadhaar, Selfie). Riders may upload these
    individually across multiple calls; `documents_uploaded` flips to True
    only once all three are present.
    """
    await _require_rider(current_user, require_approved=False)
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update = {"updated_at": datetime.now(timezone.utc)}
    if body.dl_image:
        update["dl_image"] = body.dl_image
    if body.aadhaar_image:
        update["aadhaar_image"] = body.aadhaar_image
        # Keep legacy id_proof_image in sync for backward compat with admin views
        update["id_proof_image"] = body.aadhaar_image
    if body.selfie_image:
        update["selfie_image"] = body.selfie_image

    if not any(k in update for k in ("dl_image", "aadhaar_image", "selfie_image")):
        raise HTTPException(status_code=400, detail="No documents provided")

    # Compute documents_uploaded based on resulting state (existing + new)
    has_dl = bool(update.get("dl_image") or user.get("dl_image"))
    has_aadhaar = bool(update.get("aadhaar_image") or user.get("aadhaar_image") or user.get("id_proof_image"))
    has_selfie = bool(update.get("selfie_image") or user.get("selfie_image"))
    update["documents_uploaded"] = has_dl and has_aadhaar and has_selfie

    await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    return {
        "documents_uploaded": update["documents_uploaded"],
        "has_dl": has_dl, "has_aadhaar": has_aadhaar, "has_selfie": has_selfie,
        "message": "All documents uploaded. Awaiting admin approval." if update["documents_uploaded"]
                   else "Document saved. Upload the remaining documents to complete verification.",
    }


@router.put("/status")
async def update_rider_status(body: RiderStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Toggle rider online/offline."""
    await _require_rider(current_user)
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {"rider_status": body.status, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"rider_status": body.status}


@router.put("/location")
async def update_rider_location(body: RiderLocationUpdate, current_user: dict = Depends(get_current_user)):
    """Update rider's current GPS location."""
    await _require_rider(current_user)
    db = get_db()
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {"current_location": {"lat": body.latitude, "lng": body.longitude},
                  "location_updated_at": now, "updated_at": now}},
    )
    return {"status": "location_updated"}


# ── Worklist ─────────────────────────────────────────────────

@router.get("/worklist")
async def get_worklist(current_user: dict = Depends(get_current_user)):
    """Get all trips assigned to this rider (pending + active)."""
    await _require_rider(current_user)
    db = get_db()
    cursor = db.trips.find({
        "rider_id": current_user["user_id"],
        "status": {"$in": ["assigned", "accepted", "started"]},
    }).sort("created_at", -1)
    trips = await cursor.to_list(length=50)
    result = []
    for t in trips:
        order = await db.orders.find_one({"_id": ObjectId(t["order_id"])})
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])}) if order else None
        result.append({
            "id": str(t["_id"]), "order_id": t["order_id"],
            "order_number": order["order_number"] if order else "N/A",
            "trip_type": t["trip_type"], "status": t["status"],
            "pickup_address": t.get("pickup_address", ""),
            "drop_address": t.get("drop_address", ""),
            "fee": t.get("fee", RIDER_FEE),
            "customer_name": customer.get("name", "Customer") if customer else "Customer",
            "customer_phone": customer.get("phone", "") if customer else "",
            "photos_uploaded": t.get("photos_uploaded", False),
            # Pickup trips: after the customer-pickup OTP the rider must still
            # drop at the store. Surface that state + the OTP to show the owner.
            "pickup_done": t.get("pickup_done", False),
            "store_drop_otp": order.get("store_received_otp") if order else None,
            # Delivery trips: the rider must know whether to collect cash.
            "payment_status": order.get("payment_status", "pending") if order else "pending",
            "payment_method": order.get("payment_method", "online") if order else "online",
            "total_amount": order.get("total_amount", 0) if order else 0,
            "created_at": t["created_at"],
        })
    return result


@router.get("/history")
async def get_trip_history(current_user: dict = Depends(get_current_user)):
    """Get completed/cancelled trips."""
    await _require_rider(current_user)
    db = get_db()
    cursor = db.trips.find({
        "rider_id": current_user["user_id"],
        "status": {"$in": ["completed", "cancelled"]},
    }).sort("created_at", -1)
    trips = await cursor.to_list(length=100)
    result = []
    for t in trips:
        order = await db.orders.find_one({"_id": ObjectId(t["order_id"])}) if t.get("order_id") else None
        result.append({
            "id": str(t["_id"]), "order_id": t["order_id"],
            "order_number": order["order_number"] if order else t.get("order_id", "")[-8:].upper(),
            "trip_type": t["trip_type"], "status": t["status"],
            "fee": t.get("fee", RIDER_FEE),
            "pickup_address": t.get("pickup_address", ""),
            "drop_address": t.get("drop_address", ""),
            "completed_at": t.get("completed_at"),
            "created_at": t["created_at"],
        })
    return result


# ── Accept Trip ──────────────────────────────────────────────

@router.post("/{trip_id}/accept")
async def accept_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Rider accepts an assigned trip."""
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip["status"] != "assigned":
        raise HTTPException(status_code=400, detail=f"Cannot accept trip in '{trip['status']}' status")
    now = datetime.now(timezone.utc)
    await db.trips.update_one({"_id": ObjectId(trip_id)}, {"$set": {"status": "accepted", "updated_at": now}})

    # Update order status
    order = await db.orders.find_one({"_id": ObjectId(trip["order_id"])})
    if order:
        new_status = "rider_assigned_pickup" if trip["trip_type"] == "pickup" else "out_for_delivery"
        tl = order.get("status_timeline", [])
        tl.append({"status": new_status, "timestamp": now.isoformat(), "note": f"Rider accepted {trip['trip_type']}"})
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": new_status, "status_timeline": tl, "updated_at": now}})

    # Set rider on_trip
    await db.users.update_one({"_id": ObjectId(current_user["user_id"])}, {"$set": {"rider_status": "on_trip"}})
    return {"status": "accepted", "trip_id": trip_id}


# ── Start Trip ───────────────────────────────────────────────

@router.post("/{trip_id}/start")
async def start_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Rider starts the trip (heading to pickup/delivery location)."""
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Trip must be accepted first")
    now = datetime.now(timezone.utc)
    await db.trips.update_one({"_id": ObjectId(trip_id)}, {"$set": {"status": "started", "started_at": now}})
    return {"status": "started", "trip_id": trip_id}


# ── Pickup Flow ──────────────────────────────────────────────

@router.post("/{trip_id}/upload-photos")
async def upload_pickup_photos(trip_id: str, body: PhotoUploadRequest, current_user: dict = Depends(get_current_user)):
    """Rider uploads garment photos at pickup. Each photo is persisted to the
    `uploads` collection (same as the generic /upload endpoint) and referenced
    on the order by upload_id + URL. The store is notified so the owner can
    review before clothes arrive.
    """
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip or trip["trip_type"] != "pickup":
        raise HTTPException(status_code=400, detail="Invalid pickup trip")
    if not body.photos:
        raise HTTPException(status_code=400, detail="At least one photo is required")

    now = datetime.now(timezone.utc)
    order_id = trip["order_id"]
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order_number = order.get("order_number", "")

    # Persist each photo as its own document in the uploads collection so the
    # order document stays small and the image is fetchable via /upload/{id}.
    photo_refs = []
    for idx, image_data in enumerate(body.photos):
        if not image_data:
            continue
        # If the rider somehow sent an already-uploaded URL, just keep it
        if image_data.startswith("http") or image_data.startswith("/api/"):
            photo_refs.append({
                "url": image_data, "upload_id": None, "size": 0,
                "uploaded_at": now.isoformat(), "uploaded_by": current_user["user_id"],
            })
            continue
        hash_val = hashlib.md5((image_data[:100] + str(idx)).encode()).hexdigest()[:8]
        filename = f"pickup_proof_{order_number}_{idx}_{hash_val}"
        upload_doc = {
            "filename": filename,
            "user_id": current_user["user_id"],
            "context": "pickup_proof",
            "order_id": order_id,
            "trip_id": trip_id,
            "data": image_data,
            "size": len(image_data),
            "created_at": now,
        }
        result = await db.uploads.insert_one(upload_doc)
        photo_refs.append({
            "url": f"/api/v1/upload/{result.inserted_id}",
            "upload_id": str(result.inserted_id),
            "size": len(image_data),
            "uploaded_at": now.isoformat(),
            "uploaded_by": current_user["user_id"],
        })

    if not photo_refs:
        raise HTTPException(status_code=400, detail="No valid photos in request")

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"pickup_proof_photos": photo_refs, "pickup_photos_at": now}},
    )
    # Mark photos as uploaded on the trip so step state can be restored
    await db.trips.update_one(
        {"_id": ObjectId(trip_id)},
        {"$set": {"photos_uploaded": True, "updated_at": now}},
    )

    # Push notify the store owner so they can review (non-blocking)
    if order.get("store_id"):
        try:
            from app.services.push_service import send_push_to_user
            store = await db.stores.find_one({"_id": ObjectId(order["store_id"])})
            if store and store.get("owner_user_id"):
                await send_push_to_user(
                    store["owner_user_id"],
                    title="📸 Pickup Photos Uploaded",
                    body=f"Order {order_number}: {len(photo_refs)} garment photo(s) attached.",
                    data={"type": "pickup_photos", "order_id": order_id, "order_number": order_number},
                    channel_id="default",
                )
        except Exception:
            pass

    return {
        "message": f"{len(photo_refs)} photos uploaded",
        "order_id": order_id, "photos_uploaded": True,
        "photo_refs": photo_refs,
    }


@router.post("/{trip_id}/generate-pickup-otp")
async def generate_pickup_otp(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Generate OTP and send to customer for pickup verification."""
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip or trip["trip_type"] != "pickup":
        raise HTTPException(status_code=400, detail="Invalid pickup trip")
    otp = _gen_otp()
    await db.orders.update_one(
        {"_id": ObjectId(trip["order_id"])},
        {"$set": {"pickup_otp": otp, "pickup_otp_verified": False}},
    )
    # The OTP goes to the CUSTOMER only (push + visible on their order screen);
    # the rider must ask them for it — it is never returned to the rider.
    order = await db.orders.find_one({"_id": ObjectId(trip["order_id"])})
    try:
        await notify_customer_order_update(
            order["user_id"], order["order_number"], order.get("status", "placed"),
            f"Your pickup OTP is {otp}. Share it with your rider to hand over the clothes.",
        )
    except Exception as e:
        print(f"Pickup OTP push failed: {e}")
    return {"message": "OTP sent to the customer's app — ask them for the code"}


@router.post("/{trip_id}/verify-pickup-otp")
async def verify_pickup_otp(trip_id: str, body: OTPVerifyRequest, current_user: dict = Depends(get_current_user)):
    """Rider enters customer OTP to confirm pickup."""
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip or trip["trip_type"] != "pickup":
        raise HTTPException(status_code=400, detail="Invalid pickup trip")
    order = await db.orders.find_one({"_id": ObjectId(trip["order_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("pickup_otp") != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    now = datetime.now(timezone.utc)
    # Auto-issue the store-drop OTP the rider will show the store owner on arrival.
    store_drop_otp = _gen_otp()
    tl = order.get("status_timeline", [])
    tl.append({"status": "picked_up", "timestamp": now.isoformat(), "note": "Rider verified pickup OTP"})
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {
        "pickup_otp_verified": True, "pickup_completed_at": now,
        "status": "picked_up", "status_timeline": tl,
        "store_received_otp": store_drop_otp, "store_received_otp_verified": False,
        "updated_at": now,
    }})
    # The trip stays ACTIVE — the rider still has to drop the clothes at the
    # store. The pickup trip is completed and the fee credited only when the
    # store verifies receipt (see store_ops.receive_clothes).
    await db.trips.update_one({"_id": ObjectId(trip_id)}, {"$set": {
        "pickup_done": True, "picked_up_at": now, "updated_at": now,
    }})

    # Email: order picked up → customer (non-blocking)
    try:
        from app.services.email_service import send_event as send_email_event
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        store = await db.stores.find_one({"_id": ObjectId(order["store_id"])}) if order.get("store_id") else None
        await send_email_event(
            "order_picked_up",
            to_email=customer.get("email") if customer else None,
            audience="customer",
            user_id=order["user_id"],
            order_id=str(order["_id"]),
            context={
                "customer_name": (customer.get("name") if customer else None) or "Customer",
                "order_number": order["order_number"],
                "store_name": store.get("name", "") if store else "",
            },
        )
    except Exception: pass

    return {
        "message": "Pickup confirmed! Now drop the clothes at the store.",
        "order_number": order["order_number"],
        "store_drop_otp": store_drop_otp,
    }


# ── Store Drop Flow ──────────────────────────────────────────

@router.post("/{trip_id}/generate-store-drop-otp")
async def generate_store_drop_otp(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Generate OTP for rider to give to store owner for drop verification."""
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip or trip["trip_type"] != "pickup":
        raise HTTPException(status_code=400, detail="Invalid trip")
    otp = _gen_otp()
    await db.orders.update_one(
        {"_id": ObjectId(trip["order_id"])},
        {"$set": {"store_received_otp": otp, "store_received_otp_verified": False}},
    )
    print(f"[DEV] Store drop OTP for order {trip['order_id']}: {otp}")
    return {"message": "Show this OTP to store owner", "otp": otp}


# ── Delivery Flow ────────────────────────────────────────────

@router.post("/{trip_id}/generate-delivery-otp")
async def generate_delivery_otp(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Generate OTP and send to customer for delivery verification."""
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip or trip["trip_type"] != "delivery":
        raise HTTPException(status_code=400, detail="Invalid delivery trip")
    otp = _gen_otp()
    await db.orders.update_one(
        {"_id": ObjectId(trip["order_id"])},
        {"$set": {"delivery_otp": otp, "delivery_otp_verified": False}},
    )
    # Customer-only, same as pickup: push + order screen; never shown to the rider.
    order = await db.orders.find_one({"_id": ObjectId(trip["order_id"])})
    try:
        await notify_customer_order_update(
            order["user_id"], order["order_number"], order.get("status", "out_for_delivery"),
            f"Your delivery OTP is {otp}. Share it with your rider to receive the clothes.",
        )
    except Exception as e:
        print(f"Delivery OTP push failed: {e}")
    return {"message": "OTP sent to the customer's app — ask them for the code"}


@router.post("/{trip_id}/collect-payment")
async def collect_payment(trip_id: str, current_user: dict = Depends(get_current_user)):
    """Rider confirms cash collected from the customer on a delivery trip.

    Marks the order paid and notifies the customer (push + email) and the
    admin recipients. Idempotent — an already-paid order returns success.
    """
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip or trip["trip_type"] != "delivery":
        raise HTTPException(status_code=400, detail="Invalid delivery trip")
    order = await db.orders.find_one({"_id": ObjectId(trip["order_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        return {"message": "Payment already recorded", "payment_status": "paid"}

    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": order.get("status", "out_for_delivery"), "timestamp": now.isoformat(),
               "note": "Cash collected by rider"})
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {
        "payment_status": "paid", "payment_collected_by": current_user["user_id"],
        "payment_collected_at": now, "status_timeline": tl, "updated_at": now,
    }})

    total = order.get("total_amount", 0)
    customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
    rider = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    try:
        await notify_customer_order_update(
            order["user_id"], order["order_number"], order.get("status", "out_for_delivery"),
            f"Payment of ₹{total:.0f} received in cash — thank you!",
        )
    except Exception: pass
    try:
        from app.services.email_service import send_event, send_event_to_admins
        ctx = {
            "customer_name": (customer or {}).get("name") or "Customer",
            "order_number": order["order_number"],
            "total_amount": f"{total:.0f}",
            "rider_name": (rider or {}).get("name") or (rider or {}).get("phone") or "Rider",
        }
        await send_event("payment_collected", to_email=(customer or {}).get("email"),
                         audience="customer", user_id=order["user_id"],
                         order_id=str(order["_id"]), context=ctx)
        await send_event_to_admins("payment_collected_admin", order_id=str(order["_id"]), context=ctx)
    except Exception: pass

    return {"message": f"Cash of ₹{total:.0f} recorded — order marked paid",
            "payment_status": "paid", "order_number": order["order_number"]}


@router.post("/{trip_id}/verify-delivery-otp")
async def verify_delivery_otp(trip_id: str, body: OTPVerifyRequest, current_user: dict = Depends(get_current_user)):
    """Rider enters customer OTP to confirm delivery. Completes the order."""
    await _require_rider(current_user)
    db = get_db()
    trip = await db.trips.find_one({"_id": ObjectId(trip_id), "rider_id": current_user["user_id"]})
    if not trip or trip["trip_type"] != "delivery":
        raise HTTPException(status_code=400, detail="Invalid delivery trip")
    order = await db.orders.find_one({"_id": ObjectId(trip["order_id"])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("delivery_otp") != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    now = datetime.now(timezone.utc)
    tl = order.get("status_timeline", [])
    tl.append({"status": "delivered", "timestamp": now.isoformat(), "note": "Rider verified delivery OTP"})

    # Calculate financials
    total = order.get("total_amount", 0)
    platform_fee = round(total * 0.20, 2)
    store_payout = round(total - platform_fee, 2)

    update = {
        "delivery_otp_verified": True, "delivered_at": now,
        "status": "delivered", "status_timeline": tl,
        "store_payout": store_payout, "platform_fee": platform_fee,
        "rider_delivery_fee": RIDER_FEE, "updated_at": now,
    }
    # COD settlement: handover happened, so cash changed hands — close the
    # payment. (A customer who paid online moments earlier is already "paid"
    # and skips this.)
    if order.get("payment_status") != "paid":
        update["payment_status"] = "paid"
        tl.append({"status": "delivered", "timestamp": now.isoformat(), "note": "Payment collected on delivery"})

    await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    await db.trips.update_one({"_id": ObjectId(trip_id)}, {"$set": {"status": "completed", "completed_at": now}})

    # Credit rider fee
    await db.users.update_one({"_id": ObjectId(current_user["user_id"])}, {
        "$inc": {"total_trips": 1, "total_earnings": RIDER_FEE},
        "$set": {"rider_status": "online"},
    })

    # Credit store earnings
    store_id = order.get("store_id")
    if store_id:
        await db.stores.update_one({"_id": ObjectId(store_id)}, {
            "$inc": {"total_earnings": store_payout, "pending_payout": store_payout},
        })

    # Email: order delivered → customer (non-blocking)
    try:
        from app.services.email_service import send_event as send_email_event
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        await send_email_event(
            "order_delivered",
            to_email=customer.get("email") if customer else None,
            audience="customer",
            user_id=order["user_id"],
            order_id=str(order["_id"]),
            context={
                "customer_name": (customer.get("name") if customer else None) or "Customer",
                "order_number": order["order_number"],
                "total_amount": f"{order.get('total_amount', 0):.0f}",
            },
        )
    except Exception: pass

    # Email: order delivered → admin recipients (non-blocking)
    try:
        from app.services.email_service import send_event_to_admins
        await send_event_to_admins("order_delivered_admin", order_id=str(order["_id"]), context={
            "order_number": order["order_number"],
            "customer_name": (customer.get("name") if customer else None) or "Customer",
            "total_amount": f"{order.get('total_amount', 0):.0f}",
            "payment_status": update.get("payment_status", order.get("payment_status", "pending")),
            "payment_method": order.get("payment_method", ""),
            "mode": "rider delivery",
        })
    except Exception: pass

    return {"message": "Delivery confirmed! Order complete.", "order_number": order["order_number"],
            "store_payout": store_payout, "rider_fee": RIDER_FEE}


# ── Earnings ─────────────────────────────────────────────────

@router.get("/earnings")
async def get_earnings(current_user: dict = Depends(get_current_user)):
    """Get rider's earnings summary."""
    await _require_rider(current_user)
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    # Today's earnings
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_trips = await db.trips.count_documents({
        "rider_id": current_user["user_id"], "status": "completed",
        "completed_at": {"$gte": today_start},
    })
    return {
        "total_earnings": user.get("total_earnings", 0.0),
        "total_trips": user.get("total_trips", 0),
        "today_trips": today_trips,
        "today_earnings": today_trips * RIDER_FEE,
        "per_trip_fee": RIDER_FEE,
    }
