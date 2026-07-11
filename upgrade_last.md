# UPGRADE_LAST.md — WashingBells Final Upgrade & Deployment

> **Execution mode:** Autonomous (Claude Code). Work through tasks **in order**. Commit after every completed sub-task with the checkpoint format below. Do not batch commits. If a stream timeout occurs, resume from the last checkpoint commit.
>
> **Checkpoint commit format:** `checkpoint(TASK-X.Y): <short description>`
>
> **Scope guard:** Only touch files required for the four tasks below + deployment. No refactors, no dependency upgrades beyond what is explicitly listed.

---

## Context

Monorepo layout (verify actual paths before editing — do NOT assume):

- `apps/customer` — React Native (Expo) customer app
- `apps/store` — React Native (Expo) store partner app
- `apps/rider` — React Native (Expo) rider app
- `admin/` — Next.js super-admin panel
- `backend/` — FastAPI + MongoDB (Motor/Beanie), geospatial store matching via `2dsphere` index
- Shared design system: Material 3 / Apple HIG tokens — reuse existing components, do not introduce new UI primitives

**Before starting:** run the repo's existing lint/typecheck/test commands and record baseline. All tasks must end with the same or better status.

---

## TASK 1 — Item Images (exactly one image per item, managed via Store/Rider apps)

### 1.1 Backend — schema & storage

- [ ] Add `image_url: Optional[str]` (and `image_updated_at`, `image_updated_by`) to the Item/ServiceItem model. **Enforce single image** — this is a scalar field, not an array.
- [ ] Create endpoint `POST /items/{item_id}/image` (multipart upload):
  - Auth: store or rider role only (reuse existing role guard dependency).
  - Validate: content-type in {`image/jpeg`, `image/png`, `image/webp`}, max size 5 MB.
  - Server-side processing: resize to max 800×800, convert to WebP (use `Pillow`), strip EXIF.
  - Storage: use the project's **existing media storage pattern** (check how store logos / KYC docs are stored — S3/Cloudinary/local static). Follow the same pattern. If none exists, add a `media/items/` static mount with UUID filenames and document it.
  - **Replace semantics:** uploading again overwrites the old image (delete old object, update `image_url`). Never accumulate multiple images per item.
- [ ] Create endpoint `DELETE /items/{item_id}/image` (same auth) — resets to placeholder state.
- [ ] Include `image_url` in every item serializer/response used by customer app, store app, rider app, and super-admin.

### 1.2 Store app — upload UI

- [ ] In the store app's item management screen, add an image slot per item: shows current image or a placeholder with a camera icon.
- [ ] Tap → action sheet: **Take Photo / Choose from Gallery / Remove Photo** (use `expo-image-picker`, request permissions gracefully).
- [ ] Client-side compress before upload (`expo-image-manipulator`, quality ~0.7, max 1200px) to keep uploads fast on poor networks.
- [ ] Show upload progress + retry on failure. On success, update local state immediately (optimistic) and reconcile with server response.

### 1.3 Rider app — upload UI

- [ ] Same capability as 1.2, exposed wherever riders view/verify items (e.g., pickup verification screen). Reuse the **same shared component** — do not duplicate. If the design system package exists, place `ItemImageUploader` there.

### 1.4 Customer app + Super-admin — display only

- [ ] Customer app: render item image thumbnail in the item list/cards. Use a fixed-size container with `resizeMode="cover"` and a neutral placeholder (existing skeleton/placeholder component) when `image_url` is null — **layout must not shift** between image/no-image states.
- [ ] Super-admin: show image in the items table (small thumbnail, click to preview). Read-only is acceptable; edit optional.

### 1.5 Acceptance criteria

- Each item has at most one image; re-upload replaces, never appends.
- Customer app never shows a broken image — placeholder fallback always works.
- Upload works on physical Android device over mobile data (test with tester build).

---

## TASK 2 — Weight-Based Orders (tentative qty by customer → exact qty by rider/store, reflected everywhere)

### 2.1 Backend — order model & pricing

