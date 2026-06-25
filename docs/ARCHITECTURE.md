# WashingBells — System Architecture

## Overview

WashingBells is a 4-application ecosystem for on-demand laundry services in India.

```
┌─────────────────────┐     ┌──────────────────────┐
│  Customer Mobile App │     │  Delivery Partner App │
│  (Expo/React Native) │     │  (Expo/React Native)  │
└──────────┬──────────┘     └──────────┬───────────┘
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────┐
│              FastAPI Backend (Python)             │
│              /api/v1/*                            │
├──────────────────────────────────────────────────┤
│  Auth │ Users │ Services │ Cart │ Orders │ ...   │
└──────────────────┬───────────────────────────────┘
                   │
           ┌───────┴───────┐
           ▼               ▼
   ┌──────────────┐ ┌─────────────┐
   │  MongoDB 7   │ │  Cloudinary  │
   │  (Database)  │ │  (Images)    │
   └──────────────┘ └─────────────┘

┌─────────────────────┐     ┌──────────────────────┐
│  Store Dashboard     │     │  Admin Portal         │
│  (Next.js Web)       │     │  (Next.js Web)        │
└──────────┬──────────┘     └──────────┬───────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
              FastAPI Backend (same)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Customer App | Expo SDK 54, React Native 0.81, expo-router v6 |
| Delivery App | Expo SDK 54, React Native 0.81, expo-router v6 |
| Store Portal | Next.js 14, Tailwind CSS, shadcn/ui |
| Admin Portal | Next.js 14, Tailwind CSS, shadcn/ui, Recharts |
| Backend API | FastAPI (Python 3.13), uvicorn |
| Database | MongoDB 7 (motor async driver) |
| Auth | Twilio Verify (OTP), JWT tokens |
| Payments | Razorpay (UPI, Cards, Wallets) |
| Maps | Google Maps API, Places Autocomplete |
| Image Storage | Cloudinary (garment photos, proofs) |
| Notifications | Twilio (WhatsApp + SMS), Email |
| Tunneling (dev) | Cloudflare Tunnel (trycloudflare.com) |

## MongoDB Collections

```
users              — Customer, Delivery Partner, Store Operator, Admin profiles
stores             — Store locations with vendor codes (WB001, WB002...)
services           — Laundry service categories with items and prices
carts              — Active shopping carts per user
orders             — All orders with lifecycle status, tags, assignments
addresses          — Saved user addresses
referrals          — Referral tracking (who referred whom)
coupons            — Promo codes and discount campaigns
wallets            — WB Wallet balances and transaction history
wallet_txns        — Individual wallet credit/debit entries
promo_banners      — Admin-managed carousel banners
testimonials       — Customer testimonials for home page
notifications      — Push/WhatsApp/Email notification log
garment_tags       — Unique tag codes per garment per order
delivery_proofs    — Pickup/delivery photo evidence
```

## API Prefix Convention

All API routes: `/api/v1/{resource}`

| Prefix | Access |
|--------|--------|
| `/api/v1/auth/*` | Public |
| `/api/v1/users/*` | Authenticated user |
| `/api/v1/services/*` | Public |
| `/api/v1/cart/*` | Authenticated user |
| `/api/v1/orders/*` | Authenticated user |
| `/api/v1/addresses/*` | Authenticated user |
| `/api/v1/referrals/*` | Authenticated user |
| `/api/v1/coupons/*` | Authenticated user (validate), Admin (CRUD) |
| `/api/v1/wallet/*` | Authenticated user |
| `/api/v1/banners/*` | Public (list), Admin (CRUD) |
| `/api/v1/stores/*` | Admin (CRUD), Store operator (own) |
| `/api/v1/delivery/*` | Delivery partner, Store operator |
| `/api/v1/admin/*` | Admin only |
