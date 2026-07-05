# Google Play Release Checklist — HUMAN GATE

Everything below the line needs the Play Console **account owner** (2FA).
Prepared by the fix-and-deploy run of 2026-07-05. Apps: Customer
(`com.washingbells.app`*), Store (`com.washingbells.store`), Rider
(`com.washingbells.rider`*). (*confirm exact ids in each `app.json`.)

## Before building (blockers found this round)

- [ ] **Rotate Twilio auth token** (old one is 401-invalid AND the previous
      token was committed to git history in `backend/dev.yaml`). Twilio
      Console → Account → API keys & tokens.
- [ ] **Rotate the Razorpay key secret** (same git-history exposure).
      Razorpay Dashboard → Settings → API Keys.
- [ ] **Create GCP secrets + bind to Cloud Run `washingbells-api`**:
      `twilio-account-sid`, `twilio-auth-token`, `twilio-verify-service-sid`
      → env `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
      `TWILIO_VERIFY_SERVICE_SID`. Then set env `OTP_DEV_BYPASS=false`.
      (Until this is done, prod OTP cannot work — that was bug C1. The
      123456 bypass is now hard-disabled in prod builds regardless.)
- [ ] Set `RAZORPAY_WEBHOOK_SECRET` env on Cloud Run and register the webhook
      in the Razorpay dashboard: `https://api.washingbells.com/api/v1/payments/webhook`,
      events: `payment.captured`, `order.paid`.
- [ ] Set `GOOGLE_MAPS_API_KEY` env on Cloud Run (server geocoding, B2).
- [ ] **Create an Android Maps SDK key** (Google Cloud → Credentials;
      restrict by package name + SHA-1 of the EAS keystore — get SHA-1 via
      `eas credentials`) and add it to each app's `app.json` →
      `android.config.googleMaps.apiKey`. Without it the map picker uses the
      GPS fallback (B3) — works, but no visual map.
- [ ] Remove stale MSG91 env vars from Cloud Run (replaced by Twilio).

## Build & submit (can be run by anyone with the EAS account)

```bash
# per app directory (., store/, rider/):
eas build --platform android --profile production
eas submit --platform android --latest        # track: closed testing (already configured: internal)
```
- [ ] Verify each artifact: download the .aab is for Play only; for direct
      installs ALWAYS share the `preview`-profile APK link (F1: mailed .aab
      links were the "app not installed" bug).
- [ ] **Gotcha (root-caused 2026-07-06):** building rider/store from their
      dirs FAILS with "package.json does not exist in …/build/rider" unless
      you first swap the repo-root `.easignore` for the app-scoped variant:
      `cp .easignore-rider .easignore && (cd rider && EAS_NO_VCS=1 eas build …) && git checkout .easignore`
      (same with `.easignore-store`). The root file scopes CUSTOMER builds
      and strips rider/ + store/ from the archive.
- [ ] Install the preview APK on one physical device per app before sharing.

## Play Console (owner)

- [ ] Keep the EXISTING closed-testing track — do not create a new one
      (the 12-tester / 14-day clock must not reset).
- [ ] Re-share opt-in links to testers:
      Store: https://play.google.com/apps/testing/com.washingbells.store
      Customer & Rider: copy from Play Console → Testing → Closed testing.
- [ ] When the 14-day requirement completes: Promote to Production +
      "Send for review" (owner-only click).

## Post-deploy smoke (after backend + apps ship)

- [ ] `curl https://api.washingbells.com/health` → `{"status":"ok"}`
- [ ] Real-device OTP: send + verify with a real Indian number (C1 accept).
- [ ] Geo: `GET /api/v1/stores/nearby?lat=<store lat>&lng=<store lng>` returns the store.
- [ ] Razorpay test payment → webhook flips order to paid (check
      /admin/notifications for `payment_received`).
