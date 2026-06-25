# 14 — Troubleshooting

Real issues that have occurred, and their fixes.

## Admin shows "AxiosError: Network Error"

The admin (browser) can't reach the backend at `localhost:8000`.
- **Cause**: the backend isn't running, crashed, or was killed.
- **Check**: `curl http://localhost:8000/health` → should be `{"status":"ok"}`.
- **Fix**: start the backend (`scripts/dev.sh`, or
  `cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000`).
- A **403** (not a Network Error) just means you're not logged in — that's fine.
- ⚠️ Never run `pkill -f "uvicorn main:app"` unqualified — it kills the running
  backend. Use a port-qualified kill for throwaway test servers.

## Mobile app can't connect to the backend

- The app uses `config/dev.js` → must be your machine's **LAN IP**, not
  `localhost` (phones can't reach the host's localhost).
- Phone and computer must be on the **same Wi-Fi**.
- Verify: open `http://<LAN-IP>:8000/health` in the phone's browser.

## "No route named X" / `GO_BACK was not handled`

expo-router tab/route structure problem.
- Every tab folder needs a `_layout.js` (Stack) so it collapses to the tab name.
- A back button on a screen with no history dispatches an unhandled `GO_BACK` —
  guard with `router.canGoBack() ? router.back() : router.replace(<fallback>)`.
- New route files require a **Metro restart** (`npx expo start -c`), not a hot
  reload.

## New dependency / native module behaves oddly

- Restart Metro with a clean cache: `npx expo start -c` (or `scripts/dev.sh`,
  which cleans caches).
- For Expo packages, install with `npx expo install <pkg>` so the **SDK-correct
  version** is chosen. A plain `npm install <pkg>@latest` pulls a version meant
  for a newer SDK and breaks at runtime.
- Verify versions: `npx expo install --check` (per app).

## OTP not received

- Expected right now: MSG91 OTP is **blocked on DLT template approval**
  (doc 10). The API returns `success` but doesn't deliver until the OTP
  template's DLT Template ID is set on the MSG91 dashboard.
- Use **password login** (`Test@1234`) meanwhile.
- In MSG91 logs, look up the request: pause code `211` / `dltTeId: null` =
  missing DLT template binding.

## Razorpay payment "doesn't work"

- The backend uses the **REST API via httpx** (not the SDK). Don't re-add the
  `razorpay` pip package (it crashes on Python 3.13: `No module named
  'pkg_resources'`).
- On mobile, the WebView checkout needs `react-native-webview` (installed). It
  has a Cancel button + error boundary so a payment hiccup never blocks the
  order — the order is placed first, payment is best-effort.
- Use Razorpay **test** instruments (card `4111 1111 1111 1111`).

## Coupon "isn't working"

- Was a 500 from comparing a **naive** Mongo datetime against an **aware**
  `datetime.now(timezone.utc)`. Fixed by coercing Mongo datetimes to UTC-aware
  before comparison. If you add new date comparisons, do the same (doc 16).

## Slot picker shows nothing / wrong "today"

- Slots for **today** mark past ones unavailable using **IST**. If you see
  off-by-5.5-hours behaviour, check `store_hours_service.py` uses IST, not UTC.

## passlib / bcrypt error on startup

- The project hashes passwords with the **`bcrypt`** library directly (not
  passlib) because passlib 1.7.4 is broken against bcrypt 5.x on Python 3.13.
  Keep using `bcrypt` directly in `core/security.py`.

## Backend won't start

- Check the log (`/tmp/wb-backend.log` if started via dev.sh).
- Common: a stale `.env` referencing a setting that was removed (pydantic
  `extra_forbidden`). Match `.env` keys to `Settings` in `config.py`.
- MongoDB not running → `docker start washingbells-mongo`.
