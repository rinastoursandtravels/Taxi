'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import toast from 'react-hot-toast'
import gsap from 'gsap'
import { generateBookingId } from '@/lib/utils'
import { validateFullName, validatePhoneNumber, validateEmail } from '@/lib/validation'
import { useAuth } from '@/context/AuthContext'
import { fetchTourById } from '@/lib/db'
import type { TourPackage } from '@/lib/db'
import { Users, CheckCircle, ArrowLeft, Clock, Car, ArrowRight } from 'lucide-react'
import PhoneInput from '@/components/PhoneInput'
import AuthGate from '@/components/AuthGate'

const STEPS = ['Passengers', 'Date', 'Contact', 'Confirm'] as const
type Step = 0 | 1 | 2 | 3

function toNum(val: unknown): number {
  const n = parseFloat(String(val ?? 0))
  return isNaN(n) ? 0 : n
}

function extractTime(arrival_time: string): string {
  const match = arrival_time.match(/[T\s]?(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : '00:00'
}

function formatDisplayTime(arrival_time: string | null): string {
  if (!arrival_time) return 'To be announced'
  const match = arrival_time.match(/[T\s]?(\d{2}):(\d{2})/)
  if (!match) return 'To be announced'
  const h = parseInt(match[1])
  const m = match[2]
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${period}`
}

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

export default function BookTour() {
  const params = useParams()
  const router = useRouter()
  const tourId = params.id as string
  const { user, isLoading } = useAuth()

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const [tour, setTour] = useState<TourPackage | null>(null)
  const [loadingTour, setLoadingTour] = useState(true)
  const [step, setStep] = useState<Step>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [passengers, setPassengers] = useState(1)
  const [date, setDate] = useState('')
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null)

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

  // ── Restore form state after login redirect ──────────────────────────────
  useEffect(() => {
    if (isLoading) return
    const saved = sessionStorage.getItem('tourBookingResume')
    if (!saved) return
    // Resume applies only after a Google OAuth round-trip. If the user isn't
    // signed in (OAuth abandoned), discard the snapshot.
    if (!user) { sessionStorage.removeItem('tourBookingResume'); return }
    try {
      const s = JSON.parse(saved)
      if (s.tourId !== tourId) { sessionStorage.removeItem('tourBookingResume'); return }
      sessionStorage.removeItem('tourBookingResume')
      if (s.passengers) setPassengers(s.passengers)
      if (s.date) setDate(s.date)
      setStep(2 as Step)
    } catch {
      sessionStorage.removeItem('tourBookingResume')
    }
  }, [isLoading, tourId, user])

  // ── Advance past the inline auth gate once the user is signed in ──────────
  // Email/password auth never navigates, so this fires in-place. Google OAuth
  // returns via a full reload and is handled by the resume effect above.
  useEffect(() => {
    if (!user || !showAuthGate) return
    setShowAuthGate(false)
    setStep(2 as Step)
  }, [user, showAuthGate])

  // Persist booking state before a Google OAuth redirect — OAuth needs a
  // full-page redirect, and this page resumes from it on return.
  const persistForOAuth = () => {
    sessionStorage.setItem('tourBookingResume', JSON.stringify({ tourId, passengers, date }))
    sessionStorage.setItem('postAuthRedirect', `/tours/${tourId}/book`)
  }

  // ── Auto-populate contact fields from user account ───────────────────────
  useEffect(() => {
    if (user?.email) setEmail(user.email)
    if ((user as any)?.user_metadata?.full_name) setName((user as any).user_metadata.full_name)
  }, [user])

  useEffect(() => {
    if (!tourId) return
    const load = async () => {
      setLoadingTour(true)
      try {
        const data = await fetchTourById(tourId)
        if (data) {
          setTour(data)
        } else {
          toast.error('Tour not found')
          router.push('/tours')
        }
      } catch {
        toast.error('Failed to load tour details')
        router.push('/tours')
      } finally {
        setLoadingTour(false)
      }
    }
    load()
  }, [tourId, router])

  // Tour prices are FLAT per vehicle, not per person — the package books the
  // whole car, which is why tour_packages carries car_model and max_passengers.
  // Passenger count is still chosen by the customer (and capped at the vehicle
  // capacity) but does not affect the price. This matches what the server has
  // always charged: /api/bookings/create derives amount_total from
  // tour_packages.price alone and ignores any client-supplied amount.
  const totalPrice = tour ? toNum(tour.price) : 0

  const checkAvailability = async (selectedDate: string) => {
    if (!tour?.car_model || !selectedDate) { setCapacityWarning(null); return }
    try {
      const res = await fetch(`/api/tours/${tourId}/availability?booking_date=${selectedDate}`)
      const data = await res.json()
      if (data.success && data.car_model && !data.available) {
        setCapacityWarning(
          data.warning || `The preferred ${data.car_model} vehicle may not be available for your selected timeslot. You can still book the tour, and another suitable vehicle may be assigned.`
        )
      } else {
        setCapacityWarning(null)
      }
    } catch {
      setCapacityWarning(null)
    }
  }

  const canAdvanceStep = (): boolean => {
    if (step === 0) return passengers >= 1 && (tour ? passengers <= (tour.max_passengers ?? 999) : true)
    if (step === 1) return date.length > 0
    if (step === 2) {
      if (!validateFullName(name).valid) return false
      if (!validatePhoneNumber(phone).valid) return false
      if (!validateEmail(email).valid) return false
      return true
    }
    return true
  }

  const nextStep = () => {
    if (step === 1 && !date) { toast.error('Please select a tour date.'); return }
    if (step === 1 && !user) {
      // Auth happens inline via a modal — no navigation, booking state stays put.
      setShowAuthGate(true)
      return
    }
    if (step === 2) {
      const nv = validateFullName(name)
      if (!nv.valid) { toast.error(nv.error || 'Invalid name'); return }
      const pv = validatePhoneNumber(phone)
      if (!pv.valid) { toast.error(pv.error || 'Invalid phone'); return }
      const ev = validateEmail(email)
      if (!ev.valid) { toast.error(ev.error || 'Invalid email'); return }
    }
    if (!canAdvanceStep()) return
    setStep((s) => (s + 1) as Step)
  }

  const prevStep = () => setStep((s) => (s - 1) as Step)

  const handleSubmit = async () => {
    if (!tour || isSubmitting) return
    setIsSubmitting(true)
    try {
      const bookingId = generateBookingId()
      const startTime = tour.arrival_time ? extractTime(tour.arrival_time) : '09:00'
      const payload = {
        booking_id: bookingId,
        booking_type: 'tour',
        user_name: name.trim(),
        user_email: email.trim(),
        phone: phone.trim(),
        passenger_count: passengers,
        booking_date: date,
        start_time: startTime,
        destination_id: null,
        tour_package_id: tour.id,
        car_model: tour.car_model || null,
        amount_total: totalPrice,
        booking_status: 'pending',
      }
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!result.success || !result.booking) {
        toast.error(result.error || 'Failed to create booking. Please try again.')
        setIsSubmitting(false)
        return
      }
      if (result.conflict_warning) {
        toast(result.conflict_warning, { duration: 7000 })
      }
      const savedBooking = result.booking
      const displayTime = formatDisplayTime(tour.arrival_time)
      // Trust the server's amount, never the locally computed one. The taxi
      // flow has always done this; tours did not, which is how the old
      // per-person display drifted from the flat price actually charged.
      const confirmedTotal = Number(savedBooking.amount_total ?? totalPrice)

      sessionStorage.removeItem('bookingData')
      sessionStorage.setItem(
        'tourBookingData',
        JSON.stringify({
          bookingId, bookingType: 'tour', tourId: tour.id, tourName: tour.name,
          name: name.trim(), phone: phone.trim(), email: email.trim(),
          passengers, date, time: displayTime, startTime: displayTime,
          car: tour.car_model || '', carType: tour.car_model || '',
          totalPrice: confirmedTotal, dbBookingId: savedBooking.id,
        })
      )
      toast.success('Booking created! Redirecting to payment...')
      window.location.href = `/payment?bookingId=${bookingId}&type=tour&amount=${confirmedTotal}`
    } catch (err) {
      console.error('Booking error:', err)
      toast.error('An error occurred. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (loadingTour) {
    return (
      <div ref={scrollRef} className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-primary-950">
        <Header />
        <main className="flex-1 flex items-center justify-center min-h-[80dvh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading tour details...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!tour) return null

  const maxPax = tour.max_passengers ?? 20
  const departureTime = formatDisplayTime(tour.arrival_time)

  const inputCls = "w-full px-4 py-3 bg-primary-950 border border-primary-700 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-secondary-500 focus:border-secondary-500 transition-colors text-sm"

  return (
    <div ref={scrollRef} className="scrollbar-thin-modern h-[100dvh] overflow-y-auto overflow-x-hidden bg-primary-950">
      <Header />

      {showAuthGate && (
        <AuthGate
          onClose={() => setShowAuthGate(false)}
          onOAuthStart={persistForOAuth}
        />
      )}

      <main className="relative overflow-x-hidden">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.75) 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        />
        {/* Glow blobs */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-60 -right-40 w-[440px] h-[440px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.05) 0%, transparent 70%)' }} />

        <div className="relative z-10 container mx-auto px-4 pt-20 pb-10">

          {/* Back */}
          <button
            onClick={() => router.push('/tours')}
            className="flex items-center gap-2 text-gray-500 hover:text-white mb-5 text-sm transition-colors"
          >
            <ArrowLeft size={15} /> Back to Tours
          </button>

          {/* Title */}
          <div className="text-center mb-6">
            <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-2">Tour Booking</p>
            <h1 className="font-black text-white text-2xl md:text-3xl">{tour.name}</h1>
          </div>

          {/* Progress Steps */}
          <div className="max-w-md mx-auto mb-7">
            <div className="flex items-center">
              {STEPS.map((label, idx) => (
                <div key={label} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all
                      ${idx < step
                        ? 'bg-secondary-500 text-primary-950'
                        : idx === step
                        ? 'bg-secondary-500 text-primary-950 ring-2 ring-secondary-500/30'
                        : 'bg-primary-800 text-gray-500 border border-primary-700'}`}>
                      {idx < step ? <CheckCircle size={14} /> : idx + 1}
                    </div>
                    <span className={`text-[10px] mt-1 font-semibold tracking-wide ${idx === step ? 'text-secondary-500' : idx < step ? 'text-secondary-500/70' : 'text-gray-600'}`}>
                      {label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-1 mb-4 transition-colors ${idx < step ? 'bg-secondary-500/50' : 'bg-primary-800'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Grid */}
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4 md:gap-6">

            {/* Form Panel */}
            <div className="md:col-span-2 bg-primary-900/60 border border-primary-800 rounded-2xl backdrop-blur-sm p-5 md:p-7">

              {/* Step 0: Passengers */}
              {step === 0 && (
                <div className="space-y-5">
                  <h2 className="font-black text-white text-lg mb-5">Number of Passengers</h2>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                      Select passengers (max {maxPax})
                    </label>
                    <div className="flex items-center gap-5">
                      <button type="button" onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                        className="w-11 h-11 rounded-full border border-primary-700 text-white text-xl font-bold hover:border-secondary-500 hover:text-secondary-500 transition-colors flex items-center justify-center bg-primary-950">
                        −
                      </button>
                      <span className="text-4xl font-black text-white w-14 text-center">{passengers}</span>
                      <button type="button" onClick={() => setPassengers((p) => Math.min(maxPax, p + 1))}
                        className="w-11 h-11 rounded-full border border-primary-700 text-white text-xl font-bold hover:border-secondary-500 hover:text-secondary-500 transition-colors flex items-center justify-center bg-primary-950">
                        +
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      {passengers} {passengers === 1 ? 'person' : 'people'} — price covers the whole vehicle
                    </p>
                  </div>
                  <div className="bg-secondary-500/10 border border-secondary-500/25 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 font-semibold text-sm">Total Tour Price</span>
                      <span className="text-2xl font-black text-secondary-500">₹{totalPrice.toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Flat price for the full package — pay online or request to pay later on the next screen.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 1: Date */}
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="font-black text-white text-lg mb-5">Select Tour Date</h2>
                  {tour.arrival_time && (
                    <div className="bg-primary-950 border border-primary-700 rounded-xl p-4 flex items-start gap-3">
                      <Clock size={16} className="text-secondary-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white text-sm">Fixed Daily Departure: {departureTime}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Please arrive 15 minutes early at the meeting point.</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Tour Date *</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => { setDate(e.target.value); checkAvailability(e.target.value) }}
                      min={todayISO()}
                      style={{ colorScheme: 'dark' }}
                      className={inputCls}
                    />
                    {date && (
                      <p className="text-sm text-secondary-500 mt-2 font-semibold">
                        ✓ {formatDisplayDate(date)} at {departureTime}
                      </p>
                    )}
                    {capacityWarning && (
                      <div className="mt-3 bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-3 flex items-start gap-2">
                        <span className="text-yellow-400 text-base leading-none mt-px flex-shrink-0">⚠</span>
                        <p className="text-yellow-300 text-xs leading-relaxed">{capacityWarning}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Contact */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="font-black text-white text-lg mb-5">Contact Details</h2>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Full Name *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Phone Number *</label>
                    <PhoneInput value={phone} onChange={setPhone} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Email Address *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
                      className={`${inputCls} opacity-60 cursor-not-allowed`} disabled />
                    <p className="text-gray-600 text-[11px] mt-1">Linked to your account</p>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === 3 && (
                <div>
                  <h2 className="font-black text-white text-lg mb-5">Confirm Your Booking</h2>
                  <div className="space-y-0 divide-y divide-primary-800">
                    {[
                      { label: 'Tour Package', value: tour.name },
                      { label: 'Name', value: name },
                      { label: 'Phone', value: phone },
                      { label: 'Email', value: email },
                      { label: 'Passengers', value: `${passengers} ${passengers === 1 ? 'person' : 'people'}` },
                      { label: 'Tour Date', value: formatDisplayDate(date) },
                      { label: 'Departure', value: departureTime },
                      ...(tour.car_model ? [{ label: 'Vehicle', value: tour.car_model }] : []),
                      ...(tour.duration_hours ? [{ label: 'Duration', value: `${tour.duration_hours} hours` }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between py-2.5 text-sm">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-white font-semibold text-right max-w-[60%] break-all">{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-3 text-base font-black">
                      <span className="text-gray-300">Total Amount</span>
                      <span className="text-secondary-500">₹{totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  {capacityWarning && (
                    <div className="mt-4 bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-3 flex items-start gap-2">
                      <span className="text-yellow-400 text-base leading-none mt-px flex-shrink-0">⚠</span>
                      <p className="text-yellow-300 text-xs leading-relaxed">{capacityWarning}</p>
                    </div>
                  )}
                  <div className="mt-4 bg-secondary-500/10 border border-secondary-500/25 rounded-xl p-3 text-xs text-gray-400">
                    Pay in full online, or send a booking request and settle in cash — choose on the next screen.
                    Please arrive at least 15 minutes before departure at {departureTime}.
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 mt-7">
                {step > 0 && (
                  <button type="button" onClick={prevStep}
                    className="px-5 py-3 border border-primary-700 rounded-xl font-semibold text-gray-300 hover:border-primary-600 hover:text-white transition-colors text-sm">
                    Back
                  </button>
                )}
                {step < 3 ? (
                  <button type="button" onClick={nextStep}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-colors text-sm">
                    Continue
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={isSubmitting}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-colors text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isSubmitting ? 'Processing...' : 'Confirm & Pay'}
                    {!isSubmitting && <ArrowRight size={15} />}
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-primary-900/60 border border-primary-800 rounded-2xl backdrop-blur-sm overflow-hidden">
                <div className="bg-gradient-to-br from-secondary-500/20 to-secondary-500/5 border-b border-primary-800 px-5 py-4">
                  <p className="text-secondary-500 font-semibold text-[10px] tracking-[0.2em] uppercase mb-1">Tour Package</p>
                  <h3 className="text-white font-black text-base leading-tight">{tour.name}</h3>
                </div>
                <div className="p-5 space-y-2.5 text-sm text-gray-400">
                  {tour.arrival_time && (
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-secondary-500 flex-shrink-0" />
                      <span>Daily departure {departureTime}</span>
                    </div>
                  )}
                  {tour.duration_hours && (
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-secondary-500 flex-shrink-0" />
                      <span>{tour.duration_hours} hours</span>
                    </div>
                  )}
                  {tour.max_passengers && (
                    <div className="flex items-center gap-2">
                      <Users size={13} className="text-secondary-500 flex-shrink-0" />
                      <span>Max {tour.max_passengers} passengers</span>
                    </div>
                  )}
                  {tour.car_model && (
                    <div className="flex items-center gap-2">
                      <Car size={13} className="text-secondary-500 flex-shrink-0" />
                      <span>{tour.car_model}</span>
                    </div>
                  )}
                  <div className="border-t border-primary-800 pt-3 mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Package price (whole vehicle)</span>
                      <span className="text-gray-300">₹{totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Passengers</span>
                      <span className="text-gray-300">{passengers}</span>
                    </div>
                    <div className="flex justify-between font-black text-sm border-t border-primary-800 pt-1.5">
                      <span className="text-gray-300">Total</span>
                      <span className="text-secondary-500">₹{totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {tour.highlights && tour.highlights.length > 0 && (
                <div className="bg-primary-900/60 border border-primary-800 rounded-2xl backdrop-blur-sm p-5">
                  <h4 className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider mb-3">What&apos;s Included</h4>
                  <ul className="space-y-2">
                    {tour.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="text-secondary-500 font-black text-base leading-none mt-px">✓</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
