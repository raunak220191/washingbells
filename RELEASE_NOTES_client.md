# WashingBells — Release Notes (Client Feedback Round 1)

Hardik bhai, is release mein aapke bataye hue sab major issues fix ho gaye
hain. Neeche app-wise list hai — kya fix hua aur kya retest karna hai.

## Customer App

**Fixed:**
- Order place karna ab dono modes mein kaam karta hai — Pay Now aur Pay on
  Delivery. (A1, A2)
- Ab bina payment ke order "confirm" nahi hota — jab tak payment complete na
  ho, store ko order dikhta hi nahi, aur confirmation email bhi nahi jaata. (A3)
- Coupons ab checkout par dikhte hain — tap karke apply karo, ya code type
  karo. Bina limit wale % coupons bhi ab sahi kaam karte hain. (A5)
- Bill/GST invoice har order ke liye banta hai, app mein khulta hai aur
  share bhi hota hai. (A6)
- Order details mein ab payment status (paid/unpaid), delivery address, aur
  pickup + delivery ka ALAG-ALAG time dikhta hai. Dono edit bhi ho sakte
  hain. (A7, G7)
- Wallet mein paise add karna ab kaam karta hai. (A8)
- **Store discovery fix**: 30 km radius wali problem solve — ab store apne
  set kiye hue radius ke hisaab se milta hai. Lat/long kabhi nahi poochha
  jaayega — address type karo, baaki system sambhal lega. (B1, B2)
- Email input ab Android par dikhta hai (white-on-white fix). (G4)
- Neeche ke tabs ab phone ke system buttons se nahi takraate. (G1)
- Payment ke do alag selectors: kab pay karna hai (abhi / delivery par) aur
  kaise (UPI / card / cash). (D13)

**Retest karo:** order place (dono payment modes), coupon apply, bill
download/share, order details mein alag pickup/delivery time.

## Store App

**Fixed:**
- Walk-in bill: ab decimal weight chalta hai (1.3 kg, 2.2 kg) — poora paisa
  milega, rounding loss nahi. Quantity seedha type kar sakte ho, sirf +/-
  nahi. Bill mein har item edit/delete ho sakta hai. (E4, E6)
- Bill mein coupon ya % discount de sakte ho. (E5)
- Location pin ab crash nahi karta. (B3)
- Naya order 10 second ke andar dikh jaata hai. (A4)
- iPad par app ab stretched nahi dikhta — content beech mein aata hai. (E7)
- Sunday (ya koi bhi din) open/closed — Settings → Hours se set karo; admin
  bhi kar sakta hai. (G6)

**Retest karo:** walk-in bill with 1.3 kg, print tag, GST bill, location pin.

## Rider App

**Fixed:**
- Install issue ka reason mil gaya: pehle jo link mail hua tha woh .aab file
  thi jo phone par install nahi hoti. Ab installable APK link milega. (F1)
- Rider ka poora flow test ho chuka hai: login → task list → accept →
  pickup start. (F2)

## Admin Panel

**Naya:**
- Order edit (items, quantity, discount) + pickup/delivery time reschedule. (D1)
- Customer, rider, store — sab profiles edit ho sakte hain, addresses
  included. (D2, D3, D4)
- Kisi ka bhi password reset karo — purane logins turant logout ho jaate
  hain. (D5)
- Store ke UPI/bank settlement details admin se set karo. (D9)
- Delivery fee, free-delivery limit, platform fee — Settings se control
  karo; per-store alag bhi set kar sakte ho. (D10)
- Notification bell: naye orders, payments, cancellations sab dikhte hain. (D11)

## Important (backend/account setup pending — aapki taraf se)

1. **OTP**: Twilio ka account token invalid ho gaya hai — naya token do,
   phir OTP live hoga. Tab tak password login use karo. (C1)
2. **Razorpay webhook**: dashboard mein webhook set karna hai (checklist
   mein steps hain).
3. **Google Maps key**: store app mein map dikhane ke liye chahiye — abhi
   GPS-based pin fallback chal raha hai.

Poora technical detail: `CHANGELOG_CLIENT_FIXES.md`. Deploy steps:
`PLAY_RELEASE_CHECKLIST.md` + `APPSTORE_RELEASE_CHECKLIST.md`.
