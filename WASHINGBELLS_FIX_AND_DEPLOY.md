# WashingBells — Client Feedback Remediation & Multi-Platform Deployment

> **Task file for Claude Code (Fable).** Work autonomously through every phase in order.
> Source: consolidated tester feedback from Hardik (client/store operator), April–July 2026.
> Repos: `customer-app` (React Native), `store-app` (React Native), `rider-app` (React Native), `super-admin` (Next.js), `backend` (FastAPI + MongoDB).
> Integrations: Twilio (OTP/SMS), Google Maps API, Razorpay (activated, live account).

---

## 0. Operating Rules

1. Read the root `CLAUDE.md` of each repo before touching code. Follow the existing shared design system and primitives — do NOT introduce new styling patterns.
2. Work phase by phase. Within a phase, fix P0s first, then P1s, then P2s.
3. Every fix must include: the code change, a test (unit or Maestro flow where applicable), and a line in `CHANGELOG_CLIENT_FIXES.md` mapping the fix to the bug ID below.
4. **Cross-platform rule (explicit client request):** every bug found on Android must be verified/fixed on iOS and vice-versa. Never close a bug as fixed on one platform only.
5. After each phase, run the full build + lint + test suite for the affected repo. Do not proceed to the next phase with failing checks.
6. Never commit secrets. All keys via `.env` / EAS secrets / Play Console & App Store Connect encrypted config.
7. If a bug cannot be reproduced, log it in `CHANGELOG_CLIENT_FIXES.md` as `NEEDS-REPRO` with what was checked — do not silently skip.

---

## 1. Client Concerns — Summary of What Hardik Cares About

The client's overall pattern of concern, in priority order:

1. **The core order → pay → fulfil loop is broken.** Orders can't be placed reliably, payments (Pay Now / Razorpay) fail, coupons don't apply, bills don't generate or open. This is blocking his ability to demo and onboard.
2. **Store discovery is broken.** Even with the store radius set to 30 km and a correct customer address, no store is picked up for home delivery. Lat/long is being demanded from the customer, which is unacceptable UX.
3. **Admin panel has no edit capability.** Orders, customer profiles, rider profiles, store profiles, credentials — nothing is editable after creation. He explicitly needs full CRUD as super admin.
4. **OTP is not working** (Twilio) on Android — this blocks all real-user testing.
5. **Business-config gaps:** platform fee, delivery fee, store UPI/settlement details, fractional weights, coupon behavior — the platform doesn't yet model how a real laundry business charges.
6. **Polish/layout defects** that make the product look unfinished: header/footer overlapping system UI, broken filters, iPad layout, app launch slowness on iOS, rider APK not installing.

---

## 2. Bug Backlog (Fix in This Order)

### PHASE A — P0: Order & Payment Loop (Customer app, both platforms + backend)

| ID | Bug | Detail / Repro | Acceptance criteria |
|----|-----|----------------|---------------------|
| A1 | Order placement fails | Neither Pay Now nor Pay on Delivery places an order (Android + iOS). Screenshots show both paths dead-ending. | Order placed successfully via both payment modes on both platforms; Maestro flow green. |
| A2 | Pay Now / Razorpay failing | "Payment failed" on Pay Now; sometimes no Proceed button appears at all. | Razorpay checkout opens, sandbox + live-mode smoke test passes, failure states show retry UI. |
| A3 | Order placed without payment | Client placed an order, never paid, still got confirmation email. | Order status must be `pending_payment` until Razorpay webhook confirms; email only after confirmed/COD. Verify webhook signature. |
| A4 | New COD order not appearing in Store app | Customer placed COD order; store app shows no incoming order to accept. | Store app receives new-order event (push + poll fallback) within 10s; accept/reject works end to end. |
| A5 | Coupons not visible / not applying | Coupon is active in admin, but: not listed in customer app, no manual code-entry field, apply fails. Same in admin order creation (only manual discount possible). | Active coupons listed at checkout; manual code entry field exists; validation errors surfaced; coupon usable in admin-created orders too. |
| A6 | Bill/invoice not generating, not opening, not sharing | Bill fails to generate for walk-in store orders (Android store app); on customer app bill won't open or download/share. | PDF invoice generates for every confirmed order (walk-in + online), opens in-app, and shares via native share sheet on both platforms. |
| A7 | Order details screen missing critical data | Missing: payment status (paid/unpaid), delivery address, estimated delivery time. Pickup and delivery date/time show identical values and can't be edited. | Order details shows payment status, address, pickup slot, distinct estimated delivery slot. Backend stores pickup and delivery as separate fields. |
| A8 | Wallet — cannot add money | Add-money flow dead. | Wallet top-up via Razorpay works or, if wallet is deferred, feature-flag it off cleanly (confirm with owner note in changelog). |

