/**
 * Self-test the Razorpay webhook from the dev side (no dashboard needed).
 *
 * It builds a `payment.captured` payload, signs it with your webhook secret
 * exactly like Razorpay does, and POSTs it to your /api/payment/webhook.
 *
 * Usage (Git Bash or PowerShell):
 *   node scripts/test-webhook.mjs <WEBHOOK_SECRET> [bookingPkId] [--bad]
 *
 * Examples:
 *   # Safe reachability + signature test (fake booking → no DB write expected):
 *   node scripts/test-webhook.mjs 0ebf...f090a60
 *
 *   # Negative test (wrong signature → should be rejected with 400):
 *   node scripts/test-webhook.mjs 0ebf...f090a60 --bad
 *
 *   # Full real test (records to DB): pass a REAL bookings.id (PK):
 *   node scripts/test-webhook.mjs 0ebf...f090a60 88effd1f-a0d5-4541-b7d0-e3367f4f186d
 */
import crypto from 'node:crypto'

const args = process.argv.slice(2)
const bad = args.includes('--bad')
const positional = args.filter((a) => !a.startsWith('--'))

const SECRET = positional[0] || process.env.RAZORPAY_WEBHOOK_SECRET
const BOOKING = positional[1] || '' // empty by default → safe "unresolved" path, no DB write
const URL = process.env.WEBHOOK_URL || 'https://www.rinastoursandtravels.in/api/payment/webhook'

if (!SECRET) {
  console.error('❌ Provide the webhook secret as the first argument (or set RAZORPAY_WEBHOOK_SECRET).')
  process.exit(1)
}

const stamp = Date.now()
const payload = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: `pay_TEST${stamp}`,
        order_id: `order_TEST${stamp}`,
        amount: 100, // paise = ₹1
        status: 'captured',
        notes: BOOKING ? { booking_id: BOOKING } : {},
      },
    },
  },
}

const raw = JSON.stringify(payload)
let signature = crypto.createHmac('sha256', SECRET).update(raw).digest('hex')
if (bad) signature = signature.replace(/.$/, (c) => (c === '0' ? '1' : '0')) // corrupt last char

console.log(`→ POST ${URL}`)
console.log(`  booking_id (PK): ${BOOKING || '(none — expecting 200 unresolved)'}`)
console.log(`  signature: ${bad ? 'INTENTIONALLY WRONG' : 'valid'}`)

const res = await fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
  body: raw,
})

console.log(`\n← HTTP ${res.status}`)
console.log(await res.text())
