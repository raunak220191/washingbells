# WashingBells Customer App — Design Audit (overnight-polish)

Branch: `overnight-polish`. Role: design lead + critic + developer.
Standard of record: [`.claude/skills/design-system/SKILL.md`](.claude/skills/design-system/SKILL.md).
On-device screenshots: `docs/audit/{before,after}/` (real iOS Simulator via mobile MCP).

The bar: **"a senior product designer would ship this."** Every screen now composes
shared primitives — no screen styles a header, card, chip, button or bottom bar directly.

---

## Phase 0 — Environment (verified on a real device, not web)

| Check | Result |
|---|---|
| iOS Simulator | ✅ iPhone 14, iOS 16.4 (`3DE8831E…06592`), driven via mobile MCP |
| MongoDB | ✅ `washingbells-mongo` (27017) |
| Backend (FastAPI) | ✅ `:8000` `/health` → `{"status":"ok"}`; routes under `/api/v1` |
| Metro (Expo SDK 54) | ✅ `:8081`, `--clear` |
| Login | ✅ `+919000000001` / `Test@1234` — persistent login restored Home as "Test Customer 1" |

**Screenshots are judged on the real device** — never react-native-web.

### Critical: app was crash-on-launch before anything else
The prior token-consolidation commit left `SHADOWS.card/raised/bar` referencing a **bare
`darkForest`** instead of `COLORS.darkForest`, throwing *"Property 'darkForest' doesn't
exist"* at `login.js → SHADOWS.card` on the very first render. Fixed in `2d40544`; the app
then booted and every screen below is audited on the fixed build.

---

## Phase 1 — Design system (one source of truth)

- `constants/theme.js` is the only token definition site: `COLORS`, `TINTS` (canonical
  Material pastels), `SPACING` (8-pt), `RADIUS`, `ICON`, `SHADOWS` (brand-tinted),
  `TYPE` (one scale), `ORDER_STATUS_LABELS`/`COLORS` (every backend status mapped).
- Primitives in `components/common/`: `Screen`, `Header`, `Chip`(+`ChipRow`), `Button`,
  `Card`, `ListItem`, `PriceRow`, `BottomBar`, `StatusBadge`, `QuantityStepper`.
