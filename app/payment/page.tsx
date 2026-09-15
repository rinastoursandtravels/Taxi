'use client'

import { useSearchParams, useRouter as useNextRouter } from 'next/navigation'
import { useState, useEffect, useRef, Suspense } from 'react'
import Header from '@/components/Header'
import toast from 'react-hot-toast'
import gsap from 'gsap'
import { Shield, MapPin, Clock, Users, Car } from 'lucide-react'

declare global {
  interface Window {
    Razorpay: any
  }
}

function PaymentContent() {
  const searchParams = useSearchParams()
  const router = useNextRouter()
  const bookingType = searchParams.get('type') || 'taxi'

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [bookingData, setBookingData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [freeLoading, setFreeLoading] = useState(false)
  // Null until the switch has been read, so the option never flashes in and
  // then disappears. The server re-checks this on submit regardless.
  const [freeBookingEnabled, setFreeBookingEnabled] = useState<boolean | null>(null)
  // Hold window shown in the pre-submit copy, so the customer knows the
  // deadline before they even choose "pay later". The exact hold_expires_at
  // instant is only known once confirm-unpaid actually runs.
  const [freeHoldHours, setFreeHoldHours] = useState<number | null>(null)

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
    return () => { scroller.removeEventListener('wheel', onWheel) }
  }, [])

  useEffect(() => {
    const storageKey = bookingType === 'tour' ? 'tourBookingData' : 'bookingData'
    const raw = sessionStorage.getItem(storageKey)
    const data = raw ? JSON.parse(raw) : null
    if (data) setBookingData(data)

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [bookingType])

  useEffect(() => {
    let cancelled = false
    const enabledKey = bookingType === 'tour' ? 'free_booking_enabled_tour' : 'free_booking_enabled_taxi'
    const holdKey = bookingType === 'tour' ? 'free_booking_hold_hours_tour' : 'free_booking_hold_hours_taxi'
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/settings?key=${enabledKey}`, { cache: 'no-store' })
        const data = await res.json()
        const value = data?.settings?.[0]?.value
        // Absent row means the feature has not been switched off, matching the
        // server-side default in lib/free-booking.
        if (!cancelled) setFreeBookingEnabled(value !== 'false')
      } catch {
        if (!cancelled) setFreeBookingEnabled(false)
      }
      try {
        const res = await fetch(`/api/admin/settings?key=${holdKey}`, { cache: 'no-store' })
        const data = await res.json()
        const value = Number(data?.settings?.[0]?.value)
        if (!cancelled) setFreeHoldHours(Number.isFinite(value) && value > 0 ? value : null)
      } catch {
        if (!cancelled) setFreeHoldHours(null)
      }
    })()
    return () => { cancelled = true }
  }, [bookingType])

  // Full payment is the only online option. The 30% advance was removed; its
  // place in the flow is now taken by the free "Book Now, Pay Later" path.
  const handleRazorpayPayment = async (method: 'full' = 'full') => {
    if (!bookingData) { toast.error('Booking data not found'); return }
    setLoading(true)
    try {
      const paymentAmount = bookingData.totalPrice
      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentType: method, bookingId: bookingData.dbBookingId, currency: 'INR' }),
      })
      const orderData = await orderResponse.json()
      // Surface the server's own reason rather than the generic "try again" in
      // the catch below. A refused order here is usually terminal — the slot was
      // taken while the booking sat unpaid, the booking was cancelled, or it is
      // already paid — and retrying will never clear any of those.
      if (!orderResponse.ok || !orderData.orderId) {
        toast.error(orderData.error || 'Failed to create payment order. Please try again.')
        setLoading(false)
        return
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        // Use the amount the server actually created the order for (in paise),
        // so the checkout can never diverge from the authoritative order amount.
        amount: orderData.amount,
        currency: 'INR',
        name: "Rina's Tours and Travels",
        description: `${bookingType === 'tour' ? 'Tour Package' : 'Taxi'} Booking`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            const verifyResponse = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                bookingId: bookingData.dbBookingId,
                bookingType,
                paymentMethod: method,
                amount: paymentAmount,
                userEmail: bookingData.email,
                userName: bookingData.name,
                destination: bookingData.destination,
                tourPackageName: bookingData.tourName,
                pickupDate: bookingData.date,
                pickupTime: bookingData.startTime || bookingData.time,
                carType: bookingData.carType || bookingData.car,
              }),
            })
            const verifyData = await verifyResponse.json()
            if (verifyData.success) {
              toast.success('Payment successful! Your booking is confirmed.')
              setTimeout(() => { router.replace(`/booking-confirmed?bookingId=${bookingData.dbBookingId}`) }, 2000)
            } else if (verifyData.pending) {
              // Money WAS captured by Razorpay; the server is finalising (webhook
              // will confirm within seconds). Never tell the customer it failed.
              toast.success('Payment received! We are finalizing your booking — a confirmation will arrive shortly.')
              setTimeout(() => { router.replace(`/booking-confirmed?bookingId=${bookingData.dbBookingId}`) }, 2500)
            } else {
              toast.error('Payment verification failed. Please contact support.')
              setLoading(false)
            }
          } catch (error) {
            // The payment may still have been captured; the webhook is the safety net.
            console.error('Verification error:', error)
            toast('Payment received — finalizing your booking. Please check your email for confirmation.', { icon: 'ℹ️' })
            setTimeout(() => { router.replace(`/booking-confirmed?bookingId=${bookingData.dbBookingId}`) }, 2500)
          }
        },
        prefill: { name: bookingData.name, email: bookingData.email, contact: bookingData.phone },
        theme: { color: '#ffda00' },
        config: { display: { preferences: { show_default_blocks: true } } },
        modal: {
          ondismiss: () => {
            toast.error('Payment cancelled.')
            setLoading(false)
          },
          backdropclose: false,
          escape: false,
        },
      }
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (response: any) => {
        console.error('Razorpay payment failed:', response.error)
        toast.error(`Payment failed: ${response.error.description || 'Please try again.'}`)
        setLoading(false)
      })
      rzp.open()
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Failed to initiate payment. Please try again.')
      setLoading(false)
    }
  }

  const handleFreeBooking = async () => {
    if (!bookingData) { toast.error('Booking data not found'); return }
    setFreeLoading(true)
    try {
      const res = await fetch('/api/bookings/confirm-unpaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingData.dbBookingId }),
      })
      const data = await res.json()

      if (!data.success) {
        toast.error(data.error || 'Could not submit your booking request. Please try again.')
        setFreeLoading(false)
        return
      }

      toast.success('Booking request submitted.')
      // Carry the hold deadline through so booking-confirmed can show a real
      // countdown instead of a vague "we'll be in touch" — the customer's own
      // way to beat it is to pay online before it lapses.
      const holdParam = data.holdExpiresAt ? `&holdUntil=${encodeURIComponent(data.holdExpiresAt)}` : ''
      router.replace(`/booking-confirmed?bookingId=${bookingData.dbBookingId}&unpaid=1${holdParam}`)
    } catch (error) {
      console.error('Free booking error:', error)
      toast.error('Could not submit your booking request. Please try again.')
      setFreeLoading(false)
    }
  }

  if (!bookingData) {
    return (
      <div ref={scrollRef} className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-primary-950">
        <Header />
        <main className="flex items-center justify-center min-h-[80dvh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading payment details...</p>
          </div>
        </main>
      </div>
    )
  }

  // This booking already chose "pay later" — offering that option again would
  // be a dead-end loop (it's already held, already unpaid; clicking it again
  // does nothing new). The only real action left here is paying in full.
  const alreadyPayLater = bookingData.paymentMode === 'pay_later'

  return (
    <div ref={scrollRef} className="scrollbar-thin-modern h-[100dvh] overflow-y-auto overflow-x-hidden bg-primary-950">
      <Header />

      <main className="relative overflow-x-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.75) 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-60 -right-40 w-[440px] h-[440px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.05) 0%, transparent 70%)' }} />

        <div className="relative z-10 container mx-auto px-4 pt-20 pb-10">
          <div className="text-center mb-8">
            <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-2">Secure Checkout</p>
            <h1 className="font-black text-white text-2xl md:text-3xl">Complete Your Payment</h1>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4 md:gap-6">
            <div className="md:col-span-2 bg-primary-900/60 border border-primary-800 rounded-2xl backdrop-blur-sm p-5 md:p-7">
              <div className="bg-primary-950 border border-primary-800 rounded-xl p-4 mb-6">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2.5">Booking Summary</p>
                <div className="space-y-1.5 text-sm">
                  <p className="text-gray-300"><span className="text-gray-500">ID:</span> <span className="font-mono">{bookingData.bookingId}</span></p>
                  <p className="text-gray-300"><span className="text-gray-500">Name:</span> {bookingData.name}</p>
                  {bookingData.destination && <p className="text-gray-300"><span className="text-gray-500">Destination:</span> {bookingData.destination}</p>}
                  {bookingData.tourName && <p className="text-gray-300"><span className="text-gray-500">Tour:</span> {bookingData.tourName}</p>}
                  <p className="text-gray-300"><span className="text-gray-500">Date:</span> {bookingData.date} · {bookingData.startTime}</p>
                  <p className="text-gray-300"><span className="text-gray-500">Passengers:</span> {bookingData.passengers}</p>
                </div>
              </div>

              <div className="flex items-baseline justify-between mb-6 px-1">
                <span className="text-gray-400 text-sm font-semibold">Booking Amount</span>
                <span className="text-3xl font-black text-secondary-500">₹{bookingData.totalPrice.toFixed(2)}</span>
              </div>

              {alreadyPayLater && (
                <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                  This booking is already held as a request. Pay in full below to guarantee your vehicle before the hold runs out.
                </div>
              )}

              <div className="space-y-2.5 mb-5">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Pay in Full</p>
                <button
                  onClick={() => handleRazorpayPayment('full')}
                  disabled={loading}
                  className="w-full px-6 py-3.5 bg-secondary-500 text-primary-950 rounded-xl font-black hover:bg-secondary-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  💳 {loading ? 'Processing...' : `Pay ₹${bookingData.totalPrice.toFixed(2)} — Full Payment`}
                </button>
              </div>

              {freeBookingEnabled && !alreadyPayLater && (
                <>
                  <div className="flex items-center gap-4 my-5">
                    <div className="flex-1 border-t border-primary-800" />
                    <span className="text-gray-600 text-xs font-medium">or</span>
                    <div className="flex-1 border-t border-primary-800" />
                  </div>

                  <div className="bg-primary-950 border border-primary-800 rounded-xl p-4 mb-5">
                    <p className="text-gray-400 text-sm mb-3">
                      Submit this booking without paying now. We hold{' '}
                      <span className="text-white font-semibold">your selected date and time</span> on this
                      vehicle — other dates and times stay open to everyone else.{' '}
                      {freeHoldHours ? (
                        <>You then have <span className="text-white font-semibold">{freeHoldHours} hours</span> to pay (or until your trip starts, if that comes first)</>
                      ) : (
                        <>You then have a limited time to pay</>
                      )}
                      {' '}<span className="text-white font-black">₹{bookingData.totalPrice.toFixed(2)}</span> online
                      to lock it in, or in cash with our team. Miss that deadline and the slot reopens to other customers.
                    </p>
                    <button
                      onClick={handleFreeBooking}
                      disabled={loading || freeLoading}
                      className="w-full px-5 py-3 border border-primary-700 text-white rounded-xl font-semibold hover:border-secondary-500/50 hover:text-secondary-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                      📋 {freeLoading ? 'Submitting...' : 'Book Now, Pay Later'}
                    </button>
                    <p className="text-gray-600 text-[11px] mt-3 leading-relaxed">
                      This is a booking <span className="text-gray-500 font-semibold">request</span>, not a
                      confirmed reservation. If nobody else needs that vehicle for the same slot, our team
                      can still honour it after the deadline — but paying in time is the only guarantee.
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2.5 text-xs text-gray-500">
                <Shield size={13} className="text-green-500 flex-shrink-0" />
                <span>All payments are encrypted and secure. Your data is protected.</span>
              </div>
            </div>

            <div className="bg-primary-900/60 border border-primary-800 rounded-2xl backdrop-blur-sm p-5">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-4">Order Summary</p>

              <div className="space-y-3 text-sm mb-4">
                {bookingData.destination && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="text-secondary-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-gray-500 text-[10px]">Destination</p>
                      <p className="text-white font-semibold">{bookingData.destination}</p>
                    </div>
                  </div>
                )}
                {bookingData.tourName && (
                  <div className="flex items-start gap-2">
                    <Car size={13} className="text-secondary-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-gray-500 text-[10px]">Tour Package</p>
                      <p className="text-white font-semibold">{bookingData.tourName}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Users size={13} className="text-secondary-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-500 text-[10px]">Passengers</p>
                    <p className="text-white font-semibold">{bookingData.passengers}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock size={13} className="text-secondary-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-500 text-[10px]">Date & Time</p>
                    <p className="text-white font-semibold">{bookingData.date}</p>
                    <p className="text-gray-400 text-xs">{bookingData.startTime}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-primary-800 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>₹{bookingData.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Taxes & Fees</span>
                  <span>₹0</span>
                </div>
                <div className="flex justify-between font-black text-base border-t border-primary-800 pt-2">
                  <span className="text-gray-200">Total</span>
                  <span className="text-secondary-500">₹{bookingData.totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {freeBookingEnabled && !alreadyPayLater && (
                <div className="mt-4 bg-secondary-500/10 border border-secondary-500/20 rounded-xl p-3 text-xs text-gray-400">
                  Not ready to pay? Send this as a <span className="text-secondary-500 font-black">booking request</span> and settle in cash with our team.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Payment() {
  return <Suspense><PaymentContent /></Suspense>
}
