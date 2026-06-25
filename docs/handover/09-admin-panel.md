# 09 — Admin Panel (Next.js)

Path: `admin/`. **Next.js 16** (App Router), Tailwind CSS, axios, Leaflet for
maps. Runs in a browser on the dev machine at `http://localhost:3000`.

> ⚠️ This is a newer Next.js than most training data. The repo's
> `admin/AGENTS.md` warns: read `node_modules/next/dist/docs/` before writing
> Next code — APIs and conventions may differ.

## Config

`admin/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```
Change this to your backend URL. The API client is `admin/lib/api.ts` (axios +
`admin_token` from `localStorage`, 401/403 → `/login`).

## Auth

`admin/lib/auth.ts` stores/reads the JWT. Login (`app/login/page.tsx`) supports
**password** (`+919999999999 / Test@1234`) and OTP, and rejects non-admin roles.

## Pages (`admin/app/<page>/page.tsx`)

| Page | Route | Purpose |
|------|-------|---------|
| Login | `/login` | admin sign-in |
| Dashboard | `/dashboard` | KPIs (revenue, orders, active) + recent orders |
| Orders | `/orders` | all orders, detail drawer, override status, assign store/rider |
| Riders | `/riders` | rider list, KYC review, approve/reject |
| Stores | `/stores` | store list, approve, toggle open |
| Customers | `/customers` | customer directory + detail drawer |
| **Tracking** | `/tracking` | **live rider map** (Leaflet), polls `/admin/riders/online` every 10s |
| Services | `/services` | service catalogue + items (CRUD) |
| Coupons | `/promotions` or `/coupons` | promo codes |
| Banners / Promotions | `/promotions` | marketing banners + testimonials |
| Email | `/email` | event templates, compose, unsubscribed list |
| Inbox | `/inbox` | inbound email (SendGrid Inbound Parse) |
| Terms | `/terms` | publish versioned T&C per role (TipTap editor) |
| Photos | `/photos` | order photo audit |
| Notifications | `/notifications` | admin notification feed |
| Financials | `/financials` | revenue/payout reporting |
| Settings | `/settings` | platform settings |
| DB browser | `/dashboard` (DB section) | raw Mongo CRUD over whitelisted collections, with audit log |

(Exact route names live in `admin/app/`; the sidebar is `admin/components/Sidebar.tsx`.)

## Live tracking map

- `admin/app/tracking/page.tsx` polls `GET /admin/riders/online` every 10s.
- `admin/app/tracking/_components/RiderMap.tsx` renders Leaflet markers
  (dynamic import with `ssr:false` — Leaflet needs the DOM).
- Riders appear once they go **online** and their app reports GPS
  (`PUT /delivery/location`). The rider home screen sends a foreground fix every
  20s so this works even without a background build.

## Build & deploy

```bash
cd admin
npm run build && npm start     # production
```
Deploys well to Vercel/Node. Set `NEXT_PUBLIC_API_URL` to the production API.
