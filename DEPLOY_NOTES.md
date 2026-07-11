# DEPLOY_NOTES — upgrade_last.md execution (2026-07-11)

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
