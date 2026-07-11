from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import connect_to_mongo, close_mongo_connection
from app.routers import (
    auth, users, addresses, services, cart, orders, payments,
    banners, testimonials, stores, referrals, coupons, wallet,
    delivery, store_ops, admin, upload, terms, notifications, email_admin,
    email_public, inbox, admin_db, items,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    # Seed default email event templates (idempotent — no-op if already present)
    try:
        from app.services.email_service import seed_default_events
        n = await seed_default_events()
        if n:
            print(f"[startup] Seeded {n} default email event templates")
    except Exception as e:
        print(f"[startup] Email event seed skipped: {e}")
    # Migrate legacy stores to weekly operating_hours (idempotent)
    try:
        from app.services.store_hours_service import migrate_all_stores
        from app.core.database import get_db
        n = await migrate_all_stores(get_db())
        if n:
            print(f"[startup] Migrated {n} stores to weekly operating_hours")
    except Exception as e:
        print(f"[startup] Store hours migration skipped: {e}")
    # Backfill Men/Women/Kids categories onto existing service items (idempotent)
    try:
        from app.routers.services import sync_item_categories
        from app.core.database import get_db
        n = await sync_item_categories(get_db())
        if n:
            print(f"[startup] Backfilled categories on {n} service items")
    except Exception as e:
        print(f"[startup] Category backfill skipped: {e}")
    # Ensure DB indexes (idempotent — Mongo no-ops if same)
    try:
        from app.core.database import get_db
        db = get_db()
        # 90-day TTL on email_log
        await db.email_log.create_index("created_at", expireAfterSeconds=60 * 60 * 24 * 90)
        # Unique unsubscribed email
        await db.unsubscribed_emails.create_index("email", unique=True)
        # Inbound emails — recent-first browsing
        await db.inbound_emails.create_index([("received_at", -1)])
        # Admin DB audit log — recent-first
        await db.admin_db_audit.create_index([("created_at", -1)])
        # Billing: one invoice per order; payouts recent-first per store
        await db.invoices.create_index("order_id", unique=True)
        await db.payouts.create_index([("store_id", 1), ("created_at", -1)])
        # OTP rate-limit window — requests expire after 1 hour
        await db.otp_requests.create_index("created_at", expireAfterSeconds=60 * 60)
        await db.otp_requests.create_index([("phone", 1), ("created_at", -1)])
        # Geo matching (B1): 2dsphere on the GeoJSON mirror of store lat/lng,
        # plus a backfill for stores created before the field existed.
        await db.stores.create_index([("location", "2dsphere")])
        from app.services.geo_service import sync_missing_store_locations
        await sync_missing_store_locations(db)
        print("[startup] DB indexes ensured")
    except Exception as e:
        print(f"[startup] Index ensure skipped: {e}")
    yield
    await close_mongo_connection()


app = FastAPI(
    title="WashingBells API",
    description="Backend API for the WashingBells laundry app — India",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=True,  # Default — keeps trailing-slash redirect
)

# CORS — browser callers are the admin console and marketing site only; the
# mobile apps are not subject to CORS. Localhost entries cover local dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://admin.washingbells.com",
        "https://washingbells.com",
        "https://www.washingbells.com",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8081",
        "http://localhost:19006",
    ],
    allow_origin_regex=r"http://192\.168\.\d{1,3}\.\d{1,3}:(3000|8081|19006)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(addresses.router, prefix="/api/v1")
app.include_router(services.router, prefix="/api/v1")
app.include_router(cart.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(banners.router, prefix="/api/v1")
app.include_router(testimonials.router, prefix="/api/v1")
app.include_router(stores.router, prefix="/api/v1")
app.include_router(referrals.router, prefix="/api/v1")
app.include_router(coupons.router, prefix="/api/v1")
app.include_router(wallet.router, prefix="/api/v1")
app.include_router(delivery.router, prefix="/api/v1")
app.include_router(store_ops.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
app.include_router(terms.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(email_admin.router, prefix="/api/v1")
app.include_router(email_public.router, prefix="/api/v1")
app.include_router(inbox.router, prefix="/api/v1")
app.include_router(admin_db.router, prefix="/api/v1")
app.include_router(items.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "app": "WashingBells API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}
