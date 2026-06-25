# WashingBells FastAPI backend — production image for Cloud Run
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

# Install Python deps first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source (dev.yaml/.env are excluded via .dockerignore so that all config
# comes from Cloud Run env vars + Secret Manager, not baked-in dev values)
COPY . .

# Cloud Run injects $PORT (defaults to 8080). Shell form so $PORT expands.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
