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
