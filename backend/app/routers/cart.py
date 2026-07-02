from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import CartItemAdd, CartItemUpdate, CartResponse, CartItemResponse

router = APIRouter(prefix="/cart", tags=["Cart"])


async def _build_cart_response(db, user_id: str) -> CartResponse:
    """Build a full cart response with resolved service/item names and prices."""
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart or not cart.get("items"):
        return CartResponse(items=[], total_items=0, total_amount=0.0)

    # Cache services to avoid repeated lookups
    service_cache = {}
    response_items = []

    for cart_item in cart["items"]:
        sid = cart_item["service_id"]
        if sid not in service_cache:
            svc = await db.services.find_one({"_id": ObjectId(sid)})
            if svc:
                service_cache[sid] = svc

        svc = service_cache.get(sid)
        if not svc:
            continue

        # Find the matching item within the service
        matched_item = None
        for item in svc.get("items", []):
            item_id = str(item.get("_id", ""))
            if item_id == cart_item["item_id"]:
                matched_item = item
                break

        if not matched_item:
            continue

        qty = cart_item["quantity"]
        price = matched_item["price"]
        response_items.append(
            CartItemResponse(
                service_id=sid,
                service_name=svc["name"],
                item_id=cart_item["item_id"],
                item_name=matched_item["name"],
                price=price,
                quantity=qty,
                subtotal=round(price * qty, 2),
                category=matched_item.get("category", "unisex"),
                unit=svc.get("pricing_unit", "piece"),
            )
        )

    total_items = sum(i.quantity for i in response_items)
    total_amount = round(sum(i.subtotal for i in response_items), 2)

    return CartResponse(
        items=response_items,
        total_items=total_items,
        total_amount=total_amount,
    )


@router.get("", response_model=CartResponse)
async def get_cart(current_user: dict = Depends(get_current_user)):
    db = get_db()
    return await _build_cart_response(db, current_user["user_id"])


@router.post("/items", response_model=CartResponse)
async def add_to_cart(
    item: CartItemAdd,
    current_user: dict = Depends(get_current_user),
):
    """Add item to cart. If item already exists, increment quantity."""
    db = get_db()
    user_id = current_user["user_id"]

    # Validate service and item exist
    service = await db.services.find_one({"_id": ObjectId(item.service_id)})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    item_exists = any(
        str(i.get("_id", "")) == item.item_id for i in service.get("items", [])
    )
    if not item_exists:
        raise HTTPException(status_code=404, detail="Item not found in this service")

    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        # Create new cart
        await db.carts.insert_one(
            {
                "user_id": user_id,
                "items": [
                    {
                        "service_id": item.service_id,
                        "item_id": item.item_id,
                        "quantity": item.quantity,
                    }
                ],
            }
        )
    else:
        # Check if item already in cart
        existing_idx = None
        for idx, ci in enumerate(cart.get("items", [])):
            if ci["service_id"] == item.service_id and ci["item_id"] == item.item_id:
                existing_idx = idx
                break

        if existing_idx is not None:
            # Update quantity
            await db.carts.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        f"items.{existing_idx}.quantity": cart["items"][existing_idx][
                            "quantity"
                        ]
                        + item.quantity
                    }
                },
            )
        else:
            # Add new item to cart
            await db.carts.update_one(
                {"user_id": user_id},
                {
                    "$push": {
                        "items": {
                            "service_id": item.service_id,
                            "item_id": item.item_id,
                            "quantity": item.quantity,
                        }
                    }
                },
            )

    return await _build_cart_response(db, user_id)


@router.put("/items/{service_id}/{item_id}", response_model=CartResponse)
async def update_cart_item(
    service_id: str,
    item_id: str,
    update: CartItemUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update item quantity. Set quantity to 0 to remove."""
    db = get_db()
    user_id = current_user["user_id"]
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart is empty")

    item_found = False
    for idx, ci in enumerate(cart.get("items", [])):
        if ci["service_id"] == service_id and ci["item_id"] == item_id:
            item_found = True
            if update.quantity == 0:
                # Remove item
                await db.carts.update_one(
                    {"user_id": user_id},
                    {"$pull": {"items": {"service_id": service_id, "item_id": item_id}}},
                )
            else:
                # Update quantity
                await db.carts.update_one(
                    {"user_id": user_id},
                    {"$set": {f"items.{idx}.quantity": update.quantity}},
                )
            break

    if not item_found:
        raise HTTPException(status_code=404, detail="Item not in cart")

    return await _build_cart_response(db, user_id)


@router.delete("", status_code=204)
async def clear_cart(current_user: dict = Depends(get_current_user)):
    """Clear all items from cart."""
    db = get_db()
    await db.carts.delete_one({"user_id": current_user["user_id"]})
