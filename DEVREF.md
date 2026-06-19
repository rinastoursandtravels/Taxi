# Rina's Tours and Travels (RT&T) — Developer Reference

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm start            # Start production server
npm run lint         # Check for errors
```

---

## File Navigation

| Task | File |
|------|------|
| Home page | `app/page.tsx` |
| Taxi booking | `app/book-taxi/page.tsx` |
| Tours listing | `app/tours/page.tsx` |
| Payment | `app/payment/page.tsx` |
| Booking confirmed | `app/booking-confirmed/page.tsx` |
| My bookings | `app/bookings/page.tsx` |
| Admin dashboard | `app/admin/page.tsx` |
| Database functions | `lib/database.ts` |
| Razorpay integration | `lib/payment.ts` |
| Email notifications | `lib/notifications.ts` |
| Invoice (PDF) generation | `lib/invoice.ts` |
| Utility helpers | `lib/utils.ts` |
| Supabase client | `lib/supabase.ts` |
| Header component | `components/Header.tsx` |
| Footer component | `components/Footer.tsx` |
| Database schema | `database.sql` |
| Global styles | `app/globals.css` |
| Tailwind config | `tailwind.config.js` |

---

## Code Snippets

### Database

```typescript
import { getDestinations, createBooking, getBookingById } from '@/lib/database'

const { data, error } = await getDestinations()
const { data: booking } = await createBooking({ booking_id: 'BK123456', ... })
```

### Payment

```typescript
import { createRazorpayOrder, verifyRazorpayPayment } from '@/lib/payment'

const order = await createRazorpayOrder(amount, bookingId)
const isValid = verifyRazorpayPayment(orderId, paymentId, signature)
```

### Email

```typescript
import { sendBookingConfirmation } from '@/lib/notifications'

await sendBookingConfirmation({ to: 'user@example.com', bookingId: 'BK123456', ... })
```

### Invoice

```typescript
import { generateInvoicePDF, downloadInvoicePDF } from '@/lib/invoice'

const doc = generateInvoicePDF(invoiceData)
downloadInvoicePDF(doc, 'invoice.pdf')
```

### Utilities

```typescript
import { formatCurrency, formatDate, validateEmail, calculateAdvancePayment, generateBookingId } from '@/lib/utils'

formatCurrency(1500)            // ₹1500.00
formatDate('2024-04-21')        // 21 Apr 2024
calculateAdvancePayment(1000)   // 300 (30%)
generateBookingId()             // BK20240421ABC123
```

---

## Tailwind Classes

| Element | Class |
|---------|-------|
| Black background | `bg-primary-950` |
| Yellow background | `bg-secondary-500` |
| Primary button | `btn-primary` |
| Secondary button | `btn-secondary` |
| Card | `card` |
| Input field | `input-field` |

Colors configurable in `tailwind.config.js`:
```js
colors: {
  primary: { 950: '#1a1512' },   // Black
  secondary: { 500: '#ffda00' }, // Yellow
}
```

---

## API Endpoints

```
POST /api/payment/create-order     — Create a Razorpay order
  Body: { amount, bookingId, currency }
  Response: { orderId, amount, currency }

POST /api/payment/verify           — Verify signature → atomically record payment + confirm booking (fail-closed)
  Body: { orderId, paymentId, signature, bookingId, ... }
  Response: { success, bookingId, invoiceNumber }
  202    { pending:true } if Razorpay capture can't be confirmed yet (webhook/reconcile will heal)

POST /api/payment/webhook          — Razorpay webhook (payment.captured / order.paid): server-to-server safety net
  Header: x-razorpay-signature     — verified with RAZORPAY_WEBHOOK_SECRET; calls the same atomic RPC (idempotent)

POST /api/payment/create-payment   — Manual/admin payment record (delegates to the same atomic RPC)
POST /api/payment/confirm-cash     — Confirm cash payment (admin)
GET  /api/payment/get-payment      — Get payment details for a booking

