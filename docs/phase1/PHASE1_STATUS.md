# Phase 1 — Customer App MVP — COMPLETION STATUS

**Last Updated:** 14 May 2026

## Backend (14 routers, 2 schema files)

| Router | Lines | Status |
|--------|-------|--------|
| auth.py | 69 | ✅ OTP login with Twilio dev bypass |
| users.py | 56 | ✅ GET/PUT /users/me with role, referral_code, wallet_balance |
| addresses.py | 110 | ✅ Full CRUD with default logic |
| services.py | 172 | ✅ 7 services: Dry Clean, Wash & Steam Iron, Wash & Fold, Shoe Cleaning, Steam Iron, **Premium Laundry (KG)**, **Sofa Cleaning (at-home)** |
| cart.py | 188 | ✅ Add/update/remove/clear |
| orders.py | 138 | ✅ Create with **garment tags**, **COD/online**, **coupon discount**, **wallet debit**, **status_timeline**, cancel with wallet refund |
| payments.py | 110 | ✅ Razorpay create/verify with dev bypass |
| banners.py | 84 | ✅ Admin-managed promo carousel (auto-seeds 4 banners) |
| testimonials.py | 46 | ✅ Customer reviews (auto-seeds 5) |
| stores.py | 69 | ✅ Store locations with vendor codes (auto-seeds WB001) |
| referrals.py | 145 | ✅ Generate code, apply → 10% coupon for referred, 20% for referrer |
| coupons.py | 128 | ✅ Validate codes, list user's coupons, percent/flat discount |
| wallet.py | 163 | ✅ Balance, top-up via Razorpay, transactions, credit/debit helpers |

### Schemas
| File | Lines | New Fields |
|------|-------|------------|
| schemas.py | 195 | VerifyOTP +referral_code, User +role/referral_code/wallet_balance, Service +pricing_unit/service_type, Order +payment_method/wallet_amount/status_timeline/garment_tags/agent_info |
| phase1_schemas.py | 119 | Store, Coupon, Referral, Wallet, Banner, Testimonial, GarmentTag, StatusTimeline, AgentInfo |

---

## Frontend — Stores (8 total)

| Store | Lines | Status |
|-------|-------|--------|
| authStore.js | 75 | ✅ Login/logout/initialize |
| addressStore.js | 82 | ✅ CRUD + selectedAddress |
| cartStore.js | 82 | ✅ Add/update/remove/clear |
| orderStore.js | 70 | ✅ Create/list/get/cancel |
| **walletStore.js** | 40 | ✅ NEW — Balance, top-up, verify |
| **referralStore.js** | 36 | ✅ NEW — Fetch stats, apply code |
| **couponStore.js** | 33 | ✅ NEW — Validate, list my coupons |
| **bannerStore.js** | 36 | ✅ NEW — Fetch banners, testimonials, stores |

---

## Frontend — Components (9 total)

| Component | Lines | Status |
|-----------|-------|--------|
| HomeHeader.js | 72 | ✅ Logo header |
| LocationBar.js | 97 | ✅ Address display + GPS |
| **PromoBanner.js** | 88 | ✅ UPDATED — Dynamic API banners + fallback cards |
| ServiceGrid.js | 101 | ✅ Service icons grid |
| **ReferEarn.js** | 124 | ✅ NEW — Banner + modal with share, copy code, stats |
| **Testimonials.js** | 63 | ✅ NEW — Horizontal scroll from API |
| Button.js | 64 | ✅ Primary/secondary/outline |
| QuantityStepper.js | 56 | ✅ +/- quantity |
| LoadingScreen.js | 20 | ✅ Loading spinner |

---

## Frontend — Screens (19 total)

| Screen | Lines | Status |
|--------|-------|--------|
| login.js | 201 | ✅ Phone input |
| otp-verify.js | 231 | ✅ OTP with dev bypass |
| onboarding.js | 135 | ✅ Name setup |
| **home/index.js** | 81 | ✅ UPDATED — Dynamic banners, ReferEarn, Testimonials from API |
| home/address.js | 1388 | ✅ Enterprise-grade address manager |
| home/service/[slug].js | 257 | ✅ Item picker with qty |
| basket/index.js | 287 | ✅ Cart list |
| **basket/checkout.js** | 317 | ✅ UPDATED — COD toggle, coupon input, instructions, dual scheduling |
| orders/index.js | 206 | ✅ Order list |
| **orders/[id].js** | 265 | ✅ REWRITTEN — Lifecycle timeline (green/gray), garment tags, agent info, COD pay-now, billing breakdown |
| **profile/index.js** | 117 | ✅ UPDATED — Wallet card, wired menu items |
| **profile/wallet.js** | 133 | ✅ NEW — Balance, quick top-up, transaction history |
| **profile/help.js** | 93 | ✅ NEW — WhatsApp/Call/Email + FAQ |

---

## What's Still Needed (Phase 2+)

| Feature | Priority | Notes |
|---------|----------|-------|
| Real Razorpay SDK | High | Currently dev mock — needs `react-native-razorpay` |
| Google Maps Places | High | Address picker with autocomplete |
| KG weight input UI | Medium | Premium Laundry service needs weight instead of qty |
| Store info on product listing | Medium | WhatsApp/Call icons per store |
| Push notifications | Medium | Order status updates via `expo-notifications` |
| WhatsApp/Email order confirmation | Medium | Twilio integration for post-order |
| Real-time tracking | Low | WebSocket for live delivery |
| Delivery Partner App | Phase 2 | Separate Expo app |
| Store Dashboard | Phase 3 | Next.js web app |
| Admin Portal | Phase 4 | Next.js web app |
