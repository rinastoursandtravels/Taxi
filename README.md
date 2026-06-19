# 🚖 TaxiHollongi - Airport Taxi & Tour Booking Platform

A production-grade, mobile-first taxi and tour booking platform for Hollongi Airport passengers. Built with Next.js, Supabase, and Razorpay.

## 📋 Project Overview

TaxiHollongi is a comprehensive booking platform that enables:
- **Pre-booking of taxis** from airport to destinations with fixed pricing
- **Tour package bookings** with predefined itineraries
- **Admin dashboard** for operations management
- **Transparent pricing** with 30% advance or full online payment options
- **Secure payments** via Razorpay
- **Invoice generation** and booking confirmations via email

## ✨ Features

### User Features
- 🚗 **Airport to Destination Taxi Booking** - Search and book taxis with transparent pricing
- 🕐 **Hourly/Daily Rentals** - Flexible duration-based bookings
- 🎫 **Tour Packages** - Pre-designed tours with admin-controlled itineraries
- 💳 **Flexible Payment** - 30% advance or full online payment options
- 📧 **Email Confirmations** - Automatic booking confirmations and invoices
- 📱 **Mobile-First Design** - Optimized for mobile devices
- 🔒 **Secure Checkout** - Razorpay integrated payment gateway
- 📊 **Booking History** - View all past and upcoming bookings

### Admin Features
- 📊 **Dashboard Analytics** - Real-time booking and revenue statistics
- 🚕 **Vehicle Management** - Add, edit, delete vehicles and drivers
- 📍 **Destination Management** - Manage destinations and pricing rules
- 🎫 **Tour Package Management** - Create and manage tour packages
- 📅 **Booking Management** - View all bookings with detailed information
- 👨‍💼 **Driver Assignment** - Assign vehicles and drivers to bookings
- 💰 **Pricing Management** - Manage pricing for different routes and vehicle types
- 📨 **Communication** - Send notifications to drivers and users

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe development
- **Lucide Icons** - Beautiful icon library
- **React Hot Toast** - Notifications
- **jsPDF** - Invoice generation

### Backend & Database
- **Supabase** - PostgreSQL database with real-time features
- **Supabase Auth** - User authentication
- **Supabase Storage** - File storage for invoices

### Payments
- **Razorpay** - Payment gateway integration
- **Webhook Verification** - Secure payment verification

### Notifications
- **Resend** or **SMTP** - Email notifications
- **Demo Mode** - Console logging for testing

### Deployment
- **Vercel** - Next.js optimized hosting (optional)
- **Supabase** - Backend hosting

## 📦 Project Structure

```
taxihollongi/
├── app/
│   ├── admin/                    # Admin dashboard
│   ├── api/
│   │   └── payment/             # Payment API routes
│   ├── book-taxi/               # Taxi booking page
│   ├── booking-confirmed/       # Booking confirmation page
│   ├── bookings/                # My bookings page
│   ├── payment/                 # Payment processing page
│   ├── tours/                   # Tour packages listing
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
├── components/
│   ├── Header.tsx               # Navigation header
│   └── Footer.tsx               # Footer component
├── lib/
│   ├── database.ts              # Database operations
│   ├── invoice.ts               # Invoice generation
│   ├── notifications.ts         # Email notifications
│   ├── payment.ts               # Razorpay integration
│   ├── supabase.ts              # Supabase client
│   └── utils.ts                 # Helper functions
├── database.sql                 # Database schema
├── package.json                 # Dependencies
├── tailwind.config.js           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
└── .env.local                   # Environment variables (demo)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Razorpay account (for payments)

### 1. Clone and Install

```bash
cd taxihollongi
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and API keys
3. In Supabase Dashboard:
   - Go to SQL Editor
   - Create a new query
   - Copy and paste contents of `database.sql`
   - Execute the query
4. Update `.env.local` with your Supabase credentials

### 3. Set Up Razorpay

