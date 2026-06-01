import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@rinastoursandtravels.in'
const BRAND_NAME = "Rina's Tours and Travels"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rinastoursandtravels.in'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rinastoursandtravels.in'
const APP_LOGO_URL = 'https://hpobmsfwvrewpjqnmhsv.supabase.co/storage/v1/object/sign/internal/image-removebg-preview%20(1).png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjA1YjRkYi0wMDA4LTQyOWUtYTFmZi02NzBjZTE1OWJhOTkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbnRlcm5hbC9pbWFnZS1yZW1vdmViZy1wcmV2aWV3ICgxKS5wbmciLCJpYXQiOjE3Nzc3NTQ5NzksImV4cCI6MTkzNTQzNDk3OX0.FR2fYD_zRiEMwQcrMja4J1PCZI6o6EFZ-_-8i6T0dy8'
const SUPPORT_EMAIL = 'support@taxihollongi.com'
const SUPPORT_PHONE = '+91-9101764656 / +91-9181301029'
const OFFICE_LOCATION = 'Inside the Arrival Hall, beside the Exit Gate, Donyi Polo Airport, Hollongi, Itanagar'
const AIRPORT_PICKUP_POINT = 'Exit Gate, Donyi Polo Airport, Hollongi, Itanagar'

function inr(amount: number) {
  return `&#8377;${amount.toLocaleString('en-IN')}`
}

function shell(title: string, preheader: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td align="center" style="padding-bottom:16px;">
        <img src="${APP_LOGO_URL}" alt="${BRAND_NAME}" style="max-width:180px;width:100%;height:auto;display:block;margin:0 auto 8px;">
        <div style="font-size:13px;font-weight:700;color:#111827;">${BRAND_NAME}</div>
      </td></tr>

      <tr><td style="background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="height:5px;background:#f47d09;"></td></tr>
          <tr><td style="padding:32px 32px 36px;">
            ${body}
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 8px 8px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">&copy; 2026 ${BRAND_NAME} &middot; All rights reserved</p>
        <p style="margin:0;font-size:11px;color:#9ca3af;">${OFFICE_LOCATION} &middot; ${SUPPORT_PHONE}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:7px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${label}</td>
    <td style="padding:7px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;">${value}</td>
  </tr>`
}

function sectionTitle(text: string) {
  return `<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#111827;letter-spacing:.2px;text-transform:uppercase;">${text}</p>`
}

function infoNote(text: string, tone: 'success' | 'warning' | 'info' = 'info') {
  const palette =
    tone === 'success'
      ? { bg: '#ecfdf3', border: '#16a34a', text: '#166534' }
      : tone === 'warning'
      ? { bg: '#fff7ed', border: '#d97706', text: '#9a3412' }
      : { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' }

  return `<p style="margin:0 0 24px;padding:12px 16px;background:${palette.bg};border-left:4px solid ${palette.border};border-radius:4px;font-size:14px;color:${palette.text};font-weight:600;">${text}</p>`
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatTimeWithMeridiem(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/\b(am|pm)\b/i.test(raw)) return raw.replace(/\b(am|pm)\b/i, (match) => match.toUpperCase())

  const compactTime = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (compactTime) {
    const hours = Number(compactTime[1])
    const minutes = Number(compactTime[2])
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const suffix = hours >= 12 ? 'PM' : 'AM'
      const displayHour = hours % 12 || 12
      return `${String(displayHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`
    }
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed
      .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      .replace(/\b(am|pm)\b/i, (match) => match.toUpperCase())
  }

  return raw
}

