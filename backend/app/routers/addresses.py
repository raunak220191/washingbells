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
        location_source=addr.get("location_source"),
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
    # B2: the customer is never asked for coordinates. GPS/on-device geocode
    # fills them when possible; otherwise geocode the typed address here.
    # (0 was the old client sentinel for "no GPS".)
    if not doc.get("latitude") or not doc.get("longitude"):
        from app.services.geocoding_service import geocode_address
        coords = await geocode_address(doc.get("full_address"), doc.get("city"),
                                       doc.get("state"), doc.get("pincode"))
        if coords:
            doc["latitude"], doc["longitude"] = coords
            doc["geocoded"] = True
            doc["location_source"] = doc.get("location_source") or "geocode"
        else:
            # TASK 3.2: NEW addresses require coordinates — without them the
            # geospatial store matching can never find a store. Old documents
            # stay nullable; the app prompts to pin them on next use.
            raise HTTPException(
                status_code=400,
                detail="We couldn't locate this address on the map. "
                       "Please pin the location to save it.")
    # GeoJSON Point ([lng, lat] — same convention as stores) for geo queries.
    doc["location"] = {"type": "Point",
                       "coordinates": [doc["longitude"], doc["latitude"]]}
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

    # B2: address text changed without fresh coordinates → re-geocode so the
    # pin follows the address instead of pointing at the old location.
    if update_data.get("full_address") and not update_data.get("latitude"):
        from app.services.geocoding_service import geocode_address
        coords = await geocode_address(
            update_data.get("full_address"),
            update_data.get("city", existing.get("city")),
            update_data.get("state", existing.get("state")),
            update_data.get("pincode", existing.get("pincode")),
        )
        if coords:
            update_data["latitude"], update_data["longitude"] = coords
            update_data["geocoded"] = True

    # Keep the GeoJSON point in sync whenever coordinates change (TASK 3.2).
    if update_data.get("latitude") is not None and update_data.get("longitude") is not None:
        update_data["location"] = {
            "type": "Point",
            "coordinates": [update_data["longitude"], update_data["latitude"]],
        }

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
