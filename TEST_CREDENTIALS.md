# WashingBells Test Credentials

**Last Updated:** May 21, 2026  
**Environment:** Development  
**Twilio Mode:** LIVE (Trial Account)  
**All Services:** Verified Running (5/5 — 81 API endpoints loaded)

---

## Quick Access URLs

| Service | URL | Port | Status |
|---------|-----|------|--------|
| Backend API | http://localhost:8000 | 8000 | Running |
| Swagger Docs | http://localhost:8000/docs | 8000 | Interactive API Docs |
| Admin Panel | http://localhost:3000 | 3000 | Next.js Running |
| Customer App | http://localhost:8081 | 8081 | Metro Bundler |
| Store App | http://localhost:8082 | 8082 | Metro Bundler |
| Rider App | http://localhost:8083 | 8083 | Metro Bundler |
| MongoDB | mongodb://localhost:27017 | 27017 | Connected |
| LAN IP (Expo Go) | http://192.168.1.41 | -- | Reachable |

> **Expo Go on physical device:** Scan QR code shown in Metro terminal, or enter URL manually:
> - Customer: exp://192.168.1.41:8081
> - Store: exp://192.168.1.41:8082
> - Rider: exp://192.168.1.41:8083

---

## ADMIN PANEL

### Login Credentials
```
Email: admin@washingbells.com
Password: admin123
```

### Access URLs
- Dashboard: http://localhost:3000/dashboard
- Services & Pricing: http://localhost:3000/services
- Promotions: http://localhost:3000/promotions
- Content Manager: http://localhost:3000/content
- Platform Settings: http://localhost:3000/settings
- Orders: http://localhost:3000/orders
- Customers: http://localhost:3000/customers
- Stores: http://localhost:3000/stores
- Riders: http://localhost:3000/riders
- Financials: http://localhost:3000/financials

### Admin Features
- Full CRUD on services & pricing
- Create/manage promotional coupons
- Manage banners & testimonials
- Configure platform fees & commission
- Quick create riders & stores
- View all orders, customers, stores, riders
- Financial reports & revenue breakdown

---

## CUSTOMER APP

### Test Phone Numbers (OTP Verification)

#### PRIMARY TEST NUMBER (Real SMS)
```
Phone: +919729021012
OTP: Will receive REAL SMS via Twilio
Use: Primary testing account
```

#### TEST USERS (Create via signup)
```
Phone: +919876543210
Name: Test Customer 1
Address: 123 Main St, Delhi, 110001

Phone: +919876543211
Name: Test Customer 2
Address: 456 Park Ave, Mumbai, 400001
```

> Note: Only +919729021012 is verified in Twilio trial. Other numbers will
> fail OTP unless DEBUG=True (dev bypass, OTP=123456).

### Customer Features to Test
1. **Onboarding & Auth**
   - Enter phone number -> Receive real SMS OTP
   - Verify OTP -> Complete profile
   - Auto-login on subsequent launches

2. **Address Management**
   - Add home/work/other addresses
   - Set default address
   - Edit/delete addresses

3. **Browse Services**
   - View service categories (Wash & Fold, Dry Cleaning, etc.)
   - Browse items with pricing
   - Add items to basket

4. **Place Order**
   - Review basket
   - Select pickup slot (date + time)
   - Apply coupon code
   - Choose payment method (COD/Online)
   - Add special instructions
   - Confirm order

5. **Track Order**
   - View order status in real-time
   - See assigned rider details
   - View status timeline
   - Rate order after delivery

6. **Wallet & Coupons**
   - Check wallet balance
   - View available coupons
   - Apply coupons at checkout
   - View transaction history

---

## STORE APP

### Test Store Credentials

#### STORE 1
```
Phone: +919729021012
OTP: Real SMS via Twilio
Store Name: WashingBells Store 1
Store ID: (Created via signup or admin panel)
Address: Shop 101, Connaught Place, Delhi
```

