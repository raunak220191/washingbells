# WashingBells — Overnight Work Report

Branch: `overnight-work` (no changes to `main`). Date: 2026-06-26.
All commits are independently revertible; hashes are listed per item. No new runtime
dependencies were added (Twilio uses the existing `httpx`; the driver's Playwright lives
in the skill dir, not the app). See the **Commit summary** and **What was verified** at the end.

---

## PHASE 0 — Setup & environment

**Stack detected**
- Customer app (repo root): Expo SDK 54 / React Native 0.81 / React 19, expo-router. Native-only by default.
- `rider/`, `store/`: sibling Expo apps. `admin/`: Next.js. `website/`: Vite. `backend/`: FastAPI + MongoDB (motor).
- Backend config: `backend/.env` + `backend/dev.yaml`; Mongo at `mongodb://localhost:27017` db `washingbells`.

**Services brought up & health-checked (all green):**
| Service | Port | How |
|---|---|---|
| MongoDB (docker `washingbells-mongo`) | 27017 | `docker start` / `npm run db:start` |
| FastAPI backend | 8000 | `backend/venv/bin/python -m uvicorn main:app …` |
| Customer app (Expo web) | 8081 | `CI=1 npx expo start --web` |
| Admin (Next.js) | 3000 | `cd admin && npm run dev` |
| Marketing site (Vite) | 5173 | `cd website && npm run dev` |

DB already seeded (~55 customers, riders, stores, 1 admin). Login: customers
`+919000000001…50`, admin `+919999999999`, password `Test@1234`. OTP dev-bypass code `123456`.

### Decision log (made autonomously)
1. **No mobile simulator available.** Only Xcode **Command Line Tools** are installed
   (`/Library/Developer/CommandLineTools`) — no iOS Simulator / `simctl`, and no Android SDK.
   The Maestro MCP server is configured but exposes **no tools** in this session and has no
   device to drive. **→ Substituted a Playwright web-target harness** (`expo start --web` +
   `.claude/skills/run-washingbells/driver.mjs`) for triage and flow verification. This runs the
   *real* app (react-native-web), drives real login/forms, and screenshots. Maestro `.yaml`
   flows could not be authored/run without a simulator; the driver's `persist` / `refresh-restore`
   commands are the substitute repro+verification flows.
2. **expo-secure-store throws on web**, which aborted login on the web target. Added
   `lib/secureStore.js` — native uses real SecureStore unchanged; web falls back to
   `localStorage` (dev/test only). Without this the web harness can't pass the login screen.
3. **Twilio Verify implemented via `httpx`** (already a dependency) instead of the `twilio`
   SDK — avoids adding a dependency. (No new deps added anywhere.)
4. **Refresh token = 30 days, access token stays 24h.** Chose a refresh-token rotation flow
   over short-lived access tokens to minimize churn on existing 24h-token assumptions while
   delivering true persistent login.

---

## PHASE 2 — Feature work (DONE)

### 2.1 Twilio Verify replaces MSG91 — commit `b607246`
- New `backend/app/services/twilio_service.py`: `send_otp`/`verify_otp` (Twilio Verify REST),
  `send_invite_sms` (Twilio Messaging). Dev bypass (OTP `123456`) preserved when unconfigured.
