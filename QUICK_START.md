# 🚀 WashingBells - Quick Start Guide

**Date:** May 14, 2026  
**Status:** ✅ All services running, Metro bundler restarted

---

## ✅ Current Status

All services are running and ready for iOS testing:

- **MongoDB:** ✅ Running (Docker)
- **FastAPI Backend:** ✅ http://localhost:8000
- **Cloudflare Tunnel:** ✅ https://leonard-rates-missouri-term.trycloudflare.com
- **Expo Metro:** ✅ Running (fresh cache, no tunnel mode)

**Recent Fix:** Installed and configured `expo-clipboard` package for referral code copying.

---

## 📱 Connect Your iPhone

### ✅ Requirements
- iPhone with **Expo Go** app installed
- iPhone and Mac on **same WiFi network**

### Steps:
1. **Check VS Code terminal** for QR code (appears in ~15 seconds)
2. **Open Expo Go** on iPhone
3. **Tap "Scan QR code"** in Expo Go
4. **Scan the QR** from terminal
5. **Wait ~20 seconds** for bundle to compile
6. App loads! 🎉

### Login:
- **Phone:** `+919876543210` (any +91 number)
- **OTP:** `123456` (always works)

---

## 🧪 Quick Test Checklist

**Essential flows to test:**

✅ **Login** → Phone + OTP  
✅ **Home** → See banners, services, testimonials  
✅ **Add Items** → Tap service → Add to basket  
✅ **Checkout** → Select dates → Apply coupon → Choose COD/Pay Now  
✅ **Order Detail** → Timeline, garment tags, billing  
✅ **Wallet** → Profile → Wallet → Top up ₹100  
✅ **Refer & Earn** → Home banner → Share code (uses clipboard)  
✅ **Help** → Profile → Help & Support  

---

## 🔧 Troubleshooting

### "Unable to connect"
**Fix:** Make sure iPhone and Mac are on **same WiFi**

### "Bundling failed" or white screen
**Fix:** Restart Expo with clean cache:
```bash
cd /Users/raunakpandey/Downloads/WashingBells
npx expo start -c
```

### Backend errors
**Fix:** Check backend is running:
```bash
curl http://localhost:8000/health
# Should return: {"status":"ok"}
```

---

## 🛑 Stop Everything

```bash
# Stop Expo (press Ctrl+C in terminal)
# Or kill process:
pkill -f "expo start"

# Stop backend
pkill -f uvicorn

# Stop tunnel
pkill -f cloudflared

# Stop MongoDB (optional)
docker stop washingbells-mongo
```

---

## 📚 Full Documentation

- **IOS_TEST_GUIDE.md** - Complete testing guide with all features
- **TEST_INFO.md** - Detailed API info and troubleshooting
- **docs/phase1/** - Architecture, API reference, database schema

---

## 🎯 Phase 1 Features Complete

All 14 core features implemented and ready to test:

1. ✅ OTP Authentication
2. ✅ Dynamic Banners (API-driven)
3. ✅ 7 Service Categories
4. ✅ Shopping Cart
5. ✅ Date/Time Scheduling
6. ✅ Coupon System
7. ✅ Wallet (with auto-debit)
8. ✅ Referral System
9. ✅ Payment Methods (Razorpay + COD)
10. ✅ Order Tracking Timeline
11. ✅ Garment Tags
12. ✅ Customer Testimonials
13. ✅ Help & Support
14. ✅ Store Locations

---

**🎉 Ready! Scan QR code from Expo terminal and start testing.**

**Need help?** Check IOS_TEST_GUIDE.md for detailed instructions.
