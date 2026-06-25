# 08 — Mobile Apps (Customer / Rider / Store)

All three are **Expo SDK 54** React Native apps using **expo-router** (file-based
routing) and **Zustand** for state. They are independent projects.

> The customer app lives at the **repo root** (`app/`, `stores/`, `lib/`,
> `components/`, `constants/`, `config/`). The rider and store apps are in
> `rider/` and `store/` with the same internal structure.

## Shared structure (per app)

```
<app>/
├── app/                     # expo-router screens (file = route)
│   ├── _layout.js           # root: auth/onboarding gate
│   ├── (auth)/ or (authenticate)/   # login, otp, register, terms...
│   └── (tabs)/              # main tabbed UI; each tab folder has its own _layout.js (Stack)
├── stores/                  # Zustand stores (authStore, orderStore/tripStore, cartStore...)
├── lib/                     # api.js (axios), pushNotifications.js, etc.
├── components/              # shared UI (Button, RescheduleModal, ...)
├── constants/theme.js       # COLORS, SPACING, RADIUS, SHADOW design tokens
├── config/dev.js            # ← BACKEND URL for this app (set to your LAN IP)
└── package.json
```

> **expo-router rule:** every tab folder must contain a `_layout.js` so the
> folder collapses to the tab name. A missing one causes
> `No route named "x"` warnings and broken back-navigation (doc 16).

## API client (`lib/api.js`)

axios instance. Base URL = `${DEV_BACKEND_URL}/api/v1` in dev (from
`config/dev.js`), `https://api.washingbells.in/api/v1` in prod. A request
interceptor attaches the JWT from `expo-secure-store`.

## State (Zustand)

| Store | App | Key actions |
|-------|-----|-------------|
| `authStore` | all | `initialize`, `loginWithPassword`, `verifyOTP`, `logout`, `needsTerms`/`refreshTermsStatus` |
| `cartStore` | customer | add/update items, totals (server-driven) |
| `orderStore` | customer/store | create/fetch orders; store actions (accept/reject/receive/...) |
| `tripStore` | rider | worklist, `setOnline`, `updateLocation`, trip OTP flow |
| `walletStore`/`couponStore`/`addressStore` | customer | wallet, coupon validate, addresses |

## Customer app highlights

- `app/(authenticate)/` — login (phone+password / OTP), onboarding, terms.
- `app/(tabs)/home/` — services, address picker.
- `app/(tabs)/basket/checkout.js` — the big one: address, **store picker**,
  **slot picker (Today + 5 days)**, coupon, **wallet**, **Razorpay checkout**
  (via `lib/RazorpayCheckout.js` WebView), COD.
- `app/(tabs)/orders/[id].js` — order tracking + **Reschedule** + cancel.

## Rider app highlights

- `app/(auth)/` — login, register, KYC documents, terms.
- `app/(tabs)/home/` — **online toggle** + foreground GPS reporting (powers the
  admin live map), stats, pending trips.
- `app/(tabs)/tasks/[tripId].js` — the trip flow: start → photos → pickup OTP →
  **Drop at Store** (store-drop OTP) for pickups; OTP verify for deliveries.
  Has a **Reschedule Pickup** action.
- Background GPS: `lib/locationTracking.js` (expo-task-manager). Note: background
  tracking needs a dev build; the **foreground** updater in the home screen keeps
  the live map working in Expo Go.

## Store app highlights

- `app/(auth)/` — login, store setup, complete-profile, terms.
- `app/(tabs)/home/` — open/close toggle, stats, recent orders.
- `app/(tabs)/orders/[orderId].js` — per-status action map (accept/reject →
  assign rider → **receive OTP** → start processing → set time → mark ready →
  book rider). Has **Reschedule** in the header. Print garment tags (`lib/printTags.js`).
- `app/(tabs)/settings/hours.js` — weekly hours + holiday closures.

## Push notifications

`lib/pushNotifications.js` registers an Expo push token (`POST
/notifications/register-token`) on login and sets up channels. The backend
sends via `push_service.py`. Real push tokens need a dev/standalone build (not
Expo Go), and EAS project IDs are placeholders (doc 15).

## Key dependencies (Expo SDK 54 — keep these pinned)

`expo ~54`, `react-native 0.81.5`, `react 19.1`, `expo-router ~6`,
`expo-secure-store ~15`, `expo-location ~19`, `expo-notifications ~0.32`,
`expo-device ~8`, `expo-image-picker ~17`. Store app also uses
`expo-file-system ~19`, `expo-print ~15`, `expo-sharing ~14`,
`react-native-webview 13.15`, `@react-native-community/datetimepicker 8.4.4`.

> Install Expo packages with `npx expo install <pkg>` (picks the SDK-correct
> version). A plain `npm install <pkg>` pulls the *latest* version, which won't
> match SDK 54 and breaks at runtime (this happened — doc 16).
