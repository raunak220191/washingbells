# DEPLOY_NOTES — upgrade_last.md execution (2026-07-11)

## What shipped (code complete, NOT yet deployed)

1. **Item images (TASK 1)** — one image per catalog item, uploaded by store (Item
   Photos screen) or rider (pickup Order Items card), Pillow-processed server-side,
   shown in customer item cards (`ItemThumb`) and the admin services table (+lightbox).
2. **Weight-based orders (TASK 2)** — kg lines carry `tentative_qty` → rider/store
   confirm `actual_qty` on a scale (`PATCH /orders/{id}/items/{line_id}/weight`);
   totals recompute through the existing bill-edit machinery with full audit
   (`bill_revisions` + `admin_db_audit` + invoice-freeze). Pickup OTP is blocked until
   all kg lines are weighed. Customer sees Estimated ~ / Confirmed + delta; admin sees
   est→actual, who/when, and a Bill Audit list.
3. **Map-pin addresses (TASK 3)** — mandatory pin (map on native, geocode/GPS fallback
   on web) with `location_source`; GeoJSON Point on addresses + 2dsphere; server-side
   geocode proxy `GET /geo/forward` (rate-limited, key stays in backend env); new
   addresses without locatable coords are rejected with a clear error; legacy addresses
   get a non-blocking "pin now" banner.
4. **Sort + search (TASK 4)** — locale-aware A→Z within category (memoized) on both
   item screens; debounced SearchBar above the chips, flat cross-category results with
   category labels, perfect state restore on clear; category chips untouched.

Deploy state: **stopped before TASK 5.2–5.4 execution** per instructions — migration
script, version bumps (1.2.0) and all commands are ready below.

## Baseline (recorded before TASK 1)

Verified repo layout (differs from task-file placeholders):

| Surface | Actual path |
|---|---|
| Customer app (Expo Router, JS) | repo root: `app/`, `components/`, `lib/`, `stores/` |
| Store partner app (Expo, JS) | `store/` |
| Rider app (Expo, JS) | `rider/` |
| Super-admin (Next.js 16, TS) | `admin/` |
| Backend (FastAPI + Motor) | `backend/` |

Baseline check results:

| Check | Command | Baseline |
|---|---|---|
| Backend tests | `cd backend && ./venv/bin/python -m pytest tests -q` (needs local stack: mongo + uvicorn :8000) | **46 passed** |
| Backend lint | — | **ruff NOT configured** (no pyproject/ruff.toml, not installed). New/changed backend files will be kept ruff-clean via ad-hoc `ruff check`; adding repo-wide ruff config is out of scope (would force a refactor). |
| Admin typecheck | `cd admin && npx tsc --noEmit` | **clean** |
| Admin lint | `cd admin && npm run lint` | **153 pre-existing problems (137 errors, 16 warnings)** — must not increase |
| Customer/store/rider | — | Plain JavaScript; **no lint/typecheck/test tooling exists**. Fallback: `node --check` syntax pass on every changed file + Metro bundle sanity. |

Backend tests are live-stack integration tests (see `backend/tests/conftest.py`) against seeded data (`scripts/seed_dummy_data.py`).

## BLOCKERS

### B-1 · Google Maps API key (TASK 3) — manual console steps required
There is **no Google Maps key anywhere in the project** (no app has ever rendered a
native map; `backend/.env` has `GOOGLE_MAPS_API_KEY=` empty). All code paths are in
place and degrade gracefully, but until these steps are done the map pre-centering,
server geocode fallback and the Android map tiles won't work:

1. In Google Cloud console (project used for WashingBells): create/choose an API key
   and enable **Geocoding API** (for the backend proxy) and **Maps SDK for Android**
   (for react-native-maps in the customer app).
2. Backend (server-side key, can be IP-restricted): set `GOOGLE_MAPS_API_KEY` in
   `backend/.env` locally AND in GCP Secret Manager for the Cloud Run service
   **before** deploying (TASK 5.2).
3. Customer app (Android key, restrict to package `com.washingbells.app` + SHA-1):
   `cd <repo root> && eas env:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --environment production`
   — `app.config.js` injects it into `android.config.googleMaps.apiKey` at build time.
   The key never lives in git or in the JS bundle (native manifest only).

**Recommendation:** use two separate keys (one server-restricted for Geocoding, one
Android-app-restricted for the Maps SDK) so a leaked app key can't burn geocoding quota.

## TASK 5.1 — Pre-deploy verification results (2026-07-11)

