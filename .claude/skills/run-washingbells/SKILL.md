---
name: run-washingbells
description: Run, launch, build, screenshot, or drive the WashingBells customer mobile app (Expo/React Native) on the web target via Playwright. Use when asked to start the app, log in, screenshot a screen, or verify a UI change in the customer app. Also brings up its backend stack (MongoDB + FastAPI) so authenticated screens work.
---

# Run the WashingBells customer app

The unit is the **repo-root Expo app** ("WashingBells", the customer-facing
app — expo-router, Expo SDK 54, RN 0.81, React 19). It can't be driven natively
in an agent shell, so we run it on the **web target** (`expo start --web`,
react-native-web) and drive it with **Playwright** through
[.claude/skills/run-washingbells/driver.mjs](driver.mjs). Screenshots land in `/tmp`.

All paths below are relative to the repo root (`/Users/raunakpandey/Downloads/WashingBells`).

Every authenticated screen calls the backend, so the app is only useful with the
**backend stack running**: MongoDB (docker) + FastAPI (:8000). Start those first.

## Prerequisites (macOS, already satisfied on this machine)

- Node ≥ 20, Docker Desktop, Python 3.13 venv at `backend/venv` (deps preinstalled).
- The driver is self-contained: `playwright` is installed in the skill dir, and the
  chromium build lives in the shared `~/Library/Caches/ms-playwright`.

One-time setup that was needed (already applied to this repo — listed so a clean
clone can reproduce):

```bash
# 1) web runtime deps for expo (added to root package.json)
npx expo install react-dom react-native-web

# 2) self-contained playwright for the driver
( cd .claude/skills/run-washingbells && npm install && npx playwright install chromium )
```

The repo already contains a web-safe storage shim at `lib/secureStore.js`
(expo-secure-store throws on web → token never persisted → login can't complete).
`lib/api.js`, `lib/invoice.js`, and `stores/authStore.js` import it instead of
`expo-secure-store`. Native behaviour is unchanged. Don't revert this or web login breaks.

## Build / start the backend stack (do this first)

```bash
# MongoDB on :27017 (reuses the named volume; data persists across restarts)
docker start washingbells-mongo 2>/dev/null || npm run db:start
# wait until it answers
until docker exec washingbells-mongo mongosh --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null | grep -q 1; do sleep 1; done

# FastAPI on :8000 (use the venv python, NOT system python3)
( cd backend && ./venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/wb-backend.log 2>&1 & )
until curl -s -o /dev/null http://localhost:8000/docs; do sleep 1; done
```

The mongo volume is already seeded (≈55 customers, riders, stores, 1 admin).
**Login credentials:** customers `+919000000001`…`+919000000050`,
admin `+919999999999`, all with password `Test@1234`. (Re-seed if empty:
`backend/venv/bin/python -m backend.scripts.seed_dummy_data` — idempotent.)

## Run (agent path) — start expo web, then drive it

```bash
# Start metro/web on :8081 in the background (CI=1 => non-interactive, no watch)
CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081 > /tmp/wb-expo.log 2>&1 &
until grep -q "Waiting on http://localhost:8081" /tmp/wb-expo.log; do sleep 1; done
```

Then use the driver (it lives in the skill dir and has its own node_modules):

```bash
cd .claude/skills/run-washingbells

# Open the app, wait for hydration, screenshot the login screen
node driver.mjs shot /tmp/wb-shot.png

# Log in as a seeded customer and screenshot the result (lands on Home)
node driver.mjs login 9000000001 'Test@1234' /tmp/wb-home.png

# Navigate to an expo-router route (parens groups are stripped from the URL)
node driver.mjs goto terms /tmp/wb-terms.png
```

The driver renders at iPhone size (390×844), waits up to 60s for the first
Metro bundle, prints a sample of the page text, and writes the PNG. Then
**look at the screenshot** to confirm the flow. A successful login shows
"Good Morning, Test Customer 1!" and the services grid.

## Run (human path)

`npm run web` opens the app in your desktop browser at http://localhost:8081.
Fine for eyeballing; useless for an agent (no programmatic handle) — use the driver.

## Other services in the stack (started this session, for reference)

| Service          | Port  | Start command                                  |
|------------------|-------|------------------------------------------------|
| Customer app web | 8081  | `npx expo start --web --port 8081`             |
| FastAPI backend  | 8000  | `backend/venv/bin/python -m uvicorn main:app …`|
| MongoDB          | 27017 | `npm run db:start` / `docker start washingbells-mongo` |
| Admin (Next.js)  | 3000  | `cd admin && npm run dev`                       |
| Marketing site   | 5173  | `cd website && npm run dev`                      |

## Gotchas (things that bit me)

- **expo-secure-store throws on web.** Its `setItemAsync` is `await`ed without a
  try/catch in `stores/authStore.js:loginWithPassword`, so on web the login API
  returns 200 but the exception aborts navigation → you stay on the login screen.
  Fixed by `lib/secureStore.js` (localStorage fallback gated on `Platform.OS==='web'`).
- **Data-fetching screens redbox without a backend.** Any screen that fetches on
  mount (e.g. `/terms` → `fetchLatestTerms`) shows Expo's full-screen red error
  overlay if :8000 is down. The login screen does *not* fetch on mount, so it's
  the safe first screenshot. Start the backend before driving deeper screens.
- **The app's dev API base is a LAN IP**, `config/dev.js` → `http://192.168.1.41:8000`.
  That happens to be this Mac's IP (`ipconfig getifaddr en0`), so the browser
  reaches the backend. On a machine with a different IP, set it to `localhost:8000`.
- **First web bundle is slow** (~10–60s) and compiles on first HTTP request, not at
  `expo start`. The driver waits 60s for hydration; don't shorten it.
- **Metro runs in CI mode** here (`CI=1`) → no hot reload. After editing app source,
  kill and restart expo (add `--clear` to bust the cache) before re-driving.
- **Playwright needs its own chromium.** Fresh `npm install` of playwright errors
  with "Executable doesn't exist" until `npx playwright install chromium` (~99 MB).
- **Backend port hygiene:** never `pkill uvicorn` unqualified — kill by the tracked
  pid (`/tmp/wb-backend.pid`) so you don't take down another backend.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Driver: `browserType.launch: Executable doesn't exist …chrome-headless-shell` | `cd .claude/skills/run-washingbells && npx playwright install chromium` |
| Driver hangs then errors at hydrate; `/tmp/wb-error.png` blank | Metro not up or still bundling. Check `/tmp/wb-expo.log` for "Waiting on http://localhost:8081"; re-prime with `curl http://localhost:8081/`. |
| Login screenshot stays on login screen | Backend down or wrong creds. Verify `curl -s -XPOST http://localhost:8000/api/v1/auth/login-password -H 'Content-Type: application/json' -d '{"phone":"+919000000001","password":"Test@1234"}'` returns a token. |
| `ERR_CONNECTION_REFUSED` in driver logs | Backend not running on :8000, or `config/dev.js` IP isn't this machine. |
| Backend: `Connection refused` to mongo at startup | `docker start washingbells-mongo` (or Docker Desktop daemon is down → `open -a Docker`). |
