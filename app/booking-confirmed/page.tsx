'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import gsap from 'gsap'
import { generateInvoicePDF, downloadInvoicePDF, type InvoiceData } from '@/lib/invoice'
import { CheckCircle, Download, Home, ArrowRight, Mail, Phone } from 'lucide-react'

function formatTimeFromDateTime(value?: string | null): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function BookingConfirmedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const successRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const whatsNextRef = useRef<HTMLDivElement | null>(null)
  const actionsRef = useRef<HTMLDivElement | null>(null)
  const [booking, setBooking] = useState<any>(null)
  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    let targetTop = scroller.scrollTop
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      targetTop = Math.min(max, Math.max(0, targetTop + e.deltaY))
      gsap.to(scroller, { scrollTop: targetTop, duration: 0.75, ease: 'power3.out', overwrite: true })
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    if (!booking) return
    const tl = gsap.timeline({ delay: 0.1 })

    if (successRef.current) {
      const icon = successRef.current.querySelector('.confirm-icon')
      const ring = successRef.current.querySelector('.confirm-ring')
      const texts = successRef.current.querySelectorAll('.confirm-text')
      if (ring) tl.fromTo(ring, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2.6)' })
      if (icon) tl.fromTo(icon, { scale: 0, opacity: 0, rotate: -20 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.45, ease: 'back.out(2)' }, '-=0.32')
      if (texts.length) tl.fromTo(texts, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.09 }, '-=0.22')
    }

    if (gridRef.current) {
      tl.fromTo(
        Array.from(gridRef.current.children),
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.12 },
        '-=0.2'
      )
    }

    if (whatsNextRef.current) {
      tl.fromTo(whatsNextRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, '-=0.1')
    }

    if (actionsRef.current) {
      tl.fromTo(
        Array.from(actionsRef.current.children),
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.08 },
        '-=0.15'
      )
    }
  }, [booking])

  useEffect(() => {
    const taxiData = sessionStorage.getItem('bookingData')
    const tourData = sessionStorage.getItem('tourBookingData')
    const data = taxiData ? JSON.parse(taxiData) : tourData ? JSON.parse(tourData) : null
    sessionStorage.removeItem('bookingData')
    sessionStorage.removeItem('tourBookingData')
    if (data) {
      setBooking(data)
      fetchPaymentData(data.bookingId)
    }
  }, [])

  const fetchPaymentData = async (bookingUuid: string) => {
    try {
      const response = await fetch(`/api/payment/get-payment?bookingId=${bookingUuid}`)
      if (response.ok) setPayment(await response.json())
    } catch (error) {
      console.error('Error fetching payment data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAndDownloadInvoice = async () => {
    if (!booking || !payment) return

    const bookingDetails = payment?.booking_details
    const canonicalBookingType = bookingDetails?.booking_type || booking.bookingType
    const pickupDate = bookingDetails?.pickup_date || bookingDetails?.start_datetime || booking.date
    const pickupTime =
      bookingDetails?.pickup_time
      || formatTimeFromDateTime(bookingDetails?.start_datetime)
      || booking.startTime
      || booking.time
    const carType = bookingDetails?.car_model || booking.carType || booking.car || 'Standard'
    const destination = payment?.destination_name || booking.destination
    const tourPackageName = payment?.tour_name || booking.tourName

    const onlineRecord = (payment.payment_records ?? []).find((r: { txn_type: string; invoice_number?: string | null }) => r.txn_type === 'online')
    const invoiceNumber = onlineRecord?.invoice_number || `INV-${booking.bookingId}-${Date.now()}`
    const invoiceData: InvoiceData = {
      bookingId: bookingDetails?.booking_id || booking.bookingId,
      date: new Date().toLocaleDateString('en-IN'),
      userName: bookingDetails?.user_name || booking.name,
      userEmail: bookingDetails?.user_email || booking.email,
      userPhone: bookingDetails?.phone || booking.phone,
      bookingType: canonicalBookingType === 'tour' ? 'tour' : 'taxi',
      destination,
      tourPackageName,
      pickupLocation: 'Inside the Arrival Hall, beside the Exit Gate, Donyi Polo Airport, Hollongi, Itanagar',
      pickupDate,
      pickupTime,
      passengers: Number(bookingDetails?.passenger_count || booking.passengers || 1),
      carType,
      totalAmount: parseFloat(payment.amount_total),
      advanceAmount: parseFloat(payment.amount_online_paid),
      // Cash already collected counts as settled — see the same fix in the
      // bookings page invoice.
      remainingAmount: payment.payment_type === 'full'
        ? 0
        : Math.max(
            parseFloat(payment.amount_total) -
              parseFloat(payment.amount_online_paid) -
              parseFloat(payment.amount_cash_paid || '0'),
            0
          ),
      paymentStatus: payment.payment_status === 'paid' ? 'completed' : payment.payment_status,
      paymentMethod: payment.payment_type === 'full'
        ? 'Full Online Payment'
        : parseFloat(payment.amount_online_paid) > 0
          ? 'Partial Online + Cash'
          : 'Cash Payment',
      invoiceNumber,
    }
    const doc = await generateInvoicePDF(invoiceData)
    downloadInvoicePDF(doc, `Invoice-${booking.bookingId}.pdf`)
  }

  if (!booking) {
    return (
      <div ref={scrollRef} className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-primary-950">
        <Header />
        <main className="flex items-center justify-center min-h-[80dvh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading booking confirmation...</p>
          </div>
        </main>
      </div>
    )
  }

  // A free booking arrives here with the flag set by the payment page, and is
  // confirmed by the payments row once it loads. Nothing was paid and — per the
  // agreed messaging rules — no email was sent, so this page must not claim
  // either.
  const isUnpaid = searchParams.get('unpaid') === '1' || payment?.payment_status === 'unpaid'
  const totalAmount = payment ? parseFloat(payment.amount_total) : booking.totalPrice
  const onlinePaid = isUnpaid ? 0 : (payment ? parseFloat(payment.amount_online_paid) : 0)
  const cashPaid = isUnpaid ? 0 : (payment ? parseFloat(payment.amount_cash_paid || '0') : 0)

  // The payment record fetch is still in flight or failed — this is NOT the
  // free-booking case (which knows its own state without needing `payment` at
  // all). Treating a still-null `payment` as "nothing paid" here would show a
  // customer who just paid successfully a false "advance paid, balance due"
  // message while their real payment simply hasn't loaded back yet.
  const paymentUnresolved = !isUnpaid && !payment

  // Fully settled by ANY combination of online + cash — not just
  // payment_type literally being 'full'. That literal check used to miss a
  // free ("cash") booking that was fully paid in cash, and a legacy 30%
  // booking whose remaining balance was later topped up in cash: both are
  // completely paid, but neither has payment_type === 'full'.
  const isFullyPaid = !isUnpaid && !!payment && onlinePaid + cashPaid >= totalAmount - 0.01
  const remaining = paymentUnresolved ? 0 : Math.max(0, totalAmount - onlinePaid - cashPaid)

  // How much longer this free booking's vehicle hold lasts. Passed through
  // from the payment page's confirm-unpaid response — this is the one place
  // that instant is known before the bookings list is fetched from the DB.
  // hold_expires_at is a TIMESTAMPTZ (a real instant), so new Date() is
  // correct here, never the IST wall-clock helpers used for trip times.
  const holdUntilParam = searchParams.get('holdUntil')
  const holdCountdown = (() => {
    if (!holdUntilParam) return null
    const expiresMs = new Date(holdUntilParam).getTime()
    if (Number.isNaN(expiresMs)) return null
    const diff = expiresMs - Date.now()
    if (diff <= 0) return { label: 'Deadline passed', expired: true }
    const totalMinutes = Math.floor(diff / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    return { label, expired: false }
  })()

  // Re-uses the exact sessionStorage payload this page was itself loaded
  // from — it already has everything /payment needs (dbBookingId, totalPrice,
  // contact details) — so paying now needs no extra lookup. This button only
  // ever renders on the isUnpaid branch, so payment_mode is known to already
  // be 'pay_later' — stamping it explicitly is what stops /payment from
  // re-offering "Book Now, Pay Later" on a booking that already chose it.
  const handlePayNow = () => {
    const storageKey = booking.bookingType === 'tour' ? 'tourBookingData' : 'bookingData'
    sessionStorage.setItem(storageKey, JSON.stringify({ ...booking, paymentMode: 'pay_later' }))
    router.push(`/payment?bookingId=${booking.bookingId}&type=${booking.bookingType === 'tour' ? 'tour' : 'taxi'}`)
  }

  return (
    <div ref={scrollRef} className="scrollbar-thin-modern h-[100dvh] overflow-y-auto overflow-x-hidden bg-primary-950">
      <Header />

      <main className="relative overflow-x-hidden">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.75) 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        />
        {/* Glow blobs */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-40 -right-40 w-[440px] h-[440px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 70%)' }} />

        <div className="relative z-10 container mx-auto px-4 pt-20 pb-10">

          {/* Success header */}
          <div ref={successRef} className="text-center mb-8">
            <div className="flex justify-center mb-5">
              {/* Outer pulsing ring */}
              <div className="relative flex items-center justify-center">
                <div
                  className="confirm-ring absolute w-24 h-24 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)',
                    border: '1px solid rgba(74,222,128,0.18)',
                  }}
                />
                <div
                  className="confirm-ring w-[72px] h-[72px] rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(74,222,128,0.1)',
                    border: '1px solid rgba(74,222,128,0.28)',
                    boxShadow: '0 0 32px rgba(74,222,128,0.15)',
                  }}
                >
                  <CheckCircle
                    size={34}
                    className="confirm-icon text-green-400"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.5))' }}
                  />
                </div>
              </div>
            </div>
            <p className="confirm-text text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-2">
              {isUnpaid ? 'Request Received' : 'Booking Confirmed'}
            </p>
            <h1 className="confirm-text font-black text-white text-2xl md:text-3xl mb-2">
              {isUnpaid ? 'We’ve got your request' : 'You’re all set!'}
            </h1>
            <p className="confirm-text text-gray-400 text-sm">
              {isUnpaid ? (
                <>
                  Your {booking.bookingType === 'tour' ? 'tour package' : 'taxi'} request has been recorded and is{' '}
                  <span className="text-secondary-500">not yet confirmed</span>. Your date and time are held — pay
                  before the deadline below to lock them in, online now or in cash with our team.
                </>
              ) : (
                <>
                  Your {booking.bookingType === 'tour' ? 'tour package' : 'taxi'} booking is confirmed. Confirmation sent to{' '}
                  <span className="text-secondary-500">{booking.email}</span>
                </>
              )}
            </p>
          </div>

          {/* Main grid */}
          <div ref={gridRef} className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4 md:gap-6 mb-5">

            {/* Booking Details */}
            <div className="bg-primary-900/60 border border-primary-800 rounded-2xl backdrop-blur-sm p-5">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-4">Booking Details</p>
              <div className="space-y-0 divide-y divide-primary-800">
                <div className="py-2 flex justify-between text-sm">
                  <span className="text-gray-500">Booking ID</span>
                  <span className="text-white font-mono text-xs">{booking.bookingId}</span>
                </div>
                <div className="py-2 flex justify-between text-sm">
                  <span className="text-gray-500">Name</span>
                  <span className="text-white font-semibold">{booking.name}</span>
                </div>
                <div className="py-2 flex justify-between text-sm">
                  <span className="text-gray-500">Phone</span>
                  <span className="text-white font-semibold">{booking.phone}</span>
                </div>
                {booking.destination && (
                  <div className="py-2 flex justify-between text-sm">
                    <span className="text-gray-500">Destination</span>
                    <span className="text-white font-semibold">{booking.destination}</span>
                  </div>
                )}
                {booking.tourName && (
                  <div className="py-2 flex justify-between text-sm">
                    <span className="text-gray-500">Tour Package</span>
                    <span className="text-white font-semibold text-right max-w-[55%]">{booking.tourName}</span>
                  </div>
                )}
                <div className="py-2 flex justify-between text-sm">
                  <span className="text-gray-500">Passengers</span>
                  <span className="text-white font-semibold">{booking.passengers}</span>
                </div>
                <div className="py-2 flex justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="text-white font-semibold">{booking.date}</span>
                </div>
                {booking.time && (
                  <div className="py-2 flex justify-between text-sm">
                    <span className="text-gray-500">Pickup Time</span>
                    <span className="text-white font-semibold">{booking.time}</span>
                  </div>
                )}
                {booking.carType && (
                  <div className="py-2 flex justify-between text-sm">
                    <span className="text-gray-500">Vehicle</span>
                    <span className="text-white font-semibold capitalize">{booking.carType}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-primary-900/60 border border-primary-800 rounded-2xl backdrop-blur-sm p-5 flex flex-col">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-4">Payment Summary</p>

              <div className="space-y-0 divide-y divide-primary-800 mb-4">
                <div className="py-2.5 flex justify-between text-sm">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="text-white font-semibold">₹{totalAmount.toFixed(2)}</span>
                </div>
                {/* Nothing below this line is shown while paymentUnresolved —
                    we genuinely don't know these numbers yet, and a wrong
                    guess is worse than a brief gap. */}
                {!isUnpaid && !paymentUnresolved && (
                  <div className="py-2.5 flex justify-between text-sm">
                    <span className="text-gray-500">Paid Online</span>
                    <span className="text-green-400 font-black">₹{onlinePaid.toFixed(2)}</span>
                  </div>
                )}
                {!isUnpaid && !paymentUnresolved && cashPaid > 0 && (
                  <div className="py-2.5 flex justify-between text-sm">
                    <span className="text-gray-500">Paid in Cash</span>
                    <span className="text-green-400 font-black">₹{cashPaid.toFixed(2)}</span>
                  </div>
                )}
                {!isFullyPaid && !paymentUnresolved && remaining > 0 && (
                  <div className="py-2.5 flex justify-between text-sm">
                    <span className="text-gray-500">{isUnpaid ? 'Amount Due' : 'Balance Due'}</span>
                    <span className="text-secondary-500 font-semibold">₹{remaining.toFixed(2)}</span>
                  </div>
                )}
                {isUnpaid && holdCountdown && (
                  <div className="py-2.5 flex justify-between text-sm">
                    <span className="text-gray-500">Pay Within</span>
                    <span className={`font-semibold ${holdCountdown.expired ? 'text-red-400' : 'text-amber-400'}`}>
                      {holdCountdown.expired ? holdCountdown.label : `${holdCountdown.label} left`}
                    </span>
                  </div>
                )}
              </div>

              <div className={`rounded-xl p-3 text-xs mb-4 ${isFullyPaid ? 'bg-green-500/10 border border-green-500/25 text-green-400' : 'bg-secondary-500/10 border border-secondary-500/25 text-gray-400'}`}>
                {isUnpaid
                  ? holdCountdown && !holdCountdown.expired
                    ? 'No payment made yet. Your slot is held until the deadline above — pay online now, or in cash with our team, to lock it in.'
                    : 'No payment made yet. The deadline has passed, so this slot has been reopened to other customers — pay now to reclaim it if it is still free, or contact our team to check availability.'
                  : paymentUnresolved
                    ? 'Confirming your payment — this can take a few seconds. If it doesn’t update, refresh this page or check your Bookings tab.'
                    : isFullyPaid
                      ? '✅ Full payment completed. No additional payment required.'
                      : 'Part of the total has been settled. The remaining balance is to be paid in cash to our team.'}
              </div>

              {/* Nothing has been paid, so there is no invoice to issue yet —
                  paying online here is the fastest way to lock the booking in. */}
              {isUnpaid ? (
                <button
                  onClick={handlePayNow}
                  className="mt-auto w-full flex items-center justify-center gap-2 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-colors text-sm"
                >
                  Pay Now to Guarantee
                </button>
              ) : (
                <button
                  onClick={generateAndDownloadInvoice}
                  disabled={!payment}
                  className="mt-auto w-full flex items-center justify-center gap-2 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-colors disabled:opacity-40 text-sm"
                >
                  <Download size={15} />
                  {paymentUnresolved ? 'Confirming Payment...' : 'Download Invoice'}
                </button>
              )}
            </div>
          </div>

          {/* What's Next */}
          <div ref={whatsNextRef} className="max-w-4xl mx-auto bg-primary-900/60 border border-primary-800 rounded-2xl backdrop-blur-sm p-5 mb-5">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-4">What&apos;s Next</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(isUnpaid
                ? [
                    { n: '1', title: 'Pay to Lock It In', desc: 'Pay online here any time before your deadline — or in cash if your trip is sooner' },
                    { n: '2', title: 'Track Your Status', desc: 'Visit your Bookings tab anytime to see your payment deadline and pay when you’re ready' },
                    { n: '3', title: 'Driver Assignment', desc: 'Driver and vehicle details are shared once payment is received' },
                    { n: '4', title: 'Arrive Early', desc: 'Please arrive 15 minutes before your scheduled pickup time' },
                  ]
                : [
                    { n: '1', title: 'Confirmation Sent', desc: 'Check your email for booking details and invoice' },
                    { n: '2', title: 'Driver Assignment', desc: 'Within 2 hours you\'ll receive driver and vehicle details' },
                    { n: '3', title: 'Arrive Early', desc: 'Please arrive 15 minutes before your scheduled pickup time' },
                    { n: '4', title: 'Complete Payment', desc: 'If a balance remains, pay it in cash to our team to get your driver assigned' },
                  ]
              ).map(({ n, title, desc }) => (
                <div key={n} className="flex flex-col gap-2">
                  <div className="w-7 h-7 rounded-full bg-secondary-500 text-primary-950 flex items-center justify-center font-black text-xs flex-shrink-0">
                    {n}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-gray-500 text-xs leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div ref={actionsRef} className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 mb-5">
            <Link
              href="/bookings"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-colors text-sm"
            >
              View My Bookings
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-primary-700 text-gray-300 font-semibold rounded-xl hover:border-primary-600 hover:text-white transition-colors text-sm"
            >
              <Home size={15} />
              Back to Home
            </Link>
          </div>

          {/* Support */}
          <div className="max-w-4xl mx-auto bg-primary-900/40 border border-primary-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-white font-semibold text-sm mb-1">Need Help?</p>
              <p className="text-gray-500 text-xs">Contact our support team for any questions or modifications.</p>
            </div>
            <div className="flex flex-wrap gap-2.5 text-xs">
              <a href="mailto:support@rinastoursandtravels.in"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-primary-700 text-gray-300 rounded-lg hover:border-secondary-500/40 hover:text-secondary-500 transition-colors">
                <Mail size={12} />
                support@rinastoursandtravels.in
              </a>
              <a href="tel:+919101764656"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-primary-700 text-gray-300 rounded-lg hover:border-secondary-500/40 hover:text-secondary-500 transition-colors">
                <Phone size={12} />
                +91 91017 64656
              </a>
              <a href="tel:+919181301029"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-primary-700 text-gray-300 rounded-lg hover:border-secondary-500/40 hover:text-secondary-500 transition-colors">
                <Phone size={12} />
                +91 91813 01029
              </a>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

export default function BookingConfirmed() {
  return <Suspense><BookingConfirmedContent /></Suspense>
}
