# WashingBells — Developer Handover

This folder is the **single source of truth** for a developer taking over the
WashingBells platform. Read the docs in order; each is self-contained.

> Last updated: 2026-06-03. Generated for project handover.

## What is WashingBells?

An on-demand laundry & dry-cleaning platform for India. A customer schedules a
pickup, a rider collects the clothes and drops them at a partner store, the
store processes them, and a rider delivers them back — all tracked end to end.

It is **one backend** serving **four frontends**:

| App | Tech | Who uses it | Path |
|-----|------|-------------|------|
| Backend API | FastAPI + MongoDB | all apps | `backend/` |
| Customer app | React Native (Expo SDK 54) | customers | `app/`, `stores/`, `lib/`, `components/`, `constants/` (repo root) |
| Rider app | React Native (Expo SDK 54) | delivery riders | `rider/` |
| Store app | React Native (Expo SDK 54) | store owners | `store/` |
| Admin panel | Next.js 16 | platform admins | `admin/` |

## Documentation index

| # | Doc | What's inside |
|---|-----|---------------|
| 01 | [Architecture](01-architecture.md) | How the pieces fit, data flow, ports |
| 02 | [Getting Started](02-getting-started.md) | Local setup, prerequisites, running everything |
| 03 | [Backend](03-backend.md) | FastAPI layout, routers, services, request flow |
| 04 | [Database](04-database.md) | MongoDB collections, document shapes, indexes |
| 05 | [API Reference](05-api-reference.md) | Every endpoint, grouped by router |
| 06 | [Authentication & Roles](06-authentication-and-roles.md) | OTP/password login, JWT, role gating |
| 07 | [Order Lifecycle](07-order-lifecycle.md) | The order/trip state machine, the OTP handoffs |
| 08 | [Mobile Apps](08-mobile-apps.md) | Expo app structure, routing, state, conventions |
| 09 | [Admin Panel](09-admin-panel.md) | Next.js admin structure and pages |
| 10 | [Integrations](10-integrations.md) | MSG91, Razorpay, SendGrid, Expo Push, Maps |
| 11 | [Configuration](11-configuration.md) | `dev.yaml`, `.env`, settings precedence |
| 12 | [Deployment](12-deployment.md) | Going to production, what to change |
| 13 | [Test Accounts & Seed Data](13-test-accounts-and-seed.md) | Seed script, login credentials |
| 14 | [Troubleshooting](14-troubleshooting.md) | Common errors and their fixes |
| 15 | [Known Issues & Roadmap](15-known-issues-and-roadmap.md) | What's not built / next steps |
| 16 | [Conventions & Gotchas](16-conventions-and-gotchas.md) | House rules + non-obvious traps |

## 30-second orientation

```
WashingBells/
├── backend/            # FastAPI app (the only server)
│   ├── main.py         # app entrypoint + router registration
│   ├── dev.yaml        # service config (MSG91, Razorpay) — see doc 11
│   ├── .env            # secrets + Mongo/JWT config
│   ├── requirements.txt
│   ├── app/
│   │   ├── routers/    # one file per feature area (23 routers)
│   │   ├── services/   # MSG91, Razorpay, email, push, PDF, store-hours
│   │   ├── core/       # config, database, security, utils
│   │   └── schemas/    # Pydantic request/response models
│   └── scripts/        # seed_dummy_data.py
├── app/ stores/ lib/ components/ constants/   # CUSTOMER Expo app (repo root)
├── rider/              # RIDER Expo app
├── store/              # STORE Expo app
├── admin/              # ADMIN Next.js app
├── scripts/dev.sh      # one-command launcher for everything
└── docs/handover/      # you are here
```

## Handover checklist (do these first)

- [ ] Read docs 01, 02, 11 and get the stack running locally (`scripts/dev.sh`).
- [ ] Log in to each app with a seeded account (doc 13). Password: `Test@1234`.
- [ ] Skim the API at `http://localhost:8000/docs` (auto-generated Swagger UI).
- [ ] Rotate every secret in `backend/.env` and `backend/dev.yaml` (doc 11) —
      the committed values are **shared test keys** and must not ship to prod.
- [ ] Read doc 16 before writing code — it lists traps that already bit us.
