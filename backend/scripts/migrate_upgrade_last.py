"""Idempotent migration for the upgrade_last release (run once before deploy).

Safe to re-run any number of times. Does three things:

1. Ensures the 2dsphere index on addresses.location (startup also ensures it;
   running here makes the migration self-contained for prod).
2. Backfills a GeoJSON `location` Point onto existing addresses that have
   latitude/longitude but no `location` (new writes set it inline).
3. Backfills `line_id` + `tentative_qty` onto kg lines of ACTIVE orders so
   in-flight orders can be weighed by rider/store immediately after rollout.
   (Delivered/cancelled orders are left untouched.)

Run:  cd backend && ./venv/bin/python -m scripts.migrate_upgrade_last
Prod: run the same against the Atlas URI (MONGODB_URL env).
"""

import asyncio
import uuid

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings

ACTIVE_STATUSES = [
    "placed", "pending_payment", "confirmed", "rider_assigned_pickup",
    "picked_up", "at_store", "processing", "ready_for_delivery",
    "rider_assigned_delivery", "out_for_delivery",
]


async def migrate():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    # 1. index
    await db.addresses.create_index([("location", "2dsphere")])
    print("[1] addresses.location 2dsphere index ensured")

    # 2. address GeoJSON backfill
    fixed = 0
    async for addr in db.addresses.find({
        "latitude": {"$type": "number", "$ne": 0},
        "longitude": {"$type": "number", "$ne": 0},
        "location": {"$exists": False},
    }):
        await db.addresses.update_one({"_id": addr["_id"]}, {"$set": {
            "location": {"type": "Point",
                         "coordinates": [addr["longitude"], addr["latitude"]]},
        }})
        fixed += 1
    print(f"[2] addresses backfilled with GeoJSON location: {fixed}")

    # 3. kg-line weight fields on active orders
    touched = 0
    async for order in db.orders.find({"status": {"$in": ACTIVE_STATUSES}}):
        items = order.get("items", [])
        changed = False
        for line in items:
            if line.get("unit") != "kg":
                continue
            if not line.get("line_id"):
                line["line_id"] = uuid.uuid4().hex[:8]
                changed = True
            if line.get("tentative_qty") is None:
                line["tentative_qty"] = line.get("quantity")
                line.setdefault("actual_qty", None)
                line.setdefault("weighed_by", None)
                line.setdefault("weighed_at", None)
                changed = True
        if changed:
            await db.orders.update_one({"_id": order["_id"]}, {"$set": {"items": items}})
            touched += 1
    print(f"[3] active orders with kg lines backfilled: {touched}")

    client.close()
    print("migration complete")


if __name__ == "__main__":
    asyncio.run(migrate())
