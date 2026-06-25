# 15 — Known Issues & Roadmap

## Blockers before production launch

| Item | Status | Action |
|------|--------|--------|
| **MSG91 OTP delivery** | Blocked on DLT | Fill the OTP template's DLT Template ID on the MSG91 dashboard (sender `SMSIND`). Until then OTP returns success but doesn't deliver; password login is the workaround. |
| **Razorpay live keys** | Test only | Complete Razorpay activation/KYC; swap test keys in `dev.yaml` for live keys. |
| **Secrets in repo** | Committed dev/test secrets | Rotate everything, move to env/secrets manager (doc 11). |
| **EAS / push prod** | Placeholder project IDs | Real EAS projectIds + APNs/FCM credentials for builds + push. |
| **Email deliverability** | Single-sender | Domain auth (SPF/DKIM); configure Inbound Parse on the real domain. |

## Known technical debt

- **Photo storage**: pickup proofs + KYC are stored as **base64 in the
  `uploads` Mongo collection**. This bloats the DB and won't scale. Migrate to
  S3/Cloudinary and store URLs. *(Highest-priority scaling item.)*
- **No automated tests**: there is no test suite (backend or frontend). All
  verification in this project was manual / scripted. Adding pytest for the
  backend (especially the order state machine + money math) is strongly advised.
- **No CI/CD**.
- **CORS is `*`** on the backend — tighten for prod.
- **Three separate mobile codebases**: shared concepts (auth store, theme,
  reschedule modal) are duplicated per app. A change must be made in each.
  Consider a shared package / monorepo tooling later.
- **Razorpay payment-failure UX**: the order is placed first and payment is
  best-effort; a failed/cancelled online payment leaves an unpaid order the
  customer can pay later from Orders. Confirm this matches desired business flow.
- **Rider stuck `on_trip`** edge case: if a store never confirms receipt, the
  pickup trip stays open and the rider stays `on_trip`. Admin status override is
  the manual escape hatch; consider a timeout/auto-complete.

## Nice-to-haves / roadmap ideas

- Customer order ratings/reviews (fields exist on the order: `customer_rating`,
  `customer_review`) — wire up the UI.
- Real-time updates via WebSockets/SSE instead of polling (admin tracking,
  order status, store new-order alerts all poll every 10–30s today).
- In-app delivery time estimates / ETA on the live map.
- Store payout settlement flow (the numbers are computed — `store_payout`,
  `pending_payout` — but there's no payout disbursement integration).
- Split rider fee into pickup + drop legs if you want to pay per leg.
- Internationalisation / multi-city expansion (currently India/IST assumptions
  are baked into slot logic).

## What IS built (so you know the baseline)

Auth (OTP + password), order creation + nearest-store assignment, garment tag
PDFs, full pickup→store→delivery trip flow with OTP handoffs, coupons, wallet,
referrals, Razorpay payments (test), reschedule (all apps), store hours +
slots, rider live tracking (admin map), T&C per role, push notifications,
SendGrid email (in/out) with templates + unsubscribe + inbox, admin panel
(orders/riders/stores/customers/coupons/banners/email/terms/photos/DB browser),
and a one-command dev launcher.
