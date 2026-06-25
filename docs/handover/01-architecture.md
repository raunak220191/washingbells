# 01 — Architecture

## High-level picture

```
                    ┌─────────────────────────────────────────┐
                    │            FastAPI backend              │
                    │         (backend/ — port 8000)          │
                    │                                         │
   Customer app ───▶│  /api/v1/*  ──▶  MongoDB (Motor async)  │
   (Expo :8081)     │                                         │
                    │  Services:                              │
   Rider app ──────▶│   • MSG91   (SMS / OTP)                 │
   (Expo :8082)     │   • Razorpay (payments, REST via httpx) │
                    │   • SendGrid (email in/out)             │
   Store app ──────▶│   • Expo Push (notifications)           │
   (Expo :8083)     │   • reportlab/qrcode (garment tag PDFs) │
                    │                                         │
   Admin panel ────▶│                                         │
   (Next.js :3000)  └─────────────────────────────────────────┘
```

Every client talks to the **same** REST API. There is no direct DB access from
any frontend. The backend is stateless (JWT auth); all state lives in MongoDB.

## The four frontends

- **Customer app** (`app/` + `stores/` + `lib/` + `components/` + `constants/`
  at the repo root). React Native via Expo Router. Browse services → build a
  cart → schedule a pickup → pay (Razorpay) → track the order.
- **Rider app** (`rider/`). Go online → receive pickup/delivery trips → photos
  + OTP handoffs → live GPS reported to the admin map.
- **Store app** (`store/`). Toggle open/closed → accept/reject orders → receive
  clothes (OTP) → process → mark ready → book a delivery rider.
- **Admin panel** (`admin/`). Next.js 16. Dashboard, orders, riders, stores,
  customers, live tracking map (Leaflet), coupons, banners, email, T&C, a raw
  Mongo browser, and more.

> The three mobile apps are **separate Expo projects** with their own
> `package.json`, `node_modules`, theme, and API client. They share *patterns*
> but **not code** — a change to a shared concept must be made in each app.

## Tech stack

| Layer | Choice |
|-------|--------|
| API framework | FastAPI 0.115 (Python 3.13) |
| DB | MongoDB 7 via Motor (async) |
| Auth | JWT (python-jose), bcrypt password hashing |
| SMS/OTP | MSG91 (REST via httpx) |
| Payments | Razorpay (REST via httpx — **not** the Python SDK, see doc 10) |
| Email | SendGrid (outbound + Inbound Parse webhook) |
| Push | Expo Push (`exponent` tokens) |
| PDFs | reportlab + qrcode + python-barcode |
| Mobile | React Native, Expo SDK 54, expo-router (file-based) |
| Admin | Next.js 16 (App Router), Tailwind, Leaflet, axios |

## Request flow (typical)

1. A client calls `https://<host>/api/v1/<router>/<path>` with a
   `Authorization: Bearer <JWT>` header.
2. FastAPI routes to the matching function in `backend/app/routers/<router>.py`.
3. `get_current_user` (in `core/security.py`) decodes the JWT → `{user_id, phone, role}`.
4. The handler reads/writes MongoDB via `get_db()` (Motor) and may call a
   service (MSG91, Razorpay, push, email).
5. A Pydantic response model serialises the result to JSON.

## Default ports

| Service | Port | URL |
|---------|------|-----|
| Backend | 8000 | http://localhost:8000 (Swagger: `/docs`) |
| Customer Metro | 8081 | Expo dev server |
| Rider Metro | 8082 | Expo dev server |
| Store Metro | 8083 | Expo dev server |
| Admin | 3000 | http://localhost:3000 |
| MongoDB | 27017 | mongodb://localhost:27017 |

`scripts/dev.sh` starts all of these (see doc 02).

## Networking notes

- The **admin** runs in a browser on the dev machine and calls
  `http://localhost:8000` (set in `admin/.env.local` → `NEXT_PUBLIC_API_URL`).
- The **mobile apps** run on a phone/simulator and cannot use `localhost`. They
  read the backend URL from `config/dev.js` (each app) — set this to your
  machine's **LAN IP** (e.g. `http://192.168.1.41:8000`) or a tunnel URL.
- CORS on the backend is `allow_origins=["*"]` (see `backend/main.py`) — fine
  for dev, tighten for prod (doc 12).
