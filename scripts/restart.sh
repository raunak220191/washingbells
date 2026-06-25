#!/bin/bash
# ============================================================
# WashingBells — Full Restart Script
# ============================================================
# Usage: ./scripts/restart.sh
#
# This script:
#   1. Kills all running services
#   2. Starts MongoDB
#   3. Starts the FastAPI backend
#   4. Starts Cloudflare tunnel (for iPhone testing)
#   5. Updates config/dev.js with the tunnel URL
#   6. Prints QR instructions and test credentials
# ============================================================

set -e
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  🧺 WashingBells — Full Restart${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Step 0: Kill everything ─────────────────────────────────
echo -e "${YELLOW}[1/6] Killing existing services...${NC}"
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
pkill -f "lt --port" 2>/dev/null || true
sleep 1
echo -e "${GREEN}  ✓ All ports cleared${NC}"

# ─── Step 1: MongoDB ─────────────────────────────────────────
echo -e "${YELLOW}[2/6] Starting MongoDB...${NC}"
docker start washingbells-mongo 2>/dev/null || \
  docker run -d --name washingbells-mongo -p 27017:27017 -v washingbells_data:/data/db mongo:7 2>/dev/null
sleep 2
MONGO_STATUS=$(docker ps --filter name=washingbells-mongo --format "{{.Status}}" 2>/dev/null)
echo -e "${GREEN}  ✓ MongoDB: $MONGO_STATUS${NC}"

# ─── Step 2: Backend ─────────────────────────────────────────
echo -e "${YELLOW}[3/6] Starting FastAPI backend...${NC}"
cd "$PROJECT/backend"
source venv/bin/activate 2>/dev/null || { echo "  Creating venv..."; python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt -q; }
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 4

if curl -s http://127.0.0.1:8000/health | grep -q "ok"; then
  echo -e "${GREEN}  ✓ Backend running on :8000 (PID $BACKEND_PID)${NC}"
else
  echo -e "${RED}  ✗ Backend failed to start! Check logs.${NC}"
  exit 1
fi

# ─── Step 3: Cloudflare Tunnel ────────────────────────────────
echo -e "${YELLOW}[4/6] Starting Cloudflare tunnel...${NC}"
rm -f /tmp/cf-tunnel.log
cloudflared tunnel --url http://localhost:8000 --no-autoupdate > /tmp/cf-tunnel.log 2>&1 &
CF_PID=$!

# Wait for tunnel URL
CF_URL=""
for i in $(seq 1 1200); do
  CF_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-tunnel.log 2>/dev/null | head -1)
  if [ -n "$CF_URL" ]; then break; fi
  sleep 1
done

if [ -z "$CF_URL" ]; then
  echo -e "${RED}  ✗ Cloudflare tunnel failed. Using LAN IP fallback.${NC}"
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
  CF_URL="http://$LAN_IP:8000"
fi
echo -e "${GREEN}  ✓ Tunnel: $CF_URL${NC}"

# ─── Step 4: Update config/dev.js ────────────────────────────
echo -e "${YELLOW}[5/6] Updating config/dev.js...${NC}"
cd "$PROJECT"
python3 -c "
import re
with open('config/dev.js', 'r') as f: c = f.read()
c = re.sub(r'const DEV_BACKEND_URL = \"[^\"]*\";', 'const DEV_BACKEND_URL = \"$CF_URL\";', c)
with open('config/dev.js', 'w') as f: f.write(c)
print('  ✓ config/dev.js → $CF_URL')
"

# ─── Step 5: Verify tunnel ───────────────────────────────────
echo -e "${YELLOW}[6/6] Verifying tunnel...${NC}"
HEALTH=$(curl -s --max-time 8 "$CF_URL/health" 2>/dev/null)
if echo "$HEALTH" | grep -q "ok"; then
  echo -e "${GREEN}  ✓ Tunnel verified: $CF_URL/health → OK${NC}"
