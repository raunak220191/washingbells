"""Order fee configuration (D10).

Order totals used hardcoded constants (delivery ₹40, free over ₹299) while
the admin Settings page edited `platform_settings` that nothing read. This
service is now the single source: global settings with optional per-store
overrides (store doc fields `delivery_fee_override`,
`free_delivery_threshold_override`, `platform_fee_override`).

`platform_fee` is a flat per-order customer-facing fee (₹, default 0 —
enable from admin Settings). `platform_commission_pct` (store payout split)
is unchanged and stays in the payout flow.
"""

from bson import ObjectId

DEFAULTS = {
    "delivery_fee": 40.0,
    "free_delivery_threshold": 299.0,
    "platform_fee": 0.0,
}


async def get_fee_config(db, store_id: str | None = None) -> dict:
    """Effective fees: platform_settings over DEFAULTS, then store overrides."""
    settings = await db.platform_settings.find_one({}) or {}
    cfg = {
        "delivery_fee": float(settings.get("delivery_fee", DEFAULTS["delivery_fee"])),
        "free_delivery_threshold": float(settings.get("free_delivery_threshold", DEFAULTS["free_delivery_threshold"])),
        "platform_fee": float(settings.get("platform_fee", DEFAULTS["platform_fee"])),
    }
    if store_id:
        try:
            store = await db.stores.find_one({"_id": ObjectId(store_id)}, {
                "delivery_fee_override": 1,
                "free_delivery_threshold_override": 1,
                "platform_fee_override": 1,
            })
        except Exception:
            store = None
        if store:
            for key in ("delivery_fee", "free_delivery_threshold", "platform_fee"):
                ov = store.get(f"{key}_override")
                if ov is not None and ov != "":
                    try:
                        cfg[key] = float(ov)
                    except (TypeError, ValueError):
                        pass
    return cfg


def delivery_fee_for(cfg: dict, subtotal: float) -> float:
    return 0.0 if subtotal >= cfg["free_delivery_threshold"] else cfg["delivery_fee"]
