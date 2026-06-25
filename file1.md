# WashingBells — Production Readiness Plan

**Last reviewed:** May 2026
**FX assumption:** ₹85 / USD (used to convert vendor prices)
**Scope:** customer + rider + store mobile apps, admin web panel, FastAPI backend, MongoDB.

This document covers everything required to move WashingBells from development to a production launch in India, with running-cost estimates for each major cloud provider (AWS, GCP, Azure) at three traffic tiers.

---

## 1. What "production ready" means here

To call this app production-ready we need:

1. A **public backend** with HTTPS, a real domain, monitoring, backups, and predictable uptime.
2. **Managed MongoDB** with automated backups and replica-set redundancy.
3. **Object storage + CDN** for photos (currently base64 in MongoDB — a hard scale blocker).
4. **Live payment integration** (Razorpay) instead of the current mock.
5. **Production push notifications** via EAS projectIds (rider/store have none; customer has a placeholder).
6. **Email deliverability** — DKIM/domain auth in SendGrid so emails don't land in spam.
7. **Twilio account upgrade** out of trial so OTP works for any phone number.
8. **App Store + Play Store** publication for the three mobile apps.
9. **Sentry + structured logging** so you can see what's breaking.
10. **CI/CD pipeline** so deploys don't require a developer at a laptop.
11. **Staging environment** that mirrors production so changes can be verified before going live.
12. **WAF + rate limiting** to deflect OTP / API abuse.

---

## 2. Three traffic tiers used for sizing

All cost estimates in this doc are calculated against one of these tiers.

| Tier | Active users | Orders / day | Concurrent users (peak) | Photos / day | Backend req / day |
|---|---|---|---|---|---|
| **T1 — Launch** | 500 | 50 | 30 | ~300 (50 orders × 5–6 photos) | ~50k |
| **T2 — Growth** | 5,000 | 500 | 200 | ~3,000 | ~500k |
| **T3 — Scale** | 50,000 | 5,000 | 1,500 | ~30,000 | ~5M |

Beyond T3 you'd want a different architecture (multi-region, async order pipeline, dedicated DB cluster). This doc covers up to T3.

---

## 3. Activities checklist (in execution order)

### Phase A — Account & domain (Day 1)

- [ ] Buy a domain (e.g. `washingbells.in`) — ₹800-1500/yr at Hostinger / GoDaddy / Namecheap
- [ ] Create cloud account (one of AWS / GCP / Azure) — free, requires card
- [ ] Set up DNS host (Cloudflare recommended; free; better than registrar DNS)
- [ ] Apple Developer account — $99 / yr (≈₹8,500)
- [ ] Google Play Developer — $25 one-time (≈₹2,150)
- [ ] Expo organisation account — free; required for EAS Build & Push
- [ ] Sentry account — free tier OK initially
- [ ] Cloudinary or AWS S3 account (depending on storage choice)
- [ ] **Upgrade Twilio out of trial** — add ~$20 credit so OTP works for non-verified numbers
- [ ] **SendGrid domain authentication** — add 3 CNAME records to your DNS
- [ ] Razorpay merchant account + KYC (₹0 setup; takes 2-5 business days for KYC)

### Phase B — Backend deployment (Week 1)

- [ ] Containerise FastAPI app (write `Dockerfile`)
- [ ] Pick a runtime (Cloud Run / ECS Fargate / Container Apps — see Section 4)
- [ ] Provision MongoDB cluster (MongoDB Atlas M10 recommended for T1)
- [ ] Move secrets to cloud secret manager (Secret Manager / Secrets Manager / Key Vault)
- [ ] Configure custom domain + SSL (`api.washingbells.in`)
- [ ] Deploy staging environment first; smoke test
- [ ] Deploy production environment
- [ ] Wire backend to **production** Razorpay + Twilio + SendGrid keys

### Phase C — File storage migration (Week 2)

- [ ] Set up Cloudinary or S3 bucket
- [ ] Migrate `/upload` endpoint to push to chosen storage
- [ ] Run `migrate_uploads_to_cloudinary.py` against production data
- [ ] Verify all read paths use CDN URL instead of base64
- [ ] Drop base64 data from MongoDB once verified (this reclaims most of the DB size)

