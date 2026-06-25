# 10 — Third-Party Integrations

All integrations degrade gracefully: if not configured, the backend uses a
**dev bypass** so local development works without credentials.

## MSG91 — SMS & OTP (replaces Twilio)

- Service: `backend/app/services/msg91_service.py`.
- Config: `backend/dev.yaml` → `msg91:` section (doc 11).
- Functions: `send_otp`, `verify_otp` (OTP generated/verified by MSG91
  server-side), `send_invite_sms` (rider/store invites via the Flow API).
- Phone is normalized to `91XXXXXXXXXX` (no `+`).
- **Dev bypass**: empty `msg91.auth_key` → OTP is always `123456`, invites logged.
- ⚠️ **Current status**: real keys are set but **OTP delivery is blocked on DLT
  template approval**. Sends return `success` but messages don't deliver until
  the OTP template's **DLT Template ID** is filled in on the MSG91 dashboard
  (sender header `SMSIND`). Until then, use **password login**. The old
  `docs/TWILIO_SETUP.md` is obsolete.

## Razorpay — Payments

- Service: `backend/app/services/razorpay_service.py`.
- Config: `backend/dev.yaml` → `razorpay:` (test keys committed there).
- **Uses the REST API via httpx, NOT the `razorpay` Python SDK** — the SDK
  imports `pkg_resources`, which is removed in Python 3.13 and crashes. Do not
  re-add the SDK.
- `create_razorpay_order` → `POST https://api.razorpay.com/v1/orders` (HTTP
  Basic auth). `verify_razorpay_payment` → HMAC-SHA256 of `order_id|payment_id`.
- Backend endpoints: `POST /payments/create`, `POST /payments/verify`
  (idempotent — won't downgrade an already-paid order).
- **Mobile checkout**: `lib/RazorpayCheckout.js` (customer app) loads Razorpay's
  hosted `checkout.js` in a `react-native-webview` modal, captures the real
  `{payment_id, signature}`, and posts to `/payments/verify`. Works in Expo Go.
- Test instruments: card `4111 1111 1111 1111` (any future expiry/CVV) or UPI
  `success@razorpay`.
- **Dev bypass**: empty keys → mock order + auto-approved verify.

## SendGrid — Email (in + out)

- Service: `backend/app/services/email_service.py`; admin router `email_admin.py`;
  public unsubscribe `email_public.py`; inbound `inbox.py`.
- Outbound: Jinja2-templated event emails (order placed/confirmed/picked
  up/ready/delivered, rider approved, new store pending, …), with audit log
  (`email_log`, 90-day TTL), suppression list, and an auto unsubscribe footer
  for customer-audience mail.
- Inbound: SendGrid **Inbound Parse** webhook → `POST /inbox/webhook`
  (shared-secret), surfaced in the admin Inbox.
- Config: `.env` → `SENDGRID_API_KEY`, `EMAIL_*`, `SENDGRID_INBOUND_PARSE_KEY`,
  `EMAIL_ENABLED`, `PUBLIC_BASE_URL`.
- Currently single-sender (`admin@washingbells.com`); no domain auth/DKIM yet.

## Expo Push — Notifications

- Service: `backend/app/services/push_service.py` (sends to Expo Push API).
- Tokens registered via `POST /notifications/register-token`
  (`users.expo_push_token`, `push_platform`).
- Real tokens require a dev/standalone build (not Expo Go); EAS project IDs are
  placeholders (doc 15).

## Google Maps

- `GOOGLE_MAPS_API_KEY` in `.env` (used where maps/geocoding are needed). The
  admin live map uses **Leaflet + OpenStreetMap** tiles (no key needed).

## Garment tag PDFs

- `backend/app/services/tag_pdf_service.py` — reportlab + qrcode +
  python-barcode. `GET /orders/{id}/tags/pdf`. The store app prints these
  (`store/lib/printTags.js`).
