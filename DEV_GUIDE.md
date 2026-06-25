# 🧺 WashingBells — Developer Run Guide

> Test the app on iPhone via **Expo Go** + **Cloudflare tunnel**
> No Xcode, no Android Studio required.

---

## ⚡ Quick Start (Every Session)

Open **4 terminal tabs** and run one command per tab:

| Tab | Command |
|-----|---------|
| 1 — MongoDB | `docker start washingbells-mongo` |
| 2 — Backend | `cd ~/Downloads/WashingBells/backend && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000` |
| 3 — CF Tunnel | `cloudflared tunnel --url http://localhost:8000 --no-autoupdate` |
| 4 — Expo | `cd ~/Downloads/WashingBells && npx expo start -c --tunnel` |

After Tab 3 starts → copy the `https://xxxx.trycloudflare.com` URL → paste into `config/dev.js`

---

## 🔁 Step-by-Step (First Launch)

### Step 1 — MongoDB

```zsh
# First time only (creates the container):
docker run -d --name washingbells-mongo \
  -p 27017:27017 \
  -v washingbells_data:/data/db \
  mongo:7

# Every session after that:
docker start washingbells-mongo
```

Verify: `docker ps --filter name=washingbells-mongo`

---

### Step 2 — Backend (FastAPI)

```zsh
cd ~/Downloads/WashingBells/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify: `curl http://localhost:8000/health`
Expected: `{"status":"ok"}`

---

### Step 3 — Cloudflare Tunnel (exposes backend to iPhone)

```zsh
cloudflared tunnel --url http://localhost:8000 --no-autoupdate
```

After ~5 seconds you'll see:
```
INF | https://some-random-words.trycloudflare.com |
```

**Copy that URL.**
Verify: `curl https://YOUR-URL/health` → `{"status":"ok"}`

> ⚠️ The URL is random and changes every restart. Always update config/dev.js after restarting.

---

### Step 4 — Update config/dev.js

Open `config/dev.js` and paste the Cloudflare URL:

```js
const DEV_BACKEND_URL = "https://some-random-words.trycloudflare.com";
```

---

### Step 5 — Start Expo

```zsh
cd ~/Downloads/WashingBells
npx expo start -c --tunnel
```

- Log in with Expo account `rp2201` if prompted
- QR code appears in terminal

---

### Step 6 — Open on iPhone

1. Open **Camera** app on iPhone
2. Scan the QR code
3. Tap banner → opens in **Expo Go**
4. Wait ~20 seconds for first bundle compile

---

## 🔐 Test Login

```
Phone: +919876543210  (any number works)
OTP:   123456         (dev bypass — no SMS sent)
```

---

## 🛑 Stop Everything

```zsh
lsof -ti:8000 | xargs kill -9 2>/dev/null  # Stop backend
lsof -ti:8081 | xargs kill -9 2>/dev/null  # Stop Metro
pkill -f "cloudflared tunnel" 2>/dev/null  # Stop tunnel
docker stop washingbells-mongo             # Stop MongoDB
echo "All stopped"
```

---

## 🔄 Restart Individual Services

### Backend only
```zsh
lsof -ti:8000 | xargs kill -9 2>/dev/null
cd ~/Downloads/WashingBells/backend && source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Metro/Expo only (clears bundle cache)
```zsh
lsof -ti:8081 | xargs kill -9 2>/dev/null
cd ~/Downloads/WashingBells && npx expo start -c --tunnel
```

### Cloudflare Tunnel only
```zsh
pkill -f "cloudflared tunnel"
cloudflared tunnel --url http://localhost:8000 --no-autoupdate
# New URL printed → update config/dev.js → shake phone in Expo Go → Reload
```

---

## 🔍 Health Checks

```zsh
# All services at once
echo "Mongo:" && docker ps --filter name=washingbells-mongo --format "{{.Status}}"
echo "Backend:" && curl -s http://localhost:8000/health
echo "Metro:" && curl -s http://localhost:8081/status

# Test auth flow
curl -X POST http://localhost:8000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

curl -X POST http://localhost:8000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "code": "123456"}'

# List services
curl http://localhost:8000/api/v1/services | python3 -m json.tool | head -30
```

---

## 📁 Key Files

| File | What it does |
|------|-------------|
| `config/dev.js` | **Update this every session** — Cloudflare tunnel URL |
| `lib/api.js` | Axios client — reads URL from config/dev.js |
| `backend/.env` | Backend secrets (JWT, Twilio, Razorpay) |
| `backend/requirements.txt` | Python dependencies |
| `package.json` | Frontend dependencies |
| `app.json` | Expo config (bundle ID, plugins, scheme) |

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| "Request timed out" in Expo Go | Bundle compiling — wait 30s, try again |
| "SDK version mismatch" | `npx expo install --fix` then restart Expo |
| API calls fail on iPhone | Tunnel URL expired → restart cloudflared → update `config/dev.js` → shake phone → Reload |
| `ModuleNotFoundError: pkg_resources` | `pip install setuptools` in the backend venv |
| MongoDB connection refused | `docker start washingbells-mongo` |
| Port already in use | `lsof -ti:PORT | xargs kill -9` |
| White screen / crash in Expo Go | Shake phone → Reload |
| Expo tunnel "log in" loop | Run `npx expo login` in terminal first |
| npm install fails with ERESOLVE | Use `npm install --legacy-peer-deps` |

---

## 📦 First-Time Setup

```zsh
# 1. Frontend dependencies
cd ~/Downloads/WashingBells
npm install --legacy-peer-deps

# 2. Backend Python venv
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install setuptools          # Required for Python 3.13+

# 3. Expo login (needed for --tunnel mode)
cd ~/Downloads/WashingBells
npx expo login
# Enter username: rp2201
```

---

## 🗺️ What's Built

| Screen | Done |
|--------|------|
| Login — phone + OTP | ✅ |
| Onboarding | ✅ |
| Home — services grid | ✅ |
| Service detail + item picker | ✅ |
| Address manager — GPS auto-fill | ✅ |
| Basket / Cart | ✅ |
| Checkout — time slot + address | ✅ |
| Orders list | ✅ |
| Order detail | ✅ |
| Profile | ✅ |

## 🔮 Not Yet Built

| Feature | Notes |
|---------|-------|
| Real Razorpay payments | Mock only — needs `react-native-razorpay` |
| Google Maps address picker | GPS works, no Places autocomplete yet |
| Push notifications | `expo-notifications` not started |
| Real-time order tracking | WebSocket not started |
| Rider app | Phase 3 |
| App Store / Play Store | EAS Build not configured |