#### STORE 2 (Create via Admin -> Settings -> Quick Create Store)
```
Phone: +919988776655
Name: WashingBells Store 2
Address: Shop 202, Bandra West, Mumbai
```

### Store Features to Test
1. **Login**
   - Enter phone -> Receive OTP -> Verify

2. **Order Management**
   - View incoming orders (status: placed)
   - **Accept Order** -> Assign rider for pickup
   - **Receive Clothes** -> Enter rider drop OTP
   - **Start Processing** -> Begin work
   - **Set Delivery Time** -> +1/+2/+3/+4 hours
   - **Mark Ready** -> Complete processing
   - **Book Rider** -> Auto-assign delivery rider

3. **Order Details**
   - View customer info & address
   - See all order items
   - View pickup photos
   - See garment tags
   - Track status timeline
   - View payment breakdown
   - Calculate store revenue (80% share)

4. **Profile Management**
   - View store details
   - Check active orders
   - View earnings

---

## RIDER APP

### Test Rider Credentials

#### RIDER 1
```
Phone: +919729021012
OTP: Real SMS via Twilio
Rider Name: Test Rider 1
Rider ID: (Created via signup or admin panel)
Vehicle: Bike
Vehicle Number: DL01AB1234
```

#### RIDER 2 (Create via Admin -> Settings -> Quick Create Rider)
```
Phone: +919977665544
Name: Test Rider 2
Vehicle: Scooter
Vehicle Number: MH02CD5678
```

### Rider Features to Test
1. **Login**
   - Enter phone -> Receive OTP -> Verify
   - Toggle online/offline status

2. **Pickup Jobs**
   - Receive auto-assigned pickup tasks
   - Navigate to customer address
   - **Upload pickup photos** (proof)
   - **Generate drop OTP** -> Show to store
   - Mark pickup complete

3. **Delivery Jobs**
   - Receive auto-assigned delivery tasks
   - Navigate to customer address
   - **Generate delivery OTP** -> Show to customer
   - Mark delivery complete

4. **Earnings**
   - View today's earnings
   - Track completed jobs
   - View job history

---

## TWILIO CONFIGURATION

### Account Details
```
Account SID:        [REDACTED — superseded, see MSG91]
Auth Token:         [REDACTED]
API Key:            [REDACTED]
API Secret:         [REDACTED]
Verify Service SID: [REDACTED]
Console URL:        https://console.twilio.com
```

### Verified Numbers (Trial Account)
```
+919729021012 (Primary test number - receives real SMS)
```

### OTP Behavior
| Mode | Config | OTP |
|------|--------|-----|
| Live | DEBUG=False | Real SMS sent to verified numbers |
| Dev Bypass | DEBUG=True | Always returns 123456 |
| Trial Limit | — | Can only send to Twilio-verified numbers |

### Testing OTP Flow
1. Enter +919729021012 in any app
2. Wait 5-10 seconds for SMS
3. Enter received 6-digit OTP
4. Should verify successfully

### Adding More Verified Numbers
1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/verified
2. Click "Add a new Caller ID"
3. Enter phone number, verify via SMS
4. Number can now receive OTP in trial mode

---

## END-TO-END TEST SCENARIOS

### Scenario 1: Complete Order Flow
```
1. Customer App:
   - Login as +919729021012
   - Add items to basket (e.g., Wash & Fold -> Shirt x2, Pant x1)
   - Select pickup slot (today, 2:00 PM)
   - Apply coupon "FIRST20"
   - Place order -> Get order ID

2. Store App:
   - Login as store
   - See new order in incoming list
   - Accept order
   - (System auto-assigns pickup rider)

3. Rider App:
   - Login as rider, toggle Online
   - See pickup task appear
   - Navigate to customer address
   - Upload pickup photos
   - Show drop OTP to store

4. Store App:
   - Enter rider drop OTP
   - Start processing
   - Set delivery time (+2 hours)
   - Mark ready
   - Book delivery rider

5. Rider App:
   - See delivery task appear
   - Navigate to customer address
   - Show delivery OTP to customer

6. Customer App:
   - View order status updates in real-time
   - Order shows "Delivered"
   - Rate order (1-5 stars)
```

