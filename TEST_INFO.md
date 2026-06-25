# 🧺 WashingBells — iOS Test Session
**Started:** May 14, 2026

---

## ✅ Services Running

| Service | Status | URL |
|---------|--------|-----|
| MongoDB | ✅ Running | localhost:27017 |
| Backend | ✅ Running | http://localhost:8000 |
| Tunnel | ✅ Running | https://leonard-rates-missouri-term.trycloudflare.com |
| Expo Metro | ✅ Running | Check terminal for QR code |

---

## 📱 iOS Testing Instructions

### Step 1: Scan QR Code
1. **Look for the QR code** in the terminal output (should appear in ~10-15 seconds)
2. **Open iPhone Camera** app
3. **Scan the QR code** → Opens Expo Go automatically
4. **Wait ~20-30 seconds** for first bundle to compile

### Step 2: Login
- **Phone:** `+919876543210` (any +91 number works)
- **OTP:** `123456` (dev bypass - no real SMS sent)

---

## 🧪 Complete Phase 1 Test Flow

### 1. Authentication ✓
- Enter phone number → Receive OTP → Login

### 2. Home Screen ✓
- View dynamic banners (4 promotional banners from API)
- Browse service categories (7 services)
- See customer testimonials (horizontal scroll)
- Tap "Refer & Earn" modal

### 3. Service Selection ✓
- Tap any service (e.g., "Wash & Fold")
- Add items with quantity stepper
- View price calculation
- Add to basket

### 4. Basket & Checkout ✓
- Review cart items
- Proceed to checkout
- Select pickup date & time
- Select delivery date & time
- **Enter coupon code** (optional - try: WELCOME10)
- **Add special instructions** (optional)
- **Choose payment method:**
  - Pay Now (Razorpay online)
  - Cash on Delivery (COD)

### 5. Order Detail Screen ✓
- View order lifecycle timeline with status dots
- See garment tracking tags (e.g., WB-2026-A3K7-001)
- View agent info (when assigned)
- COD orders: "Pay Now" button to switch to online
- Full billing breakdown with discounts

### 6. Wallet Features ✓
- Profile → Wallet
- View wallet balance
- Quick top-up buttons (₹100/200/500/1000)
- View transaction history
- Auto-debit on order placement

### 7. Referral System ✓
- Home → Tap "Refer & Earn" banner
- View your referral code
- Share via WhatsApp/SMS/Copy
- See referral stats (referred users, rewards earned)
- New users get 10% coupon
- Referrer gets 20% coupon

### 8. Help & Support ✓
- Profile → Help & Support
- WhatsApp contact
- Phone call
- Email support
- FAQ section

---

## 🎯 Services Available

| Service | Type | Pricing |
|---------|------|---------|
| Dry Clean | Per Piece | ₹79-₹399 |
| Wash & Steam Iron | Per Piece | ₹29-₹149 |
| Wash & Fold | Per Piece | ₹19-₹99 |
| Shoe Cleaning | Per Pair | ₹149-₹299 |
| Steam Iron | Per Piece | ₹15-₹49 |
| **Premium Laundry** | Per KG | ₹89-₹149/kg |
| **Sofa Cleaning** | At-Home | ₹399-₹1999/piece |

---

## 🔐 Test Accounts & Coupons

### Phone Number
Any Indian mobile number works: `+919876543210`, `+919999999999`, etc.

### OTP Code
Always use: `123456` (dev bypass enabled)

### Sample Coupon Codes
- `WELCOME10` - 10% off (if created via admin/referral)
- `FIRST20` - 20% off (if created via admin)
- Or generate via referral system

---

## 🐛 Troubleshooting

### App won't load
```bash
# Clear Expo cache and restart
cd /Users/raunakpandey/Downloads/WashingBells
npx expo start -c --tunnel
```

### Tunnel URL not working
```bash
# Check if tunnel is still alive
ps aux | grep cloudflared
# If not, restart services
./scripts/start-services.sh
```

### Backend errors
```bash
# Check backend logs
tail -50 /tmp/wb-backend.log
# Restart backend
cd backend && source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🛑 Stop All Services

```bash
# Kill all processes
pkill -f "uvicorn|cloudflared|expo"

# Stop MongoDB
docker stop washingbells-mongo

# Or use cleanup script
cd /Users/raunakpandey/Downloads/WashingBells
./scripts/restart.sh
# Press Ctrl+C to stop
```

---

## 📊 API Documentation

**Swagger UI:** https://leonard-rates-missouri-term.trycloudflare.com/docs

### Key Endpoints
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Login
- `GET /api/banners` - Dynamic banners
- `GET /api/testimonials` - Customer reviews
- `GET /api/services` - All services
- `POST /api/orders` - Create order
- `GET /api/wallet/balance` - Wallet balance
- `POST /api/referrals/apply` - Apply referral code

---

## 📋 Phase 1 Completion Checklist

- [x] Authentication (OTP-based)
- [x] Dynamic Banners (admin-managed)
- [x] Service Catalog (7 services)
- [x] Shopping Basket
- [x] Checkout Flow (pickup/delivery scheduling)
- [x] Payment Methods (Razorpay + COD)
- [x] Order Management (lifecycle tracking)
- [x] Garment Tracking (unique tags)
- [x] Wallet System (top-up, balance, transactions)
- [x] Referral System (code generation, rewards)
- [x] Coupon System (validation, discounts)
- [x] Customer Testimonials
- [x] Help & Support
- [x] Store Locations

---

**🎉 Ready to test Phase 1 MVP on iOS!**

*Scan the QR code in the terminal and start testing.*
