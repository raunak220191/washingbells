# 03 — Backend (FastAPI)

## Layout

```
backend/
├── main.py                  # FastAPI app, lifespan (startup seeding), router registration, CORS
├── dev.yaml                 # service config (msg91:, razorpay:) — see doc 11
├── .env                     # Mongo URL, JWT secret, SendGrid, etc.
├── requirements.txt
├── scripts/seed_dummy_data.py
├── data/rate_list.yaml      # service/price seed data
└── app/
    ├── core/
    │   ├── config.py        # Pydantic Settings; loads dev.yaml + .env
    │   ├── database.py      # Motor client, get_db(), index creation
    │   ├── security.py      # JWT create/verify, get_current_user, password hashing
    │   └── utils.py         # haversine_km, misc helpers
    ├── routers/             # 23 routers — one per feature area (see below)
    ├── services/            # external integrations + heavy logic
    └── schemas/             # Pydantic models (schemas.py, phase1_schemas.py, phase2_schemas.py)
```

## App entrypoint — `main.py`

- Builds the FastAPI app with a **lifespan** that on startup: connects to Mongo,
  seeds default email-event templates, migrates legacy stores to weekly
  `operating_hours`, and ensures indexes (TTL on `email_log`, unique on
  `unsubscribed_emails.email`, etc.).
- CORS: `allow_origins=["*"]` (tighten for prod).
- Registers all routers under the `/api/v1` prefix.
- Health check: `GET /health`.

## Routers (`app/routers/`)

Each router declares `APIRouter(prefix="/<area>")` and is included in `main.py`.

| Router | Prefix | Responsibility |
|--------|--------|----------------|
| `auth.py` | `/auth` | OTP + password login, rider/store self-registration |
| `users.py` | `/users` | `GET/PUT /users/me` (profile) |
| `addresses.py` | `/addresses` | customer saved addresses |
| `services.py` | `/services` | catalogue of laundry services + items |
| `cart.py` | `/cart` | customer cart |
| `orders.py` | `/orders` | order create, detail, cancel, **reschedule**, slots, tag PDF |
| `payments.py` | `/payments` | Razorpay order create + signature verify |
| `coupons.py` | `/coupons` | validate + list coupons |
| `wallet.py` | `/wallet` | WB wallet balance, top-up, txns |
| `referrals.py` | `/referrals` | referral codes |
| `delivery.py` | `/delivery` | **rider**: status, location, worklist, trip flow, OTPs, earnings |
| `store_ops.py` | `/store-ops` | **store**: my-store, orders, accept/reject/receive/process, hours, rider booking |
| `stores.py` | `/stores` | public store listing, nearby, slots |
| `terms.py` | `/terms` | versioned T&C per role + accept |
| `notifications.py` | `/notifications` | push token register/unregister/test |
| `upload.py` | `/upload` | generic base64 file store → `uploads` collection |
| `banners.py` / `testimonials.py` | `/banners`, `/testimonials` | marketing content |
| `admin.py` | `/admin` | the bulk of admin: dashboard, orders, riders, stores, users, services, coupons, banners, settings, **live tracking** |
| `admin_db.py` | `/admin/db` | raw Mongo browser/editor (whitelisted collections + audit log) |
| `email_admin.py` | `/admin/email` | email events, compose, logs, unsubscribed |
| `email_public.py` | `/email` | public unsubscribe/resubscribe (HMAC token) |
| `inbox.py` | `/inbox` | SendGrid Inbound Parse webhook + admin inbox |

See doc 05 for the full endpoint list.

## Services (`app/services/`)

| Service | Purpose |
|---------|---------|
| `msg91_service.py` | `send_otp`, `verify_otp`, `send_invite_sms` (REST via httpx; dev-bypass when unconfigured) |
| `razorpay_service.py` | `create_razorpay_order`, `verify_razorpay_payment` (REST via httpx + HMAC; dev-bypass when unconfigured) |
| `email_service.py` | Jinja2 templated emails via SendGrid, audit log, suppression list, unsubscribe footer |
| `push_service.py` | Expo Push notifications (`notify_rider_*`, `notify_customer_order_update`, `send_push_to_user`) |
| `store_hours_service.py` | weekly operating hours, holiday closures, **slot generation + availability** |
| `tag_pdf_service.py` | garment tag PDFs (QR + Code128 barcode via reportlab) |

## Core (`app/core/`)

- **`config.py`** — `Settings` (pydantic-settings). `get_settings()` merges
  `dev.yaml` (msg91 + razorpay sections) over `.env` over defaults. Cached with
  `@lru_cache`. See doc 11.
- **`database.py`** — `connect_to_mongo()`, `get_db()`, baseline indexes
  (`users.phone` unique, `orders.user_id`, `services.slug` unique, …).
- **`security.py`** — `create_access_token`, `verify_token`, `get_current_user`
  (FastAPI dependency returning `{user_id, phone, role}`), `hash_password` /
  `verify_password` (bcrypt directly — **passlib is broken on Python 3.13**, doc 16).

## Schemas (`app/schemas/`)

Pydantic models split across `schemas.py` (core: auth, orders, addresses,
cart, payments), `phase1_schemas.py` (coupons, wallet, referrals), and
`phase2_schemas.py` (rider/store registration, OTP verify, store toggle, etc.).
Many admin/store/delivery handlers accept a raw `dict` body rather than a
schema — grep the handler to see expected keys.

## Conventions

- All datetimes stored in MongoDB are **UTC**. India is UTC+5:30 (no DST).
  When comparing Mongo datetimes in Python, coerce to aware UTC first — Mongo
  returns **naive** datetimes (this caused a real bug; doc 16).
- ObjectIds are converted to/from `str` at the boundary.
- Routes with a static path segment must be declared **before** a sibling
  dynamic `/{param}` route, or FastAPI shadows them (doc 16).
- Side-effectful writes (status changes, payments) append to the order's
  `status_timeline` and often fire a push/email (best-effort, wrapped in
  try/except so they never fail the request).
