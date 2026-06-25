#!/bin/bash
# Simple service starter for WashingBells

cd "$(dirname "$0")/.."
PROJECT="$(pwd)"

echo "🧺 Starting WashingBells Services..."
echo ""

# 1. Start MongoDB
echo "[1/3] MongoDB..."
docker start washingbells-mongo 2>/dev/null || docker run -d --name washingbells-mongo -p 27017:27017 -v washingbells_data:/data/db mongo:7
sleep 2
echo "✓ MongoDB running"

# 2. Start Backend
echo "[2/3] FastAPI Backend..."
cd "$PROJECT/backend"
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/wb-backend.log 2>&1 &
BACKEND_PID=$!
sleep 4
curl -s http://127.0.0.1:8000/health > /dev/null && echo "✓ Backend running on :8000 (PID $BACKEND_PID)" || { echo "✗ Backend failed"; exit 1; }

# 3. Start Cloudflare Tunnel
echo "[3/3] Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:8000 --no-autoupdate > /tmp/wb-tunnel.log 2>&1 &
CF_PID=$!

# Wait for tunnel URL (max 20 minutes)
CF_URL=""
for i in $(seq 1 1200); do
  CF_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/wb-tunnel.log 2>/dev/null | head -1)
  if [ -n "$CF_URL" ]; then break; fi
  sleep 1
  if [ $((i % 10)) -eq 0 ]; then echo "  Waiting for tunnel... (${i}s)"; fi
done

if [ -z "$CF_URL" ]; then
  echo "✗ Tunnel failed after 20 minutes"
  exit 1
fi

echo "✓ Tunnel: $CF_URL"

# Update config
cd "$PROJECT"
python3 << 'PYEOF'
import re
with open('config/dev.js', 'r') as f:
    content = f.read()
with open('/tmp/wb-tunnel.log', 'r') as f:
    for line in f:
        if 'trycloudflare.com' in line:
            import re
            match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
            if match:
                url = match.group(0)
                content = re.sub(r'const DEV_BACKEND_URL = "[^"]*";', f'const DEV_BACKEND_URL = "{url}";', content)
                with open('config/dev.js', 'w') as out:
                    out.write(content)
                print(f"✓ config/dev.js updated → {url}")
                break
PYEOF

# Create TEST_INFO.md
cat > "$PROJECT/TEST_INFO.md" << 'EOF'
# 🧺 WashingBells Test Session

## Backend API
**Tunnel URL:** Check `config/dev.js` for current URL

**Swagger Docs:** `<TUNNEL_URL>/docs`

## 📱 Test on iPhone

### Step 1: Start Expo
Open a **NEW terminal** and run:
```bash
cd /Users/raunakpandey/Downloads/WashingBells
npx expo start -c --tunnel
```

### Step 2: Scan QR
- Scan QR code with iPhone Camera
- Opens in Expo Go
- Wait ~20s for first bundle

## 🔐 Test Credentials

| Field | Value |
|-------|-------|
| Phone | `+919876543210` (any +91 number) |
| OTP   | `123456` (dev bypass) |

## 🧪 Complete Test Flow

1. **Login** → Phone: +919876543210 → OTP: 123456
2. **Home** → Browse banners, services, testimonials  
3. **Add Items** → Tap service → Add garments → Basket
4. **Checkout** → Select pickup/delivery dates → Apply coupon (optional) → Choose COD or Pay Now
5. **Order Detail** → View timeline, garment tags, agent info
6. **Wallet** → Profile → Wallet → Top up ₹100/200/500/1000
7. **Refer & Earn** → Home → Refer banner → Share code
8. **Help** → Profile → Help & Support → Contact options

## 🛑 Stop Services
```bash
pkill -f "uvicorn|cloudflared"
docker stop washingbells-mongo
```

---
**Services Started:** $(date)
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All Services Running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📦 MongoDB:    Running"
echo "  🚀 Backend:    http://localhost:8000"
echo "  🌐 Tunnel:     $CF_URL"
echo "  📄 Docs:       $CF_URL/docs"
echo ""
echo "  📋 Full Guide: TEST_INFO.md"
echo ""
echo "▶ NEXT STEP: Open NEW terminal and run:"
echo "  npx expo start -c --tunnel"
echo ""
echo "🔐 Login: +919876543210 / OTP: 123456"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Cleanup handler
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $BACKEND_PID 2>/dev/null
  kill $CF_PID 2>/dev/null
  echo "✓ Services stopped"
  exit 0
}
trap cleanup INT TERM

# Keep running
wait $BACKEND_PID
