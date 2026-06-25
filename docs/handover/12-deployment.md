# 12 — Deployment (Production)

> The app has **not** been deployed to production yet. This is a checklist /
> guide, not a record of an existing prod setup.

## Backend (FastAPI)

- Run with a production ASGI server, e.g.
  `uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4` behind Nginx, or
  `gunicorn -k uvicorn.workers.UvicornWorker`.
- Put it behind HTTPS (Let's Encrypt / managed TLS).
- Containerise: a simple `python:3.13-slim` image, `pip install -r
  requirements.txt`, copy `app/` + `main.py`, run uvicorn.
- **MongoDB**: use a managed cluster (MongoDB Atlas) or a hardened self-hosted
  instance with auth + backups. Set `MONGODB_URL` accordingly.
- Set all secrets via environment / secrets manager (doc 11). Do **not** ship
  the dev `dev.yaml`/`.env`.
- Tighten CORS in `main.py` from `["*"]` to the real app/admin origins.
- Set `DEBUG=false`.

## Admin (Next.js)

```bash
cd admin && npm ci && npm run build && npm start
```
- Deploy to Vercel or a Node host. Set `NEXT_PUBLIC_API_URL` to the prod API.
- The admin is browser-side; ensure the API has correct CORS + HTTPS.

## Mobile apps (Expo)

- Build with **EAS Build** (`eas build -p ios|android`). This requires:
  - Real EAS `projectId`s (currently placeholders — doc 15).
  - Apple Developer + Google Play accounts.
  - Push credentials (APNs key, FCM) for Expo Push.
  - Background location entitlements (rider app) in `app.json`.
- Point each app's production API URL (in `lib/api.js`) at the prod backend.
- Submit via `eas submit`.

## Integrations to finish before/at launch

- **MSG91**: complete DLT template approval so OTP actually delivers (doc 10).
- **Razorpay**: swap test keys for **live** keys; complete KYC/activation.
- **SendGrid**: domain authentication (SPF/DKIM) instead of single-sender;
  configure the Inbound Parse MX + webhook on your domain.
- **Push**: production EAS + APNs/FCM credentials.

## Data

- Run the seed script **only** in dev. For prod, seed real services/coupons via
  the admin panel.
- Remove all `is_dummy: true` records before go-live.

## Observability (recommended, not yet present)

- Structured logging + a log aggregator.
- Error tracking (Sentry) on backend + apps.
- Uptime monitoring on `/health`.
- DB backups + restore drills.

## Scaling notes

- The backend is stateless (JWT) → scale horizontally behind a load balancer.
- Photos are currently **base64 in the `uploads` collection** — migrate to
  S3/Cloudinary before serious volume (doc 15); this is the biggest scaling
  liability.