### Phase D — Mobile apps (Weeks 2-3)

- [ ] `eas init` for each of the 3 apps (customer, rider, store) — creates project IDs
- [ ] Replace placeholder `projectId` in `app.json` files
- [ ] Configure `eas build --platform ios` and `--platform android` for each app
- [ ] Test push notifications on production builds (Expo Go tokens won't work)
- [ ] Submit to TestFlight (iOS) + Internal Testing (Android) for QA
- [ ] App Store + Play Store review — typically 1-7 days each
- [ ] Customer app icon + screenshots + privacy policy + store listing
- [ ] Rider + store apps published privately or as separate listings (your choice)

### Phase E — Admin web panel (Week 2, parallel)

- [ ] Add `NEXT_PUBLIC_API_URL` to point at production backend
- [ ] Deploy Next.js admin to Vercel (free for small projects) or your cloud provider
- [ ] Configure custom domain (`admin.washingbells.in`)
- [ ] Restrict access (IP allowlist or auth flow — admin login already exists)

### Phase F — Monitoring, security, CI/CD (Week 3)

- [ ] Install Sentry SDK in backend + mobile apps
- [ ] Structured JSON logging via `structlog`
- [ ] Cloud logging integration (CloudWatch / Cloud Logging / Log Analytics)
- [ ] Rate limiting via `slowapi` (covered in Sprint 5 plan)
- [ ] CORS lockdown
- [ ] Add MongoDB indexes (see Sprint 5 plan for the list)
- [ ] Set up automated daily DB backups (Atlas does this automatically)
- [ ] GitHub Actions CI/CD for backend + admin deploys
- [ ] Configure Cloudflare WAF in front of API (free)

### Phase G — Launch readiness (Week 4)

- [ ] Load test the backend (Locust or k6) at 3× expected peak
- [ ] Security audit — OWASP top 10 sweep
- [ ] Privacy policy + Terms of Service published (already supported in admin/email/T&C)
- [ ] GST registration + business compliance (India-specific)
- [ ] Customer support email + WhatsApp configured
- [ ] Run a soft launch with 20-50 test users for a week before opening publicly

---

## 4. Cloud provider comparison

All three are viable. Pick based on familiarity, not price — they're within 15% of each other at our tier.

### What we need from any cloud provider

| Component | Purpose |
|---|---|
| Container runtime | Run the FastAPI backend |
| HTTPS load balancer | TLS termination, routing |
| Object storage | Photo storage |
| CDN | Photo delivery + admin static assets |
| Secret manager | API keys, DB credentials |
| DNS | (Cloudflare recommended over cloud DNS) |
| Logging / monitoring | App + infra observability |
| Backup storage | DB snapshots, log archives |

### Option A — AWS

| Component | Service | Why |
|---|---|---|
| Compute | **ECS Fargate** (or App Runner) | Serverless containers; scales to zero; no server management |
| Database | **MongoDB Atlas on AWS** | Managed by Mongo themselves; free $0 tier exists; integrates with AWS VPC |
| Object storage | **S3** | Standard. Pair with CloudFront. |
| CDN | **CloudFront** | Tightly integrated with S3 |
| Load balancer | **Application Load Balancer (ALB)** | Standard TLS + HTTP routing |
| Secrets | **AWS Secrets Manager** | $0.40 per secret/month |
| Logs | **CloudWatch Logs** | Built-in; cheap |
| WAF | **CloudFront + AWS WAF** | Cloudflare free is competitive |

**Pros:** Most mature ecosystem; deepest service catalog; easy hiring.
**Cons:** Most complex pricing — easy to leak money on unused resources. Egress is expensive.

### Option B — Google Cloud Platform (GCP)

| Component | Service | Why |
|---|---|---|
| Compute | **Cloud Run** | Serverless containers; scales to zero; **best-in-class developer experience** |
| Database | **MongoDB Atlas on GCP** | Same Atlas, just on GCP region |
| Object storage | **Cloud Storage** | Equivalent to S3 |
| CDN | **Cloud CDN** | Built into the load balancer |
| Load balancer | **HTTPS Load Balancer** | Per-request pricing — cheaper at low traffic |
| Secrets | **Secret Manager** | $0.06 per active secret/month — cheaper than AWS |
| Logs | **Cloud Logging** | First 50GB/month free; very generous |
| WAF | **Cloud Armor** | Add-on; Cloudflare free is competitive |

**Pros:** Cloud Run is simpler than ECS — single command deploy, scales to zero by default (huge for T1). Cheaper logging. Better data analytics if you ever want BigQuery.
**Cons:** Smaller talent pool. Some services behind AWS feature-wise (queues, search).

### Option C — Microsoft Azure(Recommended)

| Component | Service | Why |
|---|---|---|
| Compute | **Azure Container Apps** | Equivalent to Cloud Run; serverless containers |
| Database | **MongoDB Atlas on Azure** OR **Cosmos DB MongoDB API** | Atlas recommended (true Mongo); Cosmos has compat quirks |
| Object storage | **Blob Storage** | Equivalent to S3 |
| CDN | **Azure CDN (Microsoft)** or front via Cloudflare | |
| Load balancer | **Application Gateway** | Standard TLS + routing |
| Secrets | **Key Vault** | $0.03 per 10k operations |
| Logs | **Log Analytics** | First 5GB/month free; then $2.30/GB |
| WAF | **Web Application Firewall on App Gateway** | |

**Pros:** Strong for enterprise Microsoft shops; good Indian region presence; tight Office 365 integration if you use that for ops.
**Cons:** Container Apps is newer than ECS / Cloud Run. Smaller community of practitioners in India for cloud-native stacks.

---

## 5. Monthly running cost — cloud infrastructure only

USD/month + ₹/month. **Excludes** third-party API costs (Twilio, SendGrid, Razorpay etc) which are covered separately in Section 6.

### Tier 1 — Launch (500 users, 50 orders/day)

| Component | AWS | GCP | Azure |
|---|---|---|---|
| Compute (backend) | ECS Fargate (0.5 vCPU, 1GB RAM, 1 task) ~$22 | Cloud Run (scale-to-zero) ~$8 | Container Apps (scale-to-zero) ~$10 |
| MongoDB Atlas M10 (10GB) | $57 | $57 | $57 |
| Object storage (10GB photos) | S3 ~$0.25 | GCS ~$0.20 | Blob ~$0.20 |
| CDN (50GB transfer) | CloudFront ~$4 | Cloud CDN ~$3 | Azure CDN ~$4 |
| Load balancer | ALB ~$22 | HTTPS LB ~$18 | App Gateway ~$25 |
| Secrets | $1 | $0.30 | $0.30 |
| Logs (5GB/mo) | CloudWatch ~$2.50 | Cloud Logging $0 | Log Analytics $0 |
| Backups (Atlas built-in) | $0 | $0 | $0 |
| **Subtotal** | **~$109 / ₹9,250** | **~$87 / ₹7,400** | **~$97 / ₹8,250** |

> **GCP wins T1 by ~20%** thanks to scale-to-zero compute and free logging. If you can live without the load balancer (Cloud Run can take traffic directly), drop another $18 — making GCP closer to ~$69/mo.

### Tier 2 — Growth (5k users, 500 orders/day)

| Component | AWS | GCP | Azure |
|---|---|---|---|
| Compute (backend, ~3 instances avg) | ECS Fargate ~$110 | Cloud Run ~$75 | Container Apps ~$90 |
| MongoDB Atlas M20 (20GB, M20) | $140 | $140 | $140 |
| Object storage (100GB photos) | S3 ~$2.50 | GCS ~$2 | Blob ~$2 |
| CDN (500GB transfer) | CloudFront ~$42 | Cloud CDN ~$32 | Azure CDN ~$36 |
| Load balancer | ALB ~$22 | HTTPS LB ~$20 | App Gateway ~$28 |
| Secrets | $1 | $0.30 | $0.30 |
| Logs (50GB/mo) | CloudWatch ~$25 | Cloud Logging $0 | Log Analytics ~$104 |
| **Subtotal** | **~$342 / ₹29,000** | **~$270 / ₹23,000** | **~$400 / ₹34,000** |

> **GCP still wins** by ~$70/month. Azure jumps because Log Analytics charges aggressively above 5GB. Mitigation: ship logs to GCS bucket instead.

### Tier 3 — Scale (50k users, 5k orders/day)

| Component | AWS | GCP | Azure |
|---|---|---|---|
| Compute (backend, ~10 instances avg) | ECS Fargate ~$650 | Cloud Run ~$520 | Container Apps ~$580 |
| MongoDB Atlas M40 (80GB) | $570 | $570 | $570 |
| Object storage (1TB photos) | S3 ~$23 | GCS ~$20 | Blob ~$20 |
| CDN (5TB transfer) | CloudFront ~$340 | Cloud CDN ~$300 | Azure CDN ~$320 |
| Load balancer | ALB ~$30 | HTTPS LB ~$22 | App Gateway ~$80 |
| Secrets | $1 | $0.30 | $0.30 |
| Logs (500GB/mo) | CloudWatch ~$250 | Cloud Logging $50 | Log Analytics ~$1,100 |
| Sentry / monitoring | (add) | (add) | (add) |
| **Subtotal** | **~$1,864 / ₹158,000** | **~$1,482 / ₹126,000** | **~$2,670 / ₹227,000** |

> **At T3 a self-managed MongoDB on EC2/GCE/VM is ~40% cheaper than Atlas, but adds operational burden. Recommend staying on Atlas until T3+.**

---

## 6. Third-party API costs (cloud-independent)

These bills come from the API vendors directly. They scale with usage, not with cloud provider.

### 6.1 Twilio (SMS + OTP)

Indian SMS pricing is the most volatile part of the bill. Twilio charges per attempt, even failures.

| Tier | Volume/month | Twilio Verify (₹0.50/SMS) | Twilio invitation SMS (₹0.80/SMS) | Total |
|---|---|---|---|---|
| T1 | 2,000 OTP + 50 invites | ₹1,000 | ₹40 | **₹1,040 / ~$12** |
| T2 | 20,000 OTP + 500 invites | ₹10,000 | ₹400 | **₹10,400 / ~$122** |
| T3 | 200,000 OTP + 5,000 invites | ₹100,000 | ₹4,000 | **₹104,000 / ~$1,224** |



### 6.2 SendGrid (email)

| Plan | Monthly emails | Cost |
|---|---|---|
| Free | 100/day (3,000/mo) | $0 |
| Essentials | 50,000 | $19.95 (~₹1,700) |
| Pro | 100,000 | $89.95 (~₹7,650) |
| Premier (custom) | 1M+ | quote |

| Tier | Estimated emails | Plan | Cost |
|---|---|---|---|
| T1 | ~5,000 (50 orders × 3 events × 30 days + admin alerts) | Essentials | ~$20 / ₹1,700 |
| T2 | ~50,000 | Essentials | ~$20 / ₹1,700 |
| T3 | ~500,000 | Pro | ~$90 / ₹7,650 |

### 6.3 Razorpay (payments)

Razorpay charges per successful payment:
- **2% + GST** for standard cards / UPI / netbanking
- **3% + GST** for international cards / PayPal-style methods

| Tier | GMV / month | Avg ₹/order | Razorpay fee (~2.36% w/GST) |
|---|---|---|---|
| T1 | 50 orders × 30 days × ₹500 avg = ₹750,000 | ₹500 | **~₹17,700** |
| T2 | 500 × 30 × ₹500 = ₹7,500,000 | ₹500 | **~₹177,000** |
| T3 | 5,000 × 30 × ₹500 = ₹75,000,000 | ₹500 | **~₹1,770,000** |

> Negotiate the rate at T2+. Major Indian D2C brands get 1.5-1.8% with volume commitments.

### 6.4 Cloudinary (if chosen over S3)

| Plan | Storage | Bandwidth | Cost |
|---|---|---|---|
| Free | 25GB | 25GB/mo | $0 |
| Plus | 300GB credits | shared | $89/mo (~₹7,560) |
| Advanced | 1,500GB credits | shared | $224/mo (~₹19,000) |

| Tier | Storage + bandwidth | Plan | Cost |
|---|---|---|---|
| T1 | ~10GB stored, ~20GB/mo BW | Free | **$0** |
| T2 | ~100GB stored, ~250GB/mo BW | Plus | **~$89 / ₹7,560** |
| T3 | ~1TB stored, ~2.5TB/mo BW | Advanced | **~$224 / ₹19,000** |

> Cloudinary is more expensive than raw S3+CloudFront but gives you on-the-fly image transforms (resize, format, quality) which would otherwise be backend work. Worth it for T1-T2; reconsider at T3.

### 6.5 Google Maps Platform

Required for the live tracking map (admin), store GPS picker (rider/store registration), and customer address autofill if you add it.

Pricing (after $200/mo free credit):
- Maps JavaScript API: $7 per 1k loads
- Places API (autocomplete): $17 per 1k sessions
- Directions API: $5 per 1k requests
- Static Maps API: $2 per 1k

| Tier | Estimated usage | After free credit |
|---|---|---|
| T1 | Within $200 free credit | **$0** |
| T2 | ~50k map loads + 5k places sessions = $435 | **~$235 / ₹20,000** |
| T3 | ~500k map loads + 50k places = $4,350 | **~$4,150 / ₹352,000** |

> Cost-saving: at T3, switch the admin tracking map from Google Maps to MapLibre + OpenStreetMap tiles (already used in the admin panel) — saves the entire map-loads cost.

### 6.6 Expo Push notifications

**Free, unlimited.** Expo absorbs the FCM/APNS quotas. No marginal cost.

### 6.7 Sentry (error tracking)

| Plan | Events/month | Cost |
|---|---|---|
| Developer | 5,000 | $0 |
| Team | 50,000 | $26 (~₹2,210) |
| Business | 100,000 | $80 (~₹6,800) |

| Tier | Expected errors | Plan | Cost |
|---|---|---|---|
| T1 | <5,000 | Developer | $0 |
| T2 | ~25,000 | Team | $26 |
| T3 | ~200,000 | Business+ | $80-200 |

### 6.8 App Store + Play Store

- Apple Developer Program: $99/yr (~₹8,500/yr)
- Google Play Developer: $25 one-time (~₹2,150)
- **Three apps × Apple = $297/yr if you publish all three separately on iOS** OR include all three under a single dev account (same $99/yr) by listing each as a separate app — recommended.

---

## 7. Total monthly cost — putting it all together

### T1 — Launch (500 users, 50 orders/day)

| Category | AWS | GCP | Azure |
|---|---|---|---|
| Cloud infrastructure | $109 | $87 | $97 |
| Twilio | $12 | $12 | $12 |
| SendGrid | $20 | $20 | $20 |
| Razorpay (2.36% of ₹750k GMV) | ₹17,700 ≈ $208 | $208 | $208 |
| Cloudinary | $0 | $0 | $0 |
| Google Maps | $0 | $0 | $0 |
| Sentry | $0 | $0 | $0 |
| **Total / month** | **~$349 / ₹29,600** | **~$327 / ₹27,800** | **~$337 / ₹28,650** |

Plus one-time: Apple Developer $99/yr, Google Play $25 (one-time), domain ₹1,000/yr.

### T2 — Growth (5k users, 500 orders/day)

| Category | AWS | GCP | Azure |
|---|---|---|---|
| Cloud infrastructure | $342 | $270 | $400 |
| Twilio (or MSG91 for ~50% off) | $122 | $122 | $122 |
| SendGrid | $20 | $20 | $20 |
| Razorpay (~₹177k) | $2,080 | $2,080 | $2,080 |
| Cloudinary | $89 | $89 | $89 |
| Google Maps | $235 | $235 | $235 |
| Sentry | $26 | $26 | $26 |
| **Total / month** | **~$2,914 / ₹248k** | **~$2,842 / ₹242k** | **~$2,972 / ₹253k** |

### T3 — Scale (50k users, 5k orders/day)

| Category | AWS | GCP | Azure |
|---|---|---|---|
| Cloud infrastructure | $1,864 | $1,482 | $2,670 |
| Twilio (or MSG91) | $1,224 | $1,224 | $1,224 |
| SendGrid | $90 | $90 | $90 |
| Razorpay (~₹1.77M, negotiated 1.8%) | $17,640 | $17,640 | $17,640 |
| Cloudinary | $224 | $224 | $224 |
| Google Maps (or migrate to OSM) | $4,150 (or $0) | $4,150 (or $0) | $4,150 (or $0) |
| Sentry | $200 | $200 | $200 |
| **Total / month** | **~$25,392 / ₹2.16M** | **~$25,010 / ₹2.13M** | **~$26,198 / ₹2.23M** |

> At T3, Razorpay is 70% of your bill. Negotiating from 2% to 1.5% saves ~$3,750/mo. **This is the single biggest cost lever.**

---

## 8. One-time setup costs (months 0–2)

| Item | Cost |
|---|---|
| Domain registration (1 yr) | ~₹1,000 |
| Apple Developer Program (1 yr) | ~₹8,500 |
| Google Play Developer (one-time) | ~₹2,150 |
| GST registration (CA fees) | ~₹3,000 |
| Logo, brand, app store screenshots (designer) | ₹15,000–50,000 |
| App Store / Play Store legal pages (privacy, terms — admin generates these) | ₹0 |
| Initial development time (assumed already spent) | — |
| **Total one-time** | **₹30,000–65,000 / ~$350–760** |

---

## 9. Recommended starting stack

For T1 launch, this gives the best operational simplicity and lowest cost:

| Layer | Choice | Why |
|---|---|---|
| Cloud | **GCP** | Cloud Run scale-to-zero + free 50GB logging beats AWS by ~$25/mo at T1 |
| Compute | **Cloud Run** | Single command deploy; no server management |
| Database | **MongoDB Atlas M10 on GCP** | Same Atlas you'd use anywhere; cheap; trivial backups |
| Storage | **Cloudinary Free** | 25GB free covers T1; gives image transforms |
| CDN | **Cloudflare** (free) | In front of everything; free WAF + DDoS |
| DNS | **Cloudflare DNS** | Free |
| Email | **SendGrid Essentials** | $20/mo covers T1+T2 |
| SMS | **Twilio Verify** (consider MSG91 at T2) | India-priced SMS |
| Payments | **Razorpay** | Industry standard for India |
| Error tracking | **Sentry Developer (free)** | 5k events/mo plenty for T1 |
| Mobile | **EAS Build + Expo Push** | No Firebase setup; Expo handles it |
| Admin web | **Vercel** | Free for small projects; great Next.js integration |
| CI/CD | **GitHub Actions** | Free for our usage |

**Estimated T1 cost on this stack: ~$327 / ₹27,800 per month + ~$10,650 one-time setup.**

---

## 10. What this doc deliberately doesn't cover

- **Team costs** (developers, customer support, ops). This doc is infra + APIs only.
- **Marketing spend** (Google / Meta ads, influencer, etc.).
- **Office, hardware, salaries.**
- **Inventory** (laundry equipment, store fit-outs) — that's the store-owner's capex, not yours.
- **Returns / refund reserves.**
- **GST output** on customer orders — you'll collect this and remit; not a cost.

---

## 11. Action items for the next 30 days

In order of urgency, before you can go live with real users:

1. **Twilio upgrade** — without this, real users can't log in. ₹0 today; ~₹1,000 credit minimum.
2. **Cloudflare DNS + domain** — required for HTTPS on api/admin/customer-facing.
3. **MongoDB Atlas M10** — production-grade DB with backups.
4. **GCP Cloud Run + Container** — deploy backend behind `api.washingbells.in`.
5. **Cloudinary** — set up free tier, migrate photos.
6. **SendGrid domain auth** — fix email deliverability.
7. **Razorpay live keys** — replace mock payments.
8. **EAS projectIds** — production push notifications.
9. **App Store / Play Store accounts** — start review process (takes 1-7 days).
10. **Sentry SDK** — install in backend + apps.

Plan ~30 days end-to-end including App Store review windows.

---

*All costs are estimates as of mid-2026 and will drift. Re-validate before committing to any vendor.*
