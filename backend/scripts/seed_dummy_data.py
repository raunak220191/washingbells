"""
Seed dummy data for WashingBells — customers, riders and stores with passwords.

Creates accounts that can log in via phone + password (bypassing OTP, which is
unavailable while the MSG91 DLT template is being approved). Every dummy account
shares the same password (SHARED_PASSWORD below) and is marked with
`is_dummy: True` so it can be cleaned up later.

Idempotent: re-running upserts by phone / owner, so it won't create duplicates.

Run from the backend directory:
    python -m scripts.seed_dummy_data
"""

import asyncio
from datetime import datetime, timezone

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings

# ── Config ────────────────────────────────────────────────────────────────
SHARED_PASSWORD = "Test@1234"   # login password for every seeded account
N_CUSTOMERS = 50
N_RIDERS = 20
N_STORES = 10

# Phone ranges (all valid +91 + 10 digits, unique per role)
CUSTOMER_PREFIX = "90000000"    # +919000000001 .. +919000000050
RIDER_PREFIX = "91000000"       # +919100000001 .. +919100000020
STORE_PREFIX = "92000000"       # +919200000001 .. +919200000010
ADMIN_PHONE = "+919999999999"   # single admin so the admin panel is usable too


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def _phone(prefix: str, i: int) -> str:
    return f"+91{prefix}{i:02d}"


async def seed():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    now = datetime.now(timezone.utc)
    pw_hash = _hash(SHARED_PASSWORD)

    counts = {"customers": 0, "riders": 0, "stores": 0, "admin": 0}

    # ── Customers ─────────────────────────────────────────────────────────
    for i in range(1, N_CUSTOMERS + 1):
        phone = _phone(CUSTOMER_PREFIX, i)
        await db.users.update_one(
            {"phone": phone},
            {
                "$set": {
                    "name": f"Test Customer {i}",
                    "email": None,
                    "role": "customer",
                    "wallet_balance": 0.0,
                    "referral_code": f"WBC{i:04d}",
                    "password_hash": pw_hash,
                    "is_dummy": True,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        counts["customers"] += 1

    # ── Riders (pre-approved so they can take trips immediately) ──────────
    for i in range(1, N_RIDERS + 1):
        phone = _phone(RIDER_PREFIX, i)
        await db.users.update_one(
            {"phone": phone},
            {
                "$set": {
                    "name": f"Test Rider {i}",
                    "email": None,
                    "role": "rider",
                    "vehicle_type": "bike",
                    "vehicle_number": f"PB10DUM{i:04d}",
                    "rider_status": "offline",
                    "rider_approved": True,
                    "documents_uploaded": True,
                    "current_location": None,
                    "total_trips": 0,
                    "total_earnings": 0.0,
                    "password_hash": pw_hash,
                    "is_dummy": True,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        counts["riders"] += 1

    # ── Stores (owner user + store doc, active & approved) ────────────────
    for i in range(1, N_STORES + 1):
        phone = _phone(STORE_PREFIX, i)
        await db.users.update_one(
            {"phone": phone},
            {
                "$set": {
                    "name": f"Store Owner {i}",
                    "email": None,
                    "role": "store_owner",
                    "password_hash": pw_hash,
                    "is_dummy": True,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        owner = await db.users.find_one({"phone": phone})
        owner_id = str(owner["_id"])

        store_doc = {
            "vendor_code": f"WBD{i:03d}",
            "name": f"WashingBells Store {i}",
            "owner_user_id": owner_id,
            "address": f"Shop {i}, Sector {40 + i}, Gurgaon",
            "city": "Gurgaon",
            "state": "Haryana",
            "pincode": "122001",
            "phone": phone,
            "whatsapp": phone,
            "latitude": 28.4595 + i * 0.004,
            "longitude": 77.0266 + i * 0.004,
            "geo_radius_km": 15,
            "status": "active",
            "is_open": True,
            "opening_time": "09:00",
            "closing_time": "21:00",
            "total_earnings": 0.0,
            "pending_payout": 0.0,
            "approved": True,
            "profile_complete": True,
            "is_dummy": True,
            "updated_at": now,
        }
        await db.stores.update_one(
            {"owner_user_id": owner_id},
            {"$set": store_doc, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        store = await db.stores.find_one({"owner_user_id": owner_id})
        await db.users.update_one(
            {"_id": owner["_id"]}, {"$set": {"store_id": str(store["_id"])}}
        )
        counts["stores"] += 1

    # ── One admin account ─────────────────────────────────────────────────
    await db.users.update_one(
        {"phone": ADMIN_PHONE},
        {
            "$set": {
                "name": "Test Admin",
                "email": None,
                "role": "admin",
                "password_hash": pw_hash,
                "is_dummy": True,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    counts["admin"] = 1

    client.close()

    print("✅ Seed complete")
    print(f"   Customers : {counts['customers']}  ({_phone(CUSTOMER_PREFIX,1)} .. {_phone(CUSTOMER_PREFIX,N_CUSTOMERS)})")
    print(f"   Riders    : {counts['riders']}  ({_phone(RIDER_PREFIX,1)} .. {_phone(RIDER_PREFIX,N_RIDERS)})")
    print(f"   Stores    : {counts['stores']}  ({_phone(STORE_PREFIX,1)} .. {_phone(STORE_PREFIX,N_STORES)})")
    print(f"   Admin     : 1  ({ADMIN_PHONE})")
    print(f"   Password (all accounts): {SHARED_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