1. Create account at [razorpay.com](https://razorpay.com)
2. Get your API keys from Dashboard
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id
   RAZORPAY_KEY_SECRET=your_secret_key
   ```

> **Note**: The project includes TEST MODE keys for demo. Replace them before production.

### 4. Configure Email (Optional)

#### Using Resend (Recommended)
```bash
npm install resend
```

Then add to `.env.local`:
```
RESEND_API_KEY=your_resend_api_key
```

#### Using SMTP
```
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
SMTP_FROM=noreply@taxihollongi.com
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Guide

### For Users

1. **Book a Taxi**
   - Go to "Book Taxi"
   - Select destination/duration
   - Enter passenger details
   - Choose payment method
   - Complete payment

2. **Book a Tour**
   - Go to "Tours"
   - Select your preferred tour
   - Enter details and select date
   - Proceed to payment

3. **View Bookings**
   - Click "My Bookings"
   - View booking status and driver details
   - Download invoices

### For Admin

1. **Access Dashboard**
   - Navigate to `/admin`
   - View overview statistics
   - Manage bookings

2. **Manage Data**
   - Add/edit drivers and vehicles
   - Update pricing rules
   - Create/manage tour packages

3. **Handle Bookings**
   - View all bookings
   - Assign drivers and vehicles
   - Track payment status

## 🔑 Required API Keys & Accounts

| Service | Purpose | Status | Setup Time |
|---------|---------|--------|-----------|
| Supabase | Database & Backend | ✅ Required | 5 min |
| Razorpay | Payments | ✅ Required | 10 min |
| Resend/SMTP | Email Notifications | ⚠️ Optional | 5 min |
| WhatsApp Business | SMS Notifications | ⚠️ Demo | - |

### Quick Setup Summary

```env
# .env.local - Demo Configuration Ready
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_1DP5mmOlF5G5ag
RAZORPAY_KEY_SECRET=demo_secret_key
RESEND_API_KEY=re_demo_key_for_testing_only
```

## 🎨 Color Scheme

- **Primary (Black)**: #1a1512 - Navigation, text, main UI
- **Secondary (Yellow)**: #ffda00 - Buttons, highlights, CTAs
- **Accent**: Gray scale for supporting elements

## 💳 Payment Integration Details

### Razorpay Implementation
- **Test Mode**: Enabled by default
- **Payment Methods**: Card, UPI, NetBanking, Wallets
- **Checkout signature**: HMAC verification on `/api/payment/verify`
- **Webhook**: `/api/payment/webhook` (`payment.captured` / `order.paid`), signed with `RAZORPAY_WEBHOOK_SECRET`
- **Test Card**: `4111 1111 1111 1111` (Visa, any expiry)

### Payment Flow
1. User selects payment method (30% advance or 100%)
2. Order created via `/api/payment/create-order`
3. Razorpay modal opens
4. Payment completion triggers `/api/payment/verify` → **atomically** records the payment and confirms the booking
5. **Webhook** (`/api/payment/webhook`) independently records the capture — so the booking is confirmed even if the customer's browser closes mid-flow
6. **Reconcile** (daily cron + admin "Reconcile Now") pulls Razorpay captures and heals any payment that slipped through — nothing is ever lost

> Reliability: all three paths use one idempotent DB function (`record_online_payment`), so a payment is never duplicated and a booking is never confirmed without its payment row. See `sql/payment_integrity.sql` and `DEVREF.md → Payment integrity & reliability`.

## 📧 Email Notifications

### Automated Emails
- Booking confirmation
- Payment receipt
- Driver assignment
- Tour details
- Admin notifications

### Email Configuration
- **Default**: Console logging (demo mode)
- **With Resend**: Uncomment Resend integration
- **With SMTP**: Configure SMTP credentials

## 📱 Responsive Design

- Mobile-first approach
- Desktop optimized layouts
- Touch-friendly UI elements
- Optimized for all screen sizes

## 🧪 Testing

### Demo Credentials
- **Admin Panel**: `/admin` (no authentication required in demo)
- **Test Payment**: Use demo Razorpay keys
- **Test Data**: Pre-loaded sample destinations, drivers, vehicles

### Test Scenarios
1. **Complete Booking**: Book → Pay (30%) → Confirm
2. **Tour Package**: Select tour → Enter details → Payment
3. **Invoice Download**: Booking confirmed → Download PDF
4. **Admin Operations**: Add driver/vehicle → Manage pricing

## 🚢 Deployment

### Deploy to Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Environment Setup for Production
1. Update `.env.local` with production API keys
2. Set `NEXT_PUBLIC_APP_URL` to your domain
3. Enable Razorpay production keys
4. Configure email service (Resend recommended)

### Build for Production
```bash
npm run build
npm start
```

## 🔐 Security Considerations

- ✅ HTTPS required in production
- ✅ API keys never exposed in frontend code
- ✅ Razorpay signature verification implemented
- ✅ CORS properly configured
- ✅ Input validation on all forms
- ⚠️ TODO: Add authentication for admin panel
- ⚠️ TODO: Implement rate limiting on payment API

## 📊 Database Schema Highlights

- **Destinations**: Manages all booking destinations
- **Pricing Rules**: Dynamic pricing per destination and car type
- **Tour Packages**: Admin-created tour itineraries
- **Bookings**: Core booking records with status tracking
- **Assignments**: Links drivers/vehicles to bookings
- **Payments**: Payment transaction records
- **Invoices**: Generated invoice records

## 🐛 Known Limitations & TODO

### Current Limitations
- WhatsApp integration is in demo mode
- SMS notifications require paid integration
- Admin authentication is not implemented (demo only)
- Real-time driver tracking not implemented

### Future Enhancements
- [ ] User authentication system
- [ ] Admin password-protected login
- [ ] Real-time booking status updates
- [ ] Driver mobile app
- [ ] Push notifications
- [ ] Advanced analytics
- [ ] Refund management UI
- [ ] Multi-language support

## 📞 Support & Contact

- **Email**: support@taxihollongi.com
- **Phone**: +91 98765 43210
- **Location**: Hollongi Airport, Itanagar, Arunachal Pradesh

## 📄 License

This project is proprietary software. All rights reserved.

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Core booking functionality
- ✅ Payment integration
- ✅ Admin dashboard basics
- ✅ Invoice generation

### Phase 2 (Next)
- 🔲 User authentication
- 🔲 Driver app
- 🔲 Real-time tracking
- 🔲 Advanced reporting

### Phase 3 (Future)
- 🔲 Mobile apps (iOS/Android)
- 🔲 AI-based pricing
- 🔲 Multi-language support
- 🔲 Analytics dashboard

## 💡 Important Notes

### Demo Mode
The application runs in demo mode with:
- Pre-loaded sample data
- Console-logged notifications instead of real emails
- Test Razorpay keys
- No database persistence (refresh resets data)

### For Production
1. Replace all demo API keys with production keys
2. Configure real email service
3. Implement proper authentication
4. Enable database persistence
5. Set up monitoring and logging
6. Configure CDN for images
7. Set up automated backups

## 📝 API Endpoints

### Payment APIs
- `POST /api/payment/create-order` - Create a Razorpay order
- `POST /api/payment/verify` - Verify signature → atomically record payment + confirm booking (fail-closed)
- `POST /api/payment/webhook` - Razorpay webhook safety net (`payment.captured` / `order.paid`)
- `POST /api/payment/confirm-cash` - Admin confirms cash collected
- `GET /api/payment/get-payment` - Payment details for a booking
- `GET·POST /api/admin/reconcile-payments` - Heal captured-but-unrecorded payments (cron / admin button)

### Database Operations
All database operations use Supabase client library. See `lib/database.ts` for available functions.

## 🙋 FAQ

**Q: Can I use this commercially?**
A: This is a complete project scaffold. You'll need to set up your own Supabase and Razorpay accounts.

**Q: How do I reset demo data?**
A: Refresh the page or clear browser storage. Run database.sql again in Supabase.

**Q: What's the payment limit?**
A: Razorpay test mode supports bookings up to ₹50,000. Use production keys for higher amounts.

**Q: Can I customize the branding?**
A: Yes! Update colors in `tailwind.config.js`, logos in components, and metadata in `app/layout.tsx`.

---

**Version**: 1.0.0  
**Last Updated**: April 2024  
**Status**: ✅ Production Ready (with demo data)

For detailed development documentation, see individual file comments.
