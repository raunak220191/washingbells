from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import (
    AddressCreate,
    AddressUpdate,
    AddressResponse,
)

router = APIRouter(prefix="/addresses", tags=["Addresses"])


def _format_address(addr: dict) -> AddressResponse:
    return AddressResponse(
        id=str(addr["_id"]),
        user_id=str(addr["user_id"]),
        label=addr["label"],
        full_address=addr["full_address"],
        landmark=addr.get("landmark"),
        latitude=addr["latitude"],
        longitude=addr["longitude"],
        city=addr["city"],
        state=addr["state"],
        pincode=addr["pincode"],
        is_default=addr.get("is_default", False),
        created_at=addr["created_at"],
    )


@router.get("", response_model=list[AddressResponse])
async def list_addresses(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.addresses.find({"user_id": current_user["user_id"]})
    addresses = await cursor.to_list(length=20)
    return [_format_address(a) for a in addresses]


@router.post("", response_model=AddressResponse, status_code=201)
async def create_address(
    address: AddressCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()

    # If this is set as default, unset all other defaults
    if address.is_default:
        await db.addresses.update_many(
            {"user_id": current_user["user_id"]},
            {"$set": {"is_default": False}},
        )

    # If this is the user's first address, make it default
    count = await db.addresses.count_documents({"user_id": current_user["user_id"]})
    if count == 0:
        address.is_default = True

    doc = {
        **address.model_dump(),
        "user_id": current_user["user_id"],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.addresses.insert_one(doc)
    created = await db.addresses.find_one({"_id": result.inserted_id})
    return _format_address(created)


@router.put("/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: str,
    update: AddressUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    existing = await db.addresses.find_one(
        {"_id": ObjectId(address_id), "user_id": current_user["user_id"]}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if update_data.get("is_default"):
        await db.addresses.update_many(
            {"user_id": current_user["user_id"]},
            {"$set": {"is_default": False}},
        )

    await db.addresses.update_one(
        {"_id": ObjectId(address_id)},
        {"$set": update_data},
    )
    updated = await db.addresses.find_one({"_id": ObjectId(address_id)})
    return _format_address(updated)


@router.delete("/{address_id}", status_code=204)
async def delete_address(
    address_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    result = await db.addresses.delete_one(
        {"_id": ObjectId(address_id), "user_id": current_user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Address not found")