### PHASE B — P0: Store Discovery & Location (Customer app + backend)

| ID | Bug | Detail | Acceptance criteria |
|----|-----|--------|---------------------|
| B1 | Store not found despite 30 km radius | Store serviceable radius set to 30 km; customer address well within it; store still not matched. Likely geospatial query bug (radians/meters mixup, missing 2dsphere index, or lat/lng swapped). | Mongo `2dsphere` index verified; `$nearSphere` / `$geoWithin` query unit-tested with known coordinates; matching works at boundary distances. |
| B2 | Bill/order requires manual latitude & longitude for home delivery | Customer cannot be asked for lat/long. | Geocode the entered address server-side (Google Geocoding API) or capture from the map-pin picker; lat/long fields removed from user-facing forms. |
| B3 | Store app crashes on "pin location" (Android) | Tapping location-pin in store android app crashes the app. | Crash fixed (likely missing runtime location permission or null map ref); regression Maestro flow added. |
| B4 | Stores not showing in list | Store list empty in customer app in some sessions. | Root-cause (API error vs. geo filter) documented and fixed; empty-state UI with reason shown when genuinely no stores. |

### PHASE C — P0: OTP / Auth (all apps + backend)

| ID | Bug | Detail | Acceptance criteria |
|----|-----|--------|---------------------|
| C1 | OTP not working on Android | Twilio OTP not received / not verifying on Android builds. Was working in earlier manual tests (May 21). | OTP send + verify works on Android and iOS release builds; check Twilio geo-permissions for India, DLT sender ID, and that release build isn't pointing at a dev backend URL. Add backend logging around Twilio API responses. |
| C2 | Sign-in/registration loop | Tester was bounced back to the same screen on Continue (June 16). | Auth flow proceeds correctly for new and existing users; error toasts instead of silent loops. |

### PHASE D — P1: Super Admin Panel (Next.js)

| ID | Bug/Feature | Detail | Acceptance criteria |
|----|-------------|--------|---------------------|
| D1 | Cannot edit created order | Full order edit needed: items, quantities (add/remove/change count), pickup & delivery date/time, discounts. Video shows quantity edit/delete failing. | Order edit screen with item CRUD, slot edit, recalculated totals, audit-log entry per edit. |
| D2 | Cannot edit user/customer profile (incl. address) | | Full customer profile edit incl. addresses. |
| D3 | Cannot edit rider profile | | Full rider profile edit. |
| D4 | Cannot edit store profile | | Full store profile edit incl. serviceable radius, UPI details (see D9). |
| D5 | Cannot reset/edit store, customer, rider credentials | Admin needs id/password reset for all three roles. | Admin-triggered credential reset with hashed storage + forced re-login. |
| D6 | Cannot create customer without an order | Customer profile creation is only possible inside new-order flow. | Standalone "Add customer" screen. |
| D7 | Coupon not usable in admin-created orders | Only manual discount possible; created promotions invisible. | Coupon selector in admin order flow, same validation as app. |
| D8 | Coupon "max discount" should be optional | Flat percentage coupons shouldn't force a cap. | `maxDiscount` optional; absent = uncapped percentage. |
| D9 | No store UPI / settlement details | No place to store the UPI/bank details a store's online payments settle to; admin has no criteria for which UPI receives payment. | Store profile gains settlement section (UPI ID / bank); payments and payout reporting reference it. Document how Razorpay Route/linked accounts would map if per-store settlement is required. |
| D10 | No platform fee / delivery fee configuration | | Global + per-store overrides for platform fee & delivery fee, applied in order totals, editable in admin. |
| D11 | Notifications not reflected on admin | | Admin notification center: new orders, payments, cancellations; badge + list. |
| D12 | No expected delivery date/time input when admin creates order | | Delivery slot picker in admin order creation, distinct from pickup slot. |
| D13 | Payment mode UX confusing | "Pay now / pay on delivery" must be one selector, payment method (UPI/card/cash) a separate one. | Two distinct selectors in both admin and customer checkout. |

