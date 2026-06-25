> ⚠️ **OUTDATED / SUPERSEDED.** WashingBells no longer uses Twilio — SMS & OTP
> are handled by **MSG91**. See `docs/handover/10-integrations.md` and
> `docs/handover/11-configuration.md`. This file is kept for historical
> reference only.

# 📱 Twilio OTP Setup Guide — WashingBells

## What You Have
- ✅ **Twilio API Key SID**: `[REDACTED]`
- ✅ **Twilio API Secret**: `[REDACTED]`
- ❌ **Account SID**: Missing (needed to use the API Key)
- ❌ **Verify Service SID**: Missing (will auto-create if Account SID is provided)

---

## Step 1: Get Your Account SID

1. Go to **[console.twilio.com](https://console.twilio.com)**
2. Login to your account
3. On the **Dashboard/Home page**, look for:
   ```
   Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Copy it — it starts with **`AC`**

---

## Step 2: Update `.env`

Open `/Users/raunakpandey/Downloads/WashingBells/backend/.env` and fill in:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   ← paste your Account SID here
TWILIO_API_KEY=[REDACTED]
TWILIO_API_SECRET=[REDACTED]
TWILIO_VERIFY_SERVICE_SID=                              ← leave blank, auto-creates
DEBUG=False                                             ← set to False to use real OTP
```

---

## Step 3: Create a Verify Service (auto or manual)

### Option A — Auto (recommended)
Leave `TWILIO_VERIFY_SERVICE_SID` blank. When the first OTP is sent, the backend automatically:
1. Creates a **WashingBells OTP** Verify Service
2. Logs the service SID: `TWILIO_VERIFY_SERVICE_SID=VAxxxx...`
3. You can then paste it back into `.env` for persistence

### Option B — Manual
1. Go to **console.twilio.com → Verify → Services**
2. Click **Create new Service**
3. Name: `WashingBells OTP`
4. Copy the **Service SID** (starts with `VA...`)
5. Add to `.env`: `TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 4: Handle Trial Account Limitations

If your Twilio account is in **trial mode**:

⚠️ **Trial accounts can only send SMS to verified phone numbers.**

To verify a test phone number:
1. Go to **console.twilio.com → Phone Numbers → Verified Caller IDs**
2. Click **Add a new Caller ID**
3. Enter your phone number (e.g., `+919876543210`)
4. Twilio will call/SMS you with a code to confirm

Once verified, real OTPs will be delivered to that number.

---

## Step 5: Test It

After filling `.env`:

```bash
# Restart the backend to load new env
cd /Users/raunakpandey/Downloads/WashingBells/backend
pkill -f uvicorn
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Test send OTP
curl -X POST http://localhost:8000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+91XXXXXXXXXX"}'

# You should see in backend logs:
# OTP sent to +91XXXXXXXXXX: status=pending
# OR
# TWILIO_VERIFY_SERVICE_SID=VA... (on first run if auto-created)
```

---

## Current Behavior (Before Setup)

Right now with empty `TWILIO_ACCOUNT_SID`:
- OTP is **always `123456`** (dev bypass mode)
- No real SMS is sent
- All test phones work

After filling Account SID + setting `DEBUG=False`:
- **Real SMS OTPs** sent to verified phone numbers
- `123456` no longer works

---

## Architecture Overview

```
Customer App  ──→  POST /api/v1/auth/send-otp  ──→  Twilio Verify (SMS)
                                                           │
Customer Phone ──receives SMS──────────────────────────────┘
Customer App  ──→  POST /api/v1/auth/verify-otp  ──→  Twilio Verify check
                         │
                         ↓ (if approved)
                    JWT Token issued
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/.env` | Added `TWILIO_API_KEY` and `TWILIO_API_SECRET` |
| `backend/app/core/config.py` | Added `TWILIO_API_KEY` and `TWILIO_API_SECRET` settings |
| `backend/app/services/twilio_service.py` | Supports API Key auth + auto-creates Verify Service |
