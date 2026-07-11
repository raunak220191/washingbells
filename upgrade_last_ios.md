# UPGRADE_LAST_IOS.md — iOS Parity + Dual-Platform Build & Deploy (WashingBells)

> **Execution mode:** Autonomous (Claude Code). Prerequisite: `upgrade_last.md` tasks 1–4 are complete and committed. This file (a) brings all four upgrades to full iOS parity, (b) builds **customer, store, rider** for **both iOS and Android**, (c) submits to **TestFlight** and **Google Play closed testing**, (d) commits everything to git.
>
> **Checkpoint commit format:** `checkpoint(IOS-X.Y): <short description>`
> Commit after every completed sub-task. Never batch. Resume from last checkpoint on interruption.
>
> **Scope guard:** No refactors. No new dependencies beyond those explicitly listed. Android behavior must remain byte-for-byte unchanged except where a shared fix is required.

---

## TASK 0 — Preflight: quick verification (apps ALREADY EXIST on TestFlight)

**Context:** All three apps have previous builds on TestFlight, so Apple Developer membership, bundle IDs, ASC app records, and EAS iOS credentials are proven working. This is a fast sanity check, not a setup gate. Anything unexpectedly broken → `BLOCKERS` in `DEPLOY_NOTES.md` and stop.

- [ ] Confirm `eas.json` iOS production + submit profiles exist per app with `ascAppId` set (they should, from prior submissions). Do NOT change bundle identifiers under any circumstances.
- [ ] **Fetch the last TestFlight build number per app** (via `eas build:list -p ios` or ASC) and record it in `DEPLOY_NOTES.md` — TASK 6's `ios.buildNumber` MUST be strictly greater, or the upload will be rejected by App Store Connect.
- [ ] Quick credentials check: `eas credentials -p ios` per app confirms cert/profile still valid (not expired/revoked). Prior builds make this near-certain — just verify, don't recreate.
- [ ] **Push notifications**: APNs key should already be in EAS credentials from previous builds; verify it's present since the weight-update reflection depends on it.
- [ ] **Google Maps on iOS**: decide provider —
  - Default: `react-native-maps` uses **Apple Maps** on iOS (no key needed). Acceptable for the pin-picker.
  - If visual parity with Android's Google Maps is required: needs `ios.config.googleMapsApiKey` in `app.json` + Maps SDK for iOS enabled on the key → list as manual console step if not enabled.
  - **Choose Apple Maps by default** (fewer moving parts); note the decision in `DEPLOY_NOTES.md`.
- [ ] Apple sign-in requirement check: apps use **phone OTP only** (Twilio Verify), no third-party social login → "Sign in with Apple" is NOT required. Confirm no Google/Facebook login exists; if one does, flag as BLOCKER (App Store rejection risk).

---

## TASK 1-iOS — Item Images: iOS parity

- [ ] `expo-image-picker` on iOS requires Info.plist strings. Add via `app.json → ios.infoPlist` for **store and rider** apps:
  - `NSCameraUsageDescription`: "WashingBells uses the camera to photograph laundry items."
  - `NSPhotoLibraryUsageDescription`: "WashingBells needs photo library access to upload item images."
- [ ] Verify the action sheet uses the native iOS `ActionSheetIOS`/design-system equivalent — no Android-only UI.
- [ ] Verify image compression + upload path works on iOS simulator AND that HEIC photos from iPhone cameras are converted (backend already converts to WebP via Pillow — confirm Pillow handles HEIC input; if not, force JPEG output in `expo-image-manipulator` on client, which it does by default. Add a test with a `.heic` fixture).
- [ ] Customer app: confirm image cards render with correct corner radius/shadow per Apple HIG tokens in the design system; no layout shift (same guard as Android).

## TASK 2-iOS — Weight Flow: iOS parity

- [ ] Rider/store weight input: use `keyboardType="decimal-pad"` — verify the decimal separator handling on iOS locales (force `.` normalization before PATCH).
- [ ] `KeyboardAvoidingView` with `behavior="padding"` on iOS for the weight-entry screen — the confirm button must remain visible above the keyboard.
- [ ] Verify order-updated push/refresh reflects the recalculated total on iOS customer app (APNs path from TASK 0).
- [ ] Safe-area check on the order details "updated" badge and delta line (notch devices).

## TASK 3-iOS — Map Pin Address: iOS parity

