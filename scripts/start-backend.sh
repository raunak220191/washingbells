#!/bin/bash
# WashingBells — Start Backend Server
# Run from project root: ./scripts/start-backend.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🧺 WashingBells — Starting Backend..."

# 1. Check Docker / MongoDB
if ! docker ps --filter name=washingbells-mongo --format '{{.Names}}' | grep -q washingbells-mongo; then
  echo "📦 Starting MongoDB container..."
  docker start washingbells-mongo 2>/dev/null || \
    docker run -d --name washingbells-mongo -p 27017:27017 -v washingbells_data:/data/db mongo:7
  sleep 2
fi
echo "✅ MongoDB running on :27017"

# 2. Activate venv and start FastAPI
cd "$PROJECT_DIR/backend"
if [ ! -d "venv" ]; then
  echo "🐍 Creating Python virtual environment..."
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

echo "🚀 Starting FastAPI on http://0.0.0.0:8000"
echo "📄 API Docs: http://localhost:8000/docs"
echo ""
uvicorn main:app --reload --host 0.0.0.0 --port 8000
