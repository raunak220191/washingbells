#!/bin/bash
# WashingBells — Start Backend + Expose via localtunnel
# Usage: ./scripts/start-backend-tunnel.sh
# This exposes http://localhost:8000 via a public HTTPS URL that your phone can reach.

set -e
LT="/usr/local/Cellar/node/23.11.0/bin/lt"
PROJECT="$( cd "$( dirname "$0" )/.." && pwd )"
API_FILE="$PROJECT/lib/api.js"

echo "🧺 WashingBells — Backend Tunnel"
echo ""

# 1. Ensure MongoDB is running
if ! docker ps --filter name=washingbells-mongo --format '{{.Names}}' 2>/dev/null | grep -q washingbells-mongo; then
  echo "📦 Starting MongoDB..."
  docker start washingbells-mongo 2>/dev/null || \
    docker run -d --name washingbells-mongo -p 27017:27017 -v washingbells_data:/data/db mongo:7
  sleep 2
fi
echo "✅ MongoDB running"

# 2. Start backend in background
cd "$PROJECT/backend"
source venv/bin/activate
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 3
echo "✅ Backend running on :8000 (PID $BACKEND_PID)"

# 3. Start localtunnel and capture the URL
echo ""
echo "🌐 Starting public tunnel for backend..."
TUNNEL_URL=$($LT --port 8000 --print-requests 2>/dev/null &
  sleep 5
  # Read from lt output (it prints URL to stdout)
)

# Better approach: run lt and capture URL from its output line
TMPFILE=$(mktemp)
$LT --port 8000 > "$TMPFILE" 2>&1 &
LT_PID=$!
sleep 4

TUNNEL_URL=$(grep -o 'https://[^ ]*\.loca\.lt' "$TMPFILE" | head -1)

if [ -z "$TUNNEL_URL" ]; then
  # Try reading the file content to see what happened
  cat "$TMPFILE"
  echo "❌ Could not get tunnel URL. Check output above."
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

echo "✅ Tunnel URL: $TUNNEL_URL"
echo ""

# 4. Update lib/api.js with the tunnel URL
sed -i '' "s|const DEV_MACHINE_IP = \"[^\"]*\";|// TUNNEL MODE — auto-set by start-backend-tunnel.sh|g" "$API_FILE"
sed -i '' "s|return \`http://\${DEV_MACHINE_IP}:8000/api/v1\`;|return '${TUNNEL_URL}/api/v1';|g" "$API_FILE"

echo "📝 Updated lib/api.js → $TUNNEL_URL/api/v1"
echo ""
echo "⚠️  IMPORTANT: localtunnel may show a 'click to continue' page on first visit."
echo "   Open this URL in your phone's browser first: $TUNNEL_URL"
echo "   Then press any key in the browser to bypass the warning page."
echo ""
echo "🔗 Backend API: $TUNNEL_URL/api/v1"
echo "📄 API Docs:    $TUNNEL_URL/docs"
echo ""
echo "Press Ctrl+C to stop tunnel and backend"
echo "After stopping, your lib/api.js will need the LAN IP restored."
echo ""

# 5. Wait for Ctrl+C, then cleanup
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID 2>/dev/null; kill $LT_PID 2>/dev/null; echo 'Restoring api.js...'; sed -i '' \"s|// TUNNEL MODE.*|const DEV_MACHINE_IP = \\\"$(ipconfig getifaddr en0 2>/dev/null || echo '192.168.1.41')\\\";|g\" \"$API_FILE\"; sed -i '' \"s|return '${TUNNEL_URL}/api/v1';|return \\\`http://\\\${DEV_MACHINE_IP}:8000/api/v1\\\`;|g\" \"$API_FILE\"; echo 'Done. api.js restored to LAN mode.'; exit 0" INT TERM

wait $BACKEND_PID
