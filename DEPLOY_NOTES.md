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
