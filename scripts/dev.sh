#!/bin/bash
# WashingBells — full dev launcher
# Starts backend, then opens 3 Terminal windows (customer / rider / store)
# each with their own Metro on separate ports.

set -e

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

# Pass --no-clean to skip the cache wipe (faster restarts).
CLEAN=1
[ "$1" = "--no-clean" ] && CLEAN=0

# ── 1. Kill stale processes ──────────────────────────────────────────────────
echo "Stopping any running Metro / uvicorn processes..."
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "expo start"       2>/dev/null || true
pkill -f "react-native/cli" 2>/dev/null || true
pkill -f "next dev"         2>/dev/null || true
pkill -f "next-server"      2>/dev/null || true
sleep 1

# ── 1b. Clean caches (Metro / Expo / Next.js) ────────────────────────────────
# Stale Metro / Next build caches cause "Network Error" and module-resolution
# weirdness after dependency changes (e.g. a newly added native module).
if [ "$CLEAN" = "1" ]; then
  echo "Cleaning caches..."
  command -v watchman >/dev/null 2>&1 && watchman watch-del-all >/dev/null 2>&1 || true
  rm -rf "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-* 2>/dev/null || true
  rm -rf "$PROJECT/node_modules/.cache" \
         "$PROJECT/rider/node_modules/.cache" \
         "$PROJECT/store/node_modules/.cache" \
         "$PROJECT/admin/.next" \
         "$PROJECT/admin/node_modules/.cache" \
         "$PROJECT/backend"/**/__pycache__ 2>/dev/null || true
  echo "  Caches cleared (run with --no-clean to skip)"
fi

# ── 2. MongoDB ───────────────────────────────────────────────────────────────
echo "Starting MongoDB..."
docker start washingbells-mongo 2>/dev/null \
  || docker run -d --name washingbells-mongo -p 27017:27017 \
       -v washingbells_data:/data/db mongo:7
echo "  MongoDB OK"

# ── 3. Backend (venv) ────────────────────────────────────────────────────────
echo "Starting FastAPI backend..."
cd "$PROJECT/backend"
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 \
  >> /tmp/wb-backend.log 2>&1 &
BACKEND_PID=$!

# Wait up to 30 s for health check (startup seeds data + ensures indexes)
for i in $(seq 1 30); do
  sleep 1
  curl -sf http://127.0.0.1:8000/health > /dev/null 2>&1 && break
  if [ "$i" -eq 30 ]; then
    echo "  Backend failed to start — check /tmp/wb-backend.log"
    exit 1
  fi
done
echo "  Backend OK  (PID $BACKEND_PID)  →  http://192.168.1.41:8000"

# ── 4. Open separate Terminal windows for each Metro ─────────────────────────
# Customer app  — port 8081 (Expo default)
# Rider app     — port 8082
# Store app     — port 8083

open_terminal() {
  local title="$1"
  local dir="$2"
  local port="$3"

  local clearflag=""
  [ "$CLEAN" = "1" ] && clearflag="--clear"
  osascript <<APPLE
tell application "Terminal"
  set w to do script "echo '=== $title (port $port) ==='; cd '$dir'; npx expo start --lan --port $port $clearflag"
  set custom title of front window to "$title"
  activate
end tell
APPLE
}

open_next_terminal() {
  local title="$1"
  local dir="$2"
  local port="$3"

  osascript <<APPLE
tell application "Terminal"
  set w to do script "echo '=== $title (port $port) ==='; cd '$dir'; npm run dev -- --port $port"
  set custom title of front window to "$title"
  activate
end tell
APPLE
}

echo "Opening Terminal windows..."
open_terminal      "WashingBells — Customer"  "$PROJECT"          8081
sleep 1
open_terminal      "WashingBells — Rider"     "$PROJECT/rider"    8082
sleep 1
open_terminal      "WashingBells — Store"     "$PROJECT/store"    8083
sleep 1
open_next_terminal "WashingBells — Admin"     "$PROJECT/admin"    3000

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend  →  http://192.168.1.41:8000"
echo "  Docs     →  http://192.168.1.41:8000/docs"
echo "  Admin    →  http://localhost:3000"
echo ""
echo "  3 Expo windows (scan QR with iPhone Camera):"
echo "    Customer  →  :8081"
echo "    Rider     →  :8082"
echo "    Store     →  :8083"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
