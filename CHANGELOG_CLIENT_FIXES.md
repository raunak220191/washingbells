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

### Platform caveats (per cross-platform rule)

Backend fixes are platform-independent. Client-side changes (checkout delivery
picker, coupon row, payment badge, confirming states, store-app 10s poll) are
React Native shared code — no platform-specific branches were touched. Verified
rendering on the web target (react-native-web smoke); native Android/iOS visual
verification queued for the Maestro/device pass in the Verification Matrix
before deploy (Section 3 of the task file).
