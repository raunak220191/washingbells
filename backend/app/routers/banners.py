"""Promo Banners — admin-managed carousel content for the home screen."""

from fastapi import APIRouter
from app.core.database import get_db
from app.schemas.phase1_schemas import BannerResponse
from datetime import datetime, timezone

router = APIRouter(prefix="/banners", tags=["banners"])

SEED_BANNERS = [
    {
        "title": "Flat 30% Off on Dry Cleaning",
        "image_url": "/assets/Banner_add_1.png",
        "link_type": "service",
        "link_target": "dry-clean",
        "position": 1,
        "active": True,
        "valid_from": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "valid_to": datetime(2027, 12, 31, tzinfo=timezone.utc),
    },
    {
        "title": "Free Delivery on Orders Above ₹299",
        "image_url": "/assets/Banner_add_2.png",
        "link_type": "none",
        "link_target": None,
        "position": 2,
        "active": True,
        "valid_from": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "valid_to": datetime(2027, 12, 31, tzinfo=timezone.utc),
    },
    {
        "title": "Refer & Earn — Get 20% Off",
        "image_url": "/assets/Banner_add_3.png",
        "link_type": "external",
        "link_target": "referral",
        "position": 3,
        "active": True,
        "valid_from": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "valid_to": datetime(2027, 12, 31, tzinfo=timezone.utc),
    },
    {
        "title": "Premium Laundry — Per KG Pricing",
        "image_url": "/assets/Banner_add_4.png",
        "link_type": "service",
        "link_target": "premium-laundry",
        "position": 4,
        "active": True,
        "valid_from": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "valid_to": datetime(2027, 12, 31, tzinfo=timezone.utc),
    },
]


def _format_banner(b: dict) -> dict:
    return {
        "id": str(b["_id"]),
        "title": b["title"],
        "image_url": b["image_url"],
        "link_type": b.get("link_type", "none"),
        "link_target": b.get("link_target"),
        "position": b.get("position", 0),
    }


@router.get("", response_model=list[BannerResponse])
async def list_banners():
    """Get active promo banners for the home carousel."""
    db = get_db()
    now = datetime.now(timezone.utc)
    cursor = db.promo_banners.find({
        "active": True,
        "valid_from": {"$lte": now},
        "valid_to": {"$gte": now},
    }).sort("position", 1)
    banners = await cursor.to_list(length=20)

    if not banners:
        # Seed default banners
        for b in SEED_BANNERS:
            b["created_at"] = now
        await db.promo_banners.insert_many(SEED_BANNERS)
        banners = await db.promo_banners.find({"active": True}).sort("position", 1).to_list(length=20)

    return [_format_banner(b) for b in banners]
