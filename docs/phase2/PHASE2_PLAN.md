# Phase 2 — Delivery Partner App + Order Fulfillment

**Goal:** Build the delivery partner mobile app and wire it to the existing backend so orders can be picked up, verified, and delivered end-to-end.

---

## 2.1 Backend — Delivery Partner APIs

### User Role Expansion
- [ ] `POST /api/v1/auth/register-partner` — Partner signup (phone, name, photo, DL, address proof)
- [ ] Upload endpoints for partner documents (profile photo, DL, address proof) → Cloudinary
- [ ] Admin approval workflow for partners (status: pending → approved → active)

### Partner Worklist & Assignment
- [ ] `GET /api/v1/delivery/worklist` — List orders assigned to the logged-in partner
- [ ] `POST /api/v1/delivery/{order_id}/accept` — Accept an assigned order
- [ ] `POST /api/v1/delivery/{order_id}/start-trip` — Start pickup/delivery trip (triggers GPS tracking)
- [ ] `POST /api/v1/delivery/{order_id}/arrive` — Mark arrived at customer location

### Pickup Flow
- [ ] `POST /api/v1/delivery/{order_id}/weigh` — Add weight (KG) for premium laundry orders
- [ ] `POST /api/v1/delivery/{order_id}/upload-proof` — Upload garment photos (Cloudinary)
- [ ] `POST /api/v1/delivery/{order_id}/verify-otp` — Verify customer OTP for pickup confirmation
- [ ] `PUT /api/v1/delivery/{order_id}/status` — Update order status (picked_up, in_progress, packed, out_for_delivery, delivered)

### Delivery Flow
- [ ] Same status update + photo upload for delivery leg
- [ ] Final OTP verification on delivery

### Notifications
- [ ] Push notification to nearest partner when order is placed (proximity-based)
- [ ] Push notification to store operator on pickup
- [ ] WhatsApp/SMS to customer on each status change

---

## 2.2 Backend — Store Assignment Logic

- [ ] Auto-assign orders to nearest store based on customer address geo coordinates
- [ ] Store operator can view incoming orders and assign delivery partner
- [ ] `PUT /api/v1/stores/{store_id}/orders/{order_id}/assign` — Assign partner to order
- [ ] Notification to partner on assignment

---

## 2.3 Delivery Partner App (New Expo Project)

### Folder: `/rider/`
Separate Expo SDK 54 project with expo-router.

### Screens

| Screen | Description |
|--------|-------------|
| **Splash + Login** | Phone + OTP (shared auth with customer app, role=delivery) |
| **Registration** | Photo upload, DL upload, address proof, vehicle details |
| **Home / Dashboard** | Stats card (today's deliveries, earnings), active task |
| **Worklist Tab** | List of assigned orders — card per order with address, time, status, "Start Trip" button |
| **Active Task** | Map view (Google Maps routing), customer name/address, order checklist |
| **Camera/Proof** | Take photos of garments on pickup, upload as proof |
| **OTP Verify** | Enter customer's OTP to confirm pickup/delivery |
| **Earnings Tab** | Daily/weekly/monthly earnings breakdown |
| **Profile** | Partner info, documents status, vehicle details |

### Bottom Tabs: `Worklist | Active | Earnings | Profile`

---

## 2.4 Customer App Updates (Phase 2 additions)

- [ ] Real-time order tracking with map (WebSocket + Google Maps)
- [ ] View pickup/delivery proof photos in order detail
- [ ] Rate delivery partner after order completion
- [ ] Push notifications for status changes (expo-notifications)
- [ ] Real Razorpay SDK integration (`react-native-razorpay`)
- [ ] Google Maps Places autocomplete for address picker

---

## 2.5 Backend — Image Upload Service

- [ ] Cloudinary integration for image uploads
- [ ] `POST /api/v1/upload` — Generic image upload endpoint
- [ ] Returns Cloudinary URL, stores reference in MongoDB
- [ ] Used for: partner documents, garment proof photos, delivery proof

---

## 2.6 Backend — Notification Service

- [ ] `expo-notifications` push token registration endpoint
- [ ] Twilio WhatsApp message on: order placed, picked up, in progress, delivered
- [ ] Email receipt on order placement
- [ ] In-app notification feed

---

## Execution Order

```
2.1 Partner APIs  →  2.2 Store Assignment  →  2.5 Image Upload
        ↓                    ↓                       ↓
     2.3 Rider App ──────────────────────────────────┘
        ↓
     2.4 Customer App Updates
        ↓
     2.6 Notifications
```

## Dependencies
- Cloudinary account (free tier)
- Google Maps API key
- expo-notifications setup
- react-native-razorpay (requires dev build, not Expo Go)

## Definition of Done
- Partner can: register → get assigned → start trip → photograph items → verify OTP → mark delivered
- Customer can: see live status updates, view proof photos, rate partner
- Store can: see incoming orders, assign partners (via API, dashboard in Phase 3)
