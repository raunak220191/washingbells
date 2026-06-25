"""Phase 2 — Schemas for Delivery, Store Operations, Admin, and Upload."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── Rider Registration ──────────────────────────────────────
class RiderRegisterRequest(BaseModel):
    name: str
    vehicle_type: str = Field(..., description="bike | auto | van")
    vehicle_number: str
    email: Optional[str] = None  # optional, captured for important updates
    # Documents may be uploaded later via /delivery/upload-documents
    dl_image: Optional[str] = None  # base64
    id_proof_image: Optional[str] = None  # base64 — Aadhaar
    selfie_image: Optional[str] = None  # base64 — selfie with ID for KYC


class RiderDocumentsUpload(BaseModel):
    """Submit one or more KYC documents. Each is base64 image data."""
    dl_image: Optional[str] = None
    aadhaar_image: Optional[str] = None
    selfie_image: Optional[str] = None


class RiderProfileResponse(BaseModel):
    id: str
    phone: str
    name: str
    role: str = "rider"
    vehicle_type: str
    vehicle_number: str
    rider_status: str = "offline"  # offline | online | on_trip
    rider_approved: bool = False
    total_trips: int = 0
    total_earnings: float = 0.0
    created_at: datetime


class RiderLocationUpdate(BaseModel):
    latitude: float
    longitude: float


class RiderStatusUpdate(BaseModel):
    status: str = Field(..., description="online | offline")


# ── Store Registration ──────────────────────────────────────
class StoreRegisterRequest(BaseModel):
    store_name: str
    address: str
    city: str
    state: str = "Punjab"
    pincode: str
    phone: str
    latitude: float
    longitude: float
    opening_time: str = "09:00"
    closing_time: str = "21:00"


class StoreProfileResponse(BaseModel):
    id: str
    vendor_code: str
    name: str
    address: str
    city: str
    phone: str
    latitude: float
    longitude: float
    status: str = "active"
    is_open: bool = True
    opening_time: str = "09:00"
    closing_time: str = "21:00"
    total_earnings: float = 0.0
    pending_payout: float = 0.0
    approved: bool = False
    owner_user_id: str
    created_at: datetime


class StoreToggleRequest(BaseModel):
    is_open: bool


class RejectOrderRequest(BaseModel):
    reason: Optional[str] = None


class BookRiderRequest(BaseModel):
    rider_id: Optional[str] = None  # explicit pick; None = auto-assign


class StoreDeliveryTimeRequest(BaseModel):
    expected_delivery_at: str = Field(..., description="ISO datetime string")


# ── Trips ────────────────────────────────────────────────────
class TripResponse(BaseModel):
    id: str
    rider_id: str
    order_id: str
    order_number: str
    trip_type: str  # pickup | delivery
    status: str  # assigned | accepted | started | completed | cancelled
    pickup_address: str
    drop_address: str
    fee: float = 40.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    created_at: datetime


# ── OTP ──────────────────────────────────────────────────────
class OTPVerifyRequest(BaseModel):
    otp: str = Field(..., min_length=4, max_length=4)


# ── Photo Upload ─────────────────────────────────────────────
class PhotoUploadRequest(BaseModel):
    photos: list[str] = Field(..., description="List of base64 image strings", min_length=1, max_length=10)


# ── Admin ────────────────────────────────────────────────────
class AdminDashboardResponse(BaseModel):
    total_orders: int = 0
    orders_today: int = 0
    active_orders: int = 0
    total_revenue: float = 0.0
    revenue_today: float = 0.0
    platform_earnings: float = 0.0
    total_customers: int = 0
    total_riders: int = 0
    total_stores: int = 0
    riders_online: int = 0
    stores_open: int = 0


class AdminOrderOverride(BaseModel):
    status: str
    note: Optional[str] = None


class AdminAssignStoreRequest(BaseModel):
    store_id: str


class AdminAssignRiderRequest(BaseModel):
    rider_id: str
    trip_type: str = Field(..., description="pickup | delivery")


class ApprovalRequest(BaseModel):
    approved: bool


# ── Upload ───────────────────────────────────────────────────
class UploadResponse(BaseModel):
    url: str
    filename: str
    size: int


# ── Order (Phase 2 extended fields for responses) ───────────
class OrderPhase2Response(BaseModel):
    """Extra fields returned for Phase 2 orders."""
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    pickup_rider_id: Optional[str] = None
    pickup_rider_name: Optional[str] = None
    pickup_otp: Optional[str] = None
    pickup_otp_verified: bool = False
    pickup_proof_photos: list[str] = []
    pickup_completed_at: Optional[datetime] = None
    store_received_at: Optional[datetime] = None
    store_received_otp: Optional[str] = None
    store_received_otp_verified: bool = False
    processing_started_at: Optional[datetime] = None
    expected_delivery_at: Optional[datetime] = None
    ready_at: Optional[datetime] = None
    delivery_rider_id: Optional[str] = None
    delivery_rider_name: Optional[str] = None
    delivery_otp: Optional[str] = None
    delivery_otp_verified: bool = False
    delivery_proof_photos: list[str] = []
    delivered_at: Optional[datetime] = None
    store_payout: float = 0.0
    platform_fee: float = 0.0
    rider_pickup_fee: float = 0.0
    rider_delivery_fee: float = 0.0
    customer_rating: Optional[int] = None
    customer_review: Optional[str] = None


# ── Rating ───────────────────────────────────────────────────
class RatingRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    review: Optional[str] = None
