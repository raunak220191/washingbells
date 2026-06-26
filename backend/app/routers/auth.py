from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, verify_password, hash_password
from app.schemas.schemas import (
    SendOTPRequest, VerifyOTPRequest, AuthResponse,
    PasswordLoginRequest, SetPasswordRequest,
)
from app.schemas.phase2_schemas import RiderRegisterRequest, StoreRegisterRequest
from app.services.twilio_service import send_otp, verify_otp
from app.services.email_service import send_event as send_email_event
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-otp")
async def send_otp_endpoint(request: SendOTPRequest):
    """Send OTP to phone number for login/signup."""
    success = await send_otp(request.phone)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send OTP.")
    return {"message": "OTP sent successfully", "phone": request.phone}


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp_endpoint(request: VerifyOTPRequest):
    """Verify OTP and return JWT token. Creates user if new."""
    is_valid = await verify_otp(request.phone, request.code)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP.")

    db = get_db()
    is_new_user = False
    user = await db.users.find_one({"phone": request.phone})
    if not user:
        is_new_user = True
        user_doc = {
            "phone": request.phone, "name": None, "email": None,
            "role": "customer",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(user_doc)
        user = await db.users.find_one({"_id": result.inserted_id})

    token = create_access_token(data={
        "user_id": str(user["_id"]), "phone": user["phone"],
        "role": user.get("role", "customer"),
    })

    return AuthResponse(
        access_token=token, is_new_user=is_new_user,
        user={"id": str(user["_id"]), "phone": user["phone"],
              "name": user.get("name"), "email": user.get("email"),
              "role": user.get("role", "customer")},
    )


@router.post("/login-password", response_model=AuthResponse)
async def login_password_endpoint(request: PasswordLoginRequest):
    """Log in with phone + password. Used while OTP delivery is unavailable.

    Only works for existing users that have a password set (e.g. seeded
    accounts or users who set one via /auth/set-password). Does NOT create
    new users — sign-up still goes through OTP.
    """
    db = get_db()
    user = await db.users.find_one({"phone": request.phone})
    if not user or not verify_password(request.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password.",
        )

    token = create_access_token(data={
        "user_id": str(user["_id"]), "phone": user["phone"],
        "role": user.get("role", "customer"),
    })
    return AuthResponse(
        access_token=token, is_new_user=False,
        user={"id": str(user["_id"]), "phone": user["phone"],
              "name": user.get("name"), "email": user.get("email"),
              "role": user.get("role", "customer")},
    )


@router.post("/set-password")
async def set_password_endpoint(body: SetPasswordRequest, current_user: dict = Depends(get_current_user)):
    """Set or change the password for the currently authenticated user."""
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {"password_hash": hash_password(body.password),
                  "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Password updated successfully."}


@router.post("/register-rider")
async def register_rider(body: RiderRegisterRequest, current_user: dict = Depends(get_current_user)):
    """Register current user as a delivery rider."""
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "rider":
        raise HTTPException(status_code=400, detail="Already registered as rider")
    now = datetime.now(timezone.utc)
    has_dl = bool(body.dl_image)
    has_aadhaar = bool(body.id_proof_image)
    has_selfie = bool(body.selfie_image)
    documents_uploaded = has_dl and has_aadhaar and has_selfie
    update_fields = {
        "name": body.name, "role": "rider",
        "vehicle_type": body.vehicle_type, "vehicle_number": body.vehicle_number,
        "dl_image": body.dl_image,
        "aadhaar_image": body.id_proof_image,
        "id_proof_image": body.id_proof_image,  # legacy field
        "selfie_image": body.selfie_image,
        "documents_uploaded": documents_uploaded,
        "rider_status": "offline", "rider_approved": False,
        "current_location": None, "total_trips": 0, "total_earnings": 0.0,
        "updated_at": now,
    }
    if body.email:
        update_fields["email"] = body.email.strip().lower()
    await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
    token = create_access_token(data={"user_id": str(user["_id"]), "phone": user["phone"], "role": "rider"})
    return {"message": "Rider registration submitted. Awaiting admin approval.", "access_token": token, "rider_approved": False}


@router.post("/register-store")
async def register_store(body: StoreRegisterRequest, current_user: dict = Depends(get_current_user)):
    """Register current user as a store owner and create the store."""
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "store_owner":
        raise HTTPException(status_code=400, detail="Already registered as store owner")
    now = datetime.now(timezone.utc)
    count = await db.stores.count_documents({})
    vendor_code = f"WB{count + 1:03d}"
    store_doc = {
        "vendor_code": vendor_code, "name": body.store_name,
        "owner_user_id": current_user["user_id"],
        "address": body.address, "city": body.city, "state": body.state,
        "pincode": body.pincode, "phone": body.phone, "whatsapp": body.phone,
        "latitude": body.latitude, "longitude": body.longitude,
        "geo_radius_km": 15, "status": "pending_approval",
        "is_open": False, "opening_time": body.opening_time,
        "closing_time": body.closing_time,
        "total_earnings": 0.0, "pending_payout": 0.0, "approved": False,
        "profile_complete": True,  # Self-registration collects all required fields
        "created_at": now,
    }
    result = await db.stores.insert_one(store_doc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "role": "store_owner", "store_id": str(result.inserted_id), "updated_at": now,
    }})
    token = create_access_token(data={"user_id": str(user["_id"]), "phone": user["phone"], "role": "store_owner"})

    # Email admin that a new store is awaiting approval (non-blocking)
    try:
        admin_addr = get_settings().EMAIL_ADMIN_ADDRESS
        await send_email_event(
            "new_store_pending_admin",
            to_email=admin_addr,
            audience="admin",
            context={
                "store_name": body.store_name,
                "vendor_code": vendor_code,
                "city": body.city,
                "owner_name": user.get("name") or "Owner",
                "owner_phone": user.get("phone") or "",
            },
        )
    except Exception: pass

    return {"message": "Store registration submitted. Awaiting admin approval.",
            "access_token": token, "store_id": str(result.inserted_id),
            "vendor_code": vendor_code, "approved": False}