### Scenario 2: Admin Creates Coupon -> Customer Uses It
```
1. Admin Panel (http://localhost:3000/promotions):
   - Click "Create Coupon"
   - Code: SAVE50, Type: Flat, Value: 50, Min Order: 200
   - Save

2. Customer App:
   - Add items worth Rs 250+
   - At checkout, enter coupon "SAVE50"
   - Verify Rs 50 discount applied
   - Total should be Rs 200
   - Place order
```

### Scenario 3: Admin Creates Rider -> Rider Gets Jobs
```
1. Admin Panel (http://localhost:3000/settings):
   - Quick Create Rider section
   - Phone: +919729021012, Name: Test Rider, Vehicle: Bike
   - Submit

2. Rider App:
   - Login with same phone
   - Toggle status to "Online"

3. Store App:
   - Accept an order
   - System auto-assigns the online rider
   - Verify rider name shown

4. Rider App:
   - Pickup task appears immediately
```

### Scenario 4: Service & Pricing Management
```
1. Admin Panel (http://localhost:3000/services):
   - Click any service category (e.g., Wash & Fold)
   - Edit item prices inline
   - Add new item with + button
   - Delete an item
   - Verify changes in Customer App
```

---

## TEST PAYMENT METHODS

### COD (Cash on Delivery)
```
- Select "COD" at checkout
- No payment required upfront
- Payment status: pending
- Collect cash from customer at delivery
```

### Online Payment (Mock)
```
- Select "Online" at checkout
- Payment status: paid
- No actual gateway integration (dev mode)
```

---

## TEST COUPON CODES

