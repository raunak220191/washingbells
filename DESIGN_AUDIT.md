# WashingBells Customer App — Design Audit (overnight-design)

Branch: `overnight-design` (base `overnight-work`). Date: 2026-06-26.
Role: design critic + judge + tester + developer. Screenshots under `docs/design-audit/{ios,android}/`.

---

## PHASE 0 — Environment (verified ON DEVICE, not web)

Per the prior REPORT, the last pass had **no simulator** and fell back to a react-native-web
Playwright harness (explicitly flagged as misleading). This pass runs on **real devices**.

| Check | Result |
|---|---|
| iOS Simulator | ✅ iPhone 14, iOS 16.4 (`3DE8831E-…06592`), online via mobile MCP |
| Android emulator | ✅ Pixel 7 API 35, Android 15 (`emulator-5554`), online via mobile MCP |
| MongoDB | ✅ `washingbells-mongo` up (27017) |
| Backend (FastAPI) | ✅ `:8000` `/health` → `{"status":"ok"}`; routes under `/api/v1` |
| Metro (Expo SDK 54) | ✅ `:8081` `packager-status:running`; iOS bundled 1396 modules |
| adb reverse | ✅ `tcp:8081` (metro) + `tcp:8000` (backend) → device localhost |
| Login | ✅ Both devices logged in as `+919000000001` / `Test@1234` (Test Customer 1). iOS restored via persistent-login on launch; Android via password form. |

Screen dimensions (for touch-target math):
- **Android** reports clicks/elements in **physical px**: 1080×2400, density 2.625 → **48dp = 126px**.
- **iOS** reports in **logical points**: 390×844 → **44pt = 44px** in MCP coords.

### Environment caveats / judgment calls
1. **Vector icons initially rendered as empty boxes — root-caused to a stale Metro, NOT an app bug.**
   The LogBox error named the cause exactly: the running bundle was trying to `ExpoAsset.downloadAsync`
   the Ionicons font from `http://192.168.1.41:8082/...` (a dead prior dev server) instead of my Metro
   on `:8081`. Confirmed my `:8081` serves the font fine (`Ionicons.ttf` → HTTP 200, 390 KB). **Fix:**
   force-stopped + relaunched both apps against `exp://127.0.0.1:8081`; all glyphs (tab bar, service
   cards, Sofa feature, location pin, logo) then render correctly. **No code change — environmental.**
   The audit below is on these correct post-reload renders.
2. **Dev-only LogBox error** "Uncaught (in promise): Call to function …" overlays the bottom on
   Android — matches the Expo Go warning that `expo-notifications` push is unsupported in Expo Go
   SDK 53+. Dev/Expo-Go artifact, not a production bug.
3. **MCP coordinate space:** screenshots are returned downscaled (~486px wide) but clicks/element
   coords are device-space — all taps use `list_elements_on_screen` coordinates, not eyeballed
   pixels.

---

## PHASE 1 — Findings

Screens walked **on both devices**: Login, Home, Basket (empty + filled), Service category
(Dry Clean), Checkout, Orders (list + detail), Profile, Wallet, Edit Profile, Help, Terms.
OTP screen reviewed in code (existing seeded user logs in via password, so the OTP step is
not reached; its back button was fixed in the touch-target sweep regardless).

Overall: the app is **genuinely polished and on-brand** — confident forest-green + gold palette,
consistent card language, real copy throughout, good empty states. Findings are mostly small
consistency/safe-area items rather than broken UI.

### Findings table