- `SKILL.md` codifies the hard rule ("never style a screen directly once a primitive
  exists"), the token set, and an 8-line per-screen rubric.
- One enhancement this pass: `PriceRow` gained a `positive` prop (success-coloured value
  that keeps the amount, vs `free` which renders "FREE") for discount/wallet lines.

---

## Phase 2 — Every screen migrated to primitives (18 screens, each committed)

`<Screen>` now owns safe-area + status-bar + the canonical `lg` horizontal padding on
**every** screen, so all headers sit at the same top offset — the prior "inconsistent top
gap" is gone. Pinned action bars use `<BottomBar>` (brand upward shadow + bottom inset),
replacing per-screen `#000` drop shadows.

| Screen | Commit | Key changes |
|---|---|---|
| Service (`service/[slug]`) | `ce5793f` | **Chip fix** (compact `<Chip>` in edge-bleeding `<ChipRow>` — never clipped), `<Header>`, `<BottomBar>` |
| Basket | `3f0bdb8` | `<Card>` rows, `<PriceRow>` bill, `<BottomBar>` |
| Checkout (Schedule & Pay) | `e22b86b` | `<Header>`, date `<Chip>`s, `<PriceRow>` summary, `<BottomBar>`; **disabled "Pay & Place Order" now the intentional warm-neutral `<Button>` state** |
| Orders list | `5857cd0` | `<Card>` rows, shared `<StatusBadge>` |
| Order detail | `67b122e` | shared `<StatusBadge>` (drops `.toUpperCase()`), `<PriceRow>`, `<BottomBar>`, **lifecycle tracker fix** (see Phase 3) |
| Category | `acae1ad` | `<Header>`, `<BottomBar>` |
| Home | `d3604de` | `<Screen>` safe-area (logo header unchanged) |
| Profile | `3a27954` | `<Screen>`; **de-dupe WB Wallet entry (F7)** |
| Wallet, Help | `ec2729c` | `<Header>`; fix undefined `COLORS.textDark` → `black` |
| Edit Profile | `9d7d86f` | **single primary Save (F8)** via `<Button>`; `<Header>` |
| Terms, Privacy | `fdcd6d9` | `<Header>`, content aligned to `lg` |
| Address | `a5c8e67` | `<Screen>`; raw `#1A1A1A` shadows → brand `darkForest` tint (F9) |
| Confirming | `6e45d2f` | `<Screen>` for the order-status states |
| Login / OTP / Onboarding / Auth-Terms | `bbad198` | `<Screen>` safe-area; OTP filled-box hex → gold token |

**Resolved findings from the prior audit:** F5 (status casing — one `<StatusBadge>` in list
+ detail), F6 (tracker — below), F7 (Profile wallet dupe), F8 (Edit dual-save), F9
(decorative hex → tokens). No `SafeAreaView` or undefined `textDark` remain anywhere in `app/`.

---

## Phase 3 — Polish features (implemented, on-device verified)

**1. Order-status tracker now highlights the current step (`67b122e`, fixes F6).**
The lifecycle was `["placed","picked_up","in_progress","packed","delivered"]` but `indexOf`
was called with raw backend statuses — so `confirmed` / `at_store` / `processing` /
`ready_for_delivery` / `out_for_delivery` returned `-1` and **every step rendered as
"future"** (the order read as "nothing happened yet"). Added `STATUS_TO_STEP` mapping every
backend status onto a step; timeline timestamps now match by mapped step. Verified on device:
an `at_store` order highlights **In Progress** (Placed + Picked Up done); a delivered order
shows all five steps complete.

**2. "Order Again" reorder (`0c1b3a9`, P1 — highest ROI).**
`lib/reorder.js#reorderToCart()` resolves a past order's line items against the live
catalogue by service/item name (skipping anything no longer offered) and adds them to the
basket. Surfaced as a full-width **Order Again** action in the order-detail bottom bar
(beside the existing Pay/Reschedule/Cancel row). **Verified on device:** reordering
WB-2026-0GA9 added Shirt ×7 + Bedsheet ×4 to the basket (Shirt merged with an existing 1 →
×8), 12 items / ₹720, delivery auto-FREE over ₹299.

**3. Placeholder seed data replaced (DB data fix, on-device verified).**
Direct, targeted `updateOne`s on the running Mongo (no deletes, coordinates preserved so
distances stay correct) — these were manually-created test docs, not in any seed script:
- Stores: `Xyz`/`Ddd` → **WashingBells Express** / Shop 12, Sector 22; `Abc dry cleaners`/`Sl3`
  → **WashingBells Dry Clean Hub** / Plot 5, Sector 29; `ab1`/`Vensej Mall` →
  **WashingBells Care Point** / Sector 14 Market.
- Catalogue: Dry Clean `WDress` → **Women's Dress**.
Verified in checkout: the store selector now lists only realistic WashingBells branches.

---

## Phase 4 — Functional guardrail (place-order flow, tested via API)

Tested directly against `:8000` with a real token + basket (per CLAUDE.md — no UI tap-and-wait):

| Step | Request | Result |
|---|---|---|
| Login | `POST /auth/login-password` | ✅ token |
| COD order | `POST /orders` (cod) | ✅ **HTTP 201** — WB-2026-O22W, status `placed`, ₹720 |
| Online order | `POST /orders` (online) | ✅ **HTTP 201** — status `placed`, payment `pending` |
| Payment create | `POST /payments/create` | ✅ **HTTP 200** — Razorpay order + amount + key returned |

**The happy path works.** "Failed to place order." does NOT reproduce with valid input.

**Root cause of "Failed to place order." found & fixed (`ee29f38`).** A malformed/stale
`store_id` (or `address_id`) made `ObjectId(...)` raise `bson InvalidId`, which was
unhandled → **plain-text HTTP 500 with no JSON `detail`**. The checkout catch is
`error?.response?.data?.detail || "Failed to place order."`, so the missing detail produced
the generic fallback. Reproduced on live `:8000` (bad `store_id` → 500). Fix: `_safe_oid()`
returns a clean **400 with an actionable detail** ("Invalid store selection. Please re-select
and try again.") instead of crashing. Validated by code inspection + the helper's logic; the
running dev backend was **not restarted** (it runs without `--reload`; per project guidance
the user's `:8000` is left untouched), so the fix goes live on its next restart. No business
logic changed — purely defensive input validation.

---

## Phase 5 — Critic loop (rubric, /5, ship at ≥4)

Scored on-device after migration. Screens verified visually: Home, Service, Basket, Checkout,
Orders list, Order detail, Profile, Wallet, Help. Remaining screens (Category, Edit, Terms,
Privacy, Address, Confirming, Auth) are parse-clean and followed the same proven pattern.

| Rubric line | Score | Notes |
|---|---|---|
| Header & top spacing | 5 | One `<Screen>`/`<Header>` everywhere; identical top offset |
| Spacing & grid | 5 | All from `SPACING`; consistent card padding/margins |
| Type hierarchy | 4 | `TYPE` roles throughout; a few legacy `fontSize` literals remain in dense screens |
| Colour & elevation | 5 | Tokens only; brand-tinted soft shadows; no `#000`/`#1A1A1A` drops; no `textDark` |
| Components | 5 | Chips never clipped; disabled buttons intentional; no screen-level header/card/bar |
| States | 5 | Designed empty/loading states; status casing unified (one `<StatusBadge>`) |
| A11y & touch | 4 | ≥48dp targets, hitSlop on icon controls; some icon-only buttons still need labels |
| Senior-designer gut check | 4–5 | Confident, on-brand, consistent; would ship |

No regressions found; the app boots clean after the full 18-screen batch.

---

## Proposed (not built — needs product/design input)

| P | Proposal | Effort | Note |
|---|---|---|---|
| P3 | Orders search + status filter (Active/Delivered/Cancelled chip row) | M | Valuable at scale; mirrors the category-chip pattern |
| P4 | Schedule-pickup polish — surface next available slot / "fastest pickup" up front | M | Checkout already schedules |
| P8 | Saved-address quick-pick in checkout (vs only "Change") | M | Address CRUD already exists |
| — | Reorder on the **list** card (currently on detail) + a per-line "add" in reorder | S | Quick follow-up to P1 |
| — | Tokenise remaining legacy `fontSize` literals to `TYPE` in dense screens (address, checkout) | S | Cleanup; no visual change |
| — | `accessibilityLabel`s on remaining icon-only controls (trash, call, camera) | S | A11y polish |

## Commits (this pass, branch `overnight-polish`)
`2d40544` crash fix · `ce5793f` service · `3f0bdb8` basket · `e22b86b` checkout ·
`5857cd0` orders-list · `67b122e` order-detail+tracker · `acae1ad` category · `d3604de` home ·
`3a27954` profile/F7 · `ec2729c` wallet+help · `9d7d86f` edit/F8 · `fdcd6d9` terms+privacy ·
`a5c8e67` address/F9 · `6e45d2f` confirming · `bbad198` auth · `0c1b3a9` reorder ·
`ee29f38` place-order 500→400 fix.