| Check | Result |
|---|---|
| Backend full suite | **64 passed** (46 baseline + 8 item-image + 5 weight-flow + 5 geo/address; b2 rewritten to the new required-coords contract) |
| Backend lint | New files (`items.py`, `geo.py`, 4 test files) **ruff-clean**; `ruff==0.15.21` added to requirements-dev.txt. Remaining 27 ruff findings in touched files are pre-existing style (E701 one-liners, unused legacy imports) on lines this round didn't add — left alone per no-refactor rule. |
| Admin | `tsc --noEmit` clean; eslint **152 problems (baseline was 153 — improved)** |
| Customer/store/rider JS | All changed files pass babel JSX parse; customer app verified live on web target |
| Smoke 1 — store uploads image → customer app | PASS (API: store-owner multipart upload → `image_url` in `/services`; web UI: Blazer thumbnail renders in item card, placeholder for others) |
| Smoke 2 — kg order + Razorpay estimate → adjusted bill | PASS (scripted: online order ₹387 est → paid via real HMAC verify vs test keys in `dev.yaml` → rider weighs 3.6 kg → total ₹464.40, payment stays `paid`, `bill_revisions` weight_update entry written) |
| Smoke 3 — pinned address → nearby store → order | PASS (test_f3: map_pin address stores GeoJSON, `/stores/nearby` matches seeded store; orders placed against pinned seeded address in test_f2) |
| Smoke 4 — search + sort, clear → layout identical | PASS (web screenshots: baseline vs cleared identical; search hides chips, flat cross-category results with labels, empty state "No items found for 'zzzz'", chips restore on clear) |
| Smoke 5 — OTP login regression | PASS via test_c1 (dev OTP flow + password bypass). **Live Twilio send not testable locally** — verify one OTP post-deploy (Twilio creds already a known prod item). |
| Map picker UI | Web-fallback modal verified on web target. **Native map (Android) untestable until BLOCKER B-1 key exists** — code degrades gracefully (blank map tiles without key). |

## TASK 5.2 — Backend deploy (commands for you to run)

```bash
# 0. Env FIRST (see BLOCKER B-1): set the server geocoding key
#    - locally: backend/.env  → GOOGLE_MAPS_API_KEY=<server key>
#    - prod:    add/update the secret used by the washingbells-api Cloud Run
#      service (Secret Manager), same var name, BEFORE deploying code.

# 1. Migration (idempotent — safe to re-run) against prod Atlas:
cd backend && MONGODB_URL='<atlas-uri>' ./venv/bin/python -m scripts.migrate_upgrade_last

# 2. Deploy via the existing pipeline:
gcloud run deploy washingbells-api --source backend   # same as previous releases

# 3. Post-deploy verify:
curl -s https://api.washingbells.com/health
# + trigger one live OTP send from the customer app (Twilio regression)
```

## TASK 5.3 — Mobile builds (EAS) — versions already bumped to 1.2.0

```bash
# Customer app (repo root — root .easignore already scopes customer builds):
eas build --platform android --profile production
eas submit --platform android --latest     # same closed-testing track — do NOT promote

# Store app (swap the scoped .easignore first — known gotcha):
cp .easignore-store .easignore && (cd store && EAS_NO_VCS=1 eas build --platform android --profile production) && git checkout .easignore
(cd store && eas submit --platform android --latest)

# Rider app:
cp .easignore-rider .easignore && (cd rider && EAS_NO_VCS=1 eas build --platform android --profile production) && git checkout .easignore
(cd rider && eas submit --platform android --latest)
```
`versionCode` auto-increments (eas.json `autoIncrement: true`). Remember: the customer
EAS build needs the `GOOGLE_MAPS_ANDROID_API_KEY` EAS env var set first (BLOCKER B-1),
or the Android map renders blank tiles.

### "What's new" notes (plain language, per app)

- **Customer**: "See photos of every laundry item, search the item list, and pin your
  exact location on a map so we always find your nearest store."
- **Store**: "Add photos to catalog items and confirm exact weights for kg orders —
  bills update automatically with a full audit trail."
- **Rider**: "Weigh kg items at pickup and enter the exact weight in the app; add item
  photos on the spot. Pickup now completes only after weighing."

## Deploy execution log (2026-07-11, run by Claude on user instruction)

