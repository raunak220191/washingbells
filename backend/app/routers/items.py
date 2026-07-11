"""Item images — exactly one image per catalog item, managed by store/rider.

Follows the existing media pattern (base64 in the `uploads` collection,
see upload.py). Images are processed server-side with Pillow: resized to
max 800x800, converted to WebP, EXIF stripped. Re-upload replaces the old
object; there is never more than one image per item.
"""

import base64
import io
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from PIL import Image, ImageOps

from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter(prefix="/items", tags=["Item Images"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DIMENSION = 800
WEBP_QUALITY = 80


def _require_store_or_rider(current_user: dict):
    """Store partners and riders manage item photos (admin allowed too)."""
    if current_user.get("role") not in ("store_owner", "rider", "admin"):
        raise HTTPException(status_code=403, detail="Store or rider access required")


def _process_image(raw: bytes) -> bytes:
    """Resize to max 800x800, convert to WebP, strip EXIF (orientation applied first)."""
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)  # bake in rotation before EXIF is dropped
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=WEBP_QUALITY)  # no exif kwarg -> stripped
        return out.getvalue()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupt image file")


async def _find_item_service(db, item_id: str) -> dict:
    svc = await db.services.find_one({"items._id": item_id})
    if not svc:
        raise HTTPException(status_code=404, detail="Item not found")
    return svc


async def _delete_existing_upload(db, item: dict):
    """Replace semantics: remove the old uploads doc referenced by image_url."""
    url = item.get("image_url") or ""
    # image_url shape: /api/v1/upload/{id}/raw
    parts = [p for p in url.split("/") if p]
    if "upload" in parts:
        upload_id = parts[parts.index("upload") + 1]
        try:
            await db.uploads.delete_one({"_id": ObjectId(upload_id)})
        except Exception:
            pass  # stale/foreign reference — nothing to clean up


@router.post("/{item_id}/image")
async def upload_item_image(item_id: str, file: UploadFile,
                            current_user: dict = Depends(get_current_user)):
    """Set THE image for an item (multipart). Re-upload overwrites the previous one."""
    _require_store_or_rider(current_user)
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG or WebP images are allowed")
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image larger than 5 MB")
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    db = get_db()
    svc = await _find_item_service(db, item_id)
    item = next(i for i in svc["items"] if str(i.get("_id")) == item_id)

    webp = _process_image(raw)
    now = datetime.now(timezone.utc)
    data_uri = "data:image/webp;base64," + base64.b64encode(webp).decode()
    doc = {
        "filename": f"item_{item_id}_{int(now.timestamp())}.webp",
        "user_id": current_user["user_id"],
        "context": "item_image",
        "item_id": item_id,
        "content_type": "image/webp",
        "data": data_uri,
        "size": len(webp),
        "created_at": now,
    }
    result = await db.uploads.insert_one(doc)
    image_url = f"/api/v1/upload/{result.inserted_id}/raw"

    await _delete_existing_upload(db, item)
    updated_by = {"role": current_user.get("role"), "user_id": current_user["user_id"]}
    await db.services.update_one(
        {"_id": svc["_id"], "items._id": item_id},
        {"$set": {
            "items.$.image_url": image_url,
            "items.$.image_updated_at": now,
            "items.$.image_updated_by": updated_by,
        }},
    )
    return {"item_id": item_id, "image_url": image_url, "size": len(webp)}


@router.delete("/{item_id}/image")
async def delete_item_image(item_id: str,
                            current_user: dict = Depends(get_current_user)):
    """Remove an item's image (back to placeholder state)."""
    _require_store_or_rider(current_user)
    db = get_db()
    svc = await _find_item_service(db, item_id)
    item = next(i for i in svc["items"] if str(i.get("_id")) == item_id)

    await _delete_existing_upload(db, item)
    now = datetime.now(timezone.utc)
    updated_by = {"role": current_user.get("role"), "user_id": current_user["user_id"]}
    await db.services.update_one(
        {"_id": svc["_id"], "items._id": item_id},
        {"$set": {
            "items.$.image_url": None,
            "items.$.image_updated_at": now,
            "items.$.image_updated_by": updated_by,
        }},
    )
    return {"item_id": item_id, "image_url": None}
