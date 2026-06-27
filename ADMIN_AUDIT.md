# ADMIN_AUDIT.md — Super-Admin panel fixes (branch `admin-fixes`)

Working branch: `admin-fixes`. Backend tested directly via `curl localhost:8000/api/v1/...`
per CLAUDE.md. Admin app on `:3000`, FastAPI on `:8000`, Mongo in Docker
(`washingbells-mongo`).

Admin login (for API tests):
`POST /api/v1/auth/login-password {"phone":"+919999999999","password":"Test@1234"}` → admin JWT.

---

## Bug 1 — OTP fails on Android ("Verify & Continue" stays disabled / OTP not accepted)

**Root cause.** The customer OTP screen (`app/(authenticate)/otp-verify.js`) renders six
`<TextInput maxLength={1}>` boxes and gates the button on `code.join("").length === 6`.
On Android, Gboard/Samsung SMS-autofill (and clipboard paste) deliver the *entire* 6-digit
code into a single box; `maxLength={1}` discarded all but the first digit, so the joined code
was length 1 → "Verify & Continue" stayed disabled and the OTP was never submitted.
The backend OTP flow itself is correct (verified below) — this was purely client input handling.

**Fix.**
- `handleChange` now strips non-digits and, when a multi-character value arrives
  (autofill/paste/fast type), distributes the digits across the boxes from the current index
  and moves focus to the next empty box (or blurs when complete).
- Box 0 now accepts up to `OTP_LENGTH` chars so an autofilled code lands intact before being
  distributed; boxes 1–5 stay `maxLength={1}`.
- Added `textContentType="oneTimeCode"` + `autoComplete="sms-otp"` + `importantForAutofill`
  on box 0 for native OTP autofill.
- Admin login OTP input (`admin/app/login/page.tsx`) hardened with `inputMode="numeric"` +
  `autoComplete="one-time-code"`.

**Verified.** Backend contract via curl (dev Twilio bypass, code `123456`):
- `POST /auth/send-otp` → `{"message":"OTP sent successfully"}`
- `POST /auth/verify-otp` valid `123456` → **200** + admin JWT
- `POST /auth/verify-otp` invalid `000000` → **400** `{"detail":"Invalid OTP."}`

**Commit.** `41b8c56`

---

## Bug 2 — Standalone "Add Customer" (no order required)

**Root cause.** Admin could only create a customer as a side effect of creating an
order (`/admin/orders/create` lookup-or-creates). No way to register a customer alone.

**Fix.** New `POST /api/v1/admin/customers` (phone required; optional name/email/app
password). 409 on duplicate phone, 400 on invalid phone. Order path unchanged.
Users page gets an "Add Customer" button + `AddCustomerModal`; on success refreshes
and opens the new customer's drawer.

**Verified (curl).** create→200(+id); lookup→found; duplicate→409; invalid phone→400.
**Commit.** `c439a77`

---

## Bug 3 — Coupons applicable at order time

**Root cause.** `/admin/orders/create` only accepted a manual `discount`; coupon_code
was always stored null. No coupon validation path for admin orders.

**Fix.** Extracted `evaluate_coupon()` in `coupons.py` as the single source of truth
(active/expiry/not-yet-active/usage-limit/per-user-limit/assigned-user/min-order).
Customer `/coupons/validate` now delegates to it. Admin create accepts `coupon_code`,
validates against the **customer's** history + subtotal, rejects 400 with the rule
message if invalid, applies the discount, stores coupon_code, and increments
`used_count` (mirrors the customer flow). Coupon + optional manual admin discount
combine, capped at subtotal. Order-create UI: coupon dropdown (active/non-expired/
non-exhausted) with live preview + min-order warning.

**Verified (curl).** 30% on 300 → 90 off/210 total; min-order → 400; invalid code →
400; used_count increments; coupon+manual combine (110 off/190 total).
**Commits.** `d538764` (backend), `2c1da4d` (UI)

---

## Bug 4 — Max Discount cap optional for percent coupons

**Root cause.** Coupon form defaulted Max Discount to "500" and sent `parseFloat("")`
→ null → `float(None)` → 500 error; field was effectively required.

