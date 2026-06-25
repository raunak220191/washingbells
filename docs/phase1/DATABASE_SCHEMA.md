# WashingBells — MongoDB Collections Schema

## users
```json
{
  "_id": ObjectId,
  "phone": "+919876543210",
  "name": "Raunak Pandey",
  "email": "raunak@example.com",
  "role": "customer",           // customer | delivery | store_operator | admin
  "referral_code": "WB-RAUNAK", // unique, auto-generated
  "referred_by": "WB-FRIEND",   // referral code used at signup (null if none)
  "wallet_balance": 150.0,      // current WB wallet balance in ₹
  "avatar_url": null,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

## stores
```json
{
  "_id": ObjectId,
  "vendor_code": "WB001",       // auto-generated unique store code
  "name": "WashingBells Ludhiana Central",
  "address": "Shop 12, Model Town, Ludhiana",
  "city": "Ludhiana",
  "state": "Punjab",
  "pincode": "141002",
  "phone": "+911234567890",
  "whatsapp": "+911234567890",
  "latitude": 30.9010,
  "longitude": 75.8573,
  "geo_radius_km": 15,          // delivery radius
  "status": "active",           // active | disabled
  "operator_user_id": "...",    // linked store operator user
  "created_at": ISODate
}
```

## services
```json
{
  "_id": ObjectId,
  "name": "Wash & Fold",
  "slug": "wash-fold",
  "description": "Machine wash, tumble dry, and neatly folded",
  "icon": "layers-outline",
  "pricing_unit": "piece",      // piece | kg
  "service_type": "pickup_drop", // pickup_drop | at_home
  "items": [
    { "id": "wf_shirt", "name": "Shirt", "price": 25.0, "icon": "shirt" },
    { "id": "wf_tshirt", "name": "T-Shirt", "price": 20.0, "icon": "shirt" }
  ],
  "created_at": ISODate
}
```

## carts
```json
{
  "_id": ObjectId,
  "user_id": "...",
  "items": [
    {
      "service_id": "...",
      "service_name": "Wash & Fold",
      "item_id": "wf_shirt",
      "item_name": "Shirt",
      "price": 25.0,
      "quantity": 3,             // or weight in KG for kg-based services
      "pricing_unit": "piece"
    }
  ],
  "updated_at": ISODate
}
```

## orders
```json
{
  "_id": ObjectId,
  "order_number": "WB-2026-0042",
  "user_id": "...",
  "store_id": "...",
  "items": [
    {
      "service_name": "Wash & Fold",
      "item_name": "Shirt",
      "price": 25.0,
      "quantity": 3,
      "subtotal": 75.0,
      "pricing_unit": "piece"
    }
  ],
  "address": { /* snapshot of delivery address */ },
  "pickup_slot": { "date": "2026-05-20", "slot": "09:00-11:00" },
  "delivery_slot": { "date": "2026-05-22", "slot": "17:00-19:00" },
  "special_instructions": "Handle silk carefully",
  "payment_method": "online",   // online | cod
  "payment_status": "paid",     // pending | paid | cod_pending | refunded
  "status": "in_progress",      // placed | pickup_assigned | picked_up | in_progress | packed | delivery_assigned | delivered | cancelled
  "status_timeline": [
    { "status": "placed", "timestamp": ISODate, "note": "Order placed" },
    { "status": "picked_up", "timestamp": ISODate, "note": "Agent picked up", "agent_id": "..." }
  ],
  "garment_tags": [
    { "tag_code": "WB-2026-0042-001", "item_name": "Shirt", "status": "in_process" },
    { "tag_code": "WB-2026-0042-002", "item_name": "Shirt", "status": "in_process" },
    { "tag_code": "WB-2026-0042-003", "item_name": "Shirt", "status": "in_process" }
  ],
  "assigned_agent_id": null,
  "agent_info": null,           // { name, phone, avatar_url } snapshot
  "pickup_proof_images": [],    // Cloudinary URLs
  "delivery_proof_images": [],
  "subtotal": 75.0,
  "delivery_fee": 49.0,
  "discount": 0.0,
  "coupon_code": null,
  "wallet_applied": 0.0,
  "total_amount": 124.0,
  "razorpay_order_id": null,
  "razorpay_payment_id": null,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

## addresses
```json
{
  "_id": ObjectId,
  "user_id": "...",
  "label": "Home",
  "full_address": "123, Model Town, Ludhiana",
  "landmark": "Near City Center Mall",
  "latitude": 30.9010,
  "longitude": 75.8573,
  "city": "Ludhiana",
  "state": "Punjab",
  "pincode": "141002",
  "is_default": true,
  "created_at": ISODate
}
```

## coupons
```json
{
  "_id": ObjectId,
  "code": "DIWALI20",
  "name": "Diwali 20% Off",
  "type": "percent",            // percent | flat
  "value": 20,                  // 20% or ₹20
  "min_order": 199,             // minimum order to apply
  "max_discount": 100,          // max ₹ discount (for percent type)
  "valid_from": ISODate,
  "valid_to": ISODate,
  "store_ids": [],              // empty = all stores, or specific vendor codes
  "usage_limit": 1000,          // total uses allowed
  "used_count": 42,
  "per_user_limit": 1,
  "is_referral": false,         // true if auto-generated from referral
  "assigned_user_id": null,     // if this coupon is for a specific user
  "active": true,
  "created_at": ISODate
}
```

## referrals
```json
{
  "_id": ObjectId,
  "referrer_id": "...",         // user who shared the code
  "referred_id": "...",         // user who signed up
  "referrer_coupon_id": "...",  // 20% coupon created for referrer
  "referred_coupon_id": "...",  // 10% coupon created for new user
  "status": "completed",       // pending | completed
  "created_at": ISODate
}
```

## wallets (embedded in users or separate)
```json
{
  "_id": ObjectId,
  "user_id": "...",
  "balance": 150.0,
  "transactions": [
    {
      "id": "txn_001",
      "type": "credit",          // credit | debit
      "amount": 200.0,
      "reason": "top_up",        // top_up | cashback | order_payment | referral_bonus | refund
      "description": "Wallet top-up via Razorpay",
      "order_id": null,
      "razorpay_payment_id": "pay_xxx",
      "created_at": ISODate
    },
    {
      "id": "txn_002",
      "type": "debit",
      "amount": 50.0,
      "reason": "order_payment",
      "description": "Partial payment for order WB-2026-0042",
      "order_id": "...",
      "created_at": ISODate
    }
  ]
}
```

## promo_banners
```json
{
  "_id": ObjectId,
  "title": "Diwali Sale - 30% Off",
  "image_url": "https://res.cloudinary.com/...",
  "link_type": "service",       // service | coupon | external | none
  "link_target": "dry-clean",   // slug, coupon code, or URL
  "position": 1,                // display order
  "active": true,
  "valid_from": ISODate,
  "valid_to": ISODate,
  "created_at": ISODate
}
```

## testimonials
```json
{
  "_id": ObjectId,
  "customer_name": "Priya Sharma",
  "text": "Amazing service! My clothes have never been cleaner.",
  "rating": 5,
  "avatar_url": null,
  "city": "Ludhiana",
  "active": true,
  "created_at": ISODate
}
```
