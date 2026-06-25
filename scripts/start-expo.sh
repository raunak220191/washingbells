#!/bin/bash
# WashingBells — Start Expo Dev Server
# Run from project root: ./scripts/start-expo.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🧺 WashingBells — Starting Expo Dev Server..."
echo ""
echo "📱 Open Expo Go on your phone and scan the QR code."
echo "   Make sure your phone is on the SAME WiFi as this Mac."
echo ""
echo "   Your Mac LAN IP: $(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 'unknown')"
echo "   Backend API:     http://$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null):8000/api/v1"
echo ""

npx expo start -c
