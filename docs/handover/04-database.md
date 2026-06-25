# 04 — Database (MongoDB)

Database name: **`washingbells`** (configurable via `DATABASE_NAME`).
Driver: **Motor** (async). There is no ORM — documents are plain dicts.

> Tip: the admin panel has a built-in Mongo browser at `/dashboard` → DB
> (backed by `admin_db.py`) for whitelisted collections, with an audit log.

## Collections

| Collection | Holds | Key fields |
|------------|-------|-----------|
| `users` | every account (all roles) | `phone` (unique), `role`, `name`, `email`, `password_hash`, role-specific fields |
| `addresses` | customer delivery addresses | `user_id`, `latitude`, `longitude`, `is_default` |
| `services` | laundry service catalogue | `slug` (unique), `name`, `items[]` (id, name, price) |
| `carts` | one open cart per customer | `user_id`, `items[]` |
| `orders` | the central entity | see below |
| `trips` | rider pickup/delivery legs | `order_id`, `rider_id`, `trip_type`, `status`, `pickup_done` |
| `stores` | partner stores | `vendor_code`, `owner_user_id`, geo, `operating_hours`, `status`, `approved`, `is_open` |
| `store_closures` | holiday closures | `store_id`, `date`, `reason` |
| `coupons` | promo codes | `code`, `type` (percent/flat), `value`, `min_order`, `max_discount`, `valid_to`, limits |
| `wallets` / `wallet_txns` | WB wallet | `user_id`, `balance` / ledger entries |
| `referrals` | referral links | referrer/referee, code |
| `terms_conditions` | versioned T&C | `role`, `version`, `content_html`, `active` |
| `notifications` | admin notification feed | type, message, read |
| `uploads` | base64 images (KYC, pickup proof) | `data` (base64), `context`, `order_id` |
| `promo_banners` / `testimonials` | marketing content | — |
| `platform_settings` | admin-editable settings | singleton-ish |
| `email_settings` / `email_log` | email events + audit | `email_log` has 90-day TTL |
| `unsubscribed_emails` / `inbound_emails` | email suppression + inbox | unique `email` / Inbound Parse |
| `admin_db_audit` | audit of raw DB edits | actor, collection, before/after |

## The `orders` document (most important)

Created in `orders.py::create_order`. Core fields:

```jsonc
{
  "order_number": "WB-2026-XXXX",
  "user_id": "<customer _id>",
  "store_id": "<store _id or null>",       // nearest-open store (haversine)
  "items": [ { service_name, item_name, price, quantity, subtotal } ],
  "address": { id, label, full_address, latitude, longitude, city },
  "pickup_slot":   { "date": "YYYY-MM-DD", "slot": "09:00 - 10:00" },
  "delivery_slot": { "date": "YYYY-MM-DD", "slot": "10:00 - 11:00" },
  "status": "placed",                       // see doc 07 for the full state machine
  "payment_method": "online | cod",
  "payment_status": "pending | paid | cod_pending | failed",
  "status_timeline": [ { status, timestamp, note } ],
  "garment_tags": [ ... ],                   // generated at creation; PDF via /orders/{id}/tags/pdf

  // rider/trip linkage
  "pickup_rider_id": null, "delivery_rider_id": null,
  "pickup_otp": null, "pickup_otp_verified": false,
  "store_received_otp": null, "store_received_otp_verified": false,
  "delivery_otp": null, "delivery_otp_verified": false,

  // money
  "subtotal": 0, "delivery_fee": 0, "discount": 0,
  "wallet_applied": 0, "total_amount": 0,
  "coupon_code": null,
  "store_payout": 0, "platform_fee": 0,
  "rider_pickup_fee": 0, "rider_delivery_fee": 0,
  "razorpay_order_id": null, "razorpay_payment_id": null,

  "created_at": "...", "updated_at": "..."
}
```

## The `trips` document

A pickup and a delivery are **separate trips** linked to an order.

```jsonc
{
  "order_id": "<order _id>",
  "order_number": "WB-...",
  "rider_id": "<user _id>",
  "trip_type": "pickup | delivery",
  "status": "assigned | accepted | started | completed | cancelled",
  "pickup_done": false,        // pickup trips: customer-pickup OTP verified, now en route to store
  "fee": 40.0,
  "pickup_address": "...", "drop_address": "...",
  "photos_uploaded": false,
  "created_at": "...", "completed_at": null
}
```

> A **pickup trip stays active** (`status: started`, `pickup_done: true`) after
> the customer hands over the clothes, and is only **completed + the rider paid**
> when the store confirms receipt. See doc 07.

## The `users` document (role-dependent)

```jsonc
{
  "phone": "+919xxxxxxxxx",      // unique, E.164
  "role": "customer | rider | store_owner | admin",
  "name": "...", "email": null,
  "password_hash": "<bcrypt>",   // for password login
  "expo_push_token": null, "push_platform": null,

  // rider only
  "rider_status": "offline | online | on_trip",
  "rider_approved": false, "documents_uploaded": false,
  "vehicle_type": "bike", "vehicle_number": "...",
  "current_location": { "lat": .., "lng": .. },
  "location_updated_at": "...",
  "total_trips": 0, "total_earnings": 0.0,

  // store owner only
  "store_id": "<store _id>",

  // T&C
  "terms_accepted_version": 0, "terms_accepted_role": "...",

  "created_at": "...", "updated_at": "..."
}
```

## Indexes (created on startup — `database.py` + `main.py`)

- `users.phone` — unique
- `orders.user_id`, `orders.status`
- `addresses.user_id`
- `services.slug` — unique
- `email_log.created_at` — TTL 90 days
- `unsubscribed_emails.email` — unique
- `inbound_emails.received_at` desc, `admin_db_audit.created_at` desc

## Seeded data

`scripts/seed_dummy_data.py` upserts 50 customers / 20 riders / 10 stores /
1 admin, all tagged `is_dummy: true`. To remove: delete `users` and `stores`
where `is_dummy: true`. See doc 13.