- [ ] `react-native-maps`: confirm iOS build compiles with the chosen provider (Apple Maps default per TASK 0). Do NOT set `provider={PROVIDER_GOOGLE}` unconditionally — gate it: Google on Android, default on iOS.
- [ ] `expo-location`: add `NSLocationWhenInUseUsageDescription` to customer app `ios.infoPlist`: "WashingBells uses your location to find nearby laundry stores and pin your address."
- [ ] Verify draggable/fixed-center pin gesture behavior on iOS (gesture conflicts with scroll views differ from Android) — pin adjustment must work inside the address form screen.
- [ ] "Use current location" → iOS permission prompt flow → coordinates saved. Denied-permission path shows the inline error, not a crash.
- [ ] Backend geocode proxy unchanged — client behavior identical across platforms.

## TASK 4-iOS — Sort + Search: iOS parity

- [ ] Search input: verify design-system Input renders per HIG on iOS (clear button, keyboard `returnKeyType="search"`).
- [ ] `keyboardShouldPersistTaps="handled"` verified on iOS lists; keyboard dismiss-on-scroll enabled (`keyboardDismissMode="on-drag"`) matching platform convention.
- [ ] Layout guard repeated on iOS: screenshot the item screen with empty query on an iPhone simulator (e.g., iPhone 15) before/after — pixel-identical requirement stands.
- [ ] `localeCompare` sorting verified identical output on iOS JSC/Hermes vs Android Hermes (add a unit test with a fixed item-name fixture).

---

## TASK 5 — Cross-platform regression pass

- [ ] Run TypeScript + lint on all three apps; backend test suite green (including HEIC fixture test).
- [ ] Manual smoke on iOS simulator per app: OTP login (Twilio), image upload (store), weight flow (rider), map-pin address + nearby store (customer), search/sort (customer).
- [ ] Manual smoke on Android emulator: confirm nothing regressed from the iOS gating changes (especially the maps provider gate).
- [ ] Record all results in `DEPLOY_NOTES.md`.

---

## TASK 6 — Version bumps & git hygiene

- [ ] Bump per app in `app.json`: semantic `version` (same for both platforms), `android.versionCode` +1, and `ios.buildNumber` set **strictly greater than the last TestFlight build number recorded in TASK 0** (follow the existing numbering pattern from previous iOS builds — check what convention prior builds used and continue it).
- [ ] `checkpoint(IOS-6.1): version bumps customer/store/rider` — commit bumps BEFORE building so builds are reproducible from a tagged commit.
- [ ] Tag the release commit: `git tag -a vX.Y.Z-upgrade-last -m "Four upgrades + iOS parity"` and push tags.

---

## TASK 7 — Build (EAS, both platforms, all three apps)

Run sequentially to avoid EAS concurrency limits; checkpoint after each successful build with the build URL/ID.

- [ ] `eas build -p android --profile production` — customer, store, rider (AABs).
- [ ] `eas build -p ios --profile production` — customer, store, rider (IPAs).
- [ ] If any iOS build fails on credentials/pods: capture the full error into `DEPLOY_NOTES.md` BLOCKERS, do not retry more than twice, continue with remaining apps, and do NOT submit a partial platform set for that app (an app ships to both platforms or neither this cycle).

## TASK 8 — Submit

**Android → Google Play (closed testing):**
- [ ] `eas submit -p android` per app to the **same closed-testing track** each app is currently on (customer app mid-14-day clock — do not create or promote tracks).
- [ ] Update "What's new" per app (1–2 plain-language lines covering the four changes).

**iOS → TestFlight:**
- [ ] `eas submit -p ios` per app using the existing ASC credentials (same as prior submissions).
- [ ] After ASC processing (~5–15 min per build), verify each build appears in TestFlight and is available to the **existing internal testing group** — if the group has automatic distribution enabled, existing testers get the new build with no action; otherwise assign the build to the group. Do NOT create new groups, submit for external TestFlight review, or App Store review this cycle.
- [ ] Export compliance: apps use standard HTTPS only → set `ios.config.usesNonExemptEncryption: false` in `app.json` (before TASK 7 builds) so submission isn't blocked on the encryption question.

## TASK 9 — Post-deploy & final commit

- [ ] Verify: Play Console shows new builds live on tracks; App Store Connect shows builds "Ready to Test" in TestFlight internal group.
- [ ] Update `DEPLOY_NOTES.md`: shipped versions/build numbers per app per platform, build URLs, blockers resolved/open, rollback plan (previous AAB versions + previous TestFlight build numbers + backend git tag).
- [ ] Notify tester (Hardik): Android update on the same track + TestFlight invite steps for iOS; call out weight flow and map-pin address as priority test areas.
- [ ] Final commit: `checkpoint(IOS-9.1): deploy notes + release complete`, push branch and tags. Working tree must be clean at the end — `git status` empty.

---

## Out of scope (do NOT do)

- No App Store public release or external TestFlight review submission.
- No new Play Console tracks or track promotions.
- No switching Android maps provider or touching Android-only code paths beyond the platform gates specified.
- No CI/CD pipeline changes; builds run via EAS CLI only.