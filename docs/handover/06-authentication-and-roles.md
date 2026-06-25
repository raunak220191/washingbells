# 06 — Authentication & Roles

## Roles

| Role | Stored as | App |
|------|-----------|-----|
| Customer | `users.role = "customer"` | Customer app |
| Rider | `users.role = "rider"` | Rider app |
| Store owner | `users.role = "store_owner"` | Store app |
| Admin | `users.role = "admin"` | Admin panel |

A user is identified by **phone number** (E.164, e.g. `+919876543210`). Phone
is unique across all roles.

## Login methods

There are **two** ways to authenticate, both returning the same JWT:

### 1. Phone + OTP (the intended production flow)
```
POST /auth/send-otp    { phone }              → sends OTP via MSG91
POST /auth/verify-otp  { phone, code }        → JWT (auto-creates a customer if new)
```
- OTP send/verify is handled by **MSG91** server-side (`msg91_service.py`).
- If MSG91 is not configured (`dev.yaml msg91.auth_key` empty), it falls back to
  a **dev bypass**: any phone "receives" the code `123456`.
- ⚠️ MSG91 is currently blocked on DLT template approval — see doc 10. Until
  then, OTP may not deliver; use password login.

### 2. Phone + Password (the working bypass)
```
POST /auth/login-password  { phone, password }  → JWT (existing users only; never creates)
POST /auth/set-password    { password }          → (auth) set/change own password
```
- Passwords are bcrypt-hashed (`users.password_hash`), via `core/security.py`
  using the `bcrypt` library directly.
- All seeded accounts have password `Test@1234` (doc 13).
- Every app's login screen has a **"Login with Password"** button alongside
  "Get OTP".

## JWT

- Issued by `create_access_token` (`core/security.py`), HS256, signed with
  `JWT_SECRET_KEY`. Expiry `ACCESS_TOKEN_EXPIRE_MINUTES` (default 1440 = 24h).
- Payload: `{ user_id, phone, role, exp }`.
- `get_current_user` (FastAPI dependency) decodes it → `{user_id, phone, role}`.
- **Mobile apps** store the token in `expo-secure-store`
  (`auth_token` / `rider_auth_token` / `store_auth_token`).
- **Admin** stores it in `localStorage` (`admin_token`); a 401/403 interceptor
  redirects to `/login`.

## Role gating in the apps

Each mobile app's root `_layout.js` runs an auth/onboarding gate. Example
chains:
- **Customer**: not authed → login; authed + needs T&C → terms; else → tabs.
- **Rider**: login → must be registered (`vehicle_type`) → register; must accept
  T&C → terms; unapproved + no docs → documents; else → tabs.
- **Store**: login → must have a linked store → setup; T&C → terms;
  `profile_complete === false` → complete-profile; else → tabs.

The **Terms gate** lives in each app's auth store (`needsTerms` / `termsChecked`)
so that accepting clears it immediately (doc 16 has the history of why).

## Self-registration

- `POST /auth/register-rider` — turns the current user into a rider (collects
  vehicle + KYC images), `rider_approved: false` until an admin approves.
- `POST /auth/register-store` — turns the current user into a store owner and
  creates the `stores` document, `status: pending_approval` until admin approves.
- Admins can also **directly create** riders/stores
  (`POST /admin/riders/create`, `POST /admin/stores/create`), which sends an
  invitation SMS via MSG91.

## Admin access

- The admin login (`admin/app/login/page.tsx`) checks `user.role === "admin"`
  and rejects everyone else.
- Seeded admin: `+919999999999` / `Test@1234`.
- `POST /admin/seed-admin` can bootstrap an admin if none exists.
