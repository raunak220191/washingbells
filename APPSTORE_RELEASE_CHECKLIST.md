# App Store / TestFlight Release Checklist — HUMAN GATE

Needs the Apple Developer **account holder**. Apps already exist in App Store
Connect: Customer `6783028568`, Rider `6783028830`, Store `6783029144`.
Complete the backend blockers in PLAY_RELEASE_CHECKLIST.md first (Twilio,
Razorpay webhook, Maps keys) — they gate real-user testing on iOS too.

## Build & submit

```bash
# per app directory (., store/, rider/):
eas build --platform ios --profile production
eas submit --platform ios --latest
```
(ASC API key is configured in each eas.json: key L6HNMZ4MQ5 / issuer
dbf14e6b-…; the `.p8` must exist locally at the repo root — it is untracked
by design, never commit it.)

## TestFlight (account holder)

- [ ] After processing, add the tester group to **Internal Testing** for all
      three apps. Emails live in `testers.json` (8 testers incl.
      hardikvashisht10@). Do not hardcode them anywhere.
- [ ] Send invites; confirm at least Hardik's device gets build N.

## App Store review prep (account holder)

- [ ] Export compliance: apps use only standard HTTPS (`ITSAppUsesNonExemptEncryption=false`
      already set in each app.json) → answer "No" to proprietary encryption.
- [ ] Screenshots: iPhone 6.7" + 5.5" sets per app; **Store app also needs the
      iPad set** — E7 decision: content renders as a centered column on iPad;
      capture from an iPad simulator.
- [ ] Privacy nutrition labels: location (customer: delivery address; rider:
      live trip tracking; store: store pin), phone number, payment info
      (processed by Razorpay — not stored by the app).
- [ ] Review notes: include a seeded demo login per app
      (customer +919000000001 / rider +919100000001 / store +919200000001,
      password Test@1234) pointing at the production API, or a demo video.
- [ ] "Submit for review" click — account holder only.

## Post-submit

- [ ] Watch for review rejections mentioning background location (rider app
      uses it for trips — ensure the purpose string matches actual use).
- [ ] After approval: phased release recommended (7-day ramp).