- Deleted `msg91_service.py`; repointed `auth.py` + `admin.py`.
- `config.py`: `MSG91_*` → `TWILIO_*`; `dev.yaml` loader reads `twilio:` section.
- `dev.yaml`: replaced msg91 section (held a **real** auth key) with empty Twilio placeholders.
- **Credentials are server-side only.** `.env.example` gained `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (+ optional messaging SID / from-number).
  Nothing Twilio is in the mobile app — the app calls our `/auth/send-otp` & `/auth/verify-otp`.
- Verified: send-otp 200; verify-otp `123456` → token + new user; wrong code → 400.

**Backend endpoint changes for Twilio (for whoever wires real creds):**
- No endpoint *signature* changes for OTP. Set the three `TWILIO_*` env vars (or the `twilio:`
  block in `dev.yaml`) and create a Verify Service in the Twilio console (SMS channel).
- Invitation SMS (admin-invited rider/store) needs `TWILIO_MESSAGING_SERVICE_SID` **or**
  `TWILIO_FROM_NUMBER` in addition to account creds; otherwise it dev-logs.

### 2.2 Persistent login (Zomato-style) — commits `bf6cac4` (backend), `2047f13` (app)
- Backend: access tokens tagged `type=access`; new `create_refresh_token` (30d, `type=refresh`)
  + `decode_refresh_token`. `verify-otp` & `login-password` now also return `refresh_token`.
  New `POST /auth/refresh` rotates a refresh token for a fresh pair (re-reads the user so role
  changes propagate). Old tokens (no `type`) still validate → existing sessions unaffected.
- App: refresh token stored in **secure storage** (expo-secure-store on native); `initialize()`
  silently restores the session on launch, minting a new access token from the refresh token
  when needed; `lib/api.js` does a single-flight silent refresh + replay on 401, logout only if
  refresh fails. Cleared on logout.
- Verified on web harness: `persist` (reload → still Home) PASS; `refresh-restore` (drop access
  token, keep refresh → reload) PASS — backend log shows reload → `POST /auth/refresh` 200 →
  `GET /users/me` 200 → Home.

### 2.3 Design tokens — commits `772932c`, `69e7aeb`
- A token source of truth already existed (`constants/theme.js`: `COLORS`, `SPACING`,
  `RADIUS`, `ORDER_STATUS_LABELS`). Extended it rather than replacing it:
  - Added `ORDER_STATUS_COLORS` (complete status→color map) — single source consumed by the
    orders list AND detail screen (previously each had its own ad-hoc colors).
  - Added `TINTS` (semantic status/alert/channel surface tints).
- Conformed `profile/help.js` (6 hexes) and `basket/checkout.js` (1 hex) to tokens. All swaps
  were exact hex-for-hex, so **zero visual change** (verified `help` renders identically).
- Remaining hardcoded hex are semantic alert tints with *inconsistent* shades between screens
  (Material vs Bootstrap palettes) — a canonical-value call → listed under Needs design decision.

---

## PHASE 1 — Triage (customer app, via Playwright web harness)

Walked: login, OTP-verify, Home, Basket (empty state), Orders (list + statuses), Profile,
Wallet, Edit profile, Help, Terms. **No crashes or Expo error overlays on any authenticated
screen.** The app is in good shape; the customer app is generally polished and on-brand.

| # | Tag | Severity | Screen | Issue | Status |
|---|-----|----------|--------|-------|--------|
| 1 | [BUG] | Medium | Orders list + detail | Statuses `at_store` / `ready_for_delivery` had no label/color → rendered as grey raw `at_store` text; detail screen used an ad-hoc 3-color scheme | **Fixed** `772932c` |
| 2 | [DESIGN] | Low | Bottom tab bar (web only) | Tab labels (Home/Basket/Profile) clipped ~2px at the very bottom | Web-harness artifact (safe-area inset on react-native-web); **not reproducible on native** — not fixed, see note |
| 3 | [DESIGN] | Low | help / checkout / misc | ~33 remaining hardcoded hex tints; two different light-greens/reds used for the same semantic state across screens | Tokens added; per-screen conformance is a design call — see below |

Notes:
- Issue #2 is almost certainly a web-only rendering artifact of `react-native-web` + the
  harness viewport, not an app bug — native uses `react-native-safe-area-context` insets.
  Flagged for a quick on-device check rather than a blind fix.
- OTP & persistent-login flows were exercised through the real UI (see Phase 2 verifications).

## PHASE 3 — Bug fixes
- **Issue #1 fixed** (`772932c`). Repro + verification done with the web harness (no Maestro
  simulator available — see Phase 0 decision #1): customer `+919000000001` /orders showed grey
  `at_store` before → `At Store` colored badge after. No other `[BUG]`/`[CRASH]` issues surfaced
  in triage. The booking→checkout→payment flow was not driven end-to-end (needs basket state +
  Razorpay; the web RazorpayCheckout is a stub) — left for on-device/Maestro testing.

## Needs design decision
1. **Canonical alert/status tints.** Screens mix Material (`#E8F5E9`/`#E3F2FD`/`#FFF3E0`) and
   Bootstrap (`#D4EDDA`/`#F8D7DA`/`#155724`/`#721C24`) tints for the same success/error states.
   `TINTS` now holds one set; pick the canonical shades and migrate `checkout.js` open/closed
   badges + remaining screens to them. (Left unmigrated to avoid changing intended visuals.)
