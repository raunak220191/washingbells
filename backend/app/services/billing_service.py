"""Billing settings + GST computation.

A single admin-configurable GST rate is applied to invoices. GST is treated as
*inclusive* of the order total, so the live customer pricing / Razorpay flow is
never altered — invoices simply break the existing total into taxable value +
tax. Settings live in the `app_config` collection under _id="billing".
"""

from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import get_db

BILLING_CONFIG_ID = "billing"

DEFAULT_BILLING = {
    "gst_enabled": True,
    "gst_rate": 18.0,            # single configurable rate, %
    "invoice_prefix": "INV",
    "cgst_sgst_split": True,     # show CGST/SGST halves on the invoice (intra-state)
    "legal_name": "WashingBells",
    "invoice_footer": "Thank you for choosing WashingBells.",
}

ALLOWED_KEYS = set(DEFAULT_BILLING.keys())


async def get_billing_settings(db=None) -> dict:
    """Return billing settings merged over defaults (never raises)."""
    db = db if db is not None else get_db()
    doc = await db.app_config.find_one({"_id": BILLING_CONFIG_ID})
    settings = dict(DEFAULT_BILLING)
    if doc:
        for k in ALLOWED_KEYS:
            if k in doc and doc[k] is not None:
                settings[k] = doc[k]
    return settings


async def update_billing_settings(db, patch: dict) -> dict:
    """Upsert billing settings. Ignores unknown keys; coerces types."""
    update = {}
    for k, v in (patch or {}).items():
        if k not in ALLOWED_KEYS:
            continue
        if k == "gst_rate":
            try:
                v = max(0.0, float(v))
            except (TypeError, ValueError):
                continue
        elif k in ("gst_enabled", "cgst_sgst_split"):
            v = bool(v)
        update[k] = v
    if update:
        await db.app_config.update_one(
            {"_id": BILLING_CONFIG_ID}, {"$set": update}, upsert=True
        )
    return await get_billing_settings(db)


def compute_gst_inclusive(total: float, rate: float) -> dict:
    """Split a GST-inclusive total into taxable value + tax components.

    taxable = total / (1 + rate/100); tax = total - taxable.
    Returns cgst/sgst as equal halves (intra-state) for display.
    """
    total = round(float(total or 0), 2)
    rate = float(rate or 0)
    if rate <= 0:
        return {"taxable": total, "tax": 0.0, "cgst": 0.0, "sgst": 0.0, "rate": 0.0}
    taxable = round(total / (1 + rate / 100.0), 2)
    tax = round(total - taxable, 2)
    half = round(tax / 2.0, 2)
    return {
        "taxable": taxable,
        "tax": tax,
        "cgst": half,
        "sgst": round(tax - half, 2),  # absorb rounding remainder into sgst
        "rate": rate,
    }


async def build_invoice_for_order(db, order: dict) -> dict:
    """Return the invoice record for an order, creating it on first call.

    Idempotent — one invoice per order. The invoice number is allocated once
    via an atomic per-store counter (store.invoice_seq) and then reused.
    """
    order_id = str(order["_id"])
    existing = await db.invoices.find_one({"order_id": order_id})
    if existing:
        return existing

    settings = await get_billing_settings(db)

    # Store snapshot
    store = None
    if order.get("store_id"):
        store = await db.stores.find_one({"_id": ObjectId(order["store_id"])})
    vendor_code = (store or {}).get("vendor_code", "WB")
    store_snapshot = {
        "name": (store or {}).get("name", settings["legal_name"]),
        "vendor_code": vendor_code,
        "gstin": (store or {}).get("gst_number"),
        "address": (store or {}).get("address", ""),
        "city": (store or {}).get("city", ""),
        "phone": (store or {}).get("phone", ""),
    }

    # Customer snapshot
    customer = None
    try:
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
    except Exception:
        pass
    customer_snapshot = {
        "name": (customer or {}).get("name") or "Customer",
        "phone": (customer or {}).get("phone", ""),
    }

    total = round(float(order.get("total_amount", 0)), 2)
    gst_enabled = bool(settings["gst_enabled"])
    rate = settings["gst_rate"] if gst_enabled else 0.0
    gst = compute_gst_inclusive(total, rate)

    # Allocate a sequential per-store invoice number atomically.
    seq = 1
    if store is not None:
        updated = await db.stores.find_one_and_update(
            {"_id": store["_id"]},
            {"$inc": {"invoice_seq": 1}},
            return_document=True,
        )
        seq = (updated or {}).get("invoice_seq", 1)
    invoice_number = f"{settings['invoice_prefix']}-{vendor_code}-{seq:05d}"

    now = datetime.now(timezone.utc)
    record = {
        "order_id": order_id,
        "order_number": order.get("order_number", ""),
        "invoice_number": invoice_number,
        "store_id": order.get("store_id"),
        "store_snapshot": store_snapshot,
        "customer_snapshot": customer_snapshot,
        "items": order.get("items", []),
        "items_subtotal": round(float(order.get("subtotal", 0)), 2),
        "delivery_fee": round(float(order.get("delivery_fee", 0)), 2),
        "discount": round(float(order.get("discount", 0)), 2),
        "wallet_applied": round(float(order.get("wallet_applied", 0)), 2),
        "total": total,
        "gst_enabled": gst_enabled,
        "gst_rate": gst["rate"],
        "cgst_sgst_split": bool(settings["cgst_sgst_split"]),
        "taxable_amount": gst["taxable"],
        "tax_amount": gst["tax"],
        "cgst": gst["cgst"],
        "sgst": gst["sgst"],
        "payment_method": order.get("payment_method", "online"),
        "payment_status": order.get("payment_status", "pending"),
        "order_source": order.get("order_source", "app"),
        "footer": settings["invoice_footer"],
        "created_at": now,
    }
    result = await db.invoices.insert_one(record)
    record["_id"] = result.inserted_id
    return record
