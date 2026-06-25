# Phase 1 — Complete Customer App MVP

## Goal
Fully functional customer app: login → browse → cart → checkout → pay → track order

## Task List

### 1.1 Backend — Data Model Upgrades
- [ ] **Users collection** — add: `role` (customer|delivery|store|admin), `referral_code`, `referred_by`, `wallet_balance`, `created_at`
- [ ] **Stores collection** — new: `vendor_code`, `name`, `address`, `phone`, `whatsapp`, `geo_zone`, `status` (active/disabled)
- [ ] **Services collection** — add: `pricing_unit` (piece|kg), `service_type` (pickup_drop|at_home), `store_id`
- [ ] **Orders collection** — add: `payment_method` (online|cod), `garment_tags[]`, `assigned_agent_id`, `status_timeline[]`, `pickup_proof_images[]`, `delivery_proof_images[]`
- [ ] **Coupons collection** — new: `code`, `type` (percent|flat), `value`, `min_order`, `max_discount`, `valid_from`, `valid_to`, `store_ids[]`, `usage_limit`, `used_count`
- [ ] **Referrals collection** — new: `referrer_id`, `referred_id`, `referrer_coupon_id`, `referred_coupon_id`, `status`
- [ ] **Wallets collection** — new: `user_id`, `balance`, `transactions[]` (credit/debit with reason)
- [ ] **Promo Banners collection** — new: `title`, `image_url`, `link_type`, `link_target`, `position`, `active`, `valid_from`, `valid_to`
- [ ] **Testimonials collection** — new: `customer_name`, `text`, `rating`, `avatar_url`, `active`
- [ ] **Garment Tags collection** — new: `order_id`, `tag_code` (e.g., WB-ORD123-001), `item_name`, `service_name`, `status`

### 1.2 Backend — New API Routers
- [ ] `POST /api/v1/referrals/generate` — generate unique referral code for user
- [ ] `POST /api/v1/referrals/apply` — apply referral code on signup (creates coupons for both)
- [ ] `GET /api/v1/referrals/me` — get user's referral stats
- [ ] `POST /api/v1/coupons/validate` — validate coupon code at checkout
- [ ] `GET /api/v1/coupons/me` — list user's available coupons
- [ ] `GET /api/v1/wallet` — get wallet balance + recent transactions
- [ ] `POST /api/v1/wallet/topup` — add money to wallet (Razorpay)
- [ ] `GET /api/v1/banners` — list active promo banners
- [ ] `GET /api/v1/testimonials` — list active testimonials
- [ ] `GET /api/v1/stores/{id}` — get store info (address, whatsapp, phone)

### 1.3 Backend — Order Flow Upgrades
- [ ] Add `payment_method` to OrderCreate schema (online|cod)
- [ ] Generate unique garment tag codes on order creation (WB-{order_number}-001, 002, etc.)
- [ ] Add `status_timeline` array — each entry: `{status, timestamp, note}`
- [ ] Add COD flow: order created with `payment_status: "cod_pending"`, "Pay Now" triggers Razorpay later
- [ ] Add order confirmation notifications (Twilio WhatsApp + Email)

### 1.4 Frontend — Home Screen Enhancements
- [ ] Promo banner carousel → fetch from `/api/v1/banners` (admin-managed)
- [ ] "Refer & Earn" banner → tap opens modal with referral URL + share buttons
- [ ] Testimonials horizontal scroll section
- [ ] Update services grid to handle new service types (Premium Laundry KG, Sofa Cleaning at-home)

### 1.5 Frontend — Service Listing Upgrades
- [ ] Show store address + WhatsApp/Call icons at top of product listing
- [ ] Handle KG-based pricing for Premium Laundry (weight input instead of quantity)
- [ ] Flag "At-Home Service" for Sofa Cleaning orders

### 1.6 Frontend — Checkout Upgrades
- [ ] Dual date/time pickers (Pickup Schedule + Delivery Schedule)
- [ ] Order instructions text input
- [ ] Payment method toggle: "Pay Now" (Razorpay) vs "Cash on Delivery"
- [ ] Coupon code input + validate button
- [ ] Show garment tag codes in order confirmation

### 1.7 Frontend — Order Tracking Upgrades
- [ ] Full lifecycle timeline UI: Placed → Pickup → In Progress → Packed → Delivered
- [ ] Green (completed) / Active (current) / Gray (future) node styling
- [ ] Show assigned delivery agent info (photo, name, timing)
- [ ] "Pay Now" button visible on COD orders until fulfilled

### 1.8 Frontend — Profile & Wallet
- [ ] WB Wallet screen (balance, top-up, transaction history)
- [ ] Refer & Earn screen (rules, URL, share buttons, referral stats)
- [ ] My Addresses (already built)
- [ ] Payment Methods screen
- [ ] Help & Support screen (Call + WhatsApp buttons)
- [ ] Terms & Conditions screen

### 1.9 Frontend — Navigation Update
- [ ] Bottom tabs: Home | Basket | Orders | Help (replace Profile tab)
- [ ] Profile accessible from Home header avatar icon

## Execution Order

Start backend-first to establish the data contracts, then wire frontend:

```
1.1 Data Models  →  1.2 API Routers  →  1.3 Order Upgrades
        ↓                   ↓                    ↓
      1.4 Home        1.5 Services         1.6 Checkout
        ↓                   ↓                    ↓
                    1.7 Order Tracking
                           ↓
                  1.8 Profile & Wallet
                           ↓
                     1.9 Navigation
```

## Definition of Done
- All endpoints tested via curl
- All screens render on Expo Go (iPhone)
- Login → Browse → Add to Cart → Checkout → Pay/COD → View Order lifecycle works end-to-end