| # | Severity | Platform | Screen(s) | Finding | Status |
|---|----------|----------|-----------|---------|--------|
| F0 | Info | both | all | Vector icons rendered as empty boxes — root cause was a **stale Metro asset server** (bundle fetched `Ionicons.ttf` from a dead `192.168.1.41:8082`), not app code. | Resolved by reloading against `:8081` (env, no code change) |
| F1 | **High** | both | Bottom tab bar | Tab bar hardcoded `height:60`/`paddingBottom:8`, overriding react-navigation safe-area handling → labels overlap iOS home indicator / Android system nav bar (prior **issue #2**, now **confirmed on native**, not a web artifact). iOS: tab content bottom at y835 of 844 (under the 34pt indicator). Android: labels at y2341–2380 inside the nav-bar zone y2337–2400. | **Fixed** `907bc3a` |
| F2 | Med | both | All stack screens (9) | Header back buttons `40×40` with no `hitSlop` — below 48dp (Android) / borderline 44pt (iOS). | **Fixed** `1d35833` |
| F3 | Med | both | Checkout, Wallet | Material-vs-Bootstrap **tint split**: checkout store badges used Bootstrap `#D4EDDA/#155724/#F8D7DA/#721C24`; wallet used raw `#E8F5E9/#FFEBEE`; Help/profile used Material `TINTS`. | **Fixed** `f993c55` (canonical = Material `TINTS`) |
| F4 | Low | both | Basket | Subtotal showed "**1 items**" (no pluralization). | **Fixed** `f9265cf` |
| F5 | Low | both | Orders | Status label casing inconsistent: list shows "**At Store**" (title case), detail shows "**AT STORE**" (uppercase via `textTransform`). | Proposed (P5) |
| F6 | Med | both | Order detail | "Order Lifecycle" timeline renders all step circles as inactive grey — the **current/completed step is not highlighted**, and `at_store`/walk-in status isn't mapped onto the 5-step lifecycle, so progress reads as "nothing happened yet". | Proposed (P2) |
| F7 | Low | both | Profile | "WB Wallet" appears **twice** — the green balance card *and* a menu row directly below it (redundant entry to the same screen). | Proposed (P6) |
| F8 | Low | both | Edit Profile | **Two save affordances** — a gold "Save" text button in the header and a green "Save Changes" button — with no clear primary. | Proposed (P6) |
| F9 | Low | both | Home promo, Address | Remaining hardcoded hex: `PromoBanner` card backgrounds `#F0E6D3`/`#E6D9F0` (decorative) and `address.js` shadow `#1A1A1A` (should be `COLORS.shadow`). | Proposed (P7) — decorative, left for design |
| F10 | Info | Android | dev only | LogBox "Call to function 'ExpoAsset…'/`expo-notifications`" — Expo Go SDK 53+ doesn't support push; **not a production bug**. | No action (dev runtime) |

### Heuristic notes (per the brief)
- **Header consistency:** Two intentional patterns — tab-root screens use a large left-aligned
  title (Home logo header, "Your Basket", "My Orders", "Profile"); pushed stack screens use a
  centered title + left back arrow (+ optional right action). Both are internally consistent;
  heights and safe-area top insets are uniform. ✅
- **Footer / bottom nav:** the F1 safe-area issue (now fixed). Primary CTAs (Proceed to Schedule,
  Pay & Place Order, Add to Basket) are full-width sticky bottom bars — thumb-reachable. ✅
- **Touch targets:** back buttons were the only sub-48dp interactive elements (F2, fixed). ADD
  buttons, steppers, menu rows, tab targets all ≥48dp. Address action buttons already had hitSlop.
- **Proportions / spacing:** consistent with `SPACING`/`RADIUS` scale; service cards, store cards,
  order cards share radius/elevation. No cramped or runaway spacing found.
- **Typography:** roles consistent — forest-green section headings, grey body, gold price/accents.
  No conflicting weights for the same role.
- **Component consistency:** buttons (gold primary / green secondary / outline), inputs (rounded
  white), badges (pill), cards (white, RADIUS.md, soft shadow) are uniform across screens. ✅
- **States:** empty states are present and styled (Basket "Your basket is empty" + CTA, Wallet
  "No transactions yet", Orders has pull-to-refresh); loading uses gold `ActivityIndicator`;
  login error surfaces an Alert. No unstyled/missing states found.
- **Search & filters:** Service category screens already have filter chips (All/Men/Women/Kids/
  Accessories). **Orders has no search/filter** and **Home has no service search** — see proposals
  P1/P3 (helpful at scale; not broken today with 2 orders / 6 services).

---

## PHASE 2 — Fixes applied (each committed separately, verified on device)

| Commit | Fix | Verification |
|--------|-----|--------------|
| `907bc3a` | **Tab bar safe-area inset** — `useSafeAreaInsets`, `height: 60 + insets.bottom`, `paddingBottom: insets.bottom||8`. | iOS: tab buttons y788→**y756** (now clears the 34pt home indicator). Android (fresh bundle): labels y2341→**y2283**, clearing the nav-bar zone (y2337–2400). Both platforms. |
| `1d35833` | **Back-button touch targets** — `hitSlop:10` on 8 stack screens (→ ~60×60 effective, zero layout shift). | Back navigation exercised on wallet/help/terms/edit/order-detail/checkout — all reachable; no header re-centering. |
| `f993c55` | **Canonical TINTS migration** — checkout badges + wallet txn icons → `TINTS.*`; canonical set documented in `theme.js`. Also carries the back-button hitSlop for checkout & wallet. | Checkout "Open" store badges now render the canonical Material green (`#E8F5E9`/`#155724`), matching Help cards & email banner. iOS + Android. |
| `f9265cf` | **Basket pluralization** — "1 item" vs "N items". | Hot-reload showed "Subtotal (1 item)" on both devices. |

**Canonical-tint decision (resolves the prior REPORT's open question):** the single source of truth
is the existing **Material-family `TINTS`** (pastel `successBg #E8F5E9` / `infoBg #E3F2FD` /
`warningBg #FFF3E0` / `errorBg #FFEBEE` with high-contrast text). Chosen because it was already the
majority usage (Help contact cards, profile email banner, wallet icons) and reads softer/on-brand
next to the forest-green surfaces. The Bootstrap badge palette on checkout was migrated to it and a
"do not reintroduce" note added at the token definition.

Before/after screenshots: `docs/design-audit/{ios,android}/` — `02-home*` (tab bar before/after),
`06-checkout` (tints), `05-basket-filled` (pluralization).

Screenshot index (this pass): `android/` 01-login, 02-home(+after), 04-basket-empty, 05-basket-filled,
06-checkout, 07-orders-list, 08-order-detail, 09-profile, 10-wallet, 11-edit-profile, 12-help,
13-terms; `ios/` 02-home(+after), 04-basket-empty, 05-basket-filled, 06-checkout.

---

## PHASE 3 — Proposals (prioritized; not built blind)

Effort key: S ≈ <1h, M ≈ half-day, L ≈ 1–2 days. Ordered by value/effort.

| P | Proposal | Rationale | Effort | Recommend |
|---|----------|-----------|--------|-----------|
| **P1** | **Reorder-last / "Order again"** on Orders list & order detail | Laundry is the most repeat-heavy commerce there is — same items, same store, weekly. One tap to repopulate the basket from a past order removes the entire re-add flow. Backend already has the order's line items. | M | **Yes — highest ROI** |
| **P2** | **Order-status tracker that highlights the current step** (fixes F6) | The lifecycle timeline exists but doesn't show where the order *is*. Color the completed/active steps from `ORDER_STATUS_COLORS`, map every backend status (incl. `at_store`/walk-in) to a step, add timestamps. Pure presentational. | S–M | **Yes** |
| **P3** | **Orders search + status filter** | Not needed at 2 orders, but a returning customer accrues many. Add a status filter chip row (Active / Delivered / Cancelled) mirroring the category-chip pattern already in the app, + text search by order number/item. | M | Yes (at scale) |
| **P4** | **Schedule-pickup polish** | Checkout already schedules; consider surfacing the next available slot up front and a "fastest pickup" shortcut. | M | Later |
| **P5** | **Unify status-label casing** (fixes F5) | Render the same `ORDER_STATUS_LABELS` text in list and detail; drop the `textTransform: uppercase` on detail (or apply consistently). | S | Yes (quick) |
| **P6** | **De-dupe Profile wallet entry (F7) + single primary Save on Edit (F8)** | Remove the redundant "WB Wallet" menu row (keep the balance card, make it tappable), and pick one Save affordance. Subjective layout calls → left for review. | S | Review |
| **P7** | **Finish hex→token sweep (F9)** | Tokenize `address.js` shadow → `COLORS.shadow`; decide whether the promo-banner pastels become named tokens or stay decorative. | S | Optional |
| **P8** | **Saved addresses quick-pick at checkout** | Address management exists (`home/address.js`); surface saved addresses as a quick selector in the checkout "Delivery Address" block instead of only "Change". | M | Later |

**Implemented from proposals this pass:** none beyond the objective fixes — P2/P5 are the smallest
and obviously-correct, but both touch shared order-rendering logic and benefit from a design eye on
the active-step colors, so they're left for review per the brief ("only implement if small, obviously
correct, and self-contained; otherwise leave it for review").

---

## PHASE 4 — Summary

**Environment:** verified on **real iOS + Android** via mobile MCP (no web fallback). Root-caused and
cleared a stale-Metro asset bug that was hiding all vector icons; restarted Metro without `CI=1` so
file-watch/fast-refresh worked for iterative verification.

**Fixed (4 commits, branch `overnight-design`, base `overnight-work`):**
- `907bc3a` tab-bar safe-area inset (prior issue #2 — **confirmed real on native**, fixed, verified both platforms)
- `1d35833` back-button touch targets ≥48dp (hitSlop)
- `f993c55` canonical Material `TINTS` migration (resolves the prior open tint decision)
- `f9265cf` basket subtotal pluralization

**Canonical tint:** Material-family `TINTS` (documented at the token source).

**Left for review (subjective / needs design input):** order-status active-step highlighting (P2),
orders search/filter (P3), reorder-last (P1), status-label casing (P5), Profile/Edit redundancies
(P6), remaining decorative hex (P7), saved-address quick-pick (P8).

**Not changed on purpose:** PromoBanner decorative pastels (intentional brand color), the
dev-only Expo Go push/LogBox warning (F10), and `.mcp.json`/`package.json` (pre-existing
uncommitted changes unrelated to this audit).
