# WashingBells — API Reference

Base URL: `/api/v1`

## Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/send-otp` | No | Send OTP to phone (dev bypass: 123456) |
| POST | `/auth/verify-otp` | No | Verify OTP, return JWT + user. Auto-creates user if new. Applies referral if `referral_code` provided |

## Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | JWT | Get current user profile |
| PUT | `/users/me` | JWT | Update name, email, avatar |

## Addresses
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/addresses` | JWT | List user's addresses |
| POST | `/addresses` | JWT | Create new address |
| PUT | `/addresses/{id}` | JWT | Update address |
| DELETE | `/addresses/{id}` | JWT | Delete address |

## Services
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/services` | No | List all services (with items, prices, pricing_unit, service_type) |
| GET | `/services/{slug}` | No | Get single service by slug |

## Stores
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stores` | No | List active stores |
| GET | `/stores/{id}` | No | Get store details (address, phone, whatsapp) |

## Cart
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/cart` | JWT | Get current cart |
| POST | `/cart/items` | JWT | Add item to cart |
| PUT | `/cart/items/{service_id}/{item_id}` | JWT | Update quantity |
| DELETE | `/cart` | JWT | Clear entire cart |

## Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | JWT | Create order from cart. Generates garment tags. Accepts `payment_method` (online/cod) |
| GET | `/orders` | JWT | List user's orders |
| GET | `/orders/{id}` | JWT | Get order detail (with timeline, tags, agent info) |
| PUT | `/orders/{id}/cancel` | JWT | Cancel order (if not yet picked up) |

## Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payments/create` | JWT | Create Razorpay order for payment |
| POST | `/payments/verify` | JWT | Verify Razorpay payment signature |

## Referrals
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/referrals/me` | JWT | Get user's referral code + stats (total referred, earned) |
| POST | `/referrals/apply` | JWT | Apply a referral code (creates coupons for both parties) |

## Coupons
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/coupons/me` | JWT | List user's available coupons |
| POST | `/coupons/validate` | JWT | Validate coupon code against current cart |

## Wallet
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/wallet` | JWT | Get wallet balance + recent transactions |
| POST | `/wallet/topup` | JWT | Initiate wallet top-up (returns Razorpay order) |
| POST | `/wallet/topup/verify` | JWT | Verify top-up payment and credit wallet |

## Promo Banners
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/banners` | No | List active promo banners (ordered by position) |

## Testimonials
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/testimonials` | No | List active testimonials |