GET  /api/admin/reconcile-payments — Cron: pull Razorpay captures, heal any unrecorded payment (Bearer CRON_SECRET)
POST /api/admin/reconcile-payments — Admin "Reconcile Now" button (Bearer admin JWT); ?days=N window
```

All three record paths (`verify`, `webhook`, `reconcile`) funnel through the single idempotent Postgres
function `record_online_payment()` (see `sql/payment_integrity.sql`), so a payment is recorded **and** the
booking confirmed together (atomic) and never duplicated.

---

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # NEVER expose in frontend
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...                  # NEVER expose in frontend
RAZORPAY_WEBHOOK_SECRET=...              # Webhook signing secret — must match the value set in Razorpay dashboard
JWT_SECRET=...                           # Admin auth token signing
CRON_SECRET=...                          # Authenticates Vercel cron calls (cleanup + reconcile)

# Optional
RESEND_API_KEY=re_...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get Supabase keys**: Dashboard → Settings → API  
**Get Razorpay keys**: Dashboard → Settings → API Keys (use `rzp_test_` for dev, `rzp_live_` for prod)

---

## Deployment — Vercel (Recommended)

1. Push code to GitHub
2. Import repo at vercel.com → New Project
3. Add all env vars under Settings → Environment Variables
4. Deploy — custom domain via Settings → Domains

DNS records for custom domain:
```
A      @    76.76.19.165
CNAME  www  cname.vercel-dns.com
```

Rollback: Deployments tab → select previous → Rollback

### Docker (Self-Hosted)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
cp .env.example .env.production
docker-compose up -d
```

Nginx reverse proxy:
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

SSL (self-hosted): `sudo certbot certonly --nginx -d yourdomain.com`

---

## Pre-Launch Checklist

### Security
- [ ] All API keys switched to production (Razorpay `rzp_live_`)
- [ ] `.env.local` is in `.gitignore` — never committed
- [ ] HTTPS enabled
- [ ] Admin authentication implemented
- [ ] Rate limiting on payment API

### Config
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Email service configured (Resend or SMTP)
- [ ] Database backups configured

### Testing
- [ ] Payment flow tested end-to-end with live keys
- [ ] Email notifications verified
- [ ] Invoice generation tested
- [ ] All pages tested on mobile
- [ ] Admin dashboard fully tested
- [ ] No console errors

### Legal / Compliance
- [ ] Privacy Policy updated
- [ ] Terms & Conditions updated
- [ ] PCI DSS compliance for payments

---

## Outstanding TODOs (Not Yet Implemented)

### Authentication
- Password reset flow
- 2FA for admin accounts
- Rate limiting on `/api/admin/login`

### Notifications
- Real SMS integration (currently console-logged)
- Real WhatsApp integration (currently console-logged)
- Push notifications

### Features
- Real-time driver tracking
- Driver mobile app
- Refund management UI
- Rating & review system
- Advanced analytics
- Multi-language support

### Infrastructure
- Error tracking (Sentry/Rollbar)
- Uptime monitoring
- ~~Audit logging~~ — done (`system_events` + payment-event logging)
- Penetration testing / security audit

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `destinations` | Booking destinations |
| `pricing_rules` | Per-route, per-car-type pricing |
| `hourly_rates` | Hourly/daily rental rates |
| `tour_packages` | Tour definitions |
| `vehicles` | Vehicle inventory |
| `drivers` | Driver records |
| `bookings` | Core booking records |
| `assignments` | Driver/vehicle → booking mapping |
| `payments` | One payment summary per booking (`booking_id` UNIQUE) |
| `payment_records` | Per-transaction ledger (online/cash) under a payment |
| `system_events` | Sanitized operational/audit log (admin Logs panel) |
| `app_settings` | Feature/runtime flags (e.g. reconcile window, cleanup) |

Check indexes: `SELECT * FROM pg_indexes WHERE tablename='bookings';`

---

## Debugging

1. Browser console: **F12**
2. Server logs: `npm run dev` terminal output
3. Supabase: project dashboard → Table Editor / Logs
4. Network: DevTools → Network tab
5. Check `.env.local` values are set and correct

Test Razorpay card: `4111 1111 1111 1111` — any future expiry, any CVV  
Test UPI: `success@razorpay`

---

## Admin Authentication

Login URL: `/admin-login`

Default credentials (change immediately after first login):
```
Email:    admin@taxihollongi.com
Password: Secure@Admin123
```

Architecture: bcryptjs password hashing → JWT (24h expiry) → localStorage

Required env var:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this
```

Generate a secret: `openssl rand -base64 32`

### Admin SQL Operations

```sql
-- Add new admin (hash password first: node scripts/generate-admin-hash.js "pass")
INSERT INTO public.admins (email, password_hash, full_name, role, is_active)
VALUES ('admin@taxihollongi.com', '$2b$10$...hash...', 'Admin Name', 'admin', true);

-- Change password
UPDATE public.admins SET password_hash = '$2b$10$...newhash...' WHERE email = 'admin@taxihollongi.com';

-- Disable account
UPDATE public.admins SET is_active = false WHERE email = 'admin@taxihollongi.com';