### PHASE E — P1: Store App

| ID | Bug | Detail | Acceptance criteria |
|----|-----|--------|---------------------|
| E1 | Walk-in bill generation failing (Android) | Generate-bill for walk-in customer errors out. | Walk-in order + bill works; Maestro flow. |
| E2 | Crash on "print tag" and "GST" in order history | Both taps crash app. | Fixed + regression test. |
| E3 | Items list not in expected sequence | Service/items ordering wrong. | Deterministic, admin-controllable sort order. |
| E4 | Cannot add same item again / edit or delete item quantity in bill | Video-documented. | Full line-item CRUD in bill/order builder, incl. numeric keyboard entry (not just +/- steppers). |
| E5 | No coupon/percentage-discount option in store billing | | Coupon + % discount fields in store bill flow. |
| E6 | Fractional weights unsupported | Wash&Iron / Wash&Fold only accept whole kg (1/2/3). Real orders are 1.3 kg, 2.2 kg — whole-kg rounding loses money. | Weight accepts decimals to 0.1 kg everywhere (store app, customer app, admin, pricing engine). Price = weight × rate, rounded per config. |
| E7 | iPad layout broken | Store app on iPad is a stretched phone layout. | Responsive/tablet layout for store app key screens (dashboard, orders, billing) or lock to phone-size presentation deliberately — decide, implement, document. |

### PHASE F — P1: Rider App

| ID | Bug | Detail | Acceptance criteria |
|----|-----|--------|---------------------|
| F1 | Rider app not installing on Android | "App not installed"-type failure from distributed link, even the newly mailed one. | Root-cause (signature mismatch between builds, ABI filters, or corrupted artifact). Rebuild with consistent keystore via EAS; verify installation on a physical device profile. |
| F2 | Rider demo video & distribution pending | Client asked for rider flow video + working link. | Produce Maestro-recorded rider happy-path video artifact + working internal-testing link. |

### PHASE G — P2: UI/UX Polish (Customer app, both platforms)

| ID | Bug | Detail | Acceptance criteria |
|----|-----|--------|---------------------|
| G1 | Bottom tabs collide with Android system navigation | App tab bar overlaps system gesture/nav bar ("home tabs mixing with app tabs"). | Safe-area insets (`react-native-safe-area-context`) applied to tab bar + all screens; verified on gesture-nav and 3-button-nav devices. |
| G2 | Header + search overlap status bar | Header/search sit under the notch/status bar. | SafeArea on headers both platforms. |
| G3 | Category filters broken | Filters wrong on Premium Laundry, Steam Iron, Shoe Cleaning screens. | Filters return correct subsets; chip state visually correct. |
| G4 | Email input renders white-on-white (Android customer app) | Typed email text invisible. | Explicit text/placeholder colors from design tokens on all inputs; audit every TextInput for missing color props. |
| G5 | iOS app slow/stuck at launch | Splash hang, long load times, "unlimited usage" quota message appearing despite config. | Profile startup; lazy-load heavy modules; fix quota/config message; cold start < 4s on baseline device. |
| G6 | "Sunday closed" showing incorrectly | Slot picker claims Sunday closed when it isn't. | Store working-hours model drives slot availability; admin-editable per store. |
| G7 | Pickup/delivery slot picker: same date+time shown, unselectable | Video-documented. | Delivery slots computed after pickup slot + turnaround; both selectable and distinct. |

---

## 3. Verification Matrix (run before any deploy)

For EACH of: **Customer Android, Customer iOS, Store Android, Store iOS/iPad, Rider Android, Rider iOS, Super Admin web**:

