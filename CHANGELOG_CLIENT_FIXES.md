# Client-Feedback Fix Log (WASHINGBELLS_FIX_AND_DEPLOY.md)

Maps each bug ID from the client backlog to its fix, test, and commit.
Status legend: ✅ fixed-and-verified · ☑ verified-already-fixed (locked with a
test this round) · NEEDS-REPRO (could not reproduce; notes attached).

## Phase A — Order & Payment Loop

| ID | Status | Fix / Evidence | Test | Commits |
|----|--------|----------------|------|---------|
| A1 | ☑ | Order placement works via the app's exact API sequence (nearby store → API slot → order) for BOTH payment modes. Root causes were fixed in earlier commits (`_safe_oid` 400s instead of opaque 500s; percent-coupon crash a206310/ad090e5). Verified end-to-end against the live local stack. | `backend/tests/test_a1_order_placement.py` | earlier + 4ed2eb0 |
| A2 | ☑ | Razorpay order create/verify works against the real test-mode API; bad signatures rejected and marked `failed`; retry UI already present (`Pay Now` on order details, checkout WebView has failure/dismiss handlers). Live-mode smoke still requires a real card — flagged for release checklist. | `test_a3_payment_gating.py` (signature paths) | earlier |
| A3 | ✅ | Online orders with an amount due are now created `status=pending_payment`; store queue, store push and ALL emails hold until payment confirms. New `POST /payments/webhook` verifies `X-Razorpay-Signature` (HMAC-SHA256, `RAZORPAY_WEBHOOK_SECRET`) as the authoritative signal; `/payments/verify` remains the fast path. Both funnel into one idempotent confirm (`confirmation_notified_at` guard → fan-out fires exactly once). Wallet-covered (₹0 due) orders are marked `paid` instead of dangling. Customer app shows a "Payment Pending / Complete Payment" state. | `backend/tests/test_a3_payment_gating.py` | 4ed2eb0 |
| A4 | ✅ | COD orders visible to the store immediately (API) + push at creation; store app poll fallback tightened 20–30s → 10s to meet the ≤10s SLA. Accept → `confirmed`, reject → refund path verified. Store accept no longer stalls ~16s on inline email (see perf note). | `backend/tests/test_a4_store_accept_reject.py` | 0cd557e, b00004d |
| A5 | ✅ | Root cause of "coupons not visible": `CouponResponse.max_discount` was a required float, so ONE uncapped percent coupon (D8 shape) 500'd `/coupons/me` and the app showed nothing. Now Optional. Checkout gained a tap-to-apply available-coupons row; manual entry + inline error already existed. Admin-created orders accept `coupon_code` via shared `evaluate_coupon` (locked with test). | `backend/tests/test_a5_coupons.py` | 8aebb79 |
| A6 | ☑ | GST invoice PDF renders for accepted customer orders AND store walk-ins, idempotent re-render, 403 for other users. App-side open/print/share (expo-print / expo-sharing) was fixed earlier (expo-file-system legacy entry). | `backend/tests/test_a6_invoice_pdf.py` | 28c9eff |
| A7 | ✅ | Checkout now has a distinct, editable "Estimated Delivery" picker (default pickup+2 days); the app no longer submits delivery = copy of pickup. Backend derives pickup+48h for orders from old builds still sending identical slots. Order details gained a paid/unpaid/COD-due badge + delivery address; both slots are tappable to edit (RescheduleModal `target` prop; delivery editable until out-for-delivery). | `backend/tests/test_a7_delivery_slot.py` | 000daf9 |
| A8 | ☑ | Wallet top-up flow (earlier commit ad090e5) verified end to end: server-side amount from stored intent, genuine-signature verify credits once (idempotent), forged signature → 400. Client wiring present in `stores/walletStore.js`. | `backend/tests/test_a8_wallet_topup.py` | 6fdd226 |

### Cross-cutting fixes found during Phase A

- **perf (b00004d):** the synchronous SendGrid SDK was awaited inline — every
  email held uvicorn's event loop ~16s, freezing ALL concurrent requests
  (checkout, store accept). Now sent via worker thread + fire-and-forget
  `dispatch()`; backend suite runtime 182s → 3.6s. This was very likely a major
  contributor to the "order placement hangs/fails" reports.
- **security (50b5673):** `backend/dev.yaml` (live Twilio + Razorpay secrets)
  was tracked in git. Untracked + gitignored (`*.p8`, service-account JSONs
  too). ⚠️ The secrets remain in git history — **rotate the Twilio auth token
  and Razorpay key secret before any repo hand-off** (added to release
  checklist).
- New backend test harness: `backend/tests/` (pytest, runs against the live
  local stack per project rule "test backends through the API"). 21 tests.

