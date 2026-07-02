from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# --- Auth Schemas ---
class SendOTPRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+91\d{10}$", description="Indian phone with +91 prefix")


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+91\d{10}$")
    code: str = Field(..., min_length=4, max_length=6)
    referral_code: Optional[str] = None  # Apply referral on signup


class PasswordLoginRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+91\d{10}$")
    password: str = Field(..., min_length=4, max_length=128)


class SetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=4, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None  # long-lived; used for persistent login
    token_type: str = "bearer"
    is_new_user: bool
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# --- User Schemas ---
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None  # base64 data URI or URL


class UserResponse(BaseModel):
    id: str
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None
    role: str = "customer"
    referral_code: Optional[str] = None
    wallet_balance: float = 0.0
    created_at: datetime


# --- Address Schemas ---
class AddressCreate(BaseModel):
    label: str = Field(..., description="e.g. Home, Work, Other")
    full_address: str
    landmark: Optional[str] = None
    latitude: float
    longitude: float
    city: str
    state: str = "Punjab"
    pincode: str
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: Optional[str] = None
    full_address: Optional[str] = None
    landmark: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    is_default: Optional[bool] = None


class AddressResponse(BaseModel):
    id: str
    user_id: str
    label: str
    full_address: str
    landmark: Optional[str] = None
    latitude: float
    longitude: float
    city: str
    state: str
    pincode: str
    is_default: bool
    created_at: datetime


# --- Service & Item Schemas ---
class ServiceItemResponse(BaseModel):
    id: str
    name: str
    price: float
    icon: Optional[str] = None
    category: str = "unisex"  # men | women | kids | unisex


class ServiceResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    icon: str
    pricing_unit: str = "piece"
    service_type: str = "pickup_drop"
    items: list[ServiceItemResponse] = []


# --- Cart / Basket Schemas ---
class CartItemAdd(BaseModel):
    service_id: str
    item_id: str
    quantity: int = Field(..., ge=1, le=50)


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=0, le=50)


class CartItemResponse(BaseModel):
    service_id: str
    service_name: str
    item_id: str
    item_name: str
    price: float
    quantity: int
    subtotal: float
    category: str = "unisex"
    unit: str = "piece"  # from the service's pricing_unit (e.g. "kg")


class CartResponse(BaseModel):
    items: list[CartItemResponse] = []
    total_items: int = 0
    total_amount: float = 0.0


# --- Order Schemas ---
class TimeSlot(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD")
    slot: str = Field(..., description="e.g. 09:00-11:00")


class RescheduleRequest(BaseModel):
    pickup_slot: Optional[TimeSlot] = None
    delivery_slot: Optional[TimeSlot] = None


class OrderCreate(BaseModel):
    address_id: str
    pickup_slot: TimeSlot
    delivery_slot: TimeSlot
    special_instructions: Optional[str] = None
    coupon_code: Optional[str] = None
    payment_method: str = "online"  # online | cod
    wallet_amount: float = 0.0  # Amount to pay from WB wallet
    store_id: Optional[str] = None  # Customer-selected store; falls back to auto-assign if omitted


class OrderItemResponse(BaseModel):
    service_name: str
    item_name: str
    price: float
    quantity: float  # fractional for weight-priced (kg) lines; whole for pieces
    subtotal: float
    category: str = "unisex"
    unit: str = "piece"  # "piece" | "kg" | "pair" | ...


class OrderResponse(BaseModel):
    id: str
    order_number: str
    user_id: str
    items: list[OrderItemResponse]
    address: dict
    pickup_slot: dict
    delivery_slot: dict
    special_instructions: Optional[str] = None
    payment_method: str = "online"
    status: str
    payment_status: str
    status_timeline: list[dict] = []
    garment_tags: list[dict] = []
    assigned_agent_id: Optional[str] = None
    agent_info: Optional[dict] = None
    subtotal: float
    delivery_fee: float
    discount: float
    wallet_applied: float = 0.0
    total_amount: float
    coupon_code: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    order_source: str = "app"
    fulfillment_mode: str = "rider_delivery"
    created_at: datetime
    updated_at: datetime


# --- Payment Schemas ---
class PaymentCreateRequest(BaseModel):
    order_id: str


class PaymentCreateResponse(BaseModel):
    razorpay_order_id: str
    razorpay_key_id: str
    amount: int  # in paise
    currency: str = "INR"
    order_id: str


class PaymentVerifyRequest(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