1. Register/login with OTP (real Twilio, test number).
2. Place order: home-delivery, coupon applied, Pay Now (Razorpay test mode) → verify webhook → bill opens & shares.
3. Place COD order → appears in Store app → accept → assign rider → rider sees job.
4. Walk-in order in Store app with fractional weight (e.g., 1.3 kg) → bill generates → print tag & GST don't crash.
5. Admin: edit that order (quantity change), edit customer address, edit store radius, view notification for the order.
6. Screenshot each state into `qa-artifacts/<date>/` and reference in the changelog.

Automate all of the above as Maestro flows where feasible; keep them in `e2e/` per repo and run in CI.

---

## 4. Deployment — All Platforms & Channels

Execute after all P0s + P1s are green in the verification matrix. Version bump: minor version + build number in all three apps; tag `client-feedback-r1`.

### 4.1 Backend (FastAPI)
1. Run migrations/index creation script — MUST include the `2dsphere` index (B1) and new fields (fees, settlement details, delivery slots).
2. Deploy to the existing production host (per repo's `deploy/` scripts or Dockerfile). Run smoke tests against `/health` and one geo-match query.
3. Confirm Razorpay webhook URL registered and signature secret set in env.

### 4.2 Super Admin (Next.js)
1. `npm run build` clean, zero type errors.
2. Deploy to Vercel production (`vercel --prod` with the project's linked scope).
3. Post-deploy smoke: login, order edit, notification bell.

### 4.3 Mobile apps — build (all three apps, both OSes)
Use EAS:
```bash
eas build --platform android --profile production   # per app
eas build --platform ios --profile production        # per app
```
- One consistent keystore/credential set per app (fixes F1 — never mix local debug keystores with EAS-managed ones).
- Verify each Android artifact installs on a physical-device profile before distribution.

### 4.4 Android — Google Play
```bash
eas submit --platform android --latest              # per app
```
- Track: **closed testing** (current stage — the 12-tester/14-day requirement is in progress; keep testers enrolled, do not reset the clock by creating a new track).
- Update the web opt-in links and re-share:
  - Store: `https://play.google.com/apps/testing/com.washingbells.store`
  - Customer & Rider: their respective opt-in URLs from Play Console.
- ⚠️ **HUMAN GATE:** Promotion to production track and the final "Send for review" click require the Play Console account owner (2FA). Prepare everything up to review-ready state, then output a checklist titled `PLAY_RELEASE_CHECKLIST.md` for the human.

### 4.5 iOS — TestFlight / App Store
```bash
eas submit --platform ios --latest                   # per app
```
- Apps already exist in App Store Connect (Customer 6783028568, Rider 6783028830, Store 6783029144).
- After processing, add the client's tester group to Internal Testing for all three apps (the emails already collected: hardikvashisht10@, mohitserowa001234@, neenaserowa00@, neenaserowa001234@, dv8901447007@, shannuvashisth@, vashisht.suman1234@, kavyas@meta.com — maintain in `testers.json`, do not hardcode).
- ⚠️ **HUMAN GATE:** App Store review submission and export-compliance answers require the Apple Developer account holder. Prepare metadata, screenshots (incl. iPad set for Store app after E7), and output `APPSTORE_RELEASE_CHECKLIST.md`.

### 4.6 Distribution & comms channel
1. Regenerate all install links after builds land; verify each link installs on a clean device before sharing.
2. Produce a one-page release note (per app: fixed bug IDs, what to retest) as `RELEASE_NOTES_client.md` — written for a non-technical reader, Hinglish-friendly plain language.
3. Record the rider happy-path video (F2) and place in `qa-artifacts/`.

### 4.7 Post-deploy monitoring
- Enable crash reporting (Sentry or Crashlytics) on all three apps if not already active; alert on any crash in `print tag`, `GST`, location-pin, or checkout flows for 7 days.
- Backend: log Twilio + Razorpay API failures at WARN with request IDs.

---

## 5. Definition of Done

- Every table row above is either ✅ fixed-and-verified (with test) or `NEEDS-REPRO` with investigation notes.
- Verification matrix passes on all 7 surfaces.
- Builds submitted to closed testing (Play) and TestFlight; the two human-gate checklists generated.
- `CHANGELOG_CLIENT_FIXES.md`, `RELEASE_NOTES_client.md`, `testers.json`, and QA artifacts committed.