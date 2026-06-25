# 16 — Conventions & Gotchas

Read this before writing code. Every item here is a real trap that has already
caused a bug or wasted time in this codebase.

## Backend

### Naive vs aware datetimes (MongoDB)
MongoDB returns **naive** datetimes (no tzinfo). The codebase uses
`datetime.now(timezone.utc)` (**aware**). Comparing them in Python raises
`TypeError: can't compare offset-naive and offset-aware datetimes`. **Always
coerce** before comparing:
```python
if dt is not None and dt.tzinfo is None:
    dt = dt.replace(tzinfo=timezone.utc)
```
(This 500'd the coupon validate + order-create paths.)

### IST vs UTC for "today" logic
Store hours/slots are **local IST**. When deciding if a slot is in the past for
*today*, compare against IST, not UTC:
```python
now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
```
India has no DST, so a fixed +5:30 is correct.

### FastAPI route ordering
A **static** path segment must be declared **before** a sibling **dynamic**
`/{param}` route, or FastAPI matches the static path as the param and 500s.
Examples that bit us: `/admin/riders/online` was shadowed by
`/admin/riders/{rider_id}`; `/admin/db/_audit/log` by `/admin/db/{collection}/{doc_id}`.
Declare the specific route first.

### Passwords use `bcrypt` directly
`passlib` 1.7.4 is broken against `bcrypt` 5.x on Python 3.13. Use the `bcrypt`
library directly (`core/security.py`). Don't reintroduce passlib hashing.

### Razorpay uses REST, not the SDK
The `razorpay` pip SDK imports `pkg_resources` (removed in Python 3.13) and
crashes on import. The service talks to the REST API via httpx. Don't re-add
the SDK.

### Side effects are best-effort
Push/email after a state change are wrapped in `try/except` so they never fail
the request. Keep that pattern. Always append to `order["status_timeline"]` on
a status change.

### Response models need complete documents
Endpoints with `response_model=OrderResponse` will 500 if the order dict is
missing required fields. Real orders (via `create_order`) are complete; hand-
built test docs may not be.

## Mobile (Expo / expo-router)

### Every tab folder needs a `_layout.js`
A tab folder (e.g. `(tabs)/home/`) must contain a `_layout.js` (a `Stack`) so it
collapses to the tab name. Missing one → `No route named "home"` warnings and
broken back navigation (`GO_BACK was not handled`). New route files need a
**Metro restart with `-c`**, not a hot reload.

### Guard `router.back()`
On screens reachable without history (deep link / push / reset stack),
`router.back()` throws `GO_BACK was not handled`. Use:
```js
router.canGoBack() ? router.back() : router.replace("/(tabs)/...")
```

### Install Expo packages with `expo install`
`npx expo install <pkg>` picks the SDK-54-correct version. Plain
`npm install <pkg>` pulls the latest (newer-SDK) version, which mismatches the
native runtime and breaks (e.g. `expo-notifications`, `expo-file-system`,
`datetimepicker` all got pulled to SDK-56 versions and broke). Verify with
`npx expo install --check`.

### Three apps, no shared code
A change to a shared concept (auth store action, theme token, the reschedule
modal) must be applied in **each** app (`app/`+root, `rider/`, `store/`). They
have separate `node_modules` and themes.

### `react-native-webview` is Expo-Go-compatible
The Razorpay checkout uses it; it's bundled in Expo Go. It's lazy/guarded so a
missing native module (un-rebuilt dev build) degrades gracefully.

### Local date strings, not `toISOString()`
`toISOString()` converts to UTC and can shift the date a day in IST. For
`YYYY-MM-DD` slot dates, format from **local** components:
```js
`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
```

## Ops

### Don't kill the dev backend
The user's backend runs on **:8000**. Never `pkill -f "uvicorn main:app"`
unqualified in a script — it kills the running session (admin → Network Error).
Use a unique port + `pkill -f "uvicorn main:app --port 80XX"` for test servers.

### Config is cached
`get_settings()` is `@lru_cache`d. Restart the backend after editing
`dev.yaml`/`.env`.

## Design system

Each app's `constants/theme.js` exports `COLORS`, `SPACING`, `RADIUS`, and
`SHADOW`. Use the tokens (and `...SHADOW` for card elevation) rather than
hardcoding values, for visual consistency.
