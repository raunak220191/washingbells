# Phase 2 — Master Plan: 3 Apps + Backend Upgrades

**Created:** 15 May 2026  
**Status:** PLANNING  
**Approach:** Same as Phase 1 — Backend first, then each app one at a time

---

## 📋 The Big Picture

### 4 Apps, 1 Backend

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED FASTAPI BACKEND                    │
│                   (MongoDB + Same JWT Auth)                  │
│                                                              │
│  /api/v1/auth/*      — Shared login (role-based)            │
│  /api/v1/orders/*    — Shared order model                   │
│  /api/v1/delivery/*  — Rider-specific endpoints             │
│  /api/v1/store/*     — Store owner endpoints                │
│  /api/v1/admin/*     — Super admin endpoints                │
│  /api/v1/upload/*    — Shared image upload                  │
│  /api/v1/notify/*    — Shared notifications                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┬───────────────┐
       ▼               ▼               ▼               ▼
  ┌─────────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐
  │CUSTOMER │   │  RIDER    │   │  STORE    │   │  ADMIN   │
  │  APP    │   │  APP      │   │  OWNER    │   │  PANEL   │
  │(Existing)│   │ /rider/   │   │ /store/   │   │ /admin/  │
  │ Expo Go │   │ Expo Go   │   │ Expo Go   │   │ Web App  │
  └─────────┘   └───────────┘   └───────────┘   └──────────┘
```

---

## 🔄 Complete Order Lifecycle

```
CUSTOMER places order
        │
        ▼
┌─ 1. ORDER PLACED ──────────────────────────────────────────┐
│   Status: "placed"                                          │
│   → Notification to ADMIN + nearest STORE                  │
│   → Store auto-assigned based on customer geo              │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 2. STORE ACCEPTS ORDER ───────────────────────────────────┐
│   Status: "confirmed"                                       │
│   → STORE OWNER sees order in dashboard                    │
│   → Store books a RIDER for pickup                         │
│   → Notification to CUSTOMER: "Order confirmed"            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 3. RIDER ASSIGNED FOR PICKUP ─────────────────────────────┐
│   Status: "rider_assigned_pickup"                           │
│   → RIDER sees pickup task in worklist                     │
│   → RIDER accepts → gets customer address + navigation     │
│   → Notification to CUSTOMER: "Rider on the way"           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 4. RIDER PICKS UP FROM CUSTOMER ──────────────────────────┐
│   Status: "picked_up"                                       │
│   → RIDER arrives at customer location                     │
│   → RIDER uploads photos of clothes                        │
│   → System sends OTP to CUSTOMER                           │
│   → CUSTOMER gives OTP to RIDER                            │
│   → RIDER enters OTP → verified → pickup confirmed         │
│   → Notification to STORE: "Clothes picked up, incoming"   │
│   → Notification to CUSTOMER: "Clothes picked up"          │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 5. RIDER DROPS AT STORE ──────────────────────────────────┐
│   Status: "at_store"                                        │
│   → RIDER delivers clothes to store                        │
│   → STORE OWNER receives clothes, verifies against photos  │
│   → System sends OTP to RIDER (store-drop OTP)             │
│   → STORE OWNER enters OTP → verified → received           │
│   → Notification to CUSTOMER: "Clothes received at store"  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 6. STORE PROCESSES ORDER ─────────────────────────────────┐
│   Status: "processing"                                      │
│   → STORE OWNER processes (wash/clean/iron)                │
│   → STORE OWNER sets expected delivery time (within 4 hrs) │
│   → Notification to CUSTOMER: "Your clothes are being      │
│     processed, expected by [time]"                         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 7. STORE READY, BOOKS RIDER FOR DELIVERY ─────────────────┐
│   Status: "ready_for_delivery"                              │
│   → STORE OWNER marks order as ready                       │
│   → STORE OWNER books a RIDER for delivery                 │
│   → RIDER assigned → sees delivery task in worklist        │
│   → Notification to CUSTOMER: "Clothes ready, rider coming"│
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 8. RIDER PICKS UP FROM STORE ─────────────────────────────┐
│   Status: "out_for_delivery"                                │
│   → RIDER picks up from store                              │
│   → Notification to CUSTOMER: "Out for delivery"           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 9. RIDER DELIVERS TO CUSTOMER ────────────────────────────┐
│   Status: "delivered"                                       │
│   → RIDER arrives at customer address                      │
│   → System sends OTP to CUSTOMER                           │
│   → CUSTOMER gives OTP to RIDER                            │
│   → RIDER enters OTP → verified → delivery confirmed       │
│   → STORE OWNER balance updated: +(order_total × 80%)     │
│   → RIDER earnings updated: +delivery_fee                  │
│   → Notification to ALL: "Order delivered ✅"              │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 10. POST-DELIVERY ────────────────────────────────────────┐
│   → CUSTOMER can rate RIDER + STORE                        │
│   → ADMIN sees completed order in dashboard                │
│   → Store balance: total_amount - 20% platform fee         │
│   → Rider balance: per-trip fee                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Build Order (Sequential, like Phase 1)

### Step 1: Backend APIs (Week 1)
Build all new APIs. Test via Swagger.

| Router | Endpoints | Description |
|--------|-----------|-------------|
| **Update `auth.py`** | register-partner, register-store | Add role field (customer/rider/store_owner/admin) |
| **`delivery.py`** (~250 lines) | worklist, accept, pickup-photos, verify-pickup-otp, drop-at-store, start-delivery, verify-delivery-otp | Full rider lifecycle |
| **`store_ops.py`** (~200 lines) | incoming-orders, accept-order, receive-clothes, update-processing, mark-ready, book-rider, toggle-store, earnings | Full store owner lifecycle |
| **`admin.py`** (~200 lines) | all-orders, all-users, all-stores, all-riders, assign-store, approve-rider, approve-store, dashboard-stats, override-status | Full admin control |
| **`upload.py`** (~60 lines) | upload-image | Base64 → MongoDB GridFS or direct field storage |
| **Update `orders.py`** | Add store_id, rider_id, pickup_otp, delivery_otp, proof_photos fields | Enhanced order model |
| **New `phase2_schemas.py`** | All new request/response models | Rider, Store, Admin schemas |

### Step 2: Rider App (Week 2)
**Folder:** `/rider/` — Separate Expo SDK 54 project

| Screen | Tab | Description |
|--------|-----|-------------|
| Login | - | Phone + OTP (role=rider) |
| Registration | - | Name, photo, DL upload, vehicle details |
| **Dashboard** | Home | Today's stats: trips, earnings, active task |
| **Worklist** | Tasks | Assigned orders list, accept/reject |
| **Active Task** | Tasks | Current task: address, navigation, photo upload, OTP entry |
| **Earnings** | Earnings | Daily/weekly breakdown, withdraw |
| **Profile** | Profile | Info, documents, vehicle, toggle online/offline |

**Tabs:** `Home | Tasks | Earnings | Profile`

### Step 3: Store Owner App (Week 3)
**Folder:** `/store/` — Separate Expo SDK 54 project

| Screen | Tab | Description |
|--------|-----|-------------|
| Login | - | Phone + OTP (role=store_owner) |
| Store Setup | - | Store name, address, timings, photos |
| **Dashboard** | Home | Today's orders, revenue, store status toggle |
| **Orders** | Orders | Incoming/processing/ready/completed tabs |
| **Order Detail** | Orders | Photos received, process actions, book rider |
| **Earnings** | Earnings | Daily/weekly revenue, 80% share breakdown |
| **Settings** | Settings | Store hours, toggle open/closed, staff mgmt |

**Tabs:** `Home | Orders | Earnings | Settings`

### Step 4: Admin Web Panel (Week 4)
**Folder:** `/admin/` — Next.js or React web app (not mobile)

| Page | Description |
|------|-------------|
| Login | Admin credentials |
| **Dashboard** | Live stats: orders today, revenue, active riders, active stores |
| **Orders** | All orders, filter by status/store/rider, override status |
| **Stores** | All stores, approve new, view earnings, toggle active |
| **Riders** | All riders, approve new, view trips, toggle active |
| **Customers** | All customers, order history, wallet balance |
| **Financials** | Platform revenue (20% cuts), payouts, settlements |
| **Settings** | Rate list editor (YAML), banner manager, coupon manager |

---

## 🗄️ Database Schema Updates

### Users Collection (Updated)
```json
{
  "_id": ObjectId,
  "phone": "+919876543210",
  "name": "Raunak",
  "email": "raunak@test.com",
  "profile_image": "base64...",
  "role": "customer | rider | store_owner | admin",
  "referral_code": "WB-RAUNAK-X3K",
  "wallet_balance": 500.0,
  
  // Rider-specific
  "rider_status": "offline | online | on_trip",
  "vehicle_type": "bike | auto | van",
  "vehicle_number": "PB10AB1234",
  "dl_image": "base64...",
  "id_proof_image": "base64...",
  "rider_approved": false,
  "current_location": { "lat": 30.90, "lng": 75.85 },
  
  // Store-owner specific
  "store_id": "ObjectId ref",
  
  "created_at": "2026-05-15T...",
  "updated_at": "2026-05-15T..."
}
```

### Orders Collection (Updated)
```json
{
  "_id": ObjectId,
  "order_number": "WB-2026-A3K7",
  "user_id": "customer_id",
  "store_id": "assigned_store_id",
  
  // Pickup leg
  "pickup_rider_id": "rider_id",
  "pickup_otp": "4567",
  "pickup_otp_verified": false,
  "pickup_proof_photos": ["base64...", "base64..."],
  "pickup_completed_at": "2026-05-15T...",
  
  // Store processing
  "store_received_at": "2026-05-15T...",
  "store_received_otp": "7890",
  "store_received_otp_verified": false,
  "processing_started_at": "2026-05-15T...",
  "expected_delivery_at": "2026-05-15T16:00:00",
  "ready_at": "2026-05-15T...",
  
  // Delivery leg
  "delivery_rider_id": "rider_id",
  "delivery_otp": "1234",
  "delivery_otp_verified": false,
  "delivery_proof_photos": ["base64..."],
  "delivered_at": "2026-05-15T...",
  
  // Financials
  "store_payout": 672.0,       // 80% of total
  "platform_fee": 168.0,       // 20% of total
  "rider_pickup_fee": 40.0,
  "rider_delivery_fee": 40.0,
  
  // Rating
  "customer_rating": 5,
  "customer_review": "Great service!",
  
  // ... existing fields (items, address, status, etc.)
}
```

### Stores Collection (Updated)
```json
{
  "_id": ObjectId,
  "vendor_code": "WB001",
  "name": "WashingBells Ludhiana Central",
  "owner_user_id": "user_id",
  "address": "Shop 12, Model Town",
  "city": "Ludhiana",
  "latitude": 30.9010,
  "longitude": 75.8573,
  "geo_radius_km": 15,
  "status": "active | inactive | pending_approval",
  "is_open": true,
  "opening_time": "09:00",
  "closing_time": "21:00",
  "total_earnings": 15000.0,
  "pending_payout": 5000.0,
  "approved": true,
  "created_at": "2026-05-15T..."
}
```

### New: Rider Trips Collection
```json
{
  "_id": ObjectId,
  "rider_id": "user_id",
  "order_id": "order_id",
  "trip_type": "pickup | delivery",
  "status": "assigned | accepted | started | completed | cancelled",
  "pickup_location": { "lat": 30.90, "lng": 75.85, "address": "..." },
  "drop_location": { "lat": 30.91, "lng": 75.86, "address": "..." },
  "fee": 40.0,
  "distance_km": 3.2,
  "started_at": "2026-05-15T...",
  "completed_at": "2026-05-15T...",
  "created_at": "2026-05-15T..."
}
```

---

## 🔑 OTP Flow Detail

### Pickup OTP (Customer → Rider)
1. Rider arrives at customer → taps "Arrived"
2. Backend generates 4-digit OTP, stores in order.pickup_otp
3. Customer receives OTP via SMS/push: "Your pickup OTP is 4567"
4. Customer tells rider the OTP
5. Rider enters OTP in app → backend verifies → pickup confirmed

### Store Drop OTP (Rider → Store)
1. Rider arrives at store with clothes
2. Backend generates 4-digit OTP, stores in order.store_received_otp
3. Rider sees OTP in their app
4. Store owner enters the OTP → backend verifies → store received

### Delivery OTP (Customer → Rider)
1. Rider arrives at customer with clean clothes → taps "Arrived"
2. Backend generates 4-digit OTP, stores in order.delivery_otp
3. Customer receives OTP via SMS/push: "Your delivery OTP is 1234"
4. Customer tells rider the OTP
5. Rider enters OTP → backend verifies → delivery confirmed → order complete

---

## 💰 Financial Model

| Event | Store Owner | Platform (WashingBells) | Rider |
|-------|-------------|------------------------|-------|
| Order Total ₹840 | +₹672 (80%) | +₹168 (20%) | - |
| Pickup Trip | - | - | +₹40 |
| Delivery Trip | - | - | +₹40 |
| **Net** | **₹672** | **₹168** | **₹80** |

- Store payout credited after delivery confirmed
- Rider fee credited per trip completion
- Platform fee auto-deducted
- Payouts: Daily settlement to store/rider bank accounts (Phase 3)

---

## 🔐 Role-Based Access

| Endpoint Prefix | customer | rider | store_owner | admin |
|-----------------|----------|-------|-------------|-------|
| /api/v1/auth/* | ✅ | ✅ | ✅ | ✅ |
| /api/v1/services/* | ✅ | ❌ | ❌ | ✅ |
| /api/v1/cart/* | ✅ | ❌ | ❌ | ❌ |
| /api/v1/orders/* | ✅ (own) | ❌ | ❌ | ✅ (all) |
| /api/v1/delivery/* | ❌ | ✅ | ❌ | ✅ |
| /api/v1/store-ops/* | ❌ | ❌ | ✅ | ✅ |
| /api/v1/admin/* | ❌ | ❌ | ❌ | ✅ |
| /api/v1/wallet/* | ✅ | ✅ | ✅ | ✅ |
| /api/v1/upload/* | ✅ | ✅ | ✅ | ✅ |

---

## 📱 Shared Infrastructure

### Shared Across All Apps
- **Same backend** (FastAPI on same port)
- **Same MongoDB** (same database, role-based queries)
- **Same JWT auth** (token contains user_id + role)
- **Same OTP system** (Twilio dev bypass)
- **Same image upload** endpoint
- **Same design tokens** (colors, spacing — WashingBells brand)

### Per-App Differences
| | Customer | Rider | Store Owner | Admin |
|--|----------|-------|-------------|-------|
| **Framework** | Expo Router | Expo Router | Expo Router | Next.js (web) |
| **Folder** | `/` (root) | `/rider/` | `/store/` | `/admin/` |
| **Auth Role** | customer | rider | store_owner | admin |
| **Platform** | iOS + Android | iOS + Android | iOS + Android | Web browser |
| **Config** | `config/dev.js` | `rider/config/dev.js` | `store/config/dev.js` | `.env.local` |

---

## 🗓️ Execution Plan

### Phase 2A — Backend APIs (3-4 hours)
```
1. Update auth.py — add role, register-partner, register-store
2. Create delivery.py — rider worklist + full lifecycle
3. Create store_ops.py — store owner lifecycle
4. Create admin.py — super admin endpoints
5. Create upload.py — image handling
6. Update orders.py — store/rider assignment, OTPs, financials
7. Create phase2_schemas.py — all new models
8. Register all new routers in main.py
9. Test all endpoints via Swagger
```

### Phase 2B — Rider App (3-4 hours)
```
1. npx create-expo-app rider
2. Setup expo-router, shared theme, api lib
3. Auth screens (login + registration)
4. Dashboard + worklist screens
5. Active task screen (photo upload + OTP)
6. Earnings screen
7. Profile screen
8. Test on iOS
```

### Phase 2C — Store Owner App (3-4 hours)
```
1. npx create-expo-app store
2. Setup expo-router, shared theme, api lib
3. Auth screens (login + store setup)
4. Dashboard + order management screens
5. Order detail (receive, process, book rider)
6. Earnings screen
7. Settings (toggle open/closed)
8. Test on iOS
```

### Phase 2D — Admin Panel (3-4 hours)
```
1. npx create-next-app admin
2. Tailwind CSS setup
3. Auth (admin login)
4. Dashboard with live stats
5. Orders management page
6. Stores + Riders management
7. Financials page
8. Test in browser
```

### Phase 2E — Customer App Updates (1-2 hours)
```
1. Real-time status updates (polling)
2. View proof photos in order detail
3. Rate rider/store after delivery
4. Push notification registration
```

---

## ✅ Definition of Done

### Rider App
- [ ] Can register with phone + vehicle details
- [ ] Sees assigned pickup tasks
- [ ] Can accept task → navigate to customer
- [ ] Can upload garment photos
- [ ] Can enter customer OTP → pickup confirmed
- [ ] Can drop at store → enter store OTP
- [ ] Can do delivery run → enter customer OTP → complete
- [ ] Can see earnings

### Store Owner App
- [ ] Can register store with details
- [ ] Sees incoming orders
- [ ] Can confirm receipt of clothes (OTP)
- [ ] Can update processing status
- [ ] Can set expected delivery time
- [ ] Can book rider for delivery
- [ ] Can see earnings (80% of order value)
- [ ] Can toggle store open/closed

### Admin Panel
- [ ] Can see all orders, users, stores, riders
- [ ] Can approve new riders and stores
- [ ] Can assign/reassign orders
- [ ] Can override any order status
- [ ] Can see financial dashboard (platform revenue)
- [ ] Can manage rate list, banners, coupons

### Customer App (Updates)
- [ ] Can see detailed status with proof photos
- [ ] Can rate rider + store after delivery
- [ ] Receives OTP for pickup and delivery

---

## 📁 Final Folder Structure

```
/WashingBells/
├── app/                    ← Customer App (existing)
├── components/             ← Customer components
├── stores/                 ← Customer Zustand stores
├── lib/                    ← Shared API client
├── config/                 ← Customer config
├── constants/              ← Shared theme
├── backend/                ← Shared FastAPI backend
│   ├── app/routers/
│   │   ├── auth.py         ← Updated (roles)
│   │   ├── orders.py       ← Updated (store/rider/OTPs)
│   │   ├── delivery.py     ← NEW (rider endpoints)
│   │   ├── store_ops.py    ← NEW (store owner endpoints)
│   │   ├── admin.py        ← NEW (admin endpoints)
│   │   ├── upload.py       ← NEW (image upload)
│   │   └── ... (existing)
│   └── app/schemas/
│       ├── schemas.py
│       ├── phase1_schemas.py
│       └── phase2_schemas.py  ← NEW
├── rider/                  ← NEW: Rider App (Expo)
│   ├── app/
│   ├── components/
│   ├── stores/
│   ├── lib/
│   └── config/
├── store/                  ← NEW: Store Owner App (Expo)
│   ├── app/
│   ├── components/
│   ├── stores/
│   ├── lib/
│   └── config/
├── admin/                  ← NEW: Admin Panel (Next.js)
│   ├── app/
│   ├── components/
│   └── lib/
└── docs/
    ├── phase1/
    └── phase2/
        └── PHASE2_MASTER_PLAN.md  ← This file
```

---

**Ready to start with Phase 2A (Backend APIs)?**
