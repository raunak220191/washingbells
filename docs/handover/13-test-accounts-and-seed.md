# 13 — Test Accounts & Seed Data

## Seeding

```bash
cd backend && python -m scripts.seed_dummy_data
```

`scripts/seed_dummy_data.py` is **idempotent** (upserts by phone / owner). It
creates, all tagged `is_dummy: true`:

| Role | Count | Phone range |
|------|-------|-------------|
| Customers | 50 | `+919000000001` … `+919000000050` |
| Riders | 20 | `+919100000001` … `+919100000020` (pre-approved, docs marked uploaded) |
| Stores | 10 | owners `+919200000001` … `+919200000010` (active, approved, profile complete, **Gurgaon**) |
| Admin | 1 | `+919999999999` |

**Password for every seeded account: `Test@1234`**

> A human-readable list with names/vehicle numbers/referral codes is generated
> at `file11.md` (repo root).

## Logging in

Every app login screen has **"Login with Password"**. Enter the 10-digit number
(the `+91` is added by the app) and `Test@1234`.

- Customer: `+919000000001` … `050`
- Rider: `+919100000001` … `020` (e.g. `+919100000002`)
- Store owner: `+919200000001` … `010`
- Admin (panel): `+919999999999`

The first 5 customers were also credited **₹500 WB wallet** so the wallet
toggle at checkout is testable.

## Coupons (seeded earlier, in DB)

| Code | Type | Min order |
|------|------|-----------|
| `SAVE20` | 20% off (max ₹500) | ₹200 |
| `MY50` | 50% off | ₹2000 |

## OTP in dev

If MSG91 is unconfigured, the OTP dev-bypass code is `123456`. With MSG91
configured but DLT pending, OTP won't deliver — use password login (doc 10).

## Removing dummy data

```js
// in mongosh, or the admin DB browser
db.users.deleteMany({ is_dummy: true })
db.stores.deleteMany({ is_dummy: true })
```

## Tip: end-to-end manual test

1. Customer (`+919000000001`) → add items → checkout → pay (Razorpay test card).
2. Store owner (`+919200000001`) → accept → assign pickup rider.
3. Rider (`+919100000001`) → go online → accept trip → photos → pickup OTP →
   show store-drop OTP.
4. Store owner → receive (enter the store-drop OTP) → start processing → mark
   ready → book delivery rider.
5. Rider → accept delivery → delivery OTP → delivered.
6. Admin → watch it all on `/orders` and `/tracking`.
