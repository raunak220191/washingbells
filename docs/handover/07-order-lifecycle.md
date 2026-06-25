# 07 — Order Lifecycle (the state machine)

This is the heart of the platform. An order moves through statuses driven by
actions in different apps. Two **trips** (pickup + delivery) carry the clothes.

## Order status flow

```
            customer                store accepts          store assigns
            places order            (store app)            pickup rider
  ┌──────┐ ───────────▶ ┌────────┐ ───────────▶ ┌──────────┐ ───────────▶ ┌──────────────────────┐
  │ cart │              │ placed │              │confirmed │              │ rider_assigned_pickup│
  └──────┘              └────────┘              └──────────┘              └──────────────────────┘
                            │                                                         │
                       store rejects                                       rider accepts + collects
                            ▼                                              (customer pickup OTP)
                        ┌────────┐                                                     ▼
                        │rejected│                                              ┌───────────┐
                        └────────┘                                              │ picked_up │
                                                                               └───────────┘
                                                                                     │
                                                              rider drops at store; store verifies
                                                              store-drop OTP  (store app "receive")
                                                                                     ▼
  ┌───────────┐  store delivers  ┌─────────────────┐  store books   ┌────────────┐  store        ┌──────────┐
  │ delivered │◀──(delivery OTP)─│ out_for_delivery│◀──rider────────│ready_for_  │◀──marks ready─│processing│◀── (at_store)
  └───────────┘                  └─────────────────┘                │ delivery   │               └──────────┘
                                                                    └────────────┘
```

Full status set: `placed → confirmed → rider_assigned_pickup → picked_up →
at_store → processing → ready_for_delivery → out_for_delivery → delivered`,
plus terminal `cancelled` / `rejected`.

## Who does what

| Transition | Triggered in | Endpoint |
|-----------|--------------|----------|
| → placed | Customer app (checkout) | `POST /orders` |
| placed → confirmed | Store app (accept) | `POST /store-ops/orders/{id}/accept` |
| placed → rejected | Store app (reject) | `POST /store-ops/orders/{id}/reject` |
| confirmed → (rider trip) | Store app (assign pickup rider) | `POST /store-ops/orders/{id}/assign-pickup-rider` |
| → rider_assigned_pickup | Rider app (accept trip) | `POST /delivery/{trip}/accept` |
| → picked_up | Rider app (customer pickup OTP) | `POST /delivery/{trip}/verify-pickup-otp` |
| picked_up → at_store | Store app (receive OTP) | `POST /store-ops/orders/{id}/receive` |
| at_store → processing | Store app | `POST /store-ops/orders/{id}/start-processing` |
| processing → ready_for_delivery | Store app | `POST /store-ops/orders/{id}/mark-ready` |
| ready → (delivery trip) | Store app (book rider) | `POST /store-ops/orders/{id}/book-rider` |
| → out_for_delivery | Rider app (accept delivery trip) | `POST /delivery/{trip}/accept` |
| → delivered | Rider app (delivery OTP) | `POST /delivery/{trip}/verify-delivery-otp` |

## The pickup → store-drop handoff (read this carefully)

This is the subtlest part of the flow:

1. Rider accepts the **pickup trip**, starts it, photographs the garments
   (`upload-photos`), then verifies the **customer's pickup OTP**
   (`verify-pickup-otp`).
2. At that point: order → `picked_up`; the backend **auto-issues a store-drop
   OTP** and returns it; the **trip stays active** (`pickup_done: true`, still
   `started`) — the rider is **not yet paid**.
3. The rider drives to the store and shows the **store-drop OTP** to the owner.
4. The store owner enters it (`receive`, available at status `picked_up`):
   order → `at_store`, the **pickup trip completes**, and the **rider is paid**
   (`total_trips +1`, `+₹40`, back `online`).

> Why: the rider's job isn't done until the clothes reach the store. If this
> were short-circuited at customer-pickup (an earlier bug), the store-drop leg
> had no screen and the handoff broke. See doc 16.

## Delivery

Symmetric and simpler: store books a delivery rider → rider accepts
(`out_for_delivery`) → rider delivers and verifies the customer's **delivery
OTP** → order `delivered`, store payout + platform fee computed, rider paid.

## Money at each step

- **At creation**: `subtotal`, `delivery_fee` (free over ₹299, else ₹40),
  `discount` (coupon), `wallet_applied`, `total_amount`.
- **At delivery**: `platform_fee = 20% of total`, `store_payout = total − fee`,
  rider delivery fee ₹40.
- **Rider pickup fee** ₹40 credited at **store receipt** (not at customer pickup).

## Store assignment

`create_order` assigns the **geographically nearest open store** to the pickup
address (haversine), preferring `is_open` stores and falling back to any active
store. A customer can also pre-select a store at checkout.

## Rescheduling

`PUT /orders/{id}/reschedule` lets the customer, assigned store, assigned
rider, or admin move the pickup/delivery slot — but **only before pickup**
(statuses `placed`/`confirmed`/`rider_assigned_pickup`). UI exists in all three
apps (doc 08).

## Slots & store hours

Slots come from `store_hours_service.py` based on each store's weekly
`operating_hours` and holiday `store_closures`. Slots on **today** mark past
ones unavailable using **IST** time. Capacity per hour limits bookings.
