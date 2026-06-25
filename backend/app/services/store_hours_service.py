"""Store hours, slot generation, and order-time validation.

Store schema additions:
  store.operating_hours = {
    "mon": {"open": "09:00", "close": "21:00", "closed": False},
    "tue": {...}, ... "sun": {"closed": True}
  }
  store.slot_capacity_per_hour = 6   # optional cap, default 6

Holiday closures live in their own collection so they can be queried cheaply:
  store_closures = { _id, store_id, date: "YYYY-MM-DD", reason, created_at }

Migration of legacy stores: if a store doc has `opening_time`/`closing_time`
flat fields but no `operating_hours`, we seed Mon-Sat using those values and
mark Sunday closed. The migration runs on demand (admin endpoint or first
call to ensure_hours).
"""

from datetime import datetime, timedelta, timezone, date as date_cls
from typing import Optional
from bson import ObjectId

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

DEFAULT_HOURS = {
    "mon": {"open": "09:00", "close": "21:00", "closed": False},
    "tue": {"open": "09:00", "close": "21:00", "closed": False},
    "wed": {"open": "09:00", "close": "21:00", "closed": False},
    "thu": {"open": "09:00", "close": "21:00", "closed": False},
    "fri": {"open": "09:00", "close": "21:00", "closed": False},
    "sat": {"open": "09:00", "close": "21:00", "closed": False},
    "sun": {"open": "09:00", "close": "21:00", "closed": True},
}

DEFAULT_SLOT_CAPACITY_PER_HOUR = 6
SLOT_DURATION_MINUTES = 60


def _parse_time(s: str) -> tuple[int, int]:
    """'HH:MM' -> (hour, minute). Returns (0,0) on parse failure."""
    try:
        h, m = s.split(":")
        return int(h), int(m)
    except Exception:
        return 0, 0


def _day_key(d: date_cls) -> str:
    return DAYS[d.weekday()]


async def ensure_hours(db, store: dict) -> dict:
    """Returns store with operating_hours present. If missing, migrates from
    flat opening_time/closing_time fields and persists. Idempotent.
    """
    if store.get("operating_hours"):
        return store
    open_t = store.get("opening_time") or "09:00"
    close_t = store.get("closing_time") or "21:00"
    hours = {}
    for d in DAYS:
        if d == "sun":
            hours[d] = {"open": open_t, "close": close_t, "closed": True}
        else:
            hours[d] = {"open": open_t, "close": close_t, "closed": False}
    await db.stores.update_one(
        {"_id": store["_id"]},
        {"$set": {"operating_hours": hours, "hours_migrated_at": datetime.now(timezone.utc)}},
    )
    store["operating_hours"] = hours
    return store


async def migrate_all_stores(db) -> int:
    """Migrate every store doc to weekly hours. Returns number migrated."""
    n = 0
    cursor = db.stores.find({"operating_hours": {"$exists": False}})
    async for s in cursor:
        await ensure_hours(db, s)
        n += 1
    return n


async def is_store_closed_on(db, store_id: str, day: date_cls) -> tuple[bool, Optional[str]]:
    """Check the store_closures collection for a holiday override.
    Returns (closed, reason_or_none).
    """
    iso = day.isoformat()
    doc = await db.store_closures.find_one({"store_id": store_id, "date": iso})
    if doc:
        return True, doc.get("reason", "Closed")
    return False, None


def _generate_hour_slots(open_str: str, close_str: str) -> list[dict]:
    """Returns slots like [{'slot': '09:00 - 10:00', 'start': '09:00', 'end': '10:00'}, ...]"""
    oh, om = _parse_time(open_str)
    ch, cm = _parse_time(close_str)
    start_minutes = oh * 60 + om
    end_minutes = ch * 60 + cm
    if end_minutes <= start_minutes:
        return []
    slots = []
    cur = start_minutes
    while cur + SLOT_DURATION_MINUTES <= end_minutes:
        s_h, s_m = divmod(cur, 60)
        e_h, e_m = divmod(cur + SLOT_DURATION_MINUTES, 60)
        slots.append({
            "start": f"{s_h:02d}:{s_m:02d}",
            "end": f"{e_h:02d}:{e_m:02d}",
            "slot": f"{s_h:02d}:{s_m:02d} - {e_h:02d}:{e_m:02d}",
        })
        cur += SLOT_DURATION_MINUTES
    return slots


