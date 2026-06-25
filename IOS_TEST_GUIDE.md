# 📱 WashingBells iOS Testing Guide

**Date:** May 14, 2026  
**Status:** All services running ✅

---

## ⚡ Quick Start

### ✅ Services Status
- **MongoDB:** Running (localhost:27017)
- **Backend API:** http://localhost:8000
- **Cloudflare Tunnel:** https://leonard-rates-missouri-term.trycloudflare.com
- **Expo Metro:** Running (check VS Code terminal)

---

## 🚨 Tunnel Issue & Solution

**Problem:** Expo's ngrok tunnel failed with "remote gone away" error

**Solution:** Use **Same WiFi** method (works great for local testing!)

---

## 📱 Connect iPhone to App

### Method 1: Same WiFi (RECOMMENDED ✅)

**Requirements:**
- iPhone and Mac on **same WiFi network**
- Expo Go app installed on iPhone

**Steps:**
1. **Look at VS Code terminal** → Find the QR code (appears in 10-15 sec)
2. **Open Expo Go app** on iPhone
3. **Tap "Scan QR code"** button in Expo Go
4. **Scan the QR** shown in terminal
5. **Wait ~20 seconds** for bundle to compile
6. App launches! 🎉

### Method 2: Manual URL Entry

If QR scanning doesn't work:

1. **Check terminal** for URL like: `exp://192.168.1.41:8081`
2. **Open Expo Go** on iPhone
3. **Tap "Enter URL manually"**
4. **Type/paste** the exp:// URL
5. **Tap "Connect"**

### Method 3: Expo Account Sync

Most reliable but requires account:

1. **On Mac terminal:**
   ```bash
   npx expo login
   ```
   Enter your Expo credentials

2. **On iPhone:**
   - Open Expo Go
   - Login with same account
   - App appears in "Recently in Development"

---

## 🔐 Login to App

Once app loads:

**Phone Number:** `+919876543210` (or any +91 number)  
**OTP Code:** `123456` (always works - dev bypass enabled)

---

## 🧪 Complete Test Checklist

### ✅ Phase 1 Features to Test

#### 1. Authentication
- [ ] Enter phone number
- [ ] Receive/enter OTP: 123456
- [ ] Successfully login

#### 2. Home Screen
- [ ] See 4 dynamic banners (swipeable carousel)
- [ ] View 7 service categories
- [ ] Scroll through customer testimonials
- [ ] Tap "Refer & Earn" banner → modal opens

#### 3. Service Selection & Basket
- [ ] Tap any service (e.g., "Wash & Fold")
- [ ] Add items with + button
- [ ] See price update
- [ ] View basket with all items
- [ ] Edit quantities in basket

#### 4. Checkout Flow
- [ ] Tap "Proceed to Checkout"
- [ ] Select pickup date & time
- [ ] Select delivery date & time
- [ ] Try coupon: `WELCOME10` (if available)
- [ ] Add special instructions
- [ ] Choose payment:
  - **Pay Now** (Razorpay - online)
  - **Cash on Delivery** (COD)
- [ ] Place order

#### 5. Order Detail Screen
- [ ] View order in Orders tab
- [ ] Tap to see detail
- [ ] Check lifecycle timeline (colored dots)
- [ ] See garment tags (e.g., WB-2026-A3K7-001)
- [ ] View billing breakdown
- [ ] If COD: Try "Pay Now" button

#### 6. Wallet Features
- [ ] Go to Profile → Wallet
- [ ] View wallet balance
- [ ] Try top-up: ₹100, ₹200, ₹500, or ₹1000
- [ ] See transaction history
- [ ] Create order → wallet auto-debits

#### 7. Referral System
- [ ] Home → Tap Refer & Earn banner
- [ ] View your referral code
- [ ] Tap "Share" → WhatsApp/SMS options work
- [ ] Copy code
- [ ] See stats (referred users, rewards)

