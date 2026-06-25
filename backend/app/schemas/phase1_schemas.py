"""Phase 1 — New Pydantic schemas for stores, coupons, referrals, wallet, banners, testimonials."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# --- Store ---
class StoreResponse(BaseModel):
    id: str
    vendor_code: str
    name: str
    address: str
    city: str
    phone: str
    whatsapp: str
    latitude: float
    longitude: float
    status: str = "active"


class NearbyStoreResponse(StoreResponse):
    distance_km: float
    is_open: bool = False


# --- Coupon ---
class CouponValidateRequest(BaseModel):
    code: str
    cart_total: float


class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_amount: float = 0.0
    message: str = ""


class CouponResponse(BaseModel):
    id: str
    code: str
    name: str
    type: str
    value: float
    min_order: float
    max_discount: float
    valid_to: datetime
    is_referral: bool = False


# --- Referral ---
class ReferralApplyRequest(BaseModel):
    code: str


class ReferralStatsResponse(BaseModel):
    referral_code: str
    total_referred: int = 0
    total_earned: float = 0.0
    referral_url: str = ""


# --- Wallet ---
class WalletTopupRequest(BaseModel):
    amount: float = Field(..., gt=0, le=10000)


class WalletTransactionResponse(BaseModel):
    id: str
    type: str
    amount: float
    reason: str
    description: str
    created_at: datetime


class WalletResponse(BaseModel):
    balance: float
    transactions: list[WalletTransactionResponse] = []


# --- Promo Banner ---
class BannerResponse(BaseModel):
    id: str
    title: str
    image_url: str
    link_type: str = "none"
    link_target: Optional[str] = None
    position: int = 0


# --- Testimonial ---
class TestimonialResponse(BaseModel):
    id: str
    customer_name: str
    text: str
    rating: int
    avatar_url: Optional[str] = None
    city: Optional[str] = None


# --- Garment Tag ---
class GarmentTagResponse(BaseModel):
    tag_code: str
    item_name: str
    service_name: str
    status: str = "tagged"


# --- Status Timeline ---
class StatusTimelineEntry(BaseModel):
    status: str
    timestamp: datetime
    note: Optional[str] = None
    agent_id: Optional[str] = None


# --- Agent Info ---
class AgentInfoResponse(BaseModel):
    id: str
    name: str
    phone: str
    avatar_url: Optional[str] = None
