# ADMIN_AUDIT.md — Super-Admin panel fixes (branch `admin-fixes`)

Working branch: `admin-fixes`. Backend tested directly via `curl localhost:8000/api/v1/...`
per CLAUDE.md. Admin app on `:3000`, FastAPI on `:8000`, Mongo in Docker
(`washingbells-mongo`).

Admin login (for API tests):
`POST /api/v1/auth/login-password {"phone":"+919999999999","password":"Test@1234"}` → admin JWT.

---

## Bug 1 — OTP fails on Android ("Verify & Continue" stays disabled / OTP not accepted)

**Root cause.** The customer OTP screen (`app/(authenticate)/otp-verify.js`) renders six
`<TextInput maxLength={1}>` boxes and gates the button on `code.join("").length === 6`.
On Android, Gboard/Samsung SMS-autofill (and clipboard paste) deliver the *entire* 6-digit
code into a single box; `maxLength={1}` discarded all but the first digit, so the joined code
was length 1 → "Verify & Continue" stayed disabled and the OTP was never submitted.
The backend OTP flow itself is correct (verified below) — this was purely client input handling.

**Fix.**
- `handleChange` now strips non-digits and, when a multi-character value arrives
  (autofill/paste/fast type), distributes the digits across the boxes from the current index
  and moves focus to the next empty box (or blurs when complete).
- Box 0 now accepts up to `OTP_LENGTH` chars so an autofilled code lands intact before being
  distributed; boxes 1–5 stay `maxLength={1}`.
- Added `textContentType="oneTimeCode"` + `autoComplete="sms-otp"` + `importantForAutofill`
  on box 0 for native OTP autofill.
- Admin login OTP input (`admin/app/login/page.tsx`) hardened with `inputMode="numeric"` +
  `autoComplete="one-time-code"`.

**Verified.** Backend contract via curl (dev Twilio bypass, code `123456`):
- `POST /auth/send-otp` → `{"message":"OTP sent successfully"}`
- `POST /auth/verify-otp` valid `123456` → **200** + admin JWT
- `POST /auth/verify-otp` invalid `000000` → **400** `{"detail":"Invalid OTP."}`

**Commit.** `41b8c56`

---