async function send(to: string | string[], subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[EMAIL] RESEND_API_KEY is not set - email not sent')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const result = await resend.emails.send({
      from: `${BRAND_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    })

    if (result.error) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result }
  } catch (error: any) {
    return { success: false, error }
  }
}

export interface BookingConfirmationEmail {
  to: string
  bookingId: string
  userName: string
  bookingType: string
  destination?: string
  tourPackageName?: string
  pickupDate: string
  pickupTime?: string
  carType: string
  totalAmount: number
  amountPaid: number
  amountDue: number
  paymentMethod: string
}

export async function sendBookingConfirmation(data: BookingConfirmationEmail) {
  const isPaid = data.amountDue === 0
  const statusLabel = isPaid ? 'Fully paid. No balance due.' : `${inr(data.amountDue)} due on arrival.`
  const tripLabel = data.bookingType === 'tour'
    ? (data.tourPackageName || 'Tour Package')
    : (data.destination || 'Taxi Booking')

  const body = `
    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;">Booking Confirmed</p>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Hi ${data.userName}, your booking is confirmed and we are preparing your ride.</p>

    ${sectionTitle('Booking Details')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Booking ID', `<span style="font-family:monospace;">${data.bookingId}</span>`)}
      ${row('Service Type', data.bookingType === 'tour' ? 'Tour Package' : 'Taxi Booking')}
      ${row(data.bookingType === 'tour' ? 'Package' : 'Destination', tripLabel)}
      ${row('Pickup Location', AIRPORT_PICKUP_POINT)}
      ${row('Pickup Date', formatDate(data.pickupDate))}
      ${data.pickupTime ? row('Pickup Time', data.pickupTime) : ''}
      ${row('Vehicle', data.carType.charAt(0).toUpperCase() + data.carType.slice(1))}
    </table>

    ${sectionTitle('Payment Summary')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Total Fare', inr(data.totalAmount))}
      ${row('Paid Online', inr(data.amountPaid))}
      ${data.amountDue > 0 ? row('Due on Arrival', inr(data.amountDue)) : ''}
    </table>

    ${infoNote(statusLabel, isPaid ? 'success' : 'warning')}

    ${sectionTitle('Next Steps')}
    <ol style="margin:0 0 24px;padding-left:20px;color:#6b7280;font-size:14px;line-height:1.8;">
      <li>We will assign your vehicle and driver shortly</li>
      <li>You will receive driver details before pickup</li>
      <li>Please be ready 10 minutes before pickup</li>
      ${data.amountDue > 0 ? '<li>Pay remaining balance in cash at pickup</li>' : ''}
    </ol>

    <center>
      <a href="${APP_URL}/bookings" style="display:inline-block;background:#f47d09;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">View My Booking</a>
    </center>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">Questions? Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#6b7280;">${SUPPORT_EMAIL}</a> or ${SUPPORT_PHONE}</p>`

  return send(
    data.to,
    `Booking Confirmed - ${data.bookingId} | ${BRAND_NAME}`,
    shell(`Booking Confirmed - ${data.bookingId}`, `Your booking ${data.bookingId} is confirmed.`, body)
  )
}

export interface CashPaymentInvoiceEmail {
  to: string
  userName: string
  bookingId: string
  totalAmount: number
  amountOnlinePaid: number
  amountCashPaid: number
  cashCollectedBy: string
  paidAt: string
}

export async function sendCashPaymentInvoice(data: CashPaymentInvoiceEmail) {
  const totalCollected = data.amountOnlinePaid + data.amountCashPaid
  const isFullyPaid = totalCollected >= data.totalAmount

  const body = `
    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;">Payment Receipt</p>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Hi ${data.userName}, payment update for booking <strong>${data.bookingId}</strong> is below.</p>

    ${sectionTitle('Receipt Details')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Booking ID', `<span style="font-family:monospace;">${data.bookingId}</span>`)}
      ${row('Total Fare', inr(data.totalAmount))}
      ${data.amountOnlinePaid > 0 ? row('Online Payment', inr(data.amountOnlinePaid)) : ''}
      ${row('Cash Payment', inr(data.amountCashPaid))}
      ${row('Collected By', data.cashCollectedBy)}
      ${row('Collected On', formatDateTime(data.paidAt))}
    </table>

    ${infoNote(
      isFullyPaid ? `Payment complete - ${inr(totalCollected)} received in full.` : `Partial payment received. Balance due: ${inr(data.totalAmount - totalCollected)}`,
      isFullyPaid ? 'success' : 'warning'
    )}

    <center>
      <a href="${APP_URL}/bookings" style="display:inline-block;background:#f47d09;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">View My Booking</a>
    </center>`

  return send(
    data.to,
    `Payment Receipt - ${data.bookingId} | ${BRAND_NAME}`,
    shell(`Payment Receipt - ${data.bookingId}`, `Payment confirmed for booking ${data.bookingId}.`, body)
  )
}

export interface VehicleAssignmentEmail {
  to: string
  userName: string
  bookingId: string
  bookingType?: string
  destination?: string
  tourPackageName?: string
  pickupDate: string
  pickupTime?: string
  vehicleModel: string
  numberPlate: string
  driverName: string
  driverPhone: string
  isReassignment?: boolean
}

export async function sendVehicleAssignment(data: VehicleAssignmentEmail) {
  const title = data.isReassignment ? 'Vehicle Reassigned' : 'Driver Assigned'
  const subtitle = data.isReassignment
    ? `Hi ${data.userName}, your vehicle for booking <strong>${data.bookingId}</strong> has been updated.`
    : `Hi ${data.userName}, your driver and vehicle are now assigned for booking <strong>${data.bookingId}</strong>.`
  const isTourBooking = data.bookingType === 'tour'
  const serviceType = isTourBooking ? 'Tour Package' : 'Taxi Booking'
  const tripLabel = isTourBooking
    ? (data.tourPackageName || 'Tour Package')
    : (data.destination || 'Destination not available')
  const displayPickupTime = formatTimeWithMeridiem(data.pickupTime)

  const body = `
    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;">${title}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;">${subtitle}</p>

    ${sectionTitle('Driver and Vehicle Details')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Driver Name', data.driverName)}
      ${row('Driver Contact', `<a href="tel:${data.driverPhone}" style="color:#111827;">${data.driverPhone}</a>`)}
      ${row('Vehicle Model', data.vehicleModel)}
      ${row('Vehicle Number', data.numberPlate)}
    </table>

    ${sectionTitle('Pickup Details')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Booking ID', `<span style="font-family:monospace;">${data.bookingId}</span>`)}
      ${row('Service Type', serviceType)}
      ${row(isTourBooking ? 'Package' : 'Destination', tripLabel)}
      ${row('Pickup Location', AIRPORT_PICKUP_POINT)}
      ${row('Pickup Date', formatDate(data.pickupDate))}
      ${displayPickupTime ? row('Pickup Time', displayPickupTime) : ''}
    </table>

    ${infoNote("Please be ready 10 minutes before pickup and keep your phone reachable.")}

    <center>
      <a href="${APP_URL}/bookings" style="display:inline-block;background:#f47d09;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">View My Booking</a>
    </center>`

  const subject = data.isReassignment
    ? `Vehicle Reassigned - ${data.bookingId} | ${BRAND_NAME}`
    : `Driver Assigned - ${data.bookingId} | ${BRAND_NAME}`

  return send(data.to, subject, shell(subject, `Driver details for booking ${data.bookingId}.`, body))
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export async function sendAdminNotification(data: {
  bookingId: string
  userEmail: string
  userName: string
  totalAmount: number
  bookingType: string
  destination?: string
  pickupDate?: string
}) {
  const body = `
    <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827;">New Booking Received</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">A new booking has been confirmed and requires assignment.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Booking ID', `<span style="font-family:monospace;">${data.bookingId}</span>`)}
      ${row('Customer', `${data.userName} &lt;${data.userEmail}&gt;`)}
      ${row('Type', data.bookingType === 'tour' ? 'Tour Package' : 'Taxi Booking')}
      ${data.destination ? row(data.bookingType === 'tour' ? 'Package' : 'Destination', data.destination) : ''}
      ${data.pickupDate ? row('Pickup Date', formatDate(data.pickupDate)) : ''}
      ${row('Amount', inr(data.totalAmount))}
    </table>

    <center>
      <a href="${APP_URL}/admin" style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">Open Admin Panel</a>
    </center>`

  return send(ADMIN_EMAIL, `New Booking: ${data.bookingId} - Action Required`, shell(`New Booking: ${data.bookingId}`, `New booking from ${data.userName} for ${inr(data.totalAmount)}.`, body))
}

export interface DriverAssignmentEmail {
  to: string
  driverName: string
  bookingId: string
  bookingType?: string
  destination?: string
  tourPackageName?: string
  customerName: string
  customerPhone: string
  pickupDate: string
  pickupTime?: string
  vehicleModel: string
  numberPlate: string
  isReassignment?: boolean
}

export async function sendDriverAssignment(data: DriverAssignmentEmail) {
  const title = data.isReassignment ? 'Trip Reassigned to You' : 'New Trip Assigned'
  const isTourBooking = data.bookingType === 'tour'
  const tripLabel = isTourBooking
    ? (data.tourPackageName || 'Tour Package')
    : (data.destination || 'Taxi Booking')
  const displayPickupTime = formatTimeWithMeridiem(data.pickupTime)

  const body = `
    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;">${title}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Hi ${data.driverName}, please review your assigned trip details below.</p>

    ${sectionTitle('Customer Details')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Customer Name', data.customerName)}
      ${row('Customer Phone', `<a href="tel:${data.customerPhone}" style="color:#111827;">${data.customerPhone}</a>`)}
    </table>

    ${sectionTitle('Trip Details')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Booking ID', `<span style="font-family:monospace;">${data.bookingId}</span>`)}
      ${row(isTourBooking ? 'Package' : 'Destination', tripLabel)}
      ${row('Pickup Location', AIRPORT_PICKUP_POINT)}
      ${row('Pickup Date', formatDate(data.pickupDate))}
      ${displayPickupTime ? row('Pickup Time', displayPickupTime) : ''}
    </table>

    ${sectionTitle('Assigned Vehicle')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Vehicle Model', data.vehicleModel)}
      ${row('Vehicle Number', data.numberPlate)}
    </table>

    ${infoNote('Please be ready at least 15 minutes before pickup and keep customer contact reachable.')}`

  const subject = data.isReassignment
    ? `Trip Reassigned - ${data.bookingId} | ${BRAND_NAME}`
    : `New Trip Assigned - ${data.bookingId} | ${BRAND_NAME}`

  return send(data.to, subject, shell(subject, `Trip ${data.bookingId} assigned. Customer: ${data.customerName}.`, body))
}

export async function sendAdminDriverEmailAlert(data: {
  bookingId: string
  driverName: string
  driverEmail: string
  carModel: string
  numberPlate: string
  reason: 'invalid_format' | 'send_failed'
}) {
  const reasonText = data.reason === 'invalid_format'
    ? `The email address <strong>${data.driverEmail}</strong> is not in a valid format.`
    : `An attempt to send to <strong>${data.driverEmail}</strong> failed.`

  const body = `
    <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827;">Driver Email Issue</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Driver notification for booking <strong>${data.bookingId}</strong> could not be delivered.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Booking ID', `<span style="font-family:monospace;">${data.bookingId}</span>`)}
      ${row('Driver', data.driverName)}
      ${row('Vehicle', `${data.carModel} (${data.numberPlate})`)}
      ${row('Driver Email', `<span style="color:#dc2626;font-family:monospace;">${data.driverEmail || '(empty)'}</span>`)}
    </table>

    <p style="margin:0 0 24px;padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;font-size:14px;color:#dc2626;">
      ${reasonText} Please update the driver's email in the admin panel.
    </p>

    <center>
      <a href="${APP_URL}/admin" style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">Update Driver Email</a>
    </center>`

  return send(
    ADMIN_EMAIL,
    `Action Required: Driver Email Issue - ${data.driverName} (${data.bookingId})`,
    shell('Driver Email Issue', `Driver email for ${data.driverName} requires update.`, body)
  )
}