Create these via Admin Panel -> Promotions (http://localhost:3000/promotions):

| Code | Type | Value | Min Order | Max Uses | Expires |
|------|------|-------|-----------|----------|---------|
| FIRST20 | Percentage | 20% | Rs 100 | 100 | Dec 31, 2026 |
| SAVE50 | Flat | Rs 50 | Rs 200 | 50 | Dec 31, 2026 |
| BULK100 | Flat | Rs 100 | Rs 500 | 25 | Dec 31, 2026 |

---

## DATABASE ACCESS

### MongoDB Connection
```bash
mongosh mongodb://localhost:27017/washingbells

# View collections
show collections

# Count documents
db.users.countDocuments()
db.orders.countDocuments()
db.stores.countDocuments()
db.services.countDocuments()

# View users
db.users.find().pretty()

# View orders
db.orders.find().pretty()

# View stores
db.stores.find().pretty()

# View riders
db.users.find({role:"rider"}).pretty()

# View services
db.services.find().pretty()

# View coupons
db.coupons.find().pretty()

# Find admin user
db.users.findOne({role:"admin"})
```

---

## TROUBLESHOOTING

### OTP Not Received
1. Check phone is verified in Twilio console
2. Verify DEBUG=False in backend/.env
3. Check Twilio account balance (trial = $15.50)
4. View backend logs: tail -f /tmp/wb_backend.log
5. Try setting DEBUG=True for dev bypass (OTP=123456)

### Metro Bundler Issues
```bash
# Clear cache and restart
cd /Users/raunakpandey/Downloads/WashingBells
npx expo start --port 8081 --clear

# For store app
cd store && npx expo start --port 8082 --clear

# For rider app
cd rider && npx expo start --port 8083 --clear
```

### Backend Connection Failed
1. Ensure backend running: curl http://localhost:8000/health
2. Check MongoDB is running: mongosh --eval "db.runCommand({ping:1})"
3. Verify API_URL in config/dev.js matches your LAN IP
4. Check CORS settings in backend/main.py

### Admin Panel Login Issues
1. Verify admin user exists: mongosh -> db.users.findOne({role:"admin"})
2. If missing, seed admin: curl -X POST http://localhost:8000/api/v1/admin/seed-admin
3. Clear browser localStorage and retry

### Store App Cannot Accept Orders
- Verify store is approved (admin panel -> Stores -> Approve)
- Check store is online
- Ensure order status is "placed"

### Rider Not Receiving Jobs
- Toggle rider status to "Online" in the app
- Verify rider is approved (admin panel -> Riders -> Approve)
- Check rider location is valid

---

## API ENDPOINTS REFERENCE (81 Total)

### Auth
```
POST /api/v1/auth/send-otp         Send OTP to phone number
POST /api/v1/auth/verify-otp       Verify OTP and get JWT token
POST /api/v1/auth/register-store   Register as store owner
POST /api/v1/auth/register-rider   Register as delivery rider
```

### Users & Addresses
```
GET  /api/v1/addresses              List user addresses
POST /api/v1/addresses              Add new address
PUT  /api/v1/addresses/{id}         Update address
DELETE /api/v1/addresses/{id}       Delete address
```

### Services & Cart
```
GET  /api/v1/services               List all service categories + items
GET  /api/v1/cart                    Get current cart
POST /api/v1/cart/items              Add item to cart
DELETE /api/v1/cart/items/{sid}/{iid} Remove item from cart
```

### Orders
```
POST /api/v1/orders/create          Place new order
GET  /api/v1/orders/my-orders       List user orders
GET  /api/v1/orders/{order_id}      Get order details
POST /api/v1/orders/{order_id}/cancel  Cancel order
```

### Store Operations
```
POST /api/v1/store/orders/{id}/accept           Accept incoming order
POST /api/v1/store/orders/{id}/receive           Mark clothes received
POST /api/v1/store/orders/{id}/start-processing  Start processing
POST /api/v1/store/orders/{id}/set-time          Set delivery time
POST /api/v1/store/orders/{id}/mark-ready        Mark order ready
POST /api/v1/store/orders/{id}/book-rider        Book delivery rider
```

### Rider / Delivery
```
POST /api/v1/delivery/toggle-online              Toggle online status
GET  /api/v1/delivery/available-jobs              List available jobs
POST /api/v1/delivery/pickup/{id}/complete        Complete pickup
POST /api/v1/delivery/delivery/{id}/complete      Complete delivery
GET  /api/v1/delivery/earnings                    View earnings
GET  /api/v1/delivery/history                     View job history
POST /api/v1/delivery/location                    Update GPS location
```

### Coupons & Wallet
```
GET  /api/v1/coupons/me             List available coupons
POST /api/v1/coupons/validate       Validate coupon code
GET  /api/v1/wallet                 Get wallet balance
```

### Content
```
GET  /api/v1/banners                List promo banners
GET  /api/v1/testimonials           List testimonials
```

### Admin (Protected - requires admin JWT)
```
GET  /api/v1/admin/dashboard                       Dashboard stats
GET  /api/v1/admin/users                           List all users
GET  /api/v1/admin/orders                          List all orders
GET  /api/v1/admin/stores                          List all stores
GET  /api/v1/admin/riders                          List all riders

POST /api/v1/admin/seed-admin                      Create admin user

GET  /api/v1/admin/services                        List services
POST /api/v1/admin/services                        Create service category
PUT  /api/v1/admin/services/{id}                   Update service category
DELETE /api/v1/admin/services/{id}                 Delete service category
POST /api/v1/admin/services/{id}/items             Add item to service
PUT  /api/v1/admin/services/{id}/items/{item_id}   Update item
DELETE /api/v1/admin/services/{id}/items/{item_id} Delete item

GET  /api/v1/admin/coupons                         List coupons
POST /api/v1/admin/coupons                         Create coupon
PUT  /api/v1/admin/coupons/{id}                    Update coupon
DELETE /api/v1/admin/coupons/{id}                  Delete coupon

GET  /api/v1/admin/banners                         List banners
POST /api/v1/admin/banners                         Create banner
DELETE /api/v1/admin/banners/{id}                  Delete banner

GET  /api/v1/admin/testimonials                    List testimonials
POST /api/v1/admin/testimonials                    Create testimonial
DELETE /api/v1/admin/testimonials/{id}             Delete testimonial

GET  /api/v1/admin/settings                        Get platform settings
PUT  /api/v1/admin/settings                        Update platform settings

POST /api/v1/admin/riders/create                   Quick-create rider
POST /api/v1/admin/stores/create                   Quick-create store
POST /api/v1/admin/riders/{id}/approve             Approve rider
POST /api/v1/admin/stores/{id}/approve             Approve store
POST /api/v1/admin/orders/{id}/assign-store        Assign store to order
POST /api/v1/admin/orders/{id}/assign-rider        Assign rider to order
POST /api/v1/admin/orders/{id}/override-status     Override order status
```

---

## RESTART COMMANDS

If any service goes down, use these to restart:

```bash
# Backend API
cd /Users/raunakpandey/Downloads/WashingBells/backend
source venv/bin/activate
nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/wb_backend.log 2>&1 &

# Admin Panel
cd /Users/raunakpandey/Downloads/WashingBells/admin
nohup npm run dev > /tmp/wb_admin.log 2>&1 &

# Customer Metro (port 8081)
cd /Users/raunakpandey/Downloads/WashingBells
nohup npx expo start --port 8081 --clear > /tmp/wb_customer.log 2>&1 &

# Store Metro (port 8082)
cd /Users/raunakpandey/Downloads/WashingBells/store
nohup npx expo start --port 8082 --clear > /tmp/wb_store.log 2>&1 &

# Rider Metro (port 8083)
cd /Users/raunakpandey/Downloads/WashingBells/rider
nohup npx expo start --port 8083 --clear > /tmp/wb_rider.log 2>&1 &
```

### Kill All Services
```bash
pkill -f "uvicorn main:app"
pkill -f "next-server"
pkill -f "expo start"
```

### Check Service Logs
```bash
tail -f /tmp/wb_backend.log     # Backend
tail -f /tmp/wb_admin.log       # Admin
tail -f /tmp/wb_customer.log    # Customer Metro
tail -f /tmp/wb_store.log       # Store Metro
tail -f /tmp/wb_rider.log       # Rider Metro
```

---

## TESTING CHECKLIST

- [ ] Admin login & dashboard access
- [ ] Create service categories & items
- [ ] Edit item prices inline
- [ ] Create promotional coupons
- [ ] Upload banners & testimonials
- [ ] Configure platform settings (fees, commission)
- [ ] Quick-create rider via admin
- [ ] Quick-create store via admin
- [ ] Customer signup with real OTP (+919729021012)
- [ ] Browse services & add to basket
- [ ] Apply coupon at checkout
- [ ] Place order with COD
- [ ] Store receives & accepts order
- [ ] Rider auto-assigned for pickup
- [ ] Rider completes pickup with photos
- [ ] Store receives with OTP verification
- [ ] Store processes & sets delivery time
- [ ] Store marks ready & books delivery rider
- [ ] Rider completes delivery with OTP
- [ ] Customer sees order delivered
- [ ] Customer rates order
- [ ] Check earnings in store/rider profiles
- [ ] Verify financials in admin panel
- [ ] Test dev bypass mode (DEBUG=True, OTP=123456)

---

**Ready to Test!**

All 5 services are running. Use +919729021012 for real OTP testing.
For Twilio setup docs, see docs/TWILIO_SETUP.md
For architecture overview, see docs/ARCHITECTURE.md
For dev guide, see DEV_GUIDE.md
Swagger API explorer at http://localhost:8000/docs