async def get_available_slots(db, store: dict, target_date: date_cls) -> dict:
    """Return the slot list for a given date along with availability metadata.

    Response shape:
      {
        "date": "YYYY-MM-DD",
        "day_of_week": "mon",
        "closed": bool,
        "closed_reason": "Holiday" | None,
        "open": "09:00", "close": "21:00",
        "slots": [
          {"slot": "09:00 - 10:00", "start": "...", "end": "...",
           "available": True, "booked": 2, "capacity": 6},
        ],
        "capacity_per_hour": 6,
      }
    """
    store = await ensure_hours(db, store)
    closed_today, reason = await is_store_closed_on(db, str(store["_id"]), target_date)
    day = _day_key(target_date)
    hours = store["operating_hours"].get(day, {})
    closed_for_day = bool(hours.get("closed", False))

    if closed_today or closed_for_day:
        return {
            "date": target_date.isoformat(),
            "day_of_week": day,
            "closed": True,
            "closed_reason": reason or ("Closed on " + day.upper()),
            "open": hours.get("open", "09:00"),
            "close": hours.get("close", "21:00"),
            "slots": [],
            "capacity_per_hour": store.get("slot_capacity_per_hour", DEFAULT_SLOT_CAPACITY_PER_HOUR),
        }

    raw_slots = _generate_hour_slots(hours.get("open", "09:00"), hours.get("close", "21:00"))
    capacity = store.get("slot_capacity_per_hour", DEFAULT_SLOT_CAPACITY_PER_HOUR)

    # Count existing bookings for this store on this date so we can grey out
    # full slots. Match on stored pickup_slot.date == YYYY-MM-DD; ignores
    # cancelled/rejected.
    iso_date = target_date.isoformat()
    cursor = db.orders.find({
        "store_id": str(store["_id"]),
        "status": {"$nin": ["cancelled", "rejected"]},
        "pickup_slot.date": iso_date,
    }, {"pickup_slot.slot": 1})
    booking_counts: dict[str, int] = {}
    async for o in cursor:
        s = (o.get("pickup_slot") or {}).get("slot")
        if s:
            booking_counts[s] = booking_counts.get(s, 0) + 1

    # If target_date == today, mark past slots as unavailable. Store hours are
    # local (IST), so compare against IST "now", not UTC, otherwise today's
    # past slots are mis-marked by the +5:30 offset.
    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    today = now_ist.date()
    minutes_now = now_ist.hour * 60 + now_ist.minute if target_date == today else -1

    slots_out = []
    for s in raw_slots:
        s_h, s_m = _parse_time(s["start"])
        slot_start_minutes = s_h * 60 + s_m
        booked = booking_counts.get(s["slot"], 0)
        is_past = minutes_now != -1 and slot_start_minutes <= minutes_now
        available = booked < capacity and not is_past
        slots_out.append({
            **s,
            "available": available,
            "booked": booked,
            "capacity": capacity,
            "is_past": is_past,
        })

    return {
        "date": target_date.isoformat(),
        "day_of_week": day,
        "closed": False,
        "closed_reason": None,
        "open": hours["open"],
        "close": hours["close"],
        "slots": slots_out,
        "capacity_per_hour": capacity,
    }


async def validate_slot_against_hours(db, store_id: str, slot_payload: dict) -> tuple[bool, Optional[str]]:
    """Used by POST /orders to reject a slot that doesn't match store hours.
    `slot_payload` is the customer-submitted {"date": "YYYY-MM-DD", "slot": "09:00 - 10:00"}.

    Returns (ok, error_or_none). Lenient for legacy stores without
    operating_hours — assumes open (those stores get a banner anyway).
    """
    if not slot_payload or not slot_payload.get("date") or not slot_payload.get("slot"):
        return False, "Slot date and time required"
    try:
        target = datetime.strptime(slot_payload["date"], "%Y-%m-%d").date()
    except Exception:
        return False, "Slot date must be YYYY-MM-DD"

    store = await db.stores.find_one({"_id": ObjectId(store_id)})
    if not store:
        return True, None  # store_id may be picked later; don't block here
    if not store.get("operating_hours"):
        return True, None  # legacy, treat as open

    slot_data = await get_available_slots(db, store, target)
    if slot_data["closed"]:
        return False, f"Store closed on {target.isoformat()} ({slot_data['closed_reason']})"
    match = next((s for s in slot_data["slots"] if s["slot"] == slot_payload["slot"]), None)
    if not match:
        return False, f"Slot '{slot_payload['slot']}' is outside store hours"
    if match.get("is_past"):
        return False, "Selected slot is in the past"
    if not match["available"]:
        return False, "Selected slot is fully booked"
    return True, None
