# 11 — Configuration

Backend config is assembled by `backend/app/core/config.py` (`Settings`,
pydantic-settings). **Precedence (highest first):**

1. `backend/dev.yaml` — `msg91:` and `razorpay:` sections (mapped to `MSG91_*`
   / `RAZORPAY_*` settings by `_load_yaml_config()`).
2. `backend/.env` — everything else.
3. Defaults in `Settings`.

`get_settings()` is cached (`@lru_cache`) — restart the backend after changing
config.

## `backend/dev.yaml` (non-`.env` service config)

```yaml
msg91:
  auth_key: "<MSG91 auth key>"
  base_url: "https://control.msg91.com/api/v5"
  default_country_code: "91"
  sender_id: "SMSIND"                 # DLT-approved sender header
  otp_template_id: "<DLT template id>"
  otp_length: 6
  otp_expiry_minutes: 10
  invite_template_id: "<flow template id>"   # vars: name, role, url

razorpay:
  key_id: "rzp_test_..."              # TEST key (rotate for prod!)
  key_secret: "..."                   # TEST secret
```

Leave a section's keys empty to use that integration's dev bypass (doc 10).

## `backend/.env`

| Var | Purpose | Default |
|-----|---------|---------|
| `MONGODB_URL` | Mongo connection | `mongodb://localhost:27017` |
| `DATABASE_NAME` | DB name | `washingbells` |
| `JWT_SECRET_KEY` | **rotate for prod** | `dev-secret-key` |
| `JWT_ALGORITHM` | | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | token TTL | `1440` |
| `RIDER_APP_INVITE_URL` / `STORE_APP_INVITE_URL` | links in invite SMS | washingbells.in/... |
| `SENDGRID_API_KEY` | email | "" |
| `SENDGRID_INBOUND_PARSE_KEY` | inbound webhook secret | "" |
| `EMAIL_FROM_ADDRESS`/`_NAME`/`_REPLY_TO`/`_ADMIN_ADDRESS` | email identity | "" |
| `EMAIL_ENABLED` | master email switch | `false` |
| `PUBLIC_BASE_URL` | for unsubscribe links | "" |
| `RAZORPAY_KEY_ID` / `_SECRET` | (overridden by dev.yaml) | "" |
| `GOOGLE_MAPS_API_KEY` | maps/geocoding | "" |
| `DEBUG` | debug flag | `true` |

> Razorpay keys are read from **dev.yaml** in this project; the `.env` entries
> exist but dev.yaml wins.

## Frontend config

| App | File | Set |
|-----|------|-----|
| Customer | `config/dev.js` (repo root) | `DEV_BACKEND_URL` = your LAN IP / tunnel |
| Rider | `rider/config/dev.js` | same |
| Store | `store/config/dev.js` | same |
| Admin | `admin/.env.local` | `NEXT_PUBLIC_API_URL` |

Production URLs are hardcoded fallbacks in each `lib/api.js`
(`https://api.washingbells.in/api/v1`) — change these for your domain.

## ⚠️ Secrets hygiene

The committed `dev.yaml` and `.env` contain **shared test/dev secrets**
(MSG91 key, Razorpay test keys, a SendGrid key, a dev JWT secret). Before
production:
- Rotate **all** of them.
- Move secrets out of the repo (env vars / a secrets manager).
- Generate a strong `JWT_SECRET_KEY`.
- Do not commit real production keys.
