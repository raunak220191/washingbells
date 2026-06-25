# 02 — Getting Started (Local Development)

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.13 | backend (`backend/venv` already exists) |
| Node.js | 18+ | all 4 frontends |
| Docker | any | runs MongoDB (or install Mongo natively) |
| Expo Go app | latest | on a physical phone, to run the mobile apps |
| `watchman` | optional | faster Metro file watching (macOS: `brew install watchman`) |

## One-command launch (recommended)

```bash
./scripts/dev.sh
```

This script:
1. Kills stale Metro/uvicorn/next processes.
2. **Cleans caches** (Metro, Watchman, the admin `.next` build) — pass
   `--no-clean` to skip for a faster restart.
3. Starts MongoDB in Docker (`washingbells-mongo`).
4. Starts the FastAPI backend on `:8000` and waits for `/health`.
5. Opens 4 Terminal windows: customer (`:8081`), rider (`:8082`),
   store (`:8083`), admin (`:3000`).

## Manual setup (if you prefer)

### 1. MongoDB
```bash
docker run -d --name washingbells-mongo -p 27017:27017 \
  -v washingbells_data:/data/db mongo:7
```

### 2. Backend
```bash
cd backend
source venv/bin/activate          # venv already present
pip install -r requirements.txt   # only if deps changed
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Visit `http://localhost:8000/docs` for live Swagger UI.

### 3. Seed test data (first run)
```bash
cd backend && python -m scripts.seed_dummy_data
```
Creates 50 customers, 20 riders, 10 stores, 1 admin — all password `Test@1234`.
See doc 13 for the full credential list.

### 4. Mobile apps (customer / rider / store)
Each is a separate Expo project:
```bash
# customer (repo root)
npx expo start --port 8081
# rider
cd rider && npx expo start --port 8082
# store
cd store && npx expo start --port 8083
```
Scan the QR with Expo Go. **Important:** set each app's backend URL to your
machine's LAN IP in `config/dev.js` (customer at repo root, then `rider/config/dev.js`,
`store/config/dev.js`) — phones can't reach `localhost`.

### 5. Admin panel
```bash
cd admin && npm run dev    # http://localhost:3000
```
The API URL is in `admin/.env.local` (`NEXT_PUBLIC_API_URL`, default
`http://localhost:8000/api/v1`).

## Logging in

OTP delivery (MSG91) is not yet fully live, so **all apps support phone +
password login** (the "Login with Password" button). Use any seeded account,
e.g. customer `+919000000001` / `Test@1234`. Full list in doc 13.

The legacy OTP dev-bypass code is `123456` when MSG91 is unconfigured.

## Verifying it works

- Backend: `curl http://localhost:8000/health` → `{"status":"ok"}`
- API auth: log in via the app, or `POST /api/v1/auth/login-password`.
- Admin: open `http://localhost:3000`, log in with `+919999999999 / Test@1234`.

## Common first-run issues

See doc 14 (Troubleshooting). The big ones:
- **Admin "Network Error"** → backend isn't running on `:8000`. Start it.
- **Mobile app can't connect** → wrong IP in `config/dev.js`, or phone not on
  the same Wi-Fi.
- **New route file / dependency not picked up** → restart Metro with `-c`
  (`npx expo start -c`); `dev.sh` does this for you.