#### 8. Help & Support
- [ ] Profile → Help & Support
- [ ] Tap WhatsApp → opens WhatsApp
- [ ] Tap Call → dials number
- [ ] Tap Email → opens mail app
- [ ] View FAQ section

---

## 🎯 Services Available to Test

| Service | Pricing Model | Price Range |
|---------|--------------|-------------|
| Dry Clean | Per Piece | ₹79-₹399 |
| Wash & Steam Iron | Per Piece | ₹29-₹149 |
| Wash & Fold | Per Piece | ₹19-₹99 |
| Shoe Cleaning | Per Pair | ₹149-₹299 |
| Steam Iron | Per Piece | ₹15-₹49 |
| **Premium Laundry** | Per KG | ₹89-₹149/kg |
| **Sofa Cleaning** | At-Home Service | ₹399-₹1999 |

---

## 🐛 Troubleshooting

### App won't load / "Unable to connect"
**Problem:** iPhone can't reach Metro bundler  
**Solution:**
```bash
# 1. Make sure both devices on SAME WiFi
# 2. Restart Expo with clear cache
cd /Users/raunakpandey/Downloads/WashingBells
npx expo start -c
```

### Backend API errors
**Problem:** API calls failing  
**Check:**
```bash
# Test backend locally
curl http://localhost:8000/health

# Test tunnel
curl https://leonard-rates-missouri-term.trycloudflare.com/health

# If broken, restart backend
cd /Users/raunakpandey/Downloads/WashingBells/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Tunnel expired
**Problem:** Cloudflare tunnel URL changed  
**Solution:**
```bash
# Check new tunnel URL
grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/wb-tunnel.log

# Update config manually or restart services
./scripts/start-services.sh
```

### App crashes or white screen
**Solution:**
```bash
# Clear everything and restart
cd /Users/raunakpandey/Downloads/WashingBells
npx expo start -c --clear
# Then reconnect from iPhone
```

---

## 📊 API Testing

**Swagger Docs:** https://leonard-rates-missouri-term.trycloudflare.com/docs

### Key Endpoints to Verify

```bash
# Health check
GET /health

# Authentication
POST /api/auth/send-otp
POST /api/auth/verify-otp

# Dynamic content
GET /api/banners
GET /api/testimonials
GET /api/stores

# Services & Orders
GET /api/services
POST /api/orders
GET /api/orders/{order_id}

# Wallet
GET /api/wallet/balance
POST /api/wallet/top-up
GET /api/wallet/transactions

# Referrals & Coupons
GET /api/referrals/stats
POST /api/referrals/apply
POST /api/coupons/validate
GET /api/coupons/my-coupons
```

---

## 🛑 Stop Services

When done testing:

```bash
# Kill Metro bundler
# Press Ctrl+C in the Expo terminal

# Stop backend & tunnel
pkill -f "uvicorn|cloudflared"

# Stop MongoDB (optional)
docker stop washingbells-mongo
```

---

## 📋 Phase 1 MVP Completion

**All Core Features Implemented:**
- ✅ OTP Authentication
- ✅ Dynamic Banners (API-driven)
- ✅ 7 Service Categories
- ✅ Shopping Cart
- ✅ Date/Time Scheduling
- ✅ Coupon System
- ✅ Wallet (top-up, balance, auto-debit)
- ✅ Referral System (code sharing, rewards)
- ✅ Payment Methods (Razorpay + COD)
- ✅ Order Tracking (timeline + garment tags)
- ✅ Customer Testimonials
- ✅ Help & Support

**Next Phase:** Delivery Partner App (Phase 2)

---

## 💡 Testing Tips

1. **Use Same WiFi** - Most reliable for local dev
2. **Keep Expo Go open** - Faster reloads
3. **Shake device** - Access Expo dev menu
4. **Any +91 number works** - No real SMS needed
5. **OTP is always 123456** - Hardcoded for testing
6. **Check terminal logs** - Backend shows all API calls
7. **Test wallet before ordering** - Add ₹500 to test auto-debit

---

**🎉 Ready to test! Scan QR from Expo terminal and start exploring.**