## Phase B — Store Discovery & Location

| ID | Status | Fix / Evidence | Test | Commits |
|----|--------|----------------|------|---------|
| B1 | ✅ | Root cause of "30 km radius but no store found": `/stores/nearby` filtered by a CLIENT-supplied radius (app hardcoded 15 km) and ignored the store's admin-configured `geo_radius_km`. Now: GeoJSON `location` mirror + 2dsphere index (startup-created, idempotent backfill), `$geoNear` + per-store radius match, nearest first; location synced on every store create/update/pin; app stops sending radius (old builds' param accepted & ignored). Boundary-tested at ~28 km (match) / ~33 km (no match) for a 30 km store. | `test_b1_geo_matching.py` | 624ca48 |
| B2 | ✅ | Nobody types lat/long. Found & killed the customer app's silent `latitude \|\| 30.9` fallback that pinned every no-GPS address to **Ludhiana** (then store matching "found nothing" — feeds B1's repro). Chain now: GPS → on-device geocode of the typed address → server-side Google Geocoding (active when `GOOGLE_MAPS_API_KEY` set; India-biased) → null + explained empty-state (B4). Admin rider-delivery orders geocode server-side before falling back to store area. | `test_b2_address_geocode.py` | 264e3c1 |
| B3 | ✅ | Pin-location crash: **no Google Maps API key configured in any app's Android config** — react-native-maps crashes natively when MapView mounts without one. Expo Go bundles its own key, which is why dev tests (May) worked but the distributed APK crashed. MapView now guarded behind a maps-key check with a GPS capture fallback; permanent fix = add the client's Maps key to `app.json → android.config.googleMaps.apiKey` (release-checklist item; needs client's Google Cloud console). Maestro regression flow queued for the device pass. | guard in `store/lib/maps.js` | f1979ce |
| B4 | ✅ | Empty store lists now explain why: address unlocatable (Edit Address CTA), network failure (Retry CTA), or genuinely unserved area. Root causes of the silent empties were B1's client-radius filter and B2's Ludhiana default; `/stores/nearby` also gained a linear-scan fallback if the geo index is ever unavailable. | covered by B1/B2 tests + web smoke | 624ca48, 264e3c1 |

## Phase C — OTP / Auth

| ID | Status | Fix / Evidence | Test | Commits |
|----|--------|----------------|------|---------|
| C1 | ✅ root-caused; ⚠️ needs client's Twilio creds to complete | Hard evidence from prod (gcloud): the Cloud Run service has **no Twilio env/secrets at all** — only stale MSG91 config from the replaced provider — and runs `OTP_DEV_BYPASS=true`. Consequence: **no OTP SMS has ever been sent from production** (matches "worked May 21" — that was a different setup), and any phone number could be logged into with the hardcoded `123456` (account-takeover hole). The bypass now also requires `DEBUG=true`, so prod can never accept `123456` again. The Twilio auth token stored locally returns **401** (rotated/revoked) — a fresh token from the client's Twilio console is required. Deployment steps (see release checklist): create secrets `twilio-account-sid/auth-token/verify-service-sid`, bind to Cloud Run, set `OTP_DEV_BYPASS=false`, verify India SMS geo-permission in the Twilio console. All three apps' release builds correctly point at `api.washingbells.com` (checked). Twilio API responses were already logged; unconfigured state now logs loudly. | `test_c1_otp_auth.py` | 203eb0e |
| C2 | ✅ | Two findings: (a) with C1, testers never received a code, so every verify attempt bounced them back — fixed via C1; (b) the root auth guard redirected authenticated users out of EVERY auth screen including **onboarding**, so a new user's registration (name/email) was skipped/never completed. Onboarding is now exempt from the redirect. Login/verify/resend errors were already surfaced as alerts, not silent loops. | `test_c1_otp_auth.py` (new + existing user paths) | 203eb0e |

## Phase D — Super Admin Panel

| ID | Status | Fix / Evidence | Test | Commits |
|----|--------|----------------|------|---------|
| D1 | ✅ | Order bill editing already existed (EditBillModal → PUT /admin/orders/{id}/bill with item CRUD, coupon+manual discount, audit trail). Added the missing piece: **Reschedule** modal editing pickup AND delivery slots via PUT /orders/{id}/reschedule. | existing bill tests + `test_d_admin_crud.py` | 2855cca, 3551f55 |
| D2 | ✅ | Admin address CRUD endpoints (add/edit/delete, geocode fallback, audited) + editable addresses UI in the customer drawer. | `test_d_admin_crud.py` | 2855cca, 3551f55 |
| D3 | ☑ | Rider profile edit existed (PUT /admin/riders/{id} + UI). | — | earlier |
| D4 | ✅ | Store edit had radius/hours/coords; now also settlement + per-store fee overrides (see D9/D10). | `test_d_admin_crud.py` | 2855cca, 3551f55 |
| D5 | ✅ | PUT /admin/users/{id}/credentials — bcrypt reset + `token_version` bump; access AND refresh tokens minted earlier are rejected (true forced re-login). Reset Password modal on customers/riders/stores. | `test_d_admin_crud.py::test_d5*` | 2855cca, 3551f55 |
| D6 | ☑ | Standalone "Add customer" existed (POST /admin/customers + modal). | — | earlier |
| D7 | ☑ | Coupon selector in admin order create existed; verified same evaluate_coupon as the app. | `test_a5_coupons.py` | earlier |
| D8 | ☑ | Optional max_discount existed end-to-end; the A5 fix made uncapped coupons LISTABLE too. | `test_a5_coupons.py` | 8aebb79 |
| D9 | ✅ | New `upi_id` + bank fields editable from admin store profile AND settable by the store owner; payouts screen shows UPI. Razorpay Route mapping documented in release notes (per-store settlement would use linked accounts — needs Razorpay dashboard setup). | `test_d_admin_crud.py` | 2855cca, 3551f55 |
| D10 | ✅ | **Settings now actually drive money**: global delivery fee / free-delivery threshold / new flat platform fee + per-store overrides applied in every order path (customer, admin, walk-in, bill edit). Previously the Settings page edited values nothing read (hardcoded ₹40/₹299). Checkout fetches /stores/fees-config for display; platform fee is its own bill line. Empty override clears to global. | `test_d_admin_crud.py::test_d10*` | 2855cca, 3551f55 |
| D11 | ✅ | Notification-center writes added for new_order, payment_received, order_cancelled (accept/reject existed); bell badge + list already present. | `test_d_admin_crud.py::test_d11*` | 2855cca |
| D12 | ✅ | Admin order create accepts real pickup + delivery slots (UI pickers; delivery defaults to pickup+2 days, never a copy). | `test_d_admin_crud.py::test_d12*` | 2855cca, 3551f55 |
| D13 | ✅ | Timing (pay now / on delivery) and instrument (UPI/card/cash) are separate selectors in BOTH admin (existed) and customer checkout (new); backend stores both fields, timing wins over legacy payment_method. | `test_d13_payment_timing.py` | 36130b6 |

## Phase E — Store App

| ID | Status | Fix / Evidence | Test | Commits |
|----|--------|----------------|------|---------|
| E1 | ☑ | Walk-in bill generation verified end-to-end (order → GST PDF); the Android failure was the expo-file-system legacy-entry bug fixed earlier + the SendGrid event-loop freeze (b00004d) that made bill requests time out. | `test_a6_invoice_pdf.py` | earlier, b00004d |
| E2 | ☑ | Print-tag/GST taps: handlers are try/caught and the tags/GST PDFs verified via API; the crash matched the pre-legacy-fix builds. Device regression pass queued in the verification matrix. | `test_e_store_billing.py::test_e2*` | 131beab |
| E3 | ✅ | Deterministic order everywhere + admin-controllable `sort_order` on services and items (PUT accepts it). | `test_e_store_billing.py::test_e3*` | 131beab |
| E4 | ✅ | Walk-in bill: direct numeric entry (not just steppers), Bill card with per-line edit/remove, same item freely re-added. | UI (babel-verified; device pass queued) | c156bf1 |
| E5 | ✅ | Coupon + percent-discount fields in store billing; server validates coupon with the shared evaluator; discount capped at subtotal. | `test_e_store_billing.py::test_e5*` | 131beab, c156bf1 |
| E6 | ✅ | Fractional weights to 0.1 kg across customer cart (float quantities; whole-number rule kept for piece services), walk-in (0.5 steps + decimal input), admin orders (already float), pricing = weight × rate. Basket badge counts a kg line as one item. | `test_e_store_billing.py::test_e6*` | 131beab, c156bf1 |
| E7 | ✅ decided+implemented | Deliberate choice documented: phone-first layout retained; on iPad the dashboard/orders/billing render as a centered 700pt column (TabletContainer) instead of a stretched phone screen. Full adaptive layouts deferred. | — | c156bf1 |

### Platform caveats (per cross-platform rule)

Backend fixes are platform-independent. Client-side changes (checkout delivery
picker, coupon row, payment badge, confirming states, store-app 10s poll) are
React Native shared code — no platform-specific branches were touched. Verified
rendering on the web target (react-native-web smoke); native Android/iOS visual
verification queued for the Maestro/device pass in the Verification Matrix
before deploy (Section 3 of the task file).
