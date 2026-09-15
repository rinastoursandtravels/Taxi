'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { Eye, Download, Trash2, ArrowRight, Car, ChevronDown, CreditCard, Clock, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useAuth } from '@/context/AuthContext'
import type { Booking } from '@/lib/db'
import { generateInvoicePDF, downloadInvoicePDF, type InvoiceData } from '@/lib/invoice'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

function toNum(val: unknown): number {
  const n = parseFloat(String(val ?? 0))
  return isNaN(n) ? 0 : n
}

interface CarDetails {
  id: string
  model_name: string
  class: string
  number_plate: string
  capacity: number
  driver_name: string
  driver_phone: string
  driver_email: string | null
}

interface Assignment {
  id: string
  booking_id: string
  car_id: string | null
  start_datetime: string
  end_datetime: string
  assigned_at: string
  car_model_snapshot?: string | null
  car_number_plate_snapshot?: string | null
  car_class_snapshot?: string | null
  driver_name_snapshot?: string | null
  driver_phone_snapshot?: string | null
  driver_email_snapshot?: string | null
  cars: CarDetails | null
}

export default function MyBookings() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [assignmentMap, setAssignmentMap] = useState<Record<string, Assignment>>({})
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null)
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [resumingBookingId, setResumingBookingId] = useState<string | null>(null)
  const [pendingTimeoutHours, setPendingTimeoutHours] = useState<number>(24)
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [submittingCancellation, setSubmittingCancellation] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const cancelModalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.documentElement.style.overflowY = 'auto'
    document.body.style.overflowY = 'auto'
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'
  }, [])

  useEffect(() => {
    if (!isLoading && !user) {
      toast.error('Please sign in to view your bookings')
      router.push('/login?redirect=/bookings')
      return
    }

    if (user?.email) {
      loadBookings(user.email)
      loadPendingTimeout()
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return

    let targetTop = scroller.scrollTop

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      targetTop = Math.min(max, Math.max(0, targetTop + e.deltaY))
      gsap.to(scroller, {
        scrollTop: targetTop,
        duration: 0.75,
        ease: 'power3.out',
        overwrite: true,
      })
    }

    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      scroller.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => {
    if (cancelModalBooking && cancelModalRef.current) {
      gsap.fromTo(
        cancelModalRef.current,
        { scale: 0.88, opacity: 0, y: 24 },
        { scale: 1, opacity: 1, y: 0, duration: 0.42, ease: 'back.out(1.6)' }
      )
    }
  }, [cancelModalBooking])

  useEffect(() => {
    const scroller = scrollRef.current
    const header = document.querySelector('header') as HTMLElement | null
    if (!scroller || !header) return

    let autoHideTimer: ReturnType<typeof setTimeout> | null = null
    let hideAfterScrollTimer: ReturnType<typeof setTimeout> | null = null
    let headerHovered = false

    const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
      if (timer) clearTimeout(timer)
      return null
    }

    const isInteractiveTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      return Boolean(el.closest('a, button, input, textarea, select, label, summary, [role="button"], [data-no-header-peek]'))
    }

    const hideHeader = () => {
      gsap.killTweensOf(header)
      gsap.to(header, { yPercent: -110, opacity: 1, duration: 0.46, ease: 'power3.inOut' })
    }

    const showHeaderTemporarily = () => {
      autoHideTimer = clearTimer(autoHideTimer)
      gsap.killTweensOf(header)
      gsap.to(header, { yPercent: 0, opacity: 1, duration: 0.55, ease: 'power2.out' })
      autoHideTimer = setTimeout(() => {
        if (!headerHovered) hideHeader()
        autoHideTimer = null
      }, 6500)
    }

    const scheduleHideAfterScroll = () => {
      hideAfterScrollTimer = clearTimer(hideAfterScrollTimer)
      hideAfterScrollTimer = setTimeout(() => {
        if (!headerHovered) hideHeader()
        hideAfterScrollTimer = null
      }, 250)
    }

    const onScroll = () => scheduleHideAfterScroll()
    const onClick = (e: MouseEvent) => {
      if (!isInteractiveTarget(e.target)) showHeaderTemporarily()
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!isInteractiveTarget(e.target)) showHeaderTemporarily()
    }
    const onHeaderMouseEnter = () => {
      headerHovered = true
      autoHideTimer = clearTimer(autoHideTimer)
      hideAfterScrollTimer = clearTimer(hideAfterScrollTimer)
    }
    const onHeaderMouseLeave = () => {
      headerHovered = false
      autoHideTimer = clearTimer(autoHideTimer)
      hideAfterScrollTimer = clearTimer(hideAfterScrollTimer)
      autoHideTimer = setTimeout(() => {
        if (!headerHovered) hideHeader()
        autoHideTimer = null
      }, 6500)
    }

    gsap.set(header, { yPercent: 0, opacity: 1 })
    autoHideTimer = setTimeout(() => {
      if (!headerHovered) hideHeader()
      autoHideTimer = null
    }, 6500)

    const onMenuClosed = () => showHeaderTemporarily()

    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('click', onClick, { passive: true })
    scroller.addEventListener('touchend', onTouchEnd, { passive: true })
    header.addEventListener('mouseenter', onHeaderMouseEnter)
    header.addEventListener('mouseleave', onHeaderMouseLeave)
    document.addEventListener('header:menu-closed', onMenuClosed)

    return () => {
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('click', onClick)
      scroller.removeEventListener('touchend', onTouchEnd)
      header.removeEventListener('mouseenter', onHeaderMouseEnter)
      header.removeEventListener('mouseleave', onHeaderMouseLeave)
      document.removeEventListener('header:menu-closed', onMenuClosed)
      autoHideTimer = clearTimer(autoHideTimer)
      hideAfterScrollTimer = clearTimer(hideAfterScrollTimer)
      gsap.set(header, { yPercent: 0, opacity: 1 })
    }
  }, [])

  // ── Booking cards entry/exit scroll animation ──
  useEffect(() => {
    if (loadingBookings || bookings.length === 0) return

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.booking-card')
      cards.forEach((card, i) => {
        const isEven = i % 2 === 0
        gsap.fromTo(card,
          {
            opacity: 0,
            x: isEven ? -80 : 80,
            rotateY: isEven ? 15 : -15,
            scale: 0.92,
            transformPerspective: 1200,
          },
          {
            opacity: 1,
            x: 0,
            rotateY: 0,
            scale: 1,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              scroller: scrollRef.current,
              start: 'top 105%',
              end: 'bottom -5%',
              toggleActions: 'play none play reverse',
              invalidateOnRefresh: true,
            }
          }
        )
      })
    }, scrollRef)

    return () => ctx.revert()
  }, [loadingBookings, bookings])

  useEffect(() => {
    if (loadingBookings || bookings.length === 0) return

    // Card height changes after expand/collapse can shift neighboring triggers.
    // Refresh after layout settles so each card exits only when it truly leaves the viewport.
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh())
    const timeout = window.setTimeout(() => ScrollTrigger.refresh(), 300)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timeout)
    }
  }, [expandedBookingId, loadingBookings, bookings.length])

  const loadBookings = async (email: string) => {
    setLoadingBookings(true)
    try {
      const response = await fetch('/api/bookings/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      if (result.success) {
        const loadedBookings: Booking[] = result.bookings
        setBookings(loadedBookings)

        // Fetch vehicle assignments for all bookings
        const bookingIds = loadedBookings
          .map((b) => b.booking_id || b.id)
          .filter(Boolean)

        if (bookingIds.length > 0) {
          try {
            const assignRes = await fetch('/api/bookings/user-assignments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingIds }),
            })
            const assignData = await assignRes.json()
            if (assignData.success && assignData.assignments) {
              const map: Record<string, Assignment> = {}
              for (const a of assignData.assignments) {
                map[a.booking_id] = a
              }
              setAssignmentMap(map)
            }
          } catch (e) {
            console.error('Error loading assignments:', e)
          }
        }
      } else {
        toast.error('Failed to load bookings')
      }
    } catch (error) {
      console.error('Error loading bookings:', error)
      toast.error('Failed to load bookings')
    } finally {
      setLoadingBookings(false)
    }
  }

  const loadPendingTimeout = async () => {
    try {
      const res = await fetch('/api/admin/settings?key=pending_booking_timeout_hours', { cache: 'no-store' })
      const data = await res.json()
      if (data.success && data.settings?.length > 0) {
        setPendingTimeoutHours(parseInt(data.settings[0].value) || 24)
      }
    } catch {
      // keep default 24h
    }
  }

  const handleContinueToPay = async (booking: Booking) => {
    setResumingBookingId(booking.id)
    try {
      const res = await fetch('/api/bookings/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.booking_id }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error('Unable to resume this booking. It may have already expired.')
        return
      }

      const totalPrice = toNum(booking.amount_total)

      const startDate = new Date(booking.start_datetime)
      const day = String(startDate.getDate()).padStart(2, '0')
      const month = String(startDate.getMonth() + 1).padStart(2, '0')
      const year = startDate.getFullYear()
      const dateStr = `${day}/${month}/${year}`
      const timeStr = startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

      const sessionPayload = {
        bookingId: booking.booking_id,
        dbBookingId: data.booking.id,
        name: booking.user_name,
        email: booking.user_email,
        phone: booking.phone,
        destination: data.destinationName || undefined,
        tourName: data.tourName || undefined,
        date: dateStr,
        startTime: timeStr,
        passengers: booking.passenger_count,
        carType: booking.car_model,
        totalPrice,
        // Read fresh from the DB via resume, never assumed — this is what lets
        // /payment tell "already chose pay-later, just needs paying" apart
        // from "never chose anything yet" and avoid re-offering pay-later.
        paymentMode: data.booking.payment_mode,
      }

      const storageKey = booking.booking_type === 'tour' ? 'tourBookingData' : 'bookingData'
      sessionStorage.setItem(storageKey, JSON.stringify(sessionPayload))
      router.push(`/payment?bookingId=${booking.booking_id}&type=${booking.booking_type === 'tour' ? 'tour' : 'taxi'}`)
    } catch (error) {
      console.error('Continue to pay error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setResumingBookingId(null)
    }
  }

  const getPendingExpiryInfo = (createdAt: string) => {
    const expiresAt = new Date(createdAt).getTime() + pendingTimeoutHours * 60 * 60 * 1000
    const msLeft = expiresAt - Date.now()
    if (msLeft <= 0) return { label: 'Expiring soon', urgent: true }
    const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000))
    const minsLeft = Math.floor((msLeft % (60 * 60 * 1000)) / 60000)
    if (hoursLeft === 0) return { label: `${minsLeft}m left to pay`, urgent: true }
    if (hoursLeft < 3) return { label: `${hoursLeft}h ${minsLeft}m left to pay`, urgent: true }
    return { label: `Expires in ${hoursLeft}h`, urgent: false }
  }

  // How much longer a free ("pay later") booking keeps its vehicle reserved.
  //
  // hold_expires_at is a TIMESTAMPTZ (a real instant) — unlike start_datetime,
  // it must be parsed with new Date(), never the IST wall-clock helpers used
  // elsewhere on this page.
  const getHoldCountdown = (holdExpiresAt: string | null | undefined) => {
    if (!holdExpiresAt) return null
    const expiresMs = new Date(holdExpiresAt).getTime()
    if (Number.isNaN(expiresMs)) return null

    const diff = expiresMs - Date.now()
    if (diff <= 0) return { label: 'Payment deadline passed', expired: true, urgent: true }

    const totalMinutes = Math.floor(diff / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const urgent = hours < 3

    const label = hours > 0 ? `${hours}h ${minutes}m left to pay` : `${minutes}m left to pay`
    return { label, expired: false, urgent }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      pending: {
        className: 'bg-yellow-500/15 border border-yellow-500/30 text-yellow-400',
        label: 'Pending',
      },
      confirmed: {
        className: 'bg-blue-500/15 border border-blue-500/30 text-blue-400',
        label: 'Confirmed',
      },
      assigned: {
        className: 'bg-purple-500/15 border border-purple-500/30 text-purple-400',
        label: 'Assigned',
      },
      in_progress: {
        className: 'bg-green-500/15 border border-green-500/30 text-green-400',
        label: 'In Progress',
      },
      completed: {
        className: 'bg-gray-500/15 border border-gray-500/30 text-gray-400',
        label: 'Completed',
      },
      cancelled: {
        className: 'bg-red-500/15 border border-red-500/30 text-red-400',
        label: 'Cancelled',
      },
    }
    return statusMap[status] || { className: 'bg-gray-500/15 border border-gray-500/30 text-gray-400', label: 'Unknown' }
  }

  // An unpaid booking is cancelled outright rather than queued for review, so
  // the modal must not promise a refund or a 24-hour turnaround.
  const isUnpaidCancellation =
    cancelModalBooking?.booking_status === 'pending' &&
    cancelModalBooking?.payment_mode === 'pay_later'

  const handleCancelRequest = async () => {
    if (!cancelModalBooking || !user?.email) return
    setSubmittingCancellation(true)
    try {
      const res = await fetch('/api/bookings/cancel-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: cancelModalBooking.booking_id || cancelModalBooking.id,
          user_email: user.email,
          reason: cancellationReason.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to submit request')
      // An unpaid booking is cancelled outright — there is no payment to refund
      // and nothing for an admin to review, so promising either would be wrong.
      toast.success(
        data.cancelled
          ? 'Booking cancelled.'
          : 'Cancellation request submitted. We will review and process your refund shortly.'
      )
      setCancelModalBooking(null)
      setCancellationReason('')
      await loadBookings(user.email)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit cancellation request')
    } finally {
      setSubmittingCancellation(false)
    }
  }

  const resolveTripDetailsForInvoice = async (booking: Booking): Promise<{ destination?: string; tourPackageName?: string }> => {
    try {
      if (booking.booking_type === 'tour' && booking.tour_package_id) {
        const toursRes = await fetch('/api/tours', { method: 'GET' })
        if (toursRes.ok) {
          const toursData = await toursRes.json()
          const matchedTour = (toursData?.tours || []).find((tour: { id: string; name: string }) => tour.id === booking.tour_package_id)
          if (matchedTour?.name) {
            return { tourPackageName: matchedTour.name }
          }
        }
      }

      if (booking.booking_type !== 'tour' && booking.destination_id) {
        const destinationsRes = await fetch('/api/destinations', { method: 'GET' })
        if (destinationsRes.ok) {
          const destinationsData = await destinationsRes.json()
          const matchedDestination = (destinationsData?.destinations || []).find(
            (destination: { id: string; name: string }) => destination.id === booking.destination_id
          )
          if (matchedDestination?.name) {
            return { destination: matchedDestination.name }
          }
        }
      }
    } catch (error) {
      console.warn('Unable to resolve trip label for invoice:', error)
    }

    return {
      destination: booking.booking_type !== 'tour' ? (booking.destination_id || undefined) : undefined,
      tourPackageName: booking.booking_type === 'tour' ? (booking.tour_package_id || undefined) : undefined,
    }
  }

  const handleDownloadInvoice = async (booking: Booking) => {
    const bookingKey = booking.booking_id || booking.id
    setDownloadingInvoiceId(booking.id)
    try {
      const paymentRes = await fetch(`/api/payment/get-payment?bookingId=${encodeURIComponent(booking.id)}`)
      if (!paymentRes.ok) {
        throw new Error('Payment record not found for this booking')
      }

      const payment = await paymentRes.json()
      const totalAmount = toNum(payment.amount_total || booking.amount_total)
      const onlinePaid = toNum(payment.amount_online_paid)
      const isFullPay = payment.payment_type === 'full'
      const onlineRecord = (payment.payment_records ?? []).find((r: { txn_type: string; invoice_number?: string | null }) => r.txn_type === 'online')
      const invoiceNumber = onlineRecord?.invoice_number || `INV-${bookingKey}-${Date.now()}`
      const tripDetails = await resolveTripDetailsForInvoice(booking)
      const invoiceData: InvoiceData = {
        bookingId: bookingKey,
        date: new Date().toISOString(),
        userName: booking.user_name || 'Customer',
        userEmail: booking.user_email || '-',
        userPhone: booking.phone || '-',
        bookingType: booking.booking_type === 'tour' ? 'tour' : 'taxi',
        destination: tripDetails.destination,
        tourPackageName: tripDetails.tourPackageName,
        pickupLocation: 'Inside the Arrival Hall, beside the Exit Gate, Donyi Polo Airport, Hollongi, Itanagar',
        pickupDate: booking.start_datetime,
        pickupTime: formatTime(booking.start_datetime),
        passengers: Number(booking.passenger_count || 1),
        carType: booking.car_model || 'Not specified',
        totalAmount,
        advanceAmount: onlinePaid,
        // Cash already collected must count toward what has been settled,
        // otherwise a booking paid entirely in cash prints its full total as
        // still outstanding.
        remainingAmount: isFullPay
          ? 0
          : Math.max(totalAmount - onlinePaid - toNum(payment.amount_cash_paid), 0),
        paymentStatus: payment.payment_status === 'paid' ? 'completed' : (payment.payment_status || 'pending'),
        paymentMethod: isFullPay
          ? 'Full Online Payment'
          : onlinePaid > 0
            ? 'Partial Online + Cash'
            : 'Cash Payment',
        invoiceNumber,
      }

      const doc = await generateInvoicePDF(invoiceData)
      downloadInvoicePDF(doc, `Invoice-${bookingKey}.pdf`)
      toast.success('Invoice downloaded successfully!')
    } catch (error) {
      console.error('Invoice download error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to download invoice')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const toggleBookingDetails = (id: string) => {
    setExpandedBookingId((prev) => (prev === id ? null : id))
  }

  if (loadingBookings) {
    return (
      <div ref={scrollRef} className="scrollbar-thin-modern flex h-[100dvh] flex-col overflow-y-auto overflow-x-hidden bg-primary-950">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 md:w-32 md:h-32 translate-y-[30px]">
              <DotLottieReact
                src="/assets/yellow taxi.lottie"
                loop
                autoplay
                className="app-lottie-brand-yellow"
              />
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="scrollbar-thin-modern h-[100dvh] overflow-y-auto overflow-x-hidden bg-primary-950">
      <Header />

      <main className="relative overflow-x-hidden flex flex-col min-h-full">
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.75) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        ></div>

        <div className="relative z-10 container mx-auto px-4 pt-14 pb-12 md:pt-20 md:pb-24 flex-1 flex flex-col">
          {/* Hero heading */}
          <div className="text-center mb-8 md:mb-16">
            <h1 className="font-black text-white text-3xl md:text-5xl mb-3 md:mb-5">
              My Bookings
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-base leading-relaxed">
              Track, manage, and review all your upcoming and past journeys in one place.
            </p>
          </div>

          {bookings.length === 0 ? (
            <div className="max-w-lg mx-auto text-center rounded-2xl border border-primary-800 bg-primary-900/60 backdrop-blur-sm p-8 md:p-14 my-auto">
              <div className="w-14 h-14 rounded-full bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center mx-auto mb-5">
                <Car size={24} className="text-secondary-500" />
              </div>
              <p className="text-white font-bold text-xl mb-2">No bookings yet</p>
              <p className="text-gray-400 text-sm mb-8">You don&apos;t have any bookings yet. Start your journey today.</p>
              <a
                href="/book-taxi"
                className="inline-flex items-center gap-2 bg-secondary-500 text-primary-950 font-black px-6 py-3 rounded-xl hover:bg-secondary-400 transition-colors"
              >
                Make Your First Booking
                <ArrowRight size={16} />
              </a>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6 [perspective:2000px]">
              {bookings.map((booking) => {
                const statusBadge = getStatusBadge(booking.booking_status)
                const bookingTypeLabel =
                  booking.booking_type === 'taxi'
                    ? 'Taxi Booking'
                    : booking.booking_type === 'tour'
                    ? 'Tour'
                    : 'Taxi Booking'
                const assignment = assignmentMap[booking.booking_id || booking.id]
                const assignmentCar = assignment?.cars || null
                const assignmentModel = assignmentCar?.model_name || assignment?.car_model_snapshot || 'Vehicle record deleted'
                const assignmentClass = assignmentCar?.class || assignment?.car_class_snapshot || '-'
                const assignmentPlate = assignmentCar?.number_plate || assignment?.car_number_plate_snapshot || '-'
                const assignmentDriver = assignmentCar?.driver_name || assignment?.driver_name_snapshot || '-'
                const assignmentDriverPhone = assignmentCar?.driver_phone || assignment?.driver_phone_snapshot || '-'
                const assignmentDriverEmail = assignmentCar?.driver_email || assignment?.driver_email_snapshot || null
                const isExpanded = expandedBookingId === booking.id

                return (
                  <div
                    key={booking.id}
                    className="booking-card rounded-xl border border-primary-800 bg-primary-900/60 backdrop-blur-sm overflow-hidden hover:border-primary-700 transition-colors duration-200 will-change-transform"
                  >
                    <div className="p-3 md:p-3">
                      {/* Header */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 md:mb-1.5 pb-1.5 md:pb-2 border-b border-primary-800">
                        <div>
                          <h3 className="text-base md:text-lg font-black text-white mb-0.5">{bookingTypeLabel}</h3>
                          <p className="text-gray-500 font-mono text-[11px] md:text-xs truncate max-w-[220px] md:max-w-none">
                            {booking.booking_id || booking.id}
                          </p>
                          {booking.booking_status === 'confirmed' && (
                            <div className={`mt-1 inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] md:text-[11px] font-semibold leading-tight shadow-[0_0_0_1px_rgba(255,218,0,0.1)] ${
                              assignment
                                ? 'border-green-500/40 bg-green-500/15 text-green-200'
                                : 'border-secondary-500/40 bg-secondary-500/15 text-secondary-200'
                            }`}>
                              <Clock size={12} className={`shrink-0 ${assignment ? 'text-green-300' : 'text-secondary-300'}`} />
                              <span className="tracking-[0.01em]">
                                {assignment
                                  ? 'Driver details have been sent to your email'
                                  : 'Driver details will be sent to your email shortly'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 md:mt-0">
                          <span className={`px-2.5 py-1 rounded-full font-semibold text-[11px] md:text-xs ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                          {assignment && (
                            <span className="px-2.5 py-1 rounded-full font-semibold text-[11px] md:text-xs bg-green-500/15 border border-green-500/30 text-green-400">
                              ✓ Vehicle Assigned
                            </span>
                          )}
                          <span className="text-xl md:text-3xl font-black text-secondary-500">₹{toNum(booking.amount_total).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 transition-all duration-300 ease-out overflow-hidden ${isExpanded ? 'max-h-[420px] opacity-100 mt-2 mb-3' : 'max-h-0 opacity-0 m-0'}`}>
                        <div>
                          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Date</p>
                          <p className="text-white font-semibold">{formatDate(booking.start_datetime)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Start Time</p>
                          <p className="text-white font-semibold">{formatTime(booking.start_datetime)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">End Time</p>
                          <p className="text-white font-semibold">{formatTime(booking.end_datetime)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Passengers</p>
                          <p className="text-white font-semibold">{booking.passenger_count}</p>
                        </div>
                        {booking.car_model && (
                          <div>
                            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Car Model</p>
                            <p className="text-white font-semibold">{booking.car_model}</p>
                          </div>
                        )}
                      </div>

                      {/* Vehicle Assignment details (Integrated) */}
                      {assignment && (
                        <div className={`bg-green-500/5 border border-green-500/20 rounded-xl p-4 md:p-5 overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-[400px] opacity-100 mb-3' : 'max-h-0 opacity-0 p-0 m-0 border-transparent'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Car size={16} className="text-green-400" />
                            <h4 className="text-green-400 font-bold text-xs uppercase tracking-wider">Vehicle Assigned</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                            <p className="text-gray-300"><span className="text-gray-500 font-medium">Car:</span> {assignmentModel} ({assignmentClass})</p>
                            <p className="text-gray-300"><span className="text-gray-500 font-medium">Number Plate:</span> {assignmentPlate}</p>
                            <p className="text-gray-300"><span className="text-gray-500 font-medium">Driver:</span> {assignmentDriver}</p>
                            <p className="text-gray-300"><span className="text-gray-500 font-medium">Driver Phone:</span> {assignmentDriverPhone}</p>
                            {assignmentDriverEmail && (
                              <p className="text-gray-300"><span className="text-gray-500 font-medium">Driver Email:</span> {assignmentDriverEmail}</p>
                            )}
                            <p className="text-gray-300"><span className="text-gray-500 font-medium">Pickup:</span> {formatDate(assignment.start_datetime)} at {formatTime(assignment.start_datetime)}</p>
                          </div>
                          {!assignmentCar && (
                            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-[11px] md:text-xs text-amber-300">
                              Vehicle record was deleted, but assignment history is preserved.
                            </div>
                          )}
                          <div className="mt-3 bg-green-500/10 border border-green-500/10 rounded-lg px-3 py-2 text-[11px] md:text-xs text-green-300/70 italic">
                            Tip: Arrive at the pickup point 10 minutes early for a smooth departure.
                          </div>
                        </div>
                      )}

                      {/* User Contact Info */}
                      <div className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-[260px] opacity-100 mb-3' : 'max-h-0 opacity-0 m-0'}`}>
                        <div className="bg-primary-950/50 border border-primary-800 rounded-xl p-4 md:p-5">
                          <h4 className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-3">Contact Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            <p className="text-gray-300"><span className="text-gray-500 font-medium">Name:</span> {booking.user_name}</p>
                            <p className="text-gray-300"><span className="text-gray-500 font-medium">Phone:</span> {booking.phone}</p>
                            {booking.user_email && (
                              <p className="text-gray-300"><span className="text-gray-500 font-medium">Email:</span> {booking.user_email}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Unpaid (pay later) notice — a request, not a reservation.
                          No email is sent for these, so this is the only place the
                          customer learns what state their booking is actually in.
                          Framed as actionable (pay now to lock it in) rather than
                          passive (wait for a call) — the hold has a real deadline,
                          and paying online is the customer's own way to beat it. */}
                      {booking.booking_status === 'pending' && booking.payment_mode === 'pay_later' && (() => {
                        const hold = getHoldCountdown(booking.hold_expires_at)
                        return (
                          <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 mb-2 text-xs ${hold?.urgent ? 'bg-red-500/10 border border-red-500/20 text-red-300' : 'bg-orange-500/10 border border-orange-500/20 text-orange-300'}`}>
                            <Clock size={13} className="mt-0.5 shrink-0" />
                            <span>
                              {hold && !hold.expired ? (
                                <>
                                  Your date and time are held on this vehicle. Pay{' '}
                                  <span className="font-semibold">₹{toNum(booking.amount_total).toFixed(2)}</span> within{' '}
                                  <span className="font-semibold">{hold.label}</span> to lock it in — online now, or
                                  in cash with our team if your trip is sooner than that.
                                </>
                              ) : (
                                <>
                                  Your payment deadline has passed, so this slot has been reopened to other customers.{' '}
                                  <span className="font-semibold">Pay now</span> to reclaim it if it is still free, or contact us
                                  to check availability.
                                </>
                              )}
                            </span>
                          </div>
                        )
                      })()}

                      {/* Pending payment notice — an online checkout that was
                          started but never completed. These do expire. */}
                      {booking.booking_status === 'pending' && booking.payment_mode !== 'pay_later' && (() => {
                        const expiry = getPendingExpiryInfo(booking.created_at)
                        return (
                          <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 mb-2 text-xs ${expiry.urgent ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}>
                            <Clock size={13} className="mt-0.5 shrink-0" />
                            <span>Payment pending — complete payment to confirm your booking. <span className="font-semibold">{expiry.label}.</span></span>
                          </div>
                        )
                      })()}

                      {/* Cancellation requested notice */}
                      {booking.cancellation_requested_at && booking.booking_status !== 'cancelled' && (
                        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs">
                          <Clock size={13} className="mt-0.5 shrink-0" />
                          <span>Cancellation requested — under admin review. You will be notified once processed.</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => toggleBookingDetails(booking.id)} className="flex items-center gap-2 px-3 py-1.5 border border-primary-700 text-gray-300 rounded-lg hover:border-primary-600 hover:text-white transition-colors text-xs">
                          <Eye size={14} />
                          {isExpanded ? 'Hide Details' : 'View Details'}
                          <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {/* A pay-later booking can pay online too — that is how a
                            customer self-serves a guarantee before the hold
                            expires, instead of waiting on the team to call. */}
                        {booking.booking_status === 'pending' && (
                          <button
                            onClick={() => handleContinueToPay(booking)}
                            disabled={resumingBookingId === booking.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold disabled:opacity-50 ${
                              booking.payment_mode === 'pay_later'
                                ? 'bg-red-500/10 border border-red-500/50 text-red-300 hover:bg-red-500/20 hover:border-red-500'
                                : 'bg-secondary-500/10 border border-secondary-500/50 text-secondary-500 hover:bg-secondary-500/20 hover:border-secondary-500'
                            }`}
                          >
                            <CreditCard size={14} />
                            {resumingBookingId === booking.id
                              ? 'Loading...'
                              : booking.payment_mode === 'pay_later' ? 'Pay Now' : 'Continue to Pay'}
                          </button>
                        )}
                        {booking.booking_status === 'confirmed' && (
                          <button
                            onClick={() => handleDownloadInvoice(booking)}
                            disabled={downloadingInvoiceId === booking.id}
                            className="flex items-center gap-2 px-3 py-1.5 border border-secondary-500/40 text-secondary-500 rounded-lg hover:border-secondary-500 hover:bg-secondary-500/10 transition-colors text-xs"
                          >
                            <Download size={14} />
                            {downloadingInvoiceId === booking.id ? 'Downloading...' : 'Invoice'}
                          </button>
                        )}
                        {((booking.booking_status === 'confirmed') ||
                          (booking.booking_status === 'pending' && booking.payment_mode === 'pay_later')) &&
                          !booking.cancellation_requested_at && (
                          <button
                            onClick={() => setCancelModalBooking(booking)}
                            className="flex items-center gap-2 px-3 py-1.5 border border-red-500/40 text-red-400 rounded-lg hover:border-red-500 hover:bg-red-500/10 transition-colors text-xs"
                          >
                            <Trash2 size={14} />
                            Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Cancellation request modal */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div
            ref={cancelModalRef}
            className="w-full max-w-md rounded-3xl overflow-hidden"
            style={{
              background: 'rgba(22,17,14,0.97)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(248,113,113,0.08)',
            }}
          >
            {/* Modal header */}
            <div
              className="relative flex items-center gap-3.5 px-6 pt-6 pb-5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.2)' }}
              >
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-black text-base leading-tight">
                  {isUnpaidCancellation ? 'Cancel Booking' : 'Request Cancellation'}
                </h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  {isUnpaidCancellation ? 'This cancels your request immediately' : 'Review the policy before proceeding'}
                </p>
              </div>
              <button
                onClick={() => { setCancelModalBooking(null); setCancellationReason('') }}
                className="ml-auto flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Policy info */}
              <div
                className="rounded-2xl p-4 space-y-2.5"
                style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.15)' }}
              >
                <p className="text-red-400 text-xs font-bold uppercase tracking-wider">
                  {isUnpaidCancellation ? 'Before you cancel' : 'Refund Policy'}
                </p>
                <ul className="space-y-1.5">
                  {(isUnpaidCancellation
                    ? [
                        'You have not paid for this booking, so there is nothing to refund.',
                        'Your booking will be cancelled straight away.',
                        'The slot held for you is released immediately.',
                        'You can submit a new booking request at any time.',
                      ]
                    : [
                        'Your request will be reviewed by our team within 24 hours.',
                        'Any amount paid online is eligible for refund.',
                        'Cash already collected is handled separately by our team, not through this flow.',
                        'Refunds take 5–7 business days to reflect in your account.',
                      ]
                  ).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[13px] text-gray-400 leading-snug">
                      <span className="mt-1 w-1 h-1 rounded-full bg-red-400/60 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Reason textarea */}
              <div>
                <label className="block text-gray-500 text-[11px] font-semibold uppercase tracking-widest mb-2">
                  Reason <span className="text-gray-700 normal-case font-normal tracking-normal">(optional)</span>
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={e => setCancellationReason(e.target.value)}
                  placeholder="Tell us why you're cancelling..."
                  rows={3}
                  maxLength={300}
                  className="w-full rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none resize-none transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => (e.currentTarget.style.border = '1px solid rgba(248,113,113,0.35)')}
                  onBlur={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)')}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setCancelModalBooking(null); setCancellationReason('') }}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancelRequest}
                  disabled={submittingCancellation}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: submittingCancellation
                      ? 'rgba(220,38,38,0.5)'
                      : 'rgba(220,38,38,0.85)',
                    border: '1px solid rgba(248,113,113,0.3)',
                    boxShadow: submittingCancellation ? 'none' : '0 4px 20px rgba(220,38,38,0.25)',
                  }}
                >
                  {submittingCancellation
                    ? (isUnpaidCancellation ? 'Cancelling...' : 'Submitting...')
                    : (isUnpaidCancellation ? 'Cancel Booking' : 'Request Cancellation')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
