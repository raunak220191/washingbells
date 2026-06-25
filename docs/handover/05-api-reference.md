# 05 — API Reference

Base URL: `http://<host>:8000/api/v1`
Auth: `Authorization: Bearer <JWT>` on all but the public endpoints.
**Live interactive docs: `http://localhost:8000/docs`** (Swagger, always current).

This page is a static snapshot grouped by router. For request/response bodies,
use Swagger or read the handler in `backend/app/routers/<router>.py`.

## Auth (`/auth`) — public
```
POST /auth/send-otp              # send OTP to phone (MSG91 / dev-bypass 123456)
POST /auth/verify-otp            # verify OTP → JWT (creates customer if new)
POST /auth/login-password        # phone + password → JWT (existing users only)
POST /auth/set-password          # (auth) set/change own password
POST /auth/register-rider        # (auth) become a rider
POST /auth/register-store        # (auth) become a store owner + create store
```

## Users (`/users`)
```
GET  /users/me                   # profile
PUT  /users/me                   # update name/email/profile image
```

## Addresses (`/addresses`)
```
GET    /addresses
POST   /addresses
PUT    /addresses/{address_id}
DELETE /addresses/{address_id}
```

## Catalogue, cart, orders
```
GET  /services                   # public — service list
GET  /services/{slug}            # public — one service + items
GET  /cart
POST /cart/items
PUT  /cart/items/{service_id}/{item_id}
DELETE /cart

POST /orders                     # create order (assigns nearest open store)
GET  /orders                     # my orders
GET  /orders/{order_id}
GET  /orders/{order_id}/slots    # available pickup slots for the order's store (reschedule picker)
GET  /orders/{order_id}/tags/pdf # printable garment tags (PDF)
PUT  /orders/{order_id}/cancel
PUT  /orders/{order_id}/reschedule  # customer/store/rider/admin — move pickup/delivery slot
```

## Payments (`/payments`)
```
POST /payments/create            # create Razorpay order → {razorpay_order_id, key_id, amount}
POST /payments/verify            # verify signature → mark paid (idempotent)
```

## Coupons, wallet, referrals
```
GET  /coupons/me
POST /coupons/validate           # {code, cart_total} → {valid, discount_amount, message}
GET  /wallet
POST /wallet/topup
POST /wallet/topup/verify
GET  /referrals/me
POST /referrals/apply
```

## Stores (public) (`/stores`)
```
GET /stores
GET /stores/nearby               # ?lat&lng&radius
GET /stores/{store_id}
GET /stores/{store_id}/slots     # ?date=YYYY-MM-DD — pickup slots for a date
```

## Rider (`/delivery`)  — role: rider
```
GET  /delivery/me                # rider profile + stats
PUT  /delivery/status            # online | offline | on_trip
PUT  /delivery/location          # report GPS (powers the admin live map)
GET  /delivery/worklist          # active trips (assigned/accepted/started)
GET  /delivery/history           # completed/cancelled trips
GET  /delivery/earnings
POST /delivery/upload-documents  # KYC (DL, Aadhaar, selfie)
POST /delivery/{trip_id}/accept
POST /delivery/{trip_id}/start
POST /delivery/{trip_id}/upload-photos
POST /delivery/{trip_id}/generate-pickup-otp
POST /delivery/{trip_id}/verify-pickup-otp     # collect from customer; issues store-drop OTP
POST /delivery/{trip_id}/generate-store-drop-otp
POST /delivery/{trip_id}/generate-delivery-otp
POST /delivery/{trip_id}/verify-delivery-otp   # delivered → order complete
```

## Store (`/store-ops`) — role: store_owner
```
GET  /store-ops/my-store
PUT  /store-ops/toggle           # open/close
POST /store-ops/complete-profile
GET  /store-ops/orders
GET  /store-ops/orders/{order_id}
POST /store-ops/orders/{order_id}/accept
POST /store-ops/orders/{order_id}/reject
POST /store-ops/orders/{order_id}/assign-pickup-rider
POST /store-ops/orders/{order_id}/receive          # verify rider's store-drop OTP
POST /store-ops/orders/{order_id}/start-processing
PUT  /store-ops/orders/{order_id}/delivery-time
POST /store-ops/orders/{order_id}/mark-ready
POST /store-ops/orders/{order_id}/book-rider       # book a delivery rider
GET  /store-ops/orders/{order_id}/rider-location
GET  /store-ops/riders/nearby
GET  /store-ops/hours      |  PUT /store-ops/hours
POST /store-ops/closures   |  DELETE /store-ops/closures/{closure_id}
GET  /store-ops/earnings
```

## Terms (`/terms`)
```
GET  /terms/{role}               # public — latest active T&C for a role
GET  /terms/me/status            # (auth) needs_acceptance?
POST /terms/accept
GET  /terms/admin/list  | POST /terms/admin/publish | DELETE /terms/admin/{terms_id}
```

## Notifications, uploads, marketing
```
POST   /notifications/register-token
DELETE /notifications/unregister-token
POST   /notifications/test
POST   /upload                   # base64 → uploads collection
GET    /upload/{upload_id}
GET    /banners | GET /testimonials   # public marketing content
```

## Admin (`/admin`) — role: admin
```
GET  /admin/dashboard
GET  /admin/orders | GET /admin/orders/{id}
PUT  /admin/orders/{id}/override-status
POST /admin/orders/{id}/assign-store | .../assign-rider
GET  /admin/riders | GET /admin/riders/{id} | PUT /admin/riders/{id}/approve
GET  /admin/riders/online             # live tracking map data
GET  /admin/riders/{id}/location
POST /admin/riders/create
GET  /admin/stores | GET /admin/stores/{id} | GET /admin/stores/{id}/orders
PUT  /admin/stores/{id}/approve | .../toggle-open
POST /admin/stores/create
GET  /admin/users  | GET /admin/users/{id}
GET/POST/PUT/DELETE /admin/services[/{id}[/items[/{item_id}]]]
GET/POST/PUT/DELETE /admin/coupons[/{id}]
GET/POST/PUT/DELETE /admin/banners[/{id}]
GET/POST/DELETE     /admin/testimonials[/{id}]
GET  /admin/settings | PUT /admin/settings
GET  /admin/photos
GET  /admin/notifications | .../unread-count | POST .../mark-read
POST /admin/seed-admin

# Raw DB browser
GET  /admin/db/collections
GET/POST/PUT/DELETE /admin/db/{collection}[/{doc_id}]
GET  /admin/db/_audit/log

# Email
GET  /admin/email/config-status | events | events/{event} | log | recipients | unsubscribed
POST /admin/email/compose | seed | test
PUT  /admin/email/events/{event}
DELETE /admin/email/unsubscribed/{email}

# Inbox (SendGrid Inbound Parse)
POST /inbox/webhook              # public (shared-secret) — SendGrid posts here
GET  /inbox/list | .../unread-count | /inbox/{id}
PUT  /inbox/{id}/read | .../archive
DELETE /inbox/{id}
```

## Public email (`/email`)
```
GET /email/unsubscribe           # HMAC-signed token
GET /email/resubscribe
```
