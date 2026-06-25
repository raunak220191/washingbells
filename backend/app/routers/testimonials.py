"""Testimonials — customer reviews displayed on the home screen."""

from fastapi import APIRouter
from app.core.database import get_db
from app.schemas.phase1_schemas import TestimonialResponse
from datetime import datetime, timezone

router = APIRouter(prefix="/testimonials", tags=["testimonials"])

SEED_TESTIMONIALS = [
    {"customer_name": "Priya Sharma", "text": "Amazing service! My clothes have never been cleaner. The pickup was on time and delivery was perfect.", "rating": 5, "city": "Ludhiana"},
    {"customer_name": "Rahul Verma", "text": "Best laundry service in town. The dry cleaning quality is outstanding. Highly recommended!", "rating": 5, "city": "Chandigarh"},
    {"customer_name": "Anita Singh", "text": "I love the convenience. Schedule pickup from my phone and clothes come back fresh. 10/10!", "rating": 5, "city": "Amritsar"},
    {"customer_name": "Vikram Patel", "text": "Affordable prices and excellent quality. The sofa cleaning service transformed my living room.", "rating": 4, "city": "Jalandhar"},
    {"customer_name": "Neha Gupta", "text": "Super fast delivery and my delicates were handled with care. Will use again!", "rating": 5, "city": "Ludhiana"},
]


def _format_testimonial(t: dict) -> dict:
    return {
        "id": str(t["_id"]),
        "customer_name": t["customer_name"],
        "text": t["text"],
        "rating": t["rating"],
        "avatar_url": t.get("avatar_url"),
        "city": t.get("city"),
    }


@router.get("", response_model=list[TestimonialResponse])
async def list_testimonials():
    """Get active customer testimonials."""
    db = get_db()
    cursor = db.testimonials.find({"active": True}).limit(10)
    testimonials = await cursor.to_list(length=10)

    if not testimonials:
        now = datetime.now(timezone.utc)
        docs = [
            {**t, "active": True, "avatar_url": None, "created_at": now}
            for t in SEED_TESTIMONIALS
        ]
        await db.testimonials.insert_many(docs)
        testimonials = await db.testimonials.find({"active": True}).to_list(length=10)

    return [_format_testimonial(t) for t in testimonials]