**Fix.** Backend stores `max_discount=None` (no cap) when blank/0 and ignores it for
flat coupons. `_calculate_discount` only caps when a cap is configured. Promotions
form: blank default ("No cap" placeholder), shown only for percent coupons ("N/A for
flat" otherwise), only sent when set.

**Verified (curl).** percent 50% no-cap on 600 → 300 off; capped at 100 → 100 off;
stored max_discount = None vs 100.0.
**Commit.** `717f71b`

---

## Bug 5 — Payment TIMING separate from payment METHOD

**Root cause.** `payment_method` (cash/upi/online) conflated the instrument with
timing: status was "paid" for cash/upi and "pending" for online, with no way to mark
e.g. UPI-on-delivery.

**Fix.** Added `payment_timing` ("pay_now"|"pay_on_delivery") independent of
`payment_method` (cash|upi|card|online). `payment_status` follows TIMING
(pay_now→paid, else pending). Omitted timing falls back to the legacy mapping for
back-compat. Order-create UI: separate "Payment method" select + "Payment timing"
toggle.

**Verified (curl).** UPI+pay_on_delivery→pending; online+pay_now→paid; cash(no
timing)→paid; invalid timing→400.
**Commits.** `023d05e` (backend), `2c1da4d` (UI)

---

## Bug 8 — New Order quantity inputs can be cleared/edited

**Root cause.** Add-qty and per-line qty inputs ran `Math.max(1, Number(value))` on
every keystroke, so clearing the field snapped back to 1 — impossible to type a new
number.

**Fix.** Both inputs accept a free (possibly empty) value while typing and clamp to
≥1 on blur. Same item still merges into one line (qty increases); delete-line and
totals recompute. (Verified visually + math via order-create API tests above.)
**Commit.** `4f1d331`

---

## Bug 7 — Dashboard status split in lifecycle order, pie matches counts

**Root cause.** The pie showed only Active vs Delivered; the counts were computed
from the last 10 orders only and used a different breakdown — pie and counts
disagreed and weren't full-dataset.

**Fix.** `/admin/dashboard` now returns `status_breakdown` aggregated over ALL
orders, bucketed into lifecycle stages **in order**: Placed → Processing → Out for
Delivery → Delivered (+ Cancelled, + Other fallback). Dashboard pie and counts both
render from this one array with one color per status, so they always agree and
follow the lifecycle order.

**Verified (curl).** buckets sum to 33 = total_orders, ordered correctly.
**Commit.** `0614bc1`

---

## Bug 6 — Super-admin edit for user / rider / store (and created order)

**Root cause.** Only approve/toggle/override endpoints existed; no way to edit a
user, rider, or store profile, or a created order.

**Fix.** New super-admin-gated PUT endpoints:
- `PUT /admin/users/{id}` (name, email, phone — 409 on phone clash)
- `PUT /admin/riders/{id}` (name, email, phone, vehicle type/number, approval)
- `PUT /admin/stores/{id}` (name, address, city/state/pincode, phone, hours, geo, status)
- Created-order/bill edit: see Bug 9.
All validate, ignore unknown fields, and write a before/after audit entry
(`_audit_edit` → `admin_db_audit`). UI: reusable `EditEntityModal` wired into the
Users, Riders, and Stores detail drawers via an Edit button.

**Verified (curl).** user/rider/store edits persist; non-admin token → 403; phone
clash → 409. (Seeded store/rider edited during testing were restored.)
**Commits.** `0c8ac4e` (backend), `50f28df` (UI)

---

## Bug 9 — Edit a created order's bill (with invoice audit guardrail)

**Root cause.** No way to edit a created order's bill (items/qty/discount), and no
handling for the GST invoice when a bill changes.

**Invoice model (surfaced).** Invoices live in `db.invoices`, issued LAZILY on
first invoice-PDF fetch via `build_invoice_for_order`, which is **idempotent** — one
frozen invoice per order, numbered from an atomic per-store counter. There is **no**
existing revision mechanism and **no** bill-edit audit.

**Fix.** `PUT /admin/orders/{id}/bill` recomputes subtotal/delivery/discount/total
from the edited line items using the **same** rules as create (coupon validated
against the customer + new subtotal, optional manual discount, combined + capped),
and keeps coupon `used_count` honest when the coupon changes. Per the guardrail it
**never mutates an issued invoice**: every edit is written to `order.bill_revisions`
(before/after totals, actor, time, invoice_was_issued, invoice_number) and
`admin_db_audit`; if an invoice was already issued the order is flagged
`invoice_stale=true` and the response returns a warning to issue a revised
invoice/credit note. UI: `EditBillModal` from the order drawer (add/remove items,
edit qty/price, coupon + manual discount, live totals) — shows the warning on save.

**Verified (curl + DB).** recompute 340−40=300; empty bill→400; after issuing
INV-WB001-00002 (frozen at 300) a bill edit to 600 left the invoice **unchanged at
300**, set `invoice_stale=true`, and logged a 300→600 revision (invoice_was_issued
true).

**PROPOSED (not built) — invoice revision handling.** See "Proposals" section below.

**Commits.** `7ffd93a` (backend), `69b932f` (UI)

---

## Bug 10 — Dashboard UX polish (presentation only)

**Before/after.** Captured at 1280px and 390px (Playwright) — see
`scratchpad/dash-before-*.png` / `dash-after-*.png`.

**Root cause.** The pie used outside labels in a narrow 1/3 column, so labels
clipped ("ing: 14", "Placed:", "Cance", "r Delivery: 1"). Pie also didn't visually
reconcile with the counts.

**Fix (no business logic).** Pie → donut with the total order count centered, plus
a clean legend (color dot · label · count · %) that never clips and uses the same
per-status colors as the Order Status Counts bars, so the two panels match exactly.
Empty state ("No orders yet") retained. Verified responsive at desktop and narrow
widths; recent-orders table keeps `overflow-x-auto`; all grids stack cleanly.
**Commit.** `24e2ced`

---

## Operator conveniences (additive)

- **Search/filter — already present, verified.** Orders page: free-text search
  (order #, customer name, phone) + server-side status filter. Customers/Users page:
  search (name/phone/email/referral) + role filter. No change needed.
- **Loading/empty states — present.** Dashboard, orders, customers, riders, stores
  all render explicit loading and empty rows; dashboard pie has an empty state.
- **Add Customer** (Bug 2) and **profile/bill editing** (Bugs 6, 9) are the main new
  operator tools added this run.

## Proposals (NOT built — flagged per guardrails)

1. **Invoice revision handling (financial/GST — from Bug 9).** Today an issued
   invoice is frozen and a bill edit only records an audit trail + `invoice_stale`
   flag. Compliant next step: on a post-issue bill edit, issue a **revised tax
   invoice** (new number e.g. `…-R1`, header "REVISED INVOICE — supersedes <orig>",
   original marked `superseded_by`) for upward changes, or a **credit note** for
   downward changes, via `billing_service` + `invoice_pdf_service` + a revision
   counter. Left as a proposal to avoid silently changing GST/financial behavior.
2. **Bulk status update (touches order state).** A multi-select on the Orders table
   that calls the existing `override-status` per selected order (which already
   handles the delivered→payout math). Proposed rather than built because it changes
   order state at scale; should ship with a confirmation + per-order result summary
   and likely a dedicated audited bulk endpoint.
3. **Sidebar responsiveness (global).** `PageLayout` uses a fixed `ml-64` sidebar on
   all pages; on very narrow widths it eats horizontal space. A collapsible/drawer
   sidebar would help but is a shared-layout change beyond the dashboard scope.

## Guardrail check (verified via API)

- **Order totals.** Created orders compute `subtotal − discount (+delivery)`
  correctly; coupons applied per shared `evaluate_coupon` rules; coupon + manual
  discount combine and cap at subtotal. (Bugs 3/4/5/9 curl tests above.)
- **Payments.** `payment_status` derives from `payment_timing`, not the instrument.
- **Roles.** All new edit/bill endpoints are `_require_admin`; non-admin → 403.
  No existing role checks were changed.
- **Invoices.** Never silently mutated; issued invoice stayed frozen across a bill
  edit; edits are audited.
