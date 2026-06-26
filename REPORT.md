# WashingBells — Overnight Work Report

Branch: `overnight-work` (no changes to `main`). Date: 2026-06-26.
All commits are independently revertible; hashes are listed per item.

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

### 2.3 Design tokens — see status below (in progress)

---

## PHASE 1 — Triage  (in progress; see Issues section)

## PHASE 3 — Bug fixes  (pending triage)

## Needs design decision
- _(to be filled)_

## Backend steps remaining for Twilio (production)
- Create a Twilio account + Verify Service (SMS), set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`
  / `TWILIO_VERIFY_SERVICE_SID` in the backend secret store (Secret Manager in prod).
- For invite SMS, provision a Messaging Service or sender number.
- Docs under `docs/handover/*` and `TEST_CREDENTIALS.md` still reference MSG91 — update copy
  (left as-is overnight; non-code, low risk).
