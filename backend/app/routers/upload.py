"""Upload — Generic image upload endpoint. Stores base64 in MongoDB for now."""

import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("")
async def upload_image(body: dict, current_user: dict = Depends(get_current_user)):
    """Upload a base64 image. Returns a reference URL.
    Body: { "image": "data:image/jpeg;base64,..." , "context": "pickup_proof" }
    """
    image_data = body.get("image")
    if not image_data:
        raise HTTPException(status_code=400, detail="No image provided")

    context = body.get("context", "general")
    now = datetime.now(timezone.utc)

    # Generate a unique filename
    hash_val = hashlib.md5(image_data[:100].encode()).hexdigest()[:8]
    filename = f"{context}_{current_user['user_id']}_{hash_val}_{int(now.timestamp())}"

    db = get_db()
    doc = {
        "filename": filename,
        "user_id": current_user["user_id"],
        "context": context,
        "data": image_data,
        "size": len(image_data),
        "created_at": now,
    }
    result = await db.uploads.insert_one(doc)

    # Return a reference URL (in production, this would be a Cloudinary URL)
    ref_url = f"/api/v1/upload/{result.inserted_id}"

    return {
        "url": ref_url,
        "filename": filename,
        "size": len(image_data),
        "id": str(result.inserted_id),
    }


@router.get("/{upload_id}")
async def get_upload(upload_id: str):
    """Retrieve an uploaded image by ID. Returns the base64 data."""
    from bson import ObjectId
    db = get_db()
    try:
        doc = await db.uploads.find_one({"_id": ObjectId(upload_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Upload not found")
    if not doc:
        raise HTTPException(status_code=404, detail="Upload not found")
    return {
        "id": str(doc["_id"]),
        "filename": doc["filename"],
        "context": doc["context"],
        "data": doc["data"],
        "size": doc["size"],
        "created_at": doc["created_at"],
    }