- **Google Maps keys**: the key provided in `gmaps_apikey.env` belongs to a different
  GCP project (Geocoding probe returned REQUEST_DENIED: "API not activated on your API
  project") and `washingbells-prod` had zero API keys. Created two restricted keys in
  `washingbells-prod` instead (file updated in place, gitignored):
  `washingbells-geocoding-server` (Geocoding API only) and `washingbells-maps-android`
  (Maps SDK for Android only). Both APIs enabled on the project.
  ⚠ Recommended follow-up: add an Android app restriction (package
  `com.washingbells.app` + release SHA-1 from Play App Signing) to the Android key.
- **Backend**: `google-maps-api-key` secret created (+ accessor for washingbells-run@);
  deployed `washingbells-api-00012-j97` via `gcloud run deploy --source backend` with
  `--update-secrets GOOGLE_MAPS_API_KEY=google-maps-api-key:latest`. Health OK;
  live prod geocode verified (`/geo/forward?q=VIP Road Zirakpur` → 30.636, 76.814);
  `image_url` visible in prod `/services`.
- **Migration**: local Mac is not on the Atlas IP access list (TLS alert), so it ran as
  Cloud Run job `wb-migrate-upgrade-last` (same image digest as the service, same
  `wb-vpc`/`wb-subnet` direct-VPC egress). Result: **index ensured, 8 addresses + 9
  active orders backfilled**, exit 0. Job left in place for reuse.
- **EAS**: `GOOGLE_MAPS_ANDROID_API_KEY` created as a production secret on
  @rp2201/WashingBells; customer `eas.json` production profile pinned to
  `"environment": "production"`. Customer build 1.2.0 (versionCode 13) started.
- **Live OTP send**: not triggered by the agent (would SMS a real phone). Verify with
  the first tester login on the new build.

## iOS cycle (upgrade_last_ios.md) — TASK 0 preflight results (2026-07-11)

| Check | Result |
|---|---|
| eas.json iOS profiles | All 3 apps have `submit.production.ios` with ascAppId (customer 6783028568, store 6783029144, rider 6783028830); same ASC API key `L6HNMZ4MQ5`. Bundle IDs untouched. |
| Last TestFlight build numbers (ASC API, live) | **customer 15 · store 9 · rider 9** — all VALID/unexpired. iOS buildNumber convention = **EAS remote autoIncrement** (no `ios.buildNumber` in app.json; `appVersionSource: remote`) → next builds are 16/10/10, strictly greater ✓ |
| Credentials | iOS distribution cert "Hardik Vashisht" valid to **2027-06-22** (ASC API). EAS-managed profiles proved by 07-05/07-08 finished builds. |
| Push | `PUSH_NOTIFICATIONS` capability on all 3 bundle IDs; APNs key is EAS-managed and worked for prior TF builds (final proof at build time). |
| Maps on iOS | **Apple Maps chosen** (default provider). `MapPinPicker.js` already gates: `provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}` — no iOS key needed, Android path untouched. |
| Export compliance | Already satisfied: `ITSAppUsesNonExemptEncryption=false` present in all 3 app.json infoPlists (the plist key `ios.config.usesNonExemptEncryption` maps to). No duplicate key added. |
| Sign in with Apple | Not required — phone OTP only; grep confirms zero Google/Facebook/Apple social login usage. |
| TestFlight groups | Internal groups exist on all 3 apps with `hasAccessToAllBuilds=true` (auto-distribution — new builds reach testers with no manual assignment). |

**Mid-flight state reconciliation (Android cycle interrupted for iOS parity):**
customer Android 1.2.0 (vc 13) was already submitted to Play internal before the
both-platforms rule arrived; store Android 1.2.0 was built but NOT submitted; rider not
built. All three apps will be REBUILT for both platforms after the iOS-parity commits +
version bump (1.2.1) so every shipped artifact contains identical JS. vc13 stays on the
track (superseded by the 1.2.1 build; same track, no promotion — clock unaffected).

## iOS cycle — TASK 5 cross-platform regression results (2026-07-11)

| Check | Result |
|---|---|
| Backend suite | **65 passed** (adds the HEIC fixture test: 415 honest / 400 spoofed, never 500) |
| localeCompare pin | `node --test scripts/localeSort.test.mjs` → 2/2 pass (fixture asserts case-insensitive base-sensitivity order) |
| JS parse checks | All files changed in IOS-1..4 pass babel JSX parse |
| Admin | Untouched this cycle (last run: tsc clean, eslint 152 ≤ 153 baseline) |
| **Android emulator smoke** (Pixel 7 API 35, Expo Go, adb-driven) | Home ✓ · Dry Clean screen: SearchBar above intact chips, item thumbnails, A→Z within category ✓ · search "sh" → flat cross-category results with labels, clear × ✓ · My Addresses: no false "pin" banner (seeded address has coords) ✓ · New Address form: required LOCATION PIN card ✓ · MapPinPicker modal: fixed center pin, Use-current-location, live coords, Confirm ✓ |
| Android map tiles | **Blank in Expo Go** — Expo Go Android ships no Google Maps key; production AAB injects ours via app.config.js (verified in resolved config). Tile render + pan gesture → tester checklist on the production build. |
| **iOS simulator smoke** (iPhone 14, Expo Go 54.0.7) | App boots and renders the login screen correctly — the full JS graph incl. all iOS-parity changes (react-native-maps, ActionSheetIOS, KAV) loads on iOS Hermes with no redbox. |
| iOS interactive smoke | **Not automatable on this machine**: maestro's iOS driver crashes on this Xcode's `devicectl` JSON; `osascript` input injection blocked by macOS Accessibility permission (manual grant required). ActionSheetIOS sheet, weigh-entry keyboard, Apple Maps pin → delegated to TestFlight internal testers (priority list below); compile risk covered by EAS iOS builds. |
| OTP regression | test_c1 dev flows green; live Twilio send → first tester login on the new builds. |

## TASK 5.4 — Post-deploy

- Notify tester (Hardik): the 4 changes above; ask him to focus on the **kg weight
  flow end-to-end** and **map-pin address → nearby store** (highest risk), then item
  photos and search/sort.
- Monitor for the first hour (Cloud Run logs, washingbells-api): `POST /items/*/image`
  errors, `GET /geo/forward` 4xx/5xx (429 = rate limit, 503 = key missing),
  `PATCH /orders/*/items/*/weight` failures.
- **Rollback plan**: previous AABs remain on the closed-testing track (halt the 1.2.0
  rollout in Play Console); backend → redeploy the previous Cloud Run revision
  (`gcloud run services update-traffic washingbells-api --to-revisions <prev>=100`).
  The migration is additive-only (new fields/indexes) — old code ignores them, so no
  down-migration is needed.

## Deviations / fallbacks used

### TASK 1 — Item images
- **Media storage**: followed the repo's existing pattern — base64 in the Mongo `uploads`
  collection (there is no S3/Cloudinary/static mount). Added `GET /api/v1/upload/{id}/raw`
  which serves decoded bytes with the right content-type + immutable cache headers so
  `<Image>`/`<img>` tags can render item images directly. Images are Pillow-processed
  (≤800×800, WebP q80, EXIF stripped) before storage; re-upload deletes the old uploads doc.
- **Store app has no item-management screen** (the catalog is admin-owned). Fallback: added
  a dedicated "Item Photos" screen (`store/app/(tabs)/home/item-images.js`) + dashboard entry.
- **No shared package exists** between the three Expo apps (no workspaces; components like
  RescheduleModal are already duplicated per app). Fallback: `ItemImageUploader.js` is
  duplicated verbatim in `store/components/` and `rider/components/` with a header comment
  saying to keep them in sync.
- **Rider app had no items view.** `GET /delivery/worklist` now returns `items[]` per pickup
  trip (line fields + catalog `item_id`/`image_url`, with a name-match fallback for orders
  created before lines stored `item_id`).
- Customer app got a new display-only `ItemThumb` primitive (`components/common/ItemThumb.js`)
  per the design-system rule that repeated visual blocks live in primitives.

### TASK 2 — Weight flow
- **No formal "extra due / refund credit" model exists** in the codebase; the existing
  bill-adjustment flow is: totals change + `bill_revisions` audit + `invoice_stale`
  flag/warning when an invoice was already issued + manual admin settlement. The weight
  PATCH follows exactly that — no new payment paths (per task instruction).
- Weight recompute includes `platform_fee_charged` (parity with order creation; the
  admin bill editor's omission of platform fee is pre-existing and untouched).
- Coupon re-evaluation on weight change falls back to the ORIGINAL discount if the
  coupon no longer validates (e.g. expired since checkout) — weighing must never block
  a rider mid-pickup on a coupon error.
- Line addressing: new order lines carry `line_id`; legacy/walk-in lines are addressed
  by array index once, then get a generated `line_id`. Migration backfills active orders.

### TASK 3 — Addresses
- **Contract change**: `POST /addresses` now returns 400 when the address has no
  coordinates AND server geocoding can't resolve it. Old app builds keep working when
  the server key is configured (geocode fallback fills coords) — which is why setting
  `GOOGLE_MAPS_API_KEY` in prod (B-1) matters. `tests/test_b2` was rewritten to the
  new contract.
- Store matching still queries by lat/lng against the stores 2dsphere index (unchanged
  path); addresses additionally persist a GeoJSON Point + own 2dsphere index for
  future address-side geo queries.

### TASK 4 — Search/sort
- No design-system `Input` primitive existed; added `components/common/SearchBar.js`
  as a new primitive (Material-3 style, leading icon, clear button) rather than styling
  a raw TextInput in the screen (design-system rule).