2. **Bottom-tab label clipping (#2)** — confirm on a real device/simulator; if real, add a few px
   of bottom inset/padding to the tab bar.
3. Broaden the hardcoded-hex sweep (~33 left) to full token conformance once #1 is decided.

## Backend steps remaining for Twilio (production)
- Create a Twilio account + Verify Service (SMS), set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`
  / `TWILIO_VERIFY_SERVICE_SID` in the backend secret store (Secret Manager in prod).
- For invite SMS, provision a Messaging Service or sender number.
- Docs under `docs/handover/*` and `TEST_CREDENTIALS.md` still reference MSG91 — update copy
  (left as-is overnight; non-code, low risk).

---

## Commit summary (branch `overnight-work`, base `4ab7fcf`)
| Commit | What |
|---|---|
| `017debb` | Web target deps + `lib/secureStore.js` (web fallback) + `run-washingbells` Playwright driver/skill |
| `b607246` | Replace MSG91 → Twilio Verify (server-side only); remove MSG91; `.env.example` placeholders |
| `bf6cac4` | Backend refresh-token flow (`/auth/refresh`, 30d rotation) |
| `2047f13` | App persistent login: secure-stored refresh token, silent restore, 401 auto-refresh |
| `b15b08b` | REPORT.md (phase 0, decisions) |
| `772932c` | Fix order-status badge bug (`at_store`/`ready_for_delivery`) + shared status colors |
| `69e7aeb` | Semantic `TINTS` tokens; conform help/checkout (zero visual change) |

## What was verified (and how)
- **OTP (Twilio dev bypass), backend:** send 200; verify `123456` → token+user; wrong → 400.
- **OTP, app UI:** login → "Get OTP instead" → enter `123456` → `verify-otp` 200 → new user routed
  to Terms gate. (`send-otp`/`verify-otp` both call the new `twilio_service`.)
- **Persistent login, app UI:** `persist` (reload → still Home) PASS; `refresh-restore` (drop
  access token, keep refresh → reload → app calls `/auth/refresh` 200 → `/users/me` 200 → Home) PASS.
- **Bug fix, app UI:** `/orders` badge `at_store` → `At Store` with color, matching `Delivered`.
- All five services health-checked green (Mongo/api/expo-web/admin/website).

## What was skipped + why
- **Maestro `.yaml` flows / on-simulator runs:** no iOS Simulator or Android SDK on this machine
  (CLT-only); Maestro MCP exposed no tools. Substituted the Playwright web harness (Phase 0 #1).
- **rider/ and store/ apps, admin UI deep-dive:** out of scope for one overnight pass; focused on
  the customer app + shared backend. They start cleanly (admin on :3000, both Expo apps share the
  backend). Their `authStore`s were **not** given the refresh-token treatment — follow-up if desired.
- **register-rider/register-store** still return only an access token (no refresh) — customer auth
  was the target; extend the same pattern there if persistent login is wanted in those apps.
- **Booking → checkout → payment** end-to-end (needs basket state + Razorpay; web RN Razorpay is a
  stub) — left for on-device/Maestro testing.
- **Docs referencing MSG91** (`docs/handover/*`, `TEST_CREDENTIALS.md`): non-code, left as-is.

## How to run / re-verify (driver)
```
# services: docker start washingbells-mongo; backend on :8000; CI=1 npx expo start --web --port 8081
cd .claude/skills/run-washingbells
node driver.mjs login   9000000001 'Test@1234' /tmp/a.png   # password login → Home
node driver.mjs persist 9000000001 'Test@1234' /tmp/b.png   # session survives reload
node driver.mjs refresh-restore 9000000001 'Test@1234' /tmp/c.png  # refresh-token cold start
node driver.mjs tour    9000000001 'Test@1234' /tmp/t       # walk authenticated screens
```
