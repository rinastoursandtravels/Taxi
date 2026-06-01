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

  const handleRazorpayPayment = async (method: 'partial' | 'full') => {
    if (!bookingData) { toast.error('Booking data not found'); return }
    setLoading(true)
    try {
      const paymentAmount = method === 'full' ? bookingData.totalPrice : bookingData.advancePayment
      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: paymentAmount, bookingId: bookingData.dbBookingId, currency: 'INR' }),
      })
      const orderData = await orderResponse.json()
      if (!orderData.orderId) throw new Error('Failed to create payment order')

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: Math.round(paymentAmount * 100),
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
            } else {
              toast.error('Payment verification failed. Please contact support.')
              setLoading(false)
            }
          } catch (error) {
            console.error('Verification error:', error)
            toast.error('Error verifying payment. Please contact support.')
            setLoading(false)
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

  const advanceAmount = bookingData.advancePayment
  const remainingAmount = bookingData.totalPrice - advanceAmount

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

              <div className="flex items-center gap-4 my-5">
                <div className="flex-1 border-t border-primary-800" />
                <span className="text-gray-600 text-xs font-medium">or prebook</span>
                <div className="flex-1 border-t border-primary-800" />
              </div>

              <div className="bg-primary-950 border border-primary-800 rounded-xl p-4 mb-5">
                <p className="text-gray-400 text-sm mb-3">
                  Pay <span className="text-white font-black">₹{advanceAmount.toFixed(2)}</span> (30% advance) now and the remaining{' '}
                  <span className="text-white font-black">₹{remainingAmount.toFixed(2)}</span> in cash at the airport office on arrival.
                </p>
                <button
                  onClick={() => handleRazorpayPayment('partial')}
                  disabled={loading}
                  className="w-full px-5 py-3 border border-primary-700 text-white rounded-xl font-semibold hover:border-secondary-500/50 hover:text-secondary-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  💳 {loading ? 'Processing...' : `Pay ₹${advanceAmount.toFixed(2)} to Prebook`}
                </button>
              </div>

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

              <div className="mt-4 bg-secondary-500/10 border border-secondary-500/20 rounded-xl p-3 text-xs text-gray-400">
                Or prebook for just <span className="text-secondary-500 font-black">₹{advanceAmount.toFixed(2)}</span> — pay rest in cash at the airport.
              </div>
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