- [ ] For items priced **per Kg**, extend order line items with:
  - `unit_type: "kg" | "piece"` (derive from item's pricing unit)
  - `tentative_qty: float` — what the customer selected at order time
  - `actual_qty: Optional[float]` — null until weighed
  - `weighed_by: Optional[{role, user_id, name}]`, `weighed_at: Optional[datetime]`
- [ ] Pricing rule: order total is **estimated** using `tentative_qty` until `actual_qty` is set; then recompute line total, subtotal, GST, and grand total from `actual_qty`. Reuse the existing bill-editing + **GST audit trail** machinery — every weight update must write an audit entry (old qty → new qty, old amount → new amount, actor, timestamp).
- [ ] Endpoint `PATCH /orders/{order_id}/items/{line_id}/weight` — body `{actual_qty: float}`:
  - Auth: rider or store role, and only while order is in a pickup/processing status (define exact allowed statuses from the existing order lifecycle — likely between `PICKED_UP` and `READY`; confirm against the state machine in code).
  - Validate: `actual_qty > 0`, sane upper bound (e.g., ≤ 100 kg), max 1 decimal place.
  - Recalculate totals atomically; if Razorpay payment was pre-authorized/paid on estimate, follow the existing bill-adjustment flow (extra amount due / refund credit) — do **not** invent a new payment path.
- [ ] Emit the existing order-updated notification/event so all clients refresh (push notification + any polling/websocket already in place).

### 2.2 Customer app

- [ ] For per-Kg items, the quantity selector must be labeled **"Approx. weight"** with helper text: *"Final weight will be confirmed at pickup with a weighing scale."*
- [ ] Order details screen:
  - Before weighing: show `Estimated: ~X kg` and `Estimated total`.
  - After weighing: show `Confirmed: X kg` (with a subtle "updated" badge) and the recalculated total. If amount changed, show the delta line (`+₹Δ` or `−₹Δ`) consistent with the existing bill-edit UI.
- [ ] No layout changes beyond these labels/badges.

### 2.3 Rider app

- [ ] On the pickup screen, per-Kg line items get an **"Enter weighed qty"** field (numeric keypad, decimal allowed) pre-filled with tentative qty, plus a confirm button.
- [ ] On confirm → call the weight PATCH endpoint → show recalculated line total inline. Block order status progression past pickup until all per-Kg items have `actual_qty` set (or an explicit "customer not weighing / skip" is impossible — weighing is mandatory for kg items).

### 2.4 Store app

- [ ] Same weighing capability at the store (in case rider skipped or store re-verifies). If `actual_qty` already exists, store sees it and can correct it — every correction goes through the same endpoint and audit trail.

### 2.5 Super-admin

- [ ] Order detail view shows tentative vs actual qty per line, who weighed it and when, and the GST audit entries. No new pages — extend the existing order detail + bill audit components.

### 2.6 Acceptance criteria

- End-to-end: customer orders 3 kg (tentative) → rider weighs 3.6 kg → totals, GST, customer app, store app, and super-admin all show 3.6 kg and the recalculated amount within one refresh.
- Audit trail entry exists for every weight change.
- Piece-based items are completely untouched by this flow.

---

## TASK 3 — Manual Address Entry with Map Pin (coordinates required so nearby-store matching works)

**Problem:** manually typed addresses have no lat/lng, so the geospatial `$near` store-matching query returns nothing.

### 3.1 Customer app — map picker

- [ ] In the manual address form, add a **"Pin location on map"** step (mandatory before save):
  - Use `react-native-maps` (Google provider on Android). Confirm the Google Maps API key is already configured in `app.json` / `AndroidManifest` from the existing nearby-store map — reuse it. If Maps SDK for Android isn't enabled on the key, list it as a manual console step in the deployment section output.
  - Flow: after the user types the address, attempt **forward geocoding** (Google Geocoding API via backend proxy endpoint — see 3.2) to pre-center the map; then show a draggable pin / fixed-center-pin map for fine adjustment; "Use current location" button as a shortcut (`expo-location`).
  - Save `latitude`, `longitude`, and `location_source: "map_pin" | "geocode" | "gps"` with the address.
- [ ] Validation: address cannot be saved without coordinates. Show inline error, not a toast.
- [ ] Existing saved addresses without coordinates: on next use, prompt the user once to pin them (non-blocking banner on address selection screen).

### 3.2 Backend

- [ ] Add `GET /geo/forward?q=<address>` proxy endpoint that calls Google Geocoding API server-side (key stays in backend env, never shipped in the app bundle). Rate-limit it (reuse existing rate-limit middleware if present).
- [ ] Address model: make `location: GeoJSON Point` required for **new** addresses; keep backward compat for old documents (nullable in schema, handled in 3.1 prompt flow).
- [ ] Verify the store-matching query path uses the address's Point and the `2dsphere` index — add a regression test: address with coordinates → returns nearby stores; address without → returns clear error, not empty silent result.

### 3.3 Acceptance criteria

- Typing a manual address in a locality with stores now returns nearby stores.
- Google API key is not present anywhere in the RN bundle (grep the built JS).
- Old addresses continue to work; user is prompted to pin, never hard-blocked from viewing them.

---

## TASK 4 — Customer App: Alphabetical Sort + Item Search Bar (zero layout regressions)

### 4.1 Sorting

- [ ] Sort items **alphabetically (A→Z, case-insensitive, locale-aware `localeCompare`)** within each category. Category order itself stays exactly as-is (category chips unchanged — these had rendering issues before, do not touch them).
- [ ] Do the sort in a memoized selector (`useMemo`) at the data layer, **not** by mutating fetched arrays in place.

### 4.2 Search bar

- [ ] Add a search input **above the category chips / item list**, styled with existing design-system Input component (Material 3 style, leading search icon, clear "×" button).
- [ ] Behavior:
  - Debounced 250 ms, case-insensitive substring match on item name (and synonyms/aliases field if the model has one).
  - While searching: show a flat filtered list across **all categories** (with small category label per item); category chips visually de-emphasized or hidden — choose whichever requires fewer layout changes, but restore state perfectly when the query is cleared.
  - Empty results: existing empty-state component with "No items found for '<query>'".
- [ ] **Layout guard:** the item card/grid dimensions, paddings, chip row height, and safe-area handling must be pixel-identical when search is inactive. Take before/after screenshots on the same device profile and compare. Do not wrap existing lists in new containers that alter flex behavior.
- [ ] Keyboard handling: search input must not be covered by the keyboard; list must remain scrollable while keyboard is open (`keyboardShouldPersistTaps="handled"`).

### 4.3 Acceptance criteria

- Items are alphabetical within every category; search finds items across categories.
- With an empty query, the screen is visually indistinguishable from the current production build (screenshot diff).
- No regressions in category chip rendering.

---

## TASK 5 — Verification & Deployment

### 5.1 Pre-deploy verification (all must pass)

- [ ] Backend: full test suite + new tests (image upload validation, weight recalculation + GST audit, geocode proxy, geospatial regression test). `ruff`/lint clean.
- [ ] RN apps: TypeScript check + lint clean on customer, store, rider.
- [ ] Manual smoke script (record results in `DEPLOY_NOTES.md`):
  1. Store uploads image → visible in customer app.
  2. Kg order end-to-end weight flow (Task 2.6 scenario) including Razorpay estimate → adjusted bill.
  3. Manual address + map pin → nearby store found → order placed.
  4. Search + sort behavior, then clear query → layout identical.
  5. OTP login still works for all three apps (Twilio Verify — regression check only).

### 5.2 Backend deploy

- [ ] Apply any new env vars (`GOOGLE_MAPS_API_KEY` server-side) to the deployment environment **before** deploying code.
- [ ] Run DB migration/index script if the address `location` index or item `image_url` needs backfill (write idempotent script under `backend/scripts/`).
- [ ] Deploy via the existing pipeline; verify health endpoint + one live OTP send post-deploy.

### 5.3 Mobile builds (EAS)

- [ ] Bump `versionCode` (Android) and semantic version in all three apps' `app.json`.
- [ ] `eas build --platform android --profile production` for **customer, store, rider** (sequentially; checkpoint-commit the version bumps first).
- [ ] Upload AABs to the respective **Google Play closed-testing tracks** (customer app is mid closed-testing — do not promote tracks; just push the new build to the same track so the 14-day/12-tester clock is unaffected).
- [ ] Update "What's new" notes per app (1–2 lines, plain language).

### 5.4 Post-deploy

- [ ] Notify tester (Hardik) with a short changelist of the 4 changes and what to specifically test (weight flow + map pin address are the high-risk ones).
- [ ] Monitor backend logs for the first hour: image upload errors, geocode proxy 4xx/5xx, weight PATCH failures.
- [ ] Write `DEPLOY_NOTES.md` summary: what shipped, migration run, known gaps, rollback plan (previous AAB + backend tag).

---

## Out of scope (do NOT do)

- No multiple images per item, no image galleries.
- No changes to piece-based item pricing or the Razorpay integration beyond the existing bill-adjustment flow.
- No redesign of category chips, item cards, or navigation.
- No iOS builds this cycle unless explicitly requested.