-- View login history
SELECT email, full_name, last_login, is_active FROM public.admins ORDER BY last_login DESC;
```

### Admin API Endpoints

```
POST /api/admin/login          — Authenticate admin, returns JWT token
POST /api/admin/logout         — Invalidate session
GET  /api/admin/verify-session — Check if token is valid
```

Clear token manually (browser console): `localStorage.removeItem('adminToken')`

Key files: `context/AdminContext.tsx`, `components/ProtectedAdminPage.tsx`, `scripts/generate-admin-hash.js`, `sql/admin_schema.sql`

---

## Car Availability System

The booking pages show car **models** (not specific cars). A specific car is assigned by admin after payment.

### API: `GET /api/cars/available-models`

Query params: `booking_date`, `start_time`, `end_time`

Response:
```json
{
  "models": [
    { "model_name": "Toyota Innova", "class": "Premium", "capacity": 6,
      "per_km_charge": 25, "per_hr_charge": 300, "available_count": 3 }
  ]
}
```

**Logic**: Groups `cars` table by `model_name` → for each model checks if any car is free (no overlapping row in `vehicle_assignments`) → returns unique models with available count.

Overlap condition: `booking_start < assignment_end AND booking_end > assignment_start`

**What users see**: model name, class, capacity, price, available count  
**What users don't see**: number plate, driver, specific car ID

After payment, admin assigns specific car via `/api/bookings/assign-vehicle`.

Hard delete behavior: deleting a car keeps historical `vehicle_assignments` rows by setting `vehicle_assignments.car_id` to `NULL` (`ON DELETE SET NULL`). Snapshot columns on `vehicle_assignments` preserve last-known model/plate/driver details for history views.

---

## Payment System

Two payment types — Partial (30% online + 70% cash at airport) and Full (100% online).

### `payments` table fields

| Field | Partial | Full |
|-------|---------|------|
| `payment_type` | 'partial' | 'full' |
| `amount_total` | Full booking amount | Full booking amount |
| `amount_online_paid` | 30% | 100% |
| `amount_cash_paid` | 0 initially | 0 |
| `payment_status` | 'partial' | 'paid' |

Cash collection: admin confirms via `POST /api/payment/confirm-cash` → updates `amount_cash_paid` and `cash_paid_at`.

Helper library: `lib/payment-db.ts` — `recordOnlinePaymentAtomic()` (the one write path), `getPaymentByBookingId()`, `createPaymentRecord()`, `getPaymentRecordsByPaymentId()`, `markCashPaymentCollected()`. Amount math lives in `lib/payment-utils.ts` (`calculatePaymentAmounts`). Reconcile logic: `lib/reconcile.ts`.

### Payment integrity & reliability

Designed so a captured payment can **never** be lost and a booking can **never** be confirmed without its payment row:

- **Atomic write path** — `verify`, `webhook`, and `reconcile` all call one idempotent Postgres function, `record_online_payment()` (`sql/payment_integrity.sql`). It records the `payments` row, the `payment_records` ledger row, and flips `bookings.booking_status='confirmed'` in a single transaction. Idempotent via `ON CONFLICT (booking_id)` and a partial unique index on `payment_records.txn_id`.
- **Fail-closed `verify`** — confirms the capture with Razorpay first; if the atomic write fails it does **not** confirm the booking and returns `202 {pending:true}` (money is safe; webhook/reconcile heal it). The customer is shown "finalizing", never "failed".
- **Webhook safety net** — `POST /api/payment/webhook` (`payment.captured` / `order.paid`) records the payment even if the customer's browser closes before `verify` runs. Resolves in seconds.
- **Reconcile (self-heal)** — daily Vercel cron + admin "Reconcile Now" button pull Razorpay captures and backfill any unrecorded payment (≤ ~24h worst case without a webhook). Logs `payment_reconciled_healed`.
- **Cleanup guard** — `cleanup-pending` runs reconcile *before* deleting stale `pending` bookings, so a paid-but-pending booking is healed → confirmed → never deleted.
- **Audit trail** — every outcome is logged to `system_events` (admin Logs): `online_payment_confirmed`, `payment_record_failed`, `payment_signature_invalid`, `webhook_payment_recorded`, `webhook_signature_invalid`, `payment_reconciled_healed`, `payment_amount_mismatch`.
- **Setup:** run `sql/payment_integrity.sql`; set `RAZORPAY_WEBHOOK_SECRET` (matching the Razorpay dashboard webhook) and `CRON_SECRET`. Webhook URL: `https://<domain>/api/payment/webhook`, events `payment.captured` + `order.paid`.