else
  echo -e "${YELLOW}  ⚠ Tunnel slow — may need a few more seconds${NC}"
fi

# ─── Write test info file ────────────────────────────────────
cat > "$PROJECT/TEST_INFO.md" << TESTEOF
# 🧺 WashingBells — Test Session

## Backend API
\`$CF_URL\`

Swagger Docs: \`$CF_URL/docs\`

## 📱 How to test on iPhone

1. Open a NEW terminal tab and run:
   \`\`\`
   cd $PROJECT && npx expo start -c --tunnel
   \`\`\`
2. Scan the QR code with iPhone Camera → Opens in Expo Go
3. Wait ~20s for first bundle compile

## 🔐 Test Credentials

| Field | Value |
|-------|-------|
| Phone | \`+919876543210\` (any +91 number works) |
| OTP   | \`123456\` (dev bypass — no SMS sent) |

## 🧪 Test Flow

1. **Login** → Enter phone → OTP: 123456
2. **Home** → See banners, services, testimonials
3. **Service** → Tap "Wash & Fold" → Add shirts, pants
4. **Basket** → View cart → "Checkout"
5. **Checkout** → Select pickup/delivery date+time → Enter coupon or skip → Choose "Pay Now" or "COD" → Place Order
6. **Orders** → Tap order → See lifecycle timeline + garment tags
7. **Profile** → See wallet → Tap "Top Up" → Add money
8. **Help** → Profile → Help & Support → WhatsApp/Call/Email

## Services Available
- Dry Clean (per piece)
- Wash & Steam Iron (per piece)
- Wash & Fold (per piece)
- Shoe Cleaning (per piece)
- Steam Iron (per piece)
- **Premium Laundry (per KG)**
- **Sofa Cleaning (at-home service)**

## ⏹ Stop Everything
\`\`\`
lsof -ti:8000 | xargs kill -9 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
docker stop washingbells-mongo
\`\`\`
TESTEOF

# ─── Final Output ────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ All services running!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  📦 MongoDB:    ${GREEN}Running${NC}"
echo -e "  🚀 Backend:    ${GREEN}$CF_URL${NC}"
echo -e "  📄 API Docs:   ${GREEN}$CF_URL/docs${NC}"
echo ""
echo -e "${YELLOW}  ▶ NEXT: Open a new terminal tab and run:${NC}"
echo -e "    ${CYAN}cd $PROJECT && npx expo start -c --tunnel${NC}"
echo ""
echo -e "  📱 Then scan the QR code with your iPhone Camera"
echo ""
echo -e "${CYAN}  ────────────────────────────────────────────${NC}"
echo -e "  🔐 Login: Phone ${GREEN}+919876543210${NC}  OTP ${GREEN}123456${NC}"
echo -e "${CYAN}  ────────────────────────────────────────────${NC}"
echo ""
echo -e "  📋 Full test guide: ${CYAN}TEST_INFO.md${NC}"
echo ""

# Keep this script running (backend + tunnel are background children)
echo -e "${YELLOW}  Press Ctrl+C to stop all services${NC}"
echo ""

cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping services...${NC}"
  kill $BACKEND_PID 2>/dev/null
  kill $CF_PID 2>/dev/null
  # Restore config to LAN IP
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "192.168.1.41")
  cd "$PROJECT"
  python3 -c "
import re
with open('config/dev.js', 'r') as f: c = f.read()
c = re.sub(r'const DEV_BACKEND_URL = \"[^\"]*\";', 'const DEV_BACKEND_URL = \"http://$LAN_IP:8000\";', c)
with open('config/dev.js', 'w') as f: f.write(c)
" 2>/dev/null
  echo -e "${GREEN}  ✓ config/dev.js restored to LAN mode (http://$LAN_IP:8000)${NC}"
  echo -e "${GREEN}  ✓ All services stopped${NC}"
  exit 0
}
trap cleanup INT TERM

wait $BACKEND_PID
