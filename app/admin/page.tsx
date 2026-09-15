'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import { ProtectedAdminPage } from '@/components/ProtectedAdminPage'
import { LogOut, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Booking } from '@/lib/db'

type AdminApiResponse = {
  success?: boolean
  bookings?: Booking[]
  error?: string
}

type Car = {
  id: string
  model_name: string
  class: string
  number_plate: string
  capacity: number
  driver_name: string
  driver_phone: string
  driver_email: string | null
  driver_verified: boolean
  is_active: boolean
  created_at: string
}

type CarsResponse = {
  success: boolean
  cars?: Car[]
  error?: string
}

type Destination = {
  id: string
  name: string
  estimated_duration_minutes: number
  description: string | null
  is_active: boolean
  created_at: string
}

type DestinationFare = {
  id: string
  destination_id: string
  model_name: string
  fixed_fare: number
}

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''}`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hStr = `${h} hr${h !== 1 ? 's' : ''}`
  return m === 0 ? hStr : `${hStr} ${m} mins`
}

type DestinationsResponse = {
  success: boolean
  destinations?: Destination[]
  error?: string
}

type Tour = {
  id: string
  name: string
  description: string | null
  arrival_time: string | null
  duration_hours: number | null
  price: number
  max_passengers: number | null
  car_model: string | null
  itinerary: string | null
  highlights: string[]
  image_url: string | null
  image_urls: string[] | null
  is_active: boolean
  created_at: string
}

type ToursResponse = {
  success: boolean
  tours?: Tour[]
  error?: string
}

type Payment = {
  id: string
  booking_id: string
  // 'cash' = a free booking, settled offline. 'partial' is legacy (30% advance).
  payment_type: 'partial' | 'full' | 'cash'
  amount_total: number
  amount_online_paid: number
  amount_cash_paid: number
  txn_status: 'pending' | 'success' | 'failed'
  txn_id: string | null
  gateway: string | null
  // 'unpaid' = free booking awaiting collection. 'partial' is legacy.
  payment_status: 'pending' | 'unpaid' | 'partial' | 'paid'
  cash_paid_at: string | null
  cash_collected_by: string | null
  created_at: string
  refund_status: 'none' | 'pending' | 'processed' | 'failed' | null
  refund_amount: number | null
  refund_id: string | null
  refunded_at: string | null
  refund_notes: string | null
}

type VehicleAssignment = {
  id: string
  booking_id: string
  car_id: string | null
  start_datetime: string
  end_datetime: string
  assigned_at: string
  created_at: string
  car_model_snapshot?: string | null
  car_number_plate_snapshot?: string | null
  car_class_snapshot?: string | null
  driver_name_snapshot?: string | null
  driver_phone_snapshot?: string | null
  driver_email_snapshot?: string | null
}

type PaymentsResponse = {
  success: boolean
  payments?: Payment[]
  error?: string
}

type CarModelLibraryResponse = {
  success: boolean
  models?: string[]
  error?: string
}

type SystemLog = {
  id: string
  created_at: string
  severity: 'info' | 'warn' | 'error' | 'security'
  event_type: string
  actor_type: string
  actor_id: string | null
  actor_label: string | null
  entity_type: string | null
  entity_id: string | null
  message: string
  metadata: Record<string, unknown>
}

const ACTIVE_STATUSES = new Set(['pending', 'confirmed'])

function toNum(val: unknown): number {
  const n = parseFloat(String(val ?? 0))
  return isNaN(n) ? 0 : n
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusClass(status: string, darkMode = false) {
  if (status === 'completed') {
    return darkMode ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-green-100 text-green-800'
  }

  if (status === 'confirmed') {
    return darkMode ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30' : 'bg-blue-100 text-blue-800'
  }

  if (status === 'pending') {
    return darkMode ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' : 'bg-yellow-100 text-yellow-800'
  }

  if (status === 'cancelled') {
    return darkMode ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30' : 'bg-red-100 text-red-800'
  }

  return darkMode ? 'bg-slate-500/20 text-slate-200 border border-slate-500/30' : 'bg-gray-100 text-gray-800'
}

function getPaymentStatusClass(status: string) {
  if (status === 'paid') {
    return 'bg-green-100 text-green-800'
  }
  if (status === 'partial') {
    return 'bg-blue-100 text-blue-800'
  }
  // Unpaid needs to read as "money outstanding, act on this" rather than as a
  // neutral in-progress state, so it is deliberately louder than the rest.
  if (status === 'unpaid') {
    return 'bg-orange-100 text-orange-800 border border-orange-300'
  }
  return 'bg-yellow-100 text-yellow-800'
}

/**
 * How much longer an unpaid booking keeps its vehicle reserved.
 *
 * hold_expires_at is a TIMESTAMPTZ (a real instant), so it is parsed with
 * new Date() — not the IST wall-clock helpers used for start/end datetimes.
 */
function formatHoldRemaining(holdExpiresAt: string | null | undefined) {
  if (!holdExpiresAt) return null
  const expiresMs = new Date(holdExpiresAt).getTime()
  if (Number.isNaN(expiresMs)) return null

  const diff = expiresMs - Date.now()
  if (diff <= 0) return { label: 'payment window expired — slot reopened', expired: true }

  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return { label: `vehicle held ${days}d ${hours}h more`, expired: false }
  if (hours > 0) return { label: `vehicle held ${hours}h ${minutes}m more`, expired: false }
  return { label: `vehicle held ${minutes}m more`, expired: false }
}

function bookingTypeLabel(type: string | null | undefined) {
  if (type === 'taxi') return 'Taxi'
  if (type === 'tour') return 'Tour'
  return type ?? '-'
}

function compactLabel(value: string | null | undefined, maxLength = 18) {
  const text = value?.trim()
  if (!text) return null
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

function getCarClassFromCapacity(capacityValue: string | number): string {
  const capacity = typeof capacityValue === 'number' ? capacityValue : parseInt(capacityValue, 10)
  if (!Number.isFinite(capacity) || capacity <= 0) return 'Economy'
  if (capacity <= 4) return 'Economy'
  if (capacity <= 6) return 'Premium'
  if (capacity <= 8) return 'Luxury'
  return 'Group'
}

function getMostCommonValue<T extends string | number>(values: T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1))
  let winner = values[0]
  let maxCount = 0
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count
      winner = value
    }
  })
  return winner
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function normalizeModel(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenDistanceThreshold(token: string) {
  return Math.max(1, Math.ceil(token.length * 0.25))
}

function normalizedDistance(a: string, b: string) {
  return levenshtein(a, b) / Math.max(a.length, b.length, 1)
}

function tokenMatchScore(inputToken: string, candidateToken: string): number | null {
  if (!inputToken || !candidateToken) return null
  if (inputToken === candidateToken) return 0
  if (candidateToken.startsWith(inputToken) || inputToken.startsWith(candidateToken)) return 0.08
  if (candidateToken.includes(inputToken) || inputToken.includes(candidateToken)) return 0.14

  const distance = levenshtein(inputToken, candidateToken)
  if (distance <= tokenDistanceThreshold(inputToken)) {
    return distance / Math.max(inputToken.length, candidateToken.length, 1)
  }

  return null
}

function scoreModelSimilarity(input: string, candidate: string): number | null {
  const inputNorm = normalizeModel(input)
  const candidateNorm = normalizeModel(candidate)

  if (!inputNorm || !candidateNorm || inputNorm === candidateNorm) return null

  const inputTokens = inputNorm.split(' ').filter(Boolean)
  const candidateTokens = candidateNorm.split(' ').filter(Boolean)

  if (inputTokens.length > 0 && candidateTokens.length > 0) {
    const tokenScores = inputTokens.map((inputToken) => {
      const scores = candidateTokens
        .map((candidateToken) => tokenMatchScore(inputToken, candidateToken))
        .filter((score): score is number => score !== null)
      return scores.length > 0 ? Math.min(...scores) : null
    })

    const matchedCount = tokenScores.filter((score): score is number => score !== null).length
    const minRequiredMatches = inputTokens.length === 1 ? 1 : Math.max(2, Math.ceil(inputTokens.length * 0.7))

    if (matchedCount >= minRequiredMatches) {
      const averageTokenScore = tokenScores
        .filter((score): score is number => score !== null)
        .reduce((sum, score) => sum + score, 0) / matchedCount
      const extraWordPenalty = Math.max(0, candidateTokens.length - matchedCount) * 0.025
      const orderedPhraseBonus = candidateNorm.includes(inputNorm) ? 0.08 : 0
      return Math.max(0, averageTokenScore + extraWordPenalty - orderedPhraseBonus)
    }
  }

  const candidatePrefixes = new Set<string>([candidateNorm])
  if (candidateTokens.length > inputTokens.length && inputTokens.length > 0) {
    candidatePrefixes.add(candidateTokens.slice(0, inputTokens.length).join(' '))
  }
  if (candidateTokens.length >= 2) {
    candidatePrefixes.add(candidateTokens.slice(0, 2).join(' '))
  }

  const phraseScores = Array.from(candidatePrefixes)
    .map((form) => normalizedDistance(inputNorm, form))
    .filter((score) => score <= 0.24)

  if (phraseScores.length > 0) {
    return Math.min(...phraseScores) + 0.18
  }

  return null
}

function findSimilarModels(input: string, candidates: string[]): string[] {
  const inputNorm = normalizeModel(input)
  if (!inputNorm) return []
  return candidates
    .map((model) => ({ model, score: scoreModelSimilarity(inputNorm, model) }))
    .filter((entry): entry is { model: string; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.model.length - b.model.length || a.model.localeCompare(b.model))
    .map((entry) => entry.model)
}

function adminHeaders(extra: Record<string, string> = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

function getSeverityClass(severity: string) {
  if (severity === 'error') return 'bg-red-100 text-red-800'
  if (severity === 'warn') return 'bg-amber-100 text-amber-800'
  if (severity === 'security') return 'bg-purple-100 text-purple-800'
  return 'bg-blue-100 text-blue-800'
}

function hasAdminToken(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem('adminToken')
}

export default function AdminDashboard() {
  const router = useRouter()
  const { logout, adminEmail, adminFullName, updateAdminProfile } = useAdmin()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assignmentFilter, setAssignmentFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [bookingSearchQuery, setBookingSearchQuery] = useState('')
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [vehicleAssignments, setVehicleAssignments] = useState<VehicleAssignment[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [cars, setCars] = useState<Car[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [loadingCars, setLoadingCars] = useState(true)
  const [loadingDestinations, setLoadingDestinations] = useState(true)
  const [loadingTours, setLoadingTours] = useState(true)
  const [navigatingToDocs, setNavigatingToDocs] = useState(false)
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null)
  const [expandedCarId, setExpandedCarId] = useState<string | null>(null)
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null)
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState(0)
  const [scheduleFocusDate, setScheduleFocusDate] = useState<string>('')
  const [selectedScheduleAssignment, setSelectedScheduleAssignment] = useState<{ assignment: VehicleAssignment; booking: Booking | undefined; car: Car } | null>(null)
  const [carSearchQuery, setCarSearchQuery] = useState('')
  const [carFilterStatus, setCarFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [carFilterClass, setCarFilterClass] = useState('')
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('')
  const [scheduleFilterStatus, setScheduleFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [scheduleFilterClass, setScheduleFilterClass] = useState('')
  const scheduleDateInputRef = useRef<HTMLInputElement>(null)
  const [showAddCar, setShowAddCar] = useState(false)
  const [carModelWarning, setCarModelWarning] = useState<string[]>([])
  const [carModelWarningSource, setCarModelWarningSource] = useState<'existing' | 'library' | null>(null)
  const [carModelLibrary, setCarModelLibrary] = useState<string[]>([])
  const [lastCarModelSuggestions, setLastCarModelSuggestions] = useState<string[]>([])
  const [lastCarModelSuggestionSource, setLastCarModelSuggestionSource] = useState<'existing' | 'library' | null>(null)
  const [showAddDestination, setShowAddDestination] = useState(false)
  const [showAddTour, setShowAddTour] = useState(false)
  const [editingCar, setEditingCar] = useState<Car | null>(null)
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null)
  const [editingTour, setEditingTour] = useState<Tour | null>(null)
  const [formData, setFormData] = useState({
    model_name: '',
    class: '',
    number_plate: '',
    capacity: '',
    driver_name: '',
    driver_phone: '',
    driver_email: '',
    driver_verified: false,
  })
  const [destinationData, setDestinationData] = useState({
    name: '',
    duration_hours: '',
    duration_mins: '0',
    description: '',
  })
  const [showDestinationFareModal, setShowDestinationFareModal] = useState(false)
  const [selectedDestinationForFares, setSelectedDestinationForFares] = useState<Destination | null>(null)
  const [destinationFaresDraft, setDestinationFaresDraft] = useState<Record<string, string>>({})
  const [loadingDestinationFares, setLoadingDestinationFares] = useState(false)
  const [savingDestinationFares, setSavingDestinationFares] = useState(false)
  const [tourData, setTourData] = useState<{
    name: string; description: string; arrival_time: string; duration_hours: string;
    price: string; max_passengers: string; car_model: string; itinerary: string;
    highlights: string; image_urls: string[];
  }>({
    name: '',
    description: '',
    arrival_time: '',
    duration_hours: '',
    price: '',
    max_passengers: '',
    car_model: '',
    itinerary: '',
    highlights: '',
    image_urls: [],
  })
  const [tourImageUploading, setTourImageUploading] = useState(false)
  const [tourImageUrlInput, setTourImageUrlInput] = useState('')
  const [showCashCollectionModal, setShowCashCollectionModal] = useState(false)
  const [selectedPaymentForCash, setSelectedPaymentForCash] = useState<Payment | null>(null)
  const [selectedBookingForCash, setSelectedBookingForCash] = useState<Booking | null>(null)
  const [cashCollectionData, setCashCollectionData] = useState({
    amount_cash_paid: '',
    cash_collected_by: '',
  })
  const [submittingCashPayment, setSubmittingCashPayment] = useState(false)
  const [showVehicleAssignmentModal, setShowVehicleAssignmentModal] = useState(false)
  const [selectedPaymentForVehicle, setSelectedPaymentForVehicle] = useState<Payment | null>(null)
  const [selectedBookingForVehicle, setSelectedBookingForVehicle] = useState<Booking | null>(null)
  const [selectedCarForAssignment, setSelectedCarForAssignment] = useState<Car | null>(null)
  const [submittingVehicleAssignment, setSubmittingVehicleAssignment] = useState(false)
  const [confirmBookedCarAssignment, setConfirmBookedCarAssignment] = useState<Car | null>(null)
  const [confirmLowCapacityCarAssignment, setConfirmLowCapacityCarAssignment] = useState<Car | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null)
  const [processingCancellationId, setProcessingCancellationId] = useState<string | null>(null)
  const [cancellationRefundAmount, setCancellationRefundAmount] = useState<Record<string, string>>({})
  const [cancellationRefundNotes, setCancellationRefundNotes] = useState<Record<string, string>>({})
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('adminDarkMode') === '1'
  })
  // Collapsed hides the tab bar down to a single reopen button — useful on
  // screens like Fleet Schedule where the sticky bar eats vertical space.
  const [tabBarCollapsed, setTabBarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('adminTabBarCollapsed') === '1'
  })
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [adminFormData, setAdminFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  })
  const [submittingAdmin, setSubmittingAdmin] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editProfileData, setEditProfileData] = useState({
    full_name: adminFullName || '',
    email: adminEmail || '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  })
  const [submittingProfile, setSubmittingProfile] = useState(false)
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotalPages, setLogsTotalPages] = useState(1)
  const [logsSeverity, setLogsSeverity] = useState<'all' | 'info' | 'warn' | 'error' | 'security'>('all')
  const [logsEventType, setLogsEventType] = useState('')
  const [logsQuery, setLogsQuery] = useState('')
  const [logsMaxRows, setLogsMaxRows] = useState<number>(2000)
  const [savingLogsMaxRows, setSavingLogsMaxRows] = useState(false)
  const [editingLogsMaxRows, setEditingLogsMaxRows] = useState(false)
  const [logsMaxRowsDraft, setLogsMaxRowsDraft] = useState<number>(2000)

  // Conflict control feature
  const [conflictControlEnabled, setConflictControlEnabled] = useState(true)
  const [loadingConflictSetting, setLoadingConflictSetting] = useState(true)
  const [showConflictOffWarning, setShowConflictOffWarning] = useState(false)
  const [togglingConflictControl, setTogglingConflictControl] = useState(false)
  type ConflictData = { assignment_conflicts: any[]; model_conflicts: any[]; total: number }
  const [conflictData, setConflictData] = useState<ConflictData | null>(null)
  const [loadingConflicts, setLoadingConflicts] = useState(false)

  // Pending booking cleanup
  const [pendingTimeoutDays, setPendingTimeoutDays] = useState<number>(1)
  const [savingPendingTimeout, setSavingPendingTimeout] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [autoCleanupEnabled, setAutoCleanupEnabled] = useState(true)
  const [togglingAutoCleanup, setTogglingAutoCleanup] = useState(false)

  // Free ("pay later") booking controls. Defaults mirror sql/free_booking.sql
  // and lib/free-booking.ts so the panel shows the truth before settings load.
  const [freeBookingTaxi, setFreeBookingTaxi] = useState(true)
  const [freeBookingTour, setFreeBookingTour] = useState(true)
  const [freeHoldTaxi, setFreeHoldTaxi] = useState(48)
  const [freeHoldTour, setFreeHoldTour] = useState(24)
  const [freeMinLead, setFreeMinLead] = useState(0)
  const [freeMaxOpen, setFreeMaxOpen] = useState(2)
  const [freeMaxAdvance, setFreeMaxAdvance] = useState(90)
  const [savingFreeSetting, setSavingFreeSetting] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.style.overflowY = 'auto'
    document.body.style.overflowY = 'auto'
    document.documentElement.style.overflowX = 'hidden'
    document.body.style.overflowX = 'hidden'

    // Smooth wheel scrolling for the admin scroll container
    const scroller = scrollRef.current
    if (!scroller) return
    let targetTop = scroller.scrollTop
    const onWheel = (e: WheelEvent) => {
      // only handle vertical scroll
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      targetTop = Math.min(max, Math.max(0, targetTop + e.deltaY))
      gsap.to(scroller, { scrollTop: targetTop, duration: 0.65, ease: 'power3.out', overwrite: true })
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [])

  // ── Clear cache and logout on admin page load ─────────────────────────────
  useEffect(() => {
    // Clear all browser storage (cache, session, local data)
    // Preserve admin UI preferences and auth token before clearing
    const adminDarkMode = localStorage.getItem('adminDarkMode')
    const adminToken = localStorage.getItem('adminToken')
    localStorage.clear()
    sessionStorage.clear()
    if (adminDarkMode !== null) localStorage.setItem('adminDarkMode', adminDarkMode)
    if (adminToken !== null) localStorage.setItem('adminToken', adminToken)
    
    // Clear IndexedDB
    if (window.indexedDB) {
      const dbRequest = indexedDB.databases?.()
      if (dbRequest) {
        dbRequest.then((dbs) => {
          dbs.forEach((db) => {
            if (db.name) indexedDB.deleteDatabase(db.name)
          })
        })
      }
    }
    
    // Sign out any existing user sessions
    const signOutFromAuth = async () => {
      try {
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
      } catch (error) {
        console.error('Error signing out:', error)
      }
    }
    
    signOutFromAuth()
  }, [])

  const handleAdminLogout = async () => {
    toast.loading('Logging out...')
    try {
      await logout()
      toast.dismiss()
      toast.success('Logged out successfully')
      router.push('/admin-login')
    } catch (error) {
      toast.dismiss()
      toast.error('Error logging out')
    }
  }

  const loadPendingTimeoutSetting = async () => {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store', headers: adminHeaders() })
      const data = await res.json()
      if (data.success && data.settings) {
        for (const s of data.settings) {
          if (s.key === 'pending_booking_timeout_hours') setPendingTimeoutDays(Math.round((parseInt(s.value) || 24) / 24) || 1)
          if (s.key === 'auto_cleanup_enabled') setAutoCleanupEnabled(s.value !== 'false')
          if (s.key === 'system_logs_max_rows') {
            const value = Math.max(100, parseInt(s.value) || 2000)
            setLogsMaxRows(value)
            setLogsMaxRowsDraft(value)
          }
          // Only an explicit 'false' switches free booking off, matching the
          // server-side reading in lib/free-booking.
          if (s.key === 'free_booking_enabled_taxi') setFreeBookingTaxi(s.value !== 'false')
          if (s.key === 'free_booking_enabled_tour') setFreeBookingTour(s.value !== 'false')
          if (s.key === 'free_booking_hold_hours_taxi') setFreeHoldTaxi(Number(s.value) || 0)
          if (s.key === 'free_booking_hold_hours_tour') setFreeHoldTour(Number(s.value) || 0)
          if (s.key === 'free_booking_min_lead_hours') setFreeMinLead(Number(s.value) || 0)
          if (s.key === 'free_booking_max_open_per_user') setFreeMaxOpen(Number(s.value) || 0)
          if (s.key === 'free_booking_max_advance_days') setFreeMaxAdvance(Number(s.value) || 0)
        }
      }
    } catch {
      // keep defaults
    }
  }

  const saveFreeBookingSetting = async (key: string, value: string | number | boolean, label: string) => {
    setSavingFreeSetting(key)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key, value: String(value) }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success(`${label} saved.`)
    } catch {
      toast.error(`Failed to save ${label.toLowerCase()}.`)
    } finally {
      setSavingFreeSetting(null)
    }
  }

  const handleToggleAutoCleanup = async (newValue: boolean) => {
    setTogglingAutoCleanup(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key: 'auto_cleanup_enabled', value: String(newValue) }),
      })
      const data = await res.json()
      if (data.success) {
        setAutoCleanupEnabled(newValue)
        toast.success(`Auto-cleanup ${newValue ? 'enabled' : 'disabled'}.`)
      } else {
        throw new Error(data.error)
      }
    } catch {
      toast.error('Failed to update setting.')
    } finally {
      setTogglingAutoCleanup(false)
    }
  }

  const handleSavePendingTimeout = async () => {
    if (pendingTimeoutDays < 1 || pendingTimeoutDays > 30) {
      toast.error('Cleanup interval must be between 1 and 30 days.')
      return
    }
    setSavingPendingTimeout(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key: 'pending_booking_timeout_hours', value: String(pendingTimeoutDays * 24) }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Cleanup interval set to ${pendingTimeoutDays} day${pendingTimeoutDays !== 1 ? 's' : ''}.`)
      } else {
        throw new Error(data.error)
      }
    } catch {
      toast.error('Failed to save setting.')
    } finally {
      setSavingPendingTimeout(false)
    }
  }

  const handleCleanupPending = async () => {
    setCleaningUp(true)
    try {
      const res = await fetch('/api/admin/cleanup-pending', { method: 'POST', headers: adminHeaders() })
      const data = await res.json()
      if (data.success) {
        if (data.skipped) {
          toast.error('Auto-cleanup is disabled. Enable it in settings first.')
        } else if (data.deleted > 0) {
          toast.success(`Cleaned up ${data.deleted} expired pending booking${data.deleted !== 1 ? 's' : ''}.`)
          loadBookings()
        } else {
          toast.success('No expired pending bookings found.')
        }
      } else {
        toast.error('Cleanup failed.')
      }
    } catch {
      toast.error('Cleanup failed.')
    } finally {
      setCleaningUp(false)
    }
  }

  const handleReconcilePayments = async () => {
    setReconciling(true)
    try {
      const res = await fetch('/api/admin/reconcile-payments?days=7', { method: 'POST', headers: adminHeaders() })
      const data = await res.json()
      if (data.success) {
        const healed = data.healed || 0
        if (healed > 0) {
          toast.success(`Reconciled — recorded ${healed} missing payment${healed !== 1 ? 's' : ''}.`)
          loadBookings()
          loadPayments()
        } else {
          toast.success('All payments are in sync — nothing to heal.')
        }
        if (data.confirmedWithoutPayment > 0) {
          toast(`⚠️ ${data.confirmedWithoutPayment} confirmed booking(s) still have no payment — check Logs.`, { icon: '⚠️' })
        }
      } else {
        toast.error('Reconciliation failed.')
      }
    } catch {
      toast.error('Reconciliation failed.')
    } finally {
      setReconciling(false)
    }
  }

  useEffect(() => {
    if (!hasAdminToken()) {
      setLoadingBookings(false)
      setLoadingPayments(false)
      setLoadingCars(false)
      setLoadingDestinations(false)
      setLoadingTours(false)
      router.replace('/admin-login')
      return
    }
    loadBookings()
    loadPayments()
    loadVehicleAssignments()
    loadCars()
    loadCarModelLibrary()
    loadDestinations()
    loadTours()
    loadConflictSetting()
    loadPendingTimeoutSetting()
  }, [router])

  useEffect(() => {
    if (activeTab !== 'logs') return
    loadLogs(logsPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logsPage, logsSeverity, logsEventType, logsQuery])

  const loadConflictSetting = async () => {
    setLoadingConflictSetting(true)
    try {
      const res = await fetch('/api/admin/settings?key=conflict_control_enabled', { cache: 'no-store', headers: adminHeaders() })
      const data = await res.json()
      if (data.success && data.settings?.length > 0) {
        setConflictControlEnabled(data.settings[0].value !== 'false')
      }
    } catch {
      // default to enabled if fetch fails
    } finally {
      setLoadingConflictSetting(false)
    }
  }

  const fetchConflicts = async () => {
    setLoadingConflicts(true)
    try {
      const res = await fetch('/api/admin/conflicts', { cache: 'no-store', headers: adminHeaders() })
      const data = await res.json()
      if (data.success) setConflictData(data)
    } catch {
      toast.error('Failed to fetch conflict data')
    } finally {
      setLoadingConflicts(false)
    }
  }

  const handleToggleConflictControl = async (newValue: boolean) => {
    setTogglingConflictControl(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key: 'conflict_control_enabled', value: String(newValue) }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setConflictControlEnabled(newValue)
      setShowConflictOffWarning(false)
      toast.success(`Conflict control ${newValue ? 'enabled' : 'disabled'}.`)
      if (newValue) {
        // Turned ON — fetch conflicts immediately so admin can resolve them
        await fetchConflicts()
      } else {
        setConflictData(null)
      }
    } catch (err) {
      toast.error('Failed to update setting')
    } finally {
      setTogglingConflictControl(false)
    }
  }

  const loadBookings = async () => {
    setLoadingBookings(true)
    if (!hasAdminToken()) {
      setBookings([])
      setLoadingBookings(false)
      return
    }

    try {
      const response = await fetch('/api/bookings/admin', {
        method: 'GET',
        cache: 'no-store',
        headers: adminHeaders({ 'Cache-Control': 'no-cache' }),
      })
      const result: AdminApiResponse = await response.json()

      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          setBookings([])
          return
        }
        throw new Error(result.error || 'Failed to fetch bookings')
      }

      setBookings(result.bookings || [])
    } catch (error) {
      console.error('Error loading admin bookings:', error)
      if (hasAdminToken()) toast.error('Failed to load booking data')
      setBookings([])
    } finally {
      setLoadingBookings(false)
    }
  }

  const loadPayments = async () => {
    setLoadingPayments(true)
    if (!hasAdminToken()) {
      setPayments([])
      setLoadingPayments(false)
      return
    }

    try {
      const response = await fetch('/api/payment/get-all', {
        method: 'GET',
        cache: 'no-store',
        headers: adminHeaders({ 'Cache-Control': 'no-cache' }),
      })
      const result: PaymentsResponse = await response.json()

      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          setPayments([])
          return
        }
        throw new Error(result.error || 'Failed to fetch payments')
      }

      setPayments(result.payments || [])
    } catch (error) {
      console.error('Error loading payments:', error)
      // Don't show error toast as payments might not exist yet
      setPayments([])
    } finally {
      setLoadingPayments(false)
    }
  }

  const loadVehicleAssignments = async () => {
    if (!hasAdminToken()) {
      setVehicleAssignments([])
      return
    }
    try {
      const response = await fetch('/api/bookings/get-assignments', {
        method: 'GET',
        cache: 'no-store',
        headers: adminHeaders({ 'Cache-Control': 'no-cache' }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          setVehicleAssignments([])
          return
        }
        console.warn('Failed to fetch vehicle assignments')
        setVehicleAssignments([])
        return
      }

      setVehicleAssignments(result.assignments || [])
    } catch (error) {
      console.error('Error loading vehicle assignments:', error)
      setVehicleAssignments([])
    }
  }

  const loadCars = async () => {
    setLoadingCars(true)
    if (!hasAdminToken()) {
      setCars([])
      setLoadingCars(false)
      return
    }

    try {
      const response = await fetch('/api/cars?include_inactive=true', { method: 'GET', headers: adminHeaders() })
      const result: CarsResponse = await response.json()

      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          setCars([])
          return
        }
        throw new Error(result.error || 'Failed to fetch cars')
      }

      setCars(result.cars || [])
    } catch (error) {
      console.error('Error loading cars:', error)
      if (hasAdminToken()) toast.error('Failed to load cars data')
      setCars([])
    } finally {
      setLoadingCars(false)
    }
  }

  const loadCarModelLibrary = async () => {
    if (!hasAdminToken()) {
      setCarModelLibrary([])
      return
    }

    try {
      const response = await fetch('/api/admin/car-model-library', {
        method: 'GET',
        cache: 'no-store',
        headers: adminHeaders({ 'Cache-Control': 'no-cache' }),
      })
      const result: CarModelLibraryResponse = await response.json()

      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          setCarModelLibrary([])
          return
        }
        throw new Error(result.error || 'Failed to fetch car model library')
      }

      setCarModelLibrary(result.models || [])
    } catch (error) {
      console.error('Error loading car model library:', error)
      setCarModelLibrary([])
    }
  }

  const updateCarModelSuggestions = (rawInput: string) => {
    const input = rawInput.trim()

    if (input.length < 3) {
      setCarModelWarning([])
      setCarModelWarningSource(null)
      setLastCarModelSuggestions([])
      setLastCarModelSuggestionSource(null)
      return
    }

    const allModels = [...new Set(cars.map(c => c.model_name))]
    const candidates = editingCar
      ? allModels.filter(m => normalizeModel(m) !== normalizeModel(editingCar.model_name))
      : allModels
    const referenceModels = carModelLibrary.filter(
      (model) => !allModels.some(existing => normalizeModel(existing) === normalizeModel(model))
    )
    const exactMatch = allModels.some(m => normalizeModel(m) === normalizeModel(input))
    const exactReferenceMatch = referenceModels.some(
      (model) => normalizeModel(model) === normalizeModel(input)
    )

    if (exactMatch || exactReferenceMatch) {
      setCarModelWarning([])
      setCarModelWarningSource(null)
      setLastCarModelSuggestions([])
      setLastCarModelSuggestionSource(null)
      return
    }

    const existingMatches = findSimilarModels(input, candidates).slice(0, 4)
    if (existingMatches.length > 0) {
      setCarModelWarning(existingMatches)
      setCarModelWarningSource('existing')
      setLastCarModelSuggestions(existingMatches)
      setLastCarModelSuggestionSource('existing')
      return
    }

    const referenceMatches = findSimilarModels(input, referenceModels).slice(0, 4)
    setCarModelWarning(referenceMatches)
    setCarModelWarningSource(referenceMatches.length > 0 ? 'library' : null)
    setLastCarModelSuggestions(referenceMatches)
    setLastCarModelSuggestionSource(referenceMatches.length > 0 ? 'library' : null)
  }

  const autoFillCarSpecsFromModel = (rawModelName: string) => {
    if (editingCar) return
    const modelName = rawModelName.trim()
    if (!modelName) return

    const exactMatches = cars.filter(
      (car) => normalizeModel(car.model_name) === normalizeModel(modelName)
    )
    if (exactMatches.length === 0) return

    const commonCapacity = getMostCommonValue(exactMatches.map((car) => car.capacity))
    const commonClass = getMostCommonValue(exactMatches.map((car) => car.class))

    setFormData((prev) => ({
      ...prev,
      model_name: modelName,
      capacity: commonCapacity ? String(commonCapacity) : prev.capacity,
      class: commonClass || prev.class,
    }))
  }

  const loadDestinations = async () => {
    setLoadingDestinations(true)

    try {
      const response = await fetch('/api/destinations', { method: 'GET' })
      const result: DestinationsResponse = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch destinations')
      }

      setDestinations(result.destinations || [])
    } catch (error) {
      console.error('Error loading destinations:', error)
      toast.error('Failed to load destinations data')
      setDestinations([])
    } finally {
      setLoadingDestinations(false)
    }
  }

  const loadTours = async () => {
    setLoadingTours(true)

    try {
      const response = await fetch('/api/tours', { method: 'GET' })
      const result: ToursResponse = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch tours')
      }

      setTours(result.tours || [])
    } catch (error) {
      console.error('Error loading tours:', error)
      toast.error('Failed to load tours data')
      setTours([])
    } finally {
      setLoadingTours(false)
    }
  }

  const handleSaveLogsMaxRows = async () => {
    const nextValue = Math.floor(logsMaxRowsDraft)
    if (!Number.isFinite(nextValue) || nextValue < 100 || nextValue > 50000) {
      toast.error('Logs limit must be between 100 and 50,000 rows.')
      return
    }
    setSavingLogsMaxRows(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key: 'system_logs_max_rows', value: String(nextValue) }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to save logs setting')
      setLogsMaxRows(nextValue)
      setLogsMaxRowsDraft(nextValue)
      setEditingLogsMaxRows(false)
      toast.success(`Logs retention set to ${nextValue.toLocaleString('en-IN')} rows.`)
    } catch (error) {
      console.error('Error saving logs max rows:', error)
      toast.error('Failed to save logs retention setting.')
    } finally {
      setSavingLogsMaxRows(false)
    }
  }

  const loadLogs = async (page = logsPage) => {
    setLoadingLogs(true)
    if (!hasAdminToken()) {
      setLogs([])
      setLogsTotalPages(1)
      setLoadingLogs(false)
      return
    }
    try {
      const sp = new URLSearchParams()
      sp.set('page', String(page))
      sp.set('limit', '30')
      if (logsSeverity !== 'all') sp.set('severity', logsSeverity)
      if (logsEventType.trim()) sp.set('event_type', logsEventType.trim())
      if (logsQuery.trim()) sp.set('q', logsQuery.trim())

      const response = await fetch(`/api/admin/logs?${sp.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: adminHeaders({ 'Cache-Control': 'no-cache' }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        if (response.status === 401 || response.status === 403) {
          setLogs([])
          setLogsTotalPages(1)
          return
        }
        throw new Error(result.error || 'Failed to fetch logs')
      }

      setLogs(result.logs || [])
      setLogsPage(result.pagination?.page || page)
      setLogsTotalPages(result.pagination?.total_pages || 1)
    } catch (error) {
      console.error('Error loading logs:', error)
      if (hasAdminToken()) toast.error('Failed to load system logs')
      setLogs([])
      setLogsTotalPages(1)
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleTourImageUpload = async (file: File) => {
    try {
      setTourImageUploading(true)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/tours/upload-image', {
        method: 'POST',
        headers: adminHeaders(),
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to upload image')
      }

      setTourData(prev => ({ ...prev, image_urls: [...prev.image_urls, result.url] }))
      toast.success('Image uploaded successfully!')
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setTourImageUploading(false)
    }
  }

  const handleAddTour = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tourData.name || !tourData.price) {
      toast.error('Please fill required fields (name and price)')
      return
    }

    try {
      const highlights = tourData.highlights
        ? tourData.highlights.split(',').map((h) => h.trim()).filter((h) => h)
        : []

      const response = await fetch('/api/tours', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...tourData, highlights }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to add tour')
      }

      toast.success('Tour added successfully!')
      setTourData({
        name: '',
        description: '',
        arrival_time: '',
        duration_hours: '',
        price: '',
        max_passengers: '',
        car_model: '',
        itinerary: '',
        highlights: '',
        image_urls: [],
      })
      setTourImageUrlInput('')
      setShowAddTour(false)
      loadTours()
    } catch (error) {
      console.error('Error adding tour:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add tour')
    }
  }

  const handleUpdateTour = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingTour) return

    if (!tourData.name || !tourData.price) {
      toast.error('Please fill required fields (name and price)')
      return
    }

    try {
      const highlights = tourData.highlights
        ? tourData.highlights.split(',').map((h) => h.trim()).filter((h) => h)
        : []

      const response = await fetch(`/api/tours/${editingTour.id}`, {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...tourData, highlights }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update tour')
      }

      toast.success('Tour updated successfully!')
      setTourData({
        name: '',
        description: '',
        arrival_time: '',
        duration_hours: '',
        price: '',
        max_passengers: '',
        car_model: '',
        itinerary: '',
        highlights: '',
        image_urls: [],
      })
      setTourImageUrlInput('')
      setEditingTour(null)
      loadTours()
    } catch (error) {
      console.error('Error updating tour:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update tour')
    }
  }

  const handleDeleteTour = async (tourId: string) => {
    if (!window.confirm('Are you sure you want to delete this tour?')) return

    try {
      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete tour')
      }

      toast.success('Tour deleted successfully!')
      loadTours()
    } catch (error) {
      console.error('Error deleting tour:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete tour')
    }
  }

  const startEditTour = (tour: Tour) => {
    setEditingTour(tour)
    // Normalize both legacy timestamp values and new HH:mm values to time-only.
    let arrivalTimeLocal = ''
    if (tour.arrival_time) {
      const match = String(tour.arrival_time).match(/[T\s]?(\d{2}):(\d{2})/)
      arrivalTimeLocal = match ? `${match[1]}:${match[2]}` : ''
    }
    setTourData({
      name: tour.name,
      description: tour.description || '',
      arrival_time: arrivalTimeLocal,
      duration_hours: tour.duration_hours?.toString() || '',
      price: tour.price.toString(),
      max_passengers: tour.max_passengers?.toString() || '',
      car_model: tour.car_model || '',
      itinerary: tour.itinerary || '',
      highlights: tour.highlights?.join(', ') || '',
      image_urls: tour.image_urls?.length ? tour.image_urls : (tour.image_url ? [tour.image_url] : []),
    })
    setTourImageUrlInput('')
    setShowAddTour(false)
  }

  const cancelEditTour = () => {
    setEditingTour(null)
    setTourData({
      name: '',
      description: '',
      arrival_time: '',
      duration_hours: '',
      price: '',
      max_passengers: '',
      car_model: '',
      itinerary: '',
      highlights: '',
      image_urls: [],
    })
    setTourImageUrlInput('')
    setShowAddTour(false)
  }

  const handleDeleteTourImage = async (urlToDelete: string, index: number) => {
    const match = urlToDelete.match(/\/tour_images\/([^?#]+)/)
    if (match) {
      await fetch(`/api/tours/upload-image?filename=${encodeURIComponent(match[1])}`, { method: 'DELETE', headers: adminHeaders() })
    }
    setTourData(prev => ({ ...prev, image_urls: prev.image_urls.filter((_, i) => i !== index) }))
  }

  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault()

    const durationMins = parseInt(destinationData.duration_hours || '0') * 60 + parseInt(destinationData.duration_mins || '0')
    if (!destinationData.name || durationMins <= 0) {
      toast.error('Please fill all required fields including a valid duration')
      return
    }

    try {
      const response = await fetch('/api/destinations', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: destinationData.name,
          estimated_duration_minutes: durationMins,
          description: destinationData.description,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to add destination')
      }

      toast.success('Destination added successfully!')
      setDestinationData({ name: '', duration_hours: '', duration_mins: '0', description: '' })
      setShowAddDestination(false)
      loadDestinations()
    } catch (error) {
      console.error('Error adding destination:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add destination')
    }
  }

  const handleUpdateDestination = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingDestination) return

    const durationMins = parseInt(destinationData.duration_hours || '0') * 60 + parseInt(destinationData.duration_mins || '0')
    if (!destinationData.name || durationMins <= 0) {
      toast.error('Please fill all required fields including a valid duration')
      return
    }

    try {
      const response = await fetch(`/api/destinations/${editingDestination.id}`, {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: destinationData.name,
          estimated_duration_minutes: durationMins,
          description: destinationData.description,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update destination')
      }

      toast.success('Destination updated successfully!')
      setDestinationData({ name: '', duration_hours: '', duration_mins: '0', description: '' })
      setEditingDestination(null)
      loadDestinations()
    } catch (error) {
      console.error('Error updating destination:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update destination')
    }
  }

  const handleDeleteDestination = async (destinationId: string) => {
    if (!window.confirm('Are you sure you want to delete this destination?')) return

    try {
      const response = await fetch(`/api/destinations/${destinationId}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete destination')
      }

      toast.success('Destination deleted successfully!')
      loadDestinations()
    } catch (error) {
      console.error('Error deleting destination:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete destination')
    }
  }

  const openDestinationFareModal = async (destination: Destination) => {
    console.log('[ADMIN] Opening destination fare modal for:', destination.id, destination.name)
    setSelectedDestinationForFares(destination)
    setShowDestinationFareModal(true)
    setLoadingDestinationFares(true)
    try {
      const response = await fetch(`/api/admin/destination-fares?destination_id=${destination.id}`, {
        headers: adminHeaders(),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load destination fares')
      }

      const draft: Record<string, string> = {}
      ;(result.fares || []).forEach((row: DestinationFare) => {
        draft[row.model_name] = String(row.fixed_fare)
      })
      setDestinationFaresDraft(draft)
    } catch (error) {
      console.error('Error loading destination fares:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load destination fares')
      setDestinationFaresDraft({})
    } finally {
      setLoadingDestinationFares(false)
    }
  }

  const closeDestinationFareModal = () => {
    setShowDestinationFareModal(false)
    setSelectedDestinationForFares(null)
    setDestinationFaresDraft({})
    setLoadingDestinationFares(false)
    setSavingDestinationFares(false)
  }

  const handleSaveDestinationFares = async () => {
    if (!selectedDestinationForFares) return

    const fares = activeCarModels
      .map((modelName) => ({
        model_name: modelName,
        fixed_fare: Number(destinationFaresDraft[modelName] || 0),
      }))
      .filter((item) => Number.isFinite(item.fixed_fare) && item.fixed_fare > 0)

    setSavingDestinationFares(true)
    try {
      const response = await fetch('/api/admin/destination-fares', {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          destination_id: selectedDestinationForFares.id,
          fares,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save destination fares')
      }
      toast.success('Destination fares updated successfully!')
      closeDestinationFareModal()
    } catch (error) {
      console.error('Error saving destination fares:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save destination fares')
    } finally {
      setSavingDestinationFares(false)
    }
  }

  const startEditDestination = (destination: Destination) => {
    setEditingDestination(destination)
    setDestinationData({
      name: destination.name,
      duration_hours: String(Math.floor(destination.estimated_duration_minutes / 60)),
      duration_mins: String(destination.estimated_duration_minutes % 60),
      description: destination.description || '',
    })
    setShowAddDestination(false)
  }

  const cancelEditDestination = () => {
    setEditingDestination(null)
    setDestinationData({ name: '', duration_hours: '', duration_mins: '0', description: '' })
    setShowAddDestination(false)
  }

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.model_name || !formData.number_plate || !formData.capacity || !formData.driver_name || !formData.driver_phone) {
      toast.error('Please fill all required fields')
      return
    }

    const resolvedClass = formData.class || getCarClassFromCapacity(formData.capacity)

    try {
      const response = await fetch('/api/cars', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...formData, class: resolvedClass }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to add car')
      }

      toast.success('Car added successfully!')
      setCarModelWarning([])
      setCarModelWarningSource(null)
      setLastCarModelSuggestions([])
      setLastCarModelSuggestionSource(null)
      setFormData({
        model_name: '',
        class: '',
        capacity: '',
        number_plate: '',
        driver_name: '',
        driver_phone: '',
        driver_email: '',
        driver_verified: false,
      })
      setShowAddCar(false)
      loadCars()
    } catch (error) {
      console.error('Error adding car:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add car')
    }
  }

  const handleUpdateCar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingCar) return

    if (!formData.model_name || !formData.number_plate || !formData.capacity || !formData.driver_name || !formData.driver_phone) {
      toast.error('Please fill all required fields')
      return
    }

    const resolvedClass = formData.class || getCarClassFromCapacity(formData.capacity)

    try {
      const response = await fetch(`/api/cars/${editingCar.id}`, {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...formData, class: resolvedClass }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update car')
      }

      toast.success('Car updated successfully!')
      setCarModelWarning([])
      setCarModelWarningSource(null)
      setLastCarModelSuggestions([])
      setLastCarModelSuggestionSource(null)
      setFormData({
        model_name: '',
        class: '',
        capacity: '',
        number_plate: '',
        driver_name: '',
        driver_phone: '',
        driver_email: '',
        driver_verified: false,
      })
      setEditingCar(null)
      loadCars()
    } catch (error) {
      console.error('Error updating car:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update car')
    }
  }

  const handleDeleteCar = async (car: Car) => {
    const shortId = car.id.slice(0, 8)
    const warningMessage =
      `Permanently delete car ${car.model_name} (${car.number_plate})?\n\n` +
      'This will remove the car row from the database and cannot be undone.\n' +
      'If assignment history exists, those rows are kept and their linked car_id will be set to null.\n\n' +
      `Car ID: ${shortId}...`

    if (!window.confirm(warningMessage)) return
    if (!window.confirm('Final warning: permanently delete this car row now?')) return

    try {
      const response = await fetch(`/api/cars/${car.id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to permanently delete car')
      }
      toast.success('Car permanently deleted!')
      loadCars()
    } catch (error) {
      console.error('Error deleting car permanently:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to permanently delete car')
    }
  }

  const handleToggleCarActive = async (car: Car) => {
    try {
      const newStatus = !car.is_active
      const response = await fetch(`/api/cars/${car.id}`, {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ is_active: newStatus }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update car status')
      }

      toast.success(newStatus ? 'Car activated!' : 'Car deactivated!')
      loadCars()
    } catch (error) {
      console.error('Error toggling car status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update car status')
    }
  }

  const startEditCar = (car: Car) => {
    setEditingCar(car)
    setCarModelWarning([])
    setCarModelWarningSource(null)
    setLastCarModelSuggestions([])
    setLastCarModelSuggestionSource(null)
    setFormData({
      model_name: car.model_name,
      class: car.class,
      number_plate: car.number_plate,
      capacity: car.capacity.toString(),
      driver_name: car.driver_name,
      driver_phone: car.driver_phone,
      driver_email: car.driver_email || '',
      driver_verified: car.driver_verified,
    })
    setShowAddCar(false)
  }

  const cancelEdit = () => {
    setEditingCar(null)
    setCarModelWarning([])
    setCarModelWarningSource(null)
    setLastCarModelSuggestions([])
    setLastCarModelSuggestionSource(null)
    setFormData({
      model_name: '',
      class: '',
      number_plate: '',
      capacity: '',
      driver_name: '',
      driver_phone: '',
      driver_email: '',
      driver_verified: false,
    })
    setShowAddCar(false)
  }

  const todayDate = new Date().toISOString().slice(0, 10)
  const recentBookings = useMemo(() => bookings.slice(0, 5), [bookings])

  const filteredBookings = useMemo(() => {
    let result = bookings

    if (statusFilter !== 'all') {
      result = result.filter((booking) => booking.booking_status === statusFilter)
    }

    if (assignmentFilter !== 'all') {
      result = result.filter((booking) => {
        const assignment = vehicleAssignments.find(
          (va) => va.booking_id === (booking.booking_id || booking.id)
        )
        const isAssigned = Boolean(assignment)
        const hasLinkedCar = Boolean(
          assignment?.car_id && cars.some((car) => car.id === assignment.car_id)
        )
        const isAssignedCarDeleted = isAssigned && !hasLinkedCar

        if (assignmentFilter === 'assigned') return isAssigned
        if (assignmentFilter === 'unassigned') return !isAssigned
        if (assignmentFilter === 'assigned_deleted_car') return isAssignedCarDeleted
        return true
      })
    }

    if (paymentFilter !== 'all') {
      result = result.filter((booking) => {
        const payment = payments.find(
          (p) => p.booking_id === (booking.booking_id || booking.id)
        )
        // No payments row at all means nobody has committed money or intent —
        // an abandoned checkout. Group those with unpaid so the team sees
        // everything outstanding in one view. Cancelled bookings are excluded:
        // this filter is a follow-up queue, and there is nothing left to chase.
        if (paymentFilter === 'unpaid') {
          if (booking.booking_status === 'cancelled') return false
          return !payment || payment.payment_status === 'unpaid' || payment.payment_status === 'pending'
        }
        return payment?.payment_status === paymentFilter
      })
    }

    if (bookingSearchQuery.trim()) {
      const q = bookingSearchQuery.toLowerCase()
      result = result.filter((booking) => {
        const idToMatch = (booking.booking_id || booking.id).toLowerCase()
        return (
          booking.user_name?.toLowerCase().includes(q) ||
          booking.phone?.includes(q) ||
          idToMatch.includes(q)
        )
      })
    }

    return result
  }, [bookings, statusFilter, assignmentFilter, paymentFilter, payments, vehicleAssignments, cars, bookingSearchQuery])

  const filteredDestinations = useMemo(() => {
    const query = destinationSearchQuery.trim().toLowerCase()
    if (!query) return destinations

    return destinations.filter((destination) => (
      destination.name.toLowerCase().includes(query) ||
      (destination.description || '').toLowerCase().includes(query) ||
      destination.id.toLowerCase().includes(query)
    ))
  }, [destinations, destinationSearchQuery])

  const activeCarModels = useMemo(() => {
    const models = Array.from(
      new Set(
        cars
          .filter((car) => car.is_active)
          .map((car) => String(car.model_name || '').trim())
          .filter(Boolean)
      )
    )
    models.sort((a, b) => a.localeCompare(b))
    return models
  }, [cars])

  const destinationNameById = useMemo(
    () =>
      destinations.reduce<Record<string, string>>((acc, destination) => {
        acc[destination.id] = destination.name
        return acc
      }, {}),
    [destinations]
  )

  const tourNameById = useMemo(
    () =>
      tours.reduce<Record<string, string>>((acc, tour) => {
        acc[tour.id] = tour.name
        return acc
      }, {}),
    [tours]
  )

  const getBookingServiceLabel = (booking: Booking) => {
    if (booking.booking_type === 'tour' && booking.tour_package_id) {
      return tourNameById[booking.tour_package_id] || 'Tour package'
    }

    if (booking.destination_id) {
      return destinationNameById[booking.destination_id] || 'Destination unavailable'
    }

    return bookingTypeLabel(booking.booking_type)
  }

  const bookingPaymentById = useMemo(() => {
    const map = new Map<string, Payment>()
    payments.forEach((payment) => {
      if (!payment?.booking_id) return
      map.set(payment.booking_id, payment)
    })
    return map
  }, [payments])

  const revenueSnapshot = useMemo(() => {
    const isRevenueStatus = (status: string) => status === 'confirmed' || status === 'completed'

    const rows = bookings.map((booking) => {
      const bookingId = booking.booking_id || booking.id
      const status = booking.booking_status || 'pending'
      const payment = bookingPaymentById.get(bookingId)
      const amountTotal = toNum(booking.amount_total)
      const onlinePaid = toNum(payment?.amount_online_paid)
      const cashPaid = toNum(payment?.amount_cash_paid)
      const collected = onlinePaid + cashPaid
      const refundProcessed = payment?.refund_status === 'processed' ? Math.max(0, toNum(payment.refund_amount)) : 0
      const netCollected = Math.max(0, collected - refundProcessed)
      const outstanding = Math.max(0, amountTotal - collected)

      return {
        booking,
        bookingId,
        status,
        amountTotal,
        collected,
        netCollected,
        outstanding,
        refundProcessed,
        isRevenueStatus: isRevenueStatus(status),
      }
    })

    const revenueRows = rows.filter((row) => row.isRevenueStatus)
    const totalRevenue = revenueRows.reduce((sum, row) => sum + row.netCollected, 0)
    const totalOutstanding = revenueRows.reduce((sum, row) => sum + row.outstanding, 0)
    const billableValue = revenueRows.reduce((sum, row) => sum + row.amountTotal, 0)
    const paidRevenueRows = revenueRows.filter((row) => row.netCollected > 0)
    const averageBookingValue = paidRevenueRows.length > 0
      ? totalRevenue / paidRevenueRows.length
      : 0

    return {
      rows,
      revenueRows,
      totalRevenue,
      totalOutstanding,
      billableValue,
      averageBookingValue,
    }
  }, [bookings, bookingPaymentById])

  const stats = useMemo(() => {
    const totalRevenue = revenueSnapshot.totalRevenue
    const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.has(booking.booking_status)).length
    const completedToday = bookings.filter(
      (booking) => booking.booking_status === 'completed' && booking.start_datetime && booking.start_datetime.slice(0, 10) === todayDate
    ).length

    return {
      totalBookings: bookings.length,
      totalRevenue,
      activeBookings,
      completedToday,
    }
  }, [bookings, todayDate, revenueSnapshot.totalRevenue])

  // Handler to navigate to a booking in the All Bookings section
  const openBookingDetails = (bookingId: string) => {
    setActiveTab('bookings')
    setExpandedBookingId(bookingId)
  }

  // Open cash collection modal for a payment
  const openCashCollectionModal = (payment: Payment, booking: Booking) => {
    setSelectedPaymentForCash(payment)
    setSelectedBookingForCash(booking)
    const remainingBalance = Math.max(
      0,
      toNum(payment.amount_total) - (toNum(payment.amount_online_paid) + toNum(payment.amount_cash_paid))
    )
    setCashCollectionData({
      amount_cash_paid: remainingBalance.toFixed(2),
      cash_collected_by: '',
    })
    setShowCashCollectionModal(true)
  }

  // Close cash collection modal
  const closeCashCollectionModal = () => {
    setShowCashCollectionModal(false)
    setSelectedPaymentForCash(null)
    setSelectedBookingForCash(null)
    setCashCollectionData({
      amount_cash_paid: '',
      cash_collected_by: '',
    })
  }

  // Submit cash payment and update database
  const handleConfirmCashPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedPaymentForCash || !selectedBookingForCash) {
      toast.error('Invalid payment or booking data')
      return
    }

    if (!cashCollectionData.amount_cash_paid || !cashCollectionData.cash_collected_by) {
      toast.error('Please fill all required fields')
      return
    }

    const cashAmount = toNum(cashCollectionData.amount_cash_paid)
    if (cashAmount <= 0) {
      toast.error('Cash amount must be greater than 0')
      return
    }

    setSubmittingCashPayment(true)

    try {
      // Call API to update payment with cash collection details
      const response = await fetch('/api/payment/confirm-cash', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          payment_id: selectedPaymentForCash.id,
          booking_id: selectedPaymentForCash.booking_id,
          amount_cash_paid: cashAmount,
          cash_collected_by: cashCollectionData.cash_collected_by,
          user_email: selectedBookingForCash.user_email,
          user_name: selectedBookingForCash.user_name,
          amount_total: selectedPaymentForCash.amount_total,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to confirm cash payment')
      }

      toast.success('Cash payment confirmed! Invoice sent to customer email.')
      closeCashCollectionModal()
      
      // Reload payments and bookings to show updated data
      await loadPayments()
      await loadBookings()
    } catch (error) {
      console.error('Error confirming cash payment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to confirm cash payment')
    } finally {
      setSubmittingCashPayment(false)
    }
  }

  // Helper function: Check if a car is available (no conflicting assignments) for a booking's timeslot
  const isCarAvailableForBooking = (car: Car, booking: Booking): boolean => {
    const bookingStart = new Date(booking.start_datetime).getTime()
    const bookingEnd = new Date(booking.end_datetime).getTime()
    const currentBookingId = booking.booking_id || booking.id

    return !vehicleAssignments.some((assignment) => {
      // Skip if it's the same booking being reassigned
      if (assignment.booking_id === currentBookingId) return false
      
      if (assignment.car_id !== car.id) return false

      const assignmentStart = new Date(assignment.start_datetime).getTime()
      const assignmentEnd = new Date(assignment.end_datetime).getTime()

      // Check for overlap: booking_start < assignment_end AND booking_end > assignment_start
      return bookingStart < assignmentEnd && bookingEnd > assignmentStart
    })
  }

  // Helper function: Get conflicting assignment for display purposes
  const getConflictingAssignment = (car: Car, booking: Booking) => {
    const bookingStart = new Date(booking.start_datetime).getTime()
    const bookingEnd = new Date(booking.end_datetime).getTime()
    const currentBookingId = booking.booking_id || booking.id

    return vehicleAssignments.find((assignment) => {
      if (assignment.booking_id === currentBookingId) return false
      if (assignment.car_id !== car.id) return false

      const assignmentStart = new Date(assignment.start_datetime).getTime()
      const assignmentEnd = new Date(assignment.end_datetime).getTime()

      return bookingStart < assignmentEnd && bookingEnd > assignmentStart
    })
  }

  // Helper function: Check if car has sufficient capacity for the booking
  const hasInsufficientCapacity = (car: Car, booking: Booking): boolean => {
    return car.capacity < (booking.passenger_count ?? 0)
  }

  // Helper function: Handle car selection - check for conflicts AND capacity
  const handleCarSelectionForAssignment = (car: Car) => {
    if (!selectedBookingForVehicle) return

    // Check capacity first
    if (hasInsufficientCapacity(car, selectedBookingForVehicle)) {
      // Insufficient capacity, show confirmation
      setConfirmLowCapacityCarAssignment(car)
      setConfirmBookedCarAssignment(null)
      return
    }

    // Check if car is available
    if (isCarAvailableForBooking(car, selectedBookingForVehicle)) {
      // Car is available, select it directly
      setSelectedCarForAssignment(car)
      setConfirmBookedCarAssignment(null)
      setConfirmLowCapacityCarAssignment(null)
    } else {
      // Car is booked, show confirmation
      setConfirmBookedCarAssignment(car)
      setConfirmLowCapacityCarAssignment(null)
    }
  }

  // Helper function: Confirm selection of booked car
  const confirmBookedCarSelection = () => {
    if (confirmBookedCarAssignment) {
      setSelectedCarForAssignment(confirmBookedCarAssignment)
      setConfirmBookedCarAssignment(null)
    }
  }

  // Helper function: Confirm selection of low capacity car
  const confirmLowCapacityCarSelection = () => {
    if (confirmLowCapacityCarAssignment && selectedBookingForVehicle) {
      if (!isCarAvailableForBooking(confirmLowCapacityCarAssignment, selectedBookingForVehicle)) {
        setConfirmBookedCarAssignment(confirmLowCapacityCarAssignment)
        setConfirmLowCapacityCarAssignment(null)
        return
      }
      setSelectedCarForAssignment(confirmLowCapacityCarAssignment)
      setConfirmLowCapacityCarAssignment(null)
    }
  }

  // Open vehicle assignment modal
  const openVehicleAssignmentModal = (payment: Payment, booking: Booking) => {
    const selectedRef = booking.booking_id || booking.id
    const freshBooking = bookings.find((b) => (b.booking_id || b.id) === selectedRef)
    if (!freshBooking) {
      toast.error('This booking list changed. Please refresh bookings and try again.')
      void loadBookings()
      return
    }

    setSelectedPaymentForVehicle(payment)
    setSelectedBookingForVehicle(freshBooking)
    
    // Check if an assignment already exists for this booking
    const existingAssignment = vehicleAssignments.find(
      (va) => va.booking_id === (freshBooking.booking_id || freshBooking.id)
    )
    
    if (existingAssignment) {
      // Find the car for this assignment to pre-select it
      const assignedCar = cars.find((c) => c.id === existingAssignment.car_id)
      setSelectedCarForAssignment(assignedCar || null)
    } else {
      setSelectedCarForAssignment(null)
    }
    
    setShowVehicleAssignmentModal(true)
  }

  // Close vehicle assignment modal
  const closeVehicleAssignmentModal = () => {
    setShowVehicleAssignmentModal(false)
    setSelectedPaymentForVehicle(null)
    setSelectedBookingForVehicle(null)
    setSelectedCarForAssignment(null)
  }

  // Submit vehicle assignment or reassignment
  const handleAssignVehicle = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCarForAssignment || !selectedBookingForVehicle) {
      toast.error('Please select a vehicle')
      return
    }

    setSubmittingVehicleAssignment(true)

    try {
      const selectedRef = selectedBookingForVehicle.booking_id || selectedBookingForVehicle.id
      const freshBooking = bookings.find((b) => (b.booking_id || b.id) === selectedRef)
      if (!freshBooking) {
        toast.error('Booking data changed or was removed. Reloading latest bookings.')
        closeVehicleAssignmentModal()
        await loadBookings()
        return
      }

      // Check if assignment already exists for this booking
      const existingAssignment = vehicleAssignments.find(
        (va) => va.booking_id === (freshBooking.booking_id || freshBooking.id)
      )

      const endpoint = existingAssignment 
        ? '/api/bookings/update-assignment'
        : '/api/bookings/assign-vehicle'

      const assignPayload = {
        booking_id: freshBooking.booking_id || freshBooking.id,
        booking_row_id: freshBooking.id,
        car_id: selectedCarForAssignment.id,
        start_datetime: freshBooking.start_datetime,
        end_datetime: freshBooking.end_datetime,
        assignment_id: existingAssignment?.id,
        user_email: freshBooking.user_email,
        user_name: freshBooking.user_name,
      }

      console.log('[ADMIN_ASSIGN] Request', {
        endpoint,
        payload: assignPayload,
      })

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(assignPayload),
      })

      const result = await response.json()
      console.log('[ADMIN_ASSIGN] Response', {
        endpoint,
        ok: response.ok,
        status: response.status,
        result,
      })

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to assign vehicle')
      }

      const actionText = existingAssignment ? 'reassigned' : 'assigned'
      toast.success(`Vehicle ${selectedCarForAssignment.model_name} ${actionText} successfully! Confirmation email sent.`)
      if (Array.isArray(result.warnings) && result.warnings.length > 0) {
        result.warnings.forEach((warning: { message?: string }) => {
          if (warning.message) toast(warning.message, { duration: 9000 })
        })
      }
      closeVehicleAssignmentModal()
      
      // Reload assignments and bookings to show updated data
      await loadVehicleAssignments()
      await loadBookings()
    } catch (error) {
      console.error('Error assigning vehicle:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign vehicle')
    } finally {
      setSubmittingVehicleAssignment(false)
    }
  }

  const handleUpdateBookingStatus = async (booking: Booking, newStatus: 'pending' | 'confirmed' | 'completed' | 'cancelled') => {
    const bookingId = booking.booking_id || booking.id
    const label = newStatus === 'completed' ? 'completed' : newStatus === 'cancelled' ? 'cancelled' : newStatus === 'confirmed' ? 'confirmed' : 'pending'

    if (newStatus === 'pending') {
      const existingPayment = payments.find(
        p => p.booking_id === bookingId && (p.payment_status === 'paid' || p.payment_status === 'partial' || p.txn_status === 'success')
      )
      if (existingPayment) {
        const confirmed = window.confirm(
          `⚠️ WARNING: This booking already has a confirmed payment on record.\n\n` +
          `Reverting to Pending will move it back to a "before payment" state. ` +
          `The customer will be required to pay again as if the booking was never paid for.\n\n` +
          `The existing payment record will NOT be automatically refunded or deleted — you must handle that separately.\n\n` +
          `Are you absolutely sure you want to revert this booking to Pending?`
        )
        if (!confirmed) return
      } else {
        if (!window.confirm(`Revert this booking to pending?`)) return
      }
    } else {
      if (!window.confirm(newStatus === 'confirmed' ? `Revert this booking to ${label}?` : `Mark this booking as ${label}?`)) return
    }

    setUpdatingStatusId(booking.id)
    try {
      const response = await fetch('/api/bookings/update-status', {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ booking_id: bookingId, status: newStatus }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to update status')
      toast.success(newStatus === 'pending' || newStatus === 'confirmed' ? `Booking reverted to ${label}!` : `Booking marked as ${label}!`)
      await loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update booking status')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleDeleteBooking = async (booking: Booking) => {
    const bookingId = booking.booking_id || booking.id
    const shortId = bookingId.slice(0, 12)

    const warningMessage =
      `Delete booking ${shortId}...?\n\n` +
      'This will permanently delete the booking and all related records, including:\n' +
      '- vehicle assignments\n' +
      '- payment records\n' +
      '- any legacy assignment records\n\n' +
      'This action cannot be undone.'

    if (!window.confirm(warningMessage)) return

    setDeletingBookingId(booking.id)
    try {
      const response = await fetch('/api/bookings/admin', {
        method: 'DELETE',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ booking_id: bookingId }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete booking')
      }

      toast.success('Booking and associated records deleted successfully')
      await Promise.all([loadBookings(), loadPayments(), loadVehicleAssignments()])
    } catch (error) {
      console.error('Error deleting booking:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete booking')
    } finally {
      setDeletingBookingId(null)
    }
  }

  const handleProcessCancellation = async (booking: Booking, action: 'approve' | 'reject') => {
    const bookingId = booking.booking_id || booking.id
    const bookingPayment = payments.find(p => p.booking_id === bookingId)
    const suggestedRefund = toNum(bookingPayment?.amount_online_paid)

    if (action === 'approve') {
      const refundAmt = cancellationRefundAmount[booking.id] ?? String(suggestedRefund)
      const parsed = parseFloat(refundAmt)
      const confirmed = window.confirm(
        `Approve cancellation for booking ${bookingId.slice(0, 12)}…?\n\n` +
        `This will:\n` +
        `• Initiate a Razorpay refund of Rs. ${isNaN(parsed) ? suggestedRefund.toFixed(2) : parsed.toFixed(2)} to the customer\n` +
        `• Mark the booking as Cancelled\n\n` +
        `Cash payments (if any) must be handled manually.\n\n` +
        `Proceed?`
      )
      if (!confirmed) return
    } else {
      if (!window.confirm(`Reject this cancellation request? The booking will remain Confirmed.`)) return
    }

    setProcessingCancellationId(booking.id)
    try {
      const bookingPayment = payments.find(p => p.booking_id === bookingId)
      const refundAmt = action === 'approve'
        ? (cancellationRefundAmount[booking.id] ?? String(toNum(bookingPayment?.amount_online_paid)))
        : undefined
      const notes = action === 'approve' ? cancellationRefundNotes[booking.id] : undefined

      const res = await fetch('/api/admin/process-cancellation', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ booking_id: bookingId, action, refund_amount: refundAmt, refund_notes: notes }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Failed to process cancellation')
      toast.success(result.message)
      await Promise.all([loadBookings(), loadPayments()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process cancellation')
    } finally {
      setProcessingCancellationId(null)
    }
  }

  const renderOverview = () => (
    <div className="space-y-4 md:space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {[
          { label: 'Total Bookings', value: stats.totalBookings },
          { label: 'Total Revenue', value: `Rs. ${stats.totalRevenue.toFixed(2)}` },
          { label: 'Active Bookings', value: stats.activeBookings },
          { label: 'Completed Today', value: stats.completedToday },
          { label: 'Pending Bookings', value: bookings.filter((booking) => booking.booking_status === 'pending').length },
          { label: 'Cancelled Bookings', value: bookings.filter((booking) => booking.booking_status === 'cancelled').length },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 md:p-6">
            <p className="text-gray-600 text-xs md:text-sm font-semibold mb-1">{stat.label}</p>
            <p className="text-2xl md:text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-lg shadow-lg p-4 md:p-8 ${darkMode ? 'bg-slate-800/95 border border-slate-700/60' : 'bg-white'}`}>
        <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Recent Bookings</h3>

        {loadingBookings ? (
          <p className="text-gray-600">Loading bookings...</p>
        ) : recentBookings.length === 0 ? (
          <p className="text-gray-600">No bookings found.</p>
        ) : (
          <div className="space-y-3">
            {recentBookings.map((booking) => {
              const bookingPayment = payments.find(
                (p) => p.booking_id === (booking.booking_id || booking.id)
              )
              const displayId = (booking.booking_id || booking.id).slice(0, 12)
              const serviceLabel = getBookingServiceLabel(booking)
              const serviceMeta = booking.booking_type === 'tour'
                ? booking.tour_package_id
                  ? `Package ID: ${booking.tour_package_id}`
                  : 'Tour package'
                : booking.destination_id
                  ? `Destination ID: ${booking.destination_id}`
                  : 'Route details unavailable'
              const cardShellClass = darkMode
                ? 'border border-slate-700/70 bg-slate-900/45 shadow-lg shadow-black/10'
                : 'border border-slate-200 bg-white shadow-sm shadow-slate-200/70'
              const summaryHoverClass = darkMode ? 'hover:bg-slate-800/70' : 'hover:bg-slate-50'
              const subtleTextClass = darkMode ? 'text-gray-400' : 'text-gray-500'
              const servicePillClass = darkMode
                ? 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
                : 'border border-cyan-200 bg-cyan-50 text-cyan-800'

              return (
                <div key={booking.id} className={`overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${cardShellClass}`}>
                  {/* Summary row — click to view details */}
                  <button
                    onClick={() => openBookingDetails(booking.id)}
                    className={`w-full text-left p-3 md:p-5 transition-colors flex items-center justify-between gap-2 ${summaryHoverClass}`}
                  >
                    <div className="flex-1 min-w-0 text-sm">
                      {/* Mobile: stacked layout */}
                      <div className="flex items-start justify-between gap-2 md:hidden">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{booking.user_name || '-'}</p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${servicePillClass}`}>
                              {bookingTypeLabel(booking.booking_type)}
                            </span>
                          </div>
                          <p className={`mt-1 text-sm font-medium truncate ${darkMode ? 'text-white/90' : 'text-slate-700'}`}>{serviceLabel}</p>
                          <p className={`text-xs truncate ${subtleTextClass}`}>{serviceMeta}</p>
                          <p className={`text-xs mt-1 ${subtleTextClass}`}>{booking.phone || '-'}</p>
                          <p className={`text-xs font-mono mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{displayId}...</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusClass(booking.booking_status, darkMode)} inline-block mb-1`}>
                            {booking.booking_status || 'pending'}
                          </span>
                          <p className="text-xs font-semibold text-green-700">Rs. {toNum(booking.amount_total).toFixed(0)}</p>
                          <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{booking.start_datetime ? formatDate(booking.start_datetime) : '-'}</p>
                        </div>
                      </div>
                      {/* Desktop: grid layout */}
                      <div className="hidden md:grid grid-cols-6 gap-3 items-center">
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Booking ID</p>
                          <p className={`font-mono text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{displayId}…</p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Customer</p>
                          <p className="font-medium">{booking.user_name || '-'}</p>
                          <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{booking.phone || '-'}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Type</p>
                          <p>{bookingTypeLabel(booking.booking_type)}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Start Date</p>
                          <p>{booking.start_datetime ? formatDate(booking.start_datetime) : '-'}</p>
                          <p className="text-xs text-gray-500">
                            {booking.start_datetime
                              ? new Date(booking.start_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Amount</p>
                          <p className="font-semibold text-green-700">Rs. {toNum(booking.amount_total).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Status</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(booking.booking_status, darkMode)} inline-block`}>
                            {booking.booking_status || 'pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )

  const renderBookings = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 md:mb-6 gap-4">
          <h3 className="text-lg md:text-2xl font-bold">
            Bookings <span className="text-sm text-gray-500 font-normal">({filteredBookings.length})</span>
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                placeholder="Search name, phone, ID..."
                className="input-field w-full pl-9 text-sm"
                value={bookingSearchQuery}
                onChange={(e) => setBookingSearchQuery(e.target.value)}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="flex gap-2">
              <select
                className="input-field text-sm flex-1 sm:w-auto"
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
              >
                <option value="all">All Assignments</option>
                <option value="assigned">Assigned</option>
                <option value="assigned_deleted_car">Assigned (Car Deleted)</option>
                <option value="unassigned">Not Assigned</option>
              </select>
              <select
                className="input-field text-sm flex-1 sm:w-auto"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                className="input-field text-sm flex-1 sm:w-auto"
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
              >
                <option value="all">All Payments</option>
                <option value="unpaid">Unpaid — needs follow-up</option>
                <option value="partial">Partial (legacy)</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {loadingBookings ? (
          <p className="text-gray-600">Loading bookings...</p>
        ) : filteredBookings.length === 0 ? (
          <p className="text-gray-600">No bookings found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}{paymentFilter !== 'all' ? ` with payment "${paymentFilter}"` : ''}.</p>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map((booking) => {
              // match payment by booking_id (app-level UUID); fall back to id
              const bookingPayment = payments.find(
                (p) => p.booking_id === (booking.booking_id || booking.id)
              )
              const isExpanded = expandedBookingId === booking.id
              // display the application booking_id if present, otherwise fall back to table id
              const displayId = (booking.booking_id || booking.id).slice(0, 12)
              const destinationName = booking.destination_id ? destinationNameById[booking.destination_id] : null
              const serviceLabel = getBookingServiceLabel(booking)
              const compactServiceLabel = serviceLabel !== bookingTypeLabel(booking.booking_type)
                ? compactLabel(serviceLabel, 18)
                : null

              // Check vehicle assignment for confirmed bookings
              const assignment = vehicleAssignments.find(
                (va) => va.booking_id === (booking.booking_id || booking.id)
              )
              const assignedCar = assignment ? cars.find((c) => c.id === assignment.car_id) : null
              const isCarAssigned = !!assignment
              const hasDeletedAssignedCar = !!assignment && !assignedCar

              return (
                <div
                  key={booking.id}
                  className={`rounded-lg overflow-hidden border shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-[background-color,box-shadow,border-color] duration-300 ease-out ${
                    darkMode
                      ? `${isExpanded ? 'bg-slate-800/85' : 'bg-slate-900/70'} border-slate-600 hover:shadow-[0_8px_18px_rgba(2,6,23,0.45)]`
                      : `${isExpanded ? 'bg-gray-100/90' : 'bg-white'} border-gray-300 hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)]`
                  }`}
                >
                  {booking.cancellation_requested_at && booking.booking_status !== 'cancelled' && (
                    <div className="bg-orange-50 border-b border-orange-200 px-3 md:px-4 py-1.5 flex items-center gap-2 text-xs text-orange-700 font-semibold">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                      Cancellation Requested — awaiting admin review
                    </div>
                  )}
                  {bookingPayment?.payment_status === 'unpaid' && booking.booking_status !== 'cancelled' && (() => {
                    const hold = formatHoldRemaining(booking.hold_expires_at)
                    return (
                      <div className="bg-amber-50 border-b border-amber-300 px-3 md:px-4 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-amber-800 font-semibold">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        UNPAID — Rs. {toNum(bookingPayment.amount_total).toFixed(2)} to collect
                        {hold && (
                          <span className={`font-medium ${hold.expired ? 'text-red-600' : 'text-amber-700'}`}>
                            · {hold.label}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                  {/* Summary row — click to expand */}
                  <button
                    onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                    className={`w-full text-left p-3 md:p-4 transition-colors flex items-center justify-between gap-2 ${darkMode ? 'hover:bg-slate-800/70' : 'hover:bg-gray-50/80'}`}
                  >
                    <div className="flex-1 min-w-0 text-sm">
                      {/* Mobile: stacked layout */}
                      <div className="flex items-start justify-between gap-2 md:hidden">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{booking.user_name || '-'}</p>
                          <p className={`text-xs truncate ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>
                            {bookingTypeLabel(booking.booking_type)}
                            {compactServiceLabel ? ` - ${compactServiceLabel}` : ''}
                          </p>
                          <p className="text-xs text-gray-500">{booking.phone || '-'}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{displayId}…</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusClass(booking.booking_status, darkMode)} inline-block mb-1`}>
                            {booking.booking_status
                              ? booking.booking_status.charAt(0).toUpperCase() + booking.booking_status.slice(1)
                              : 'Pending'}
                          </span>
                          {booking.booking_status === 'confirmed' && (
                            <p className={`text-xs font-semibold mb-1 ${
                              hasDeletedAssignedCar ? 'text-amber-700' : isCarAssigned ? 'text-green-700' : 'text-orange-600'
                            }`}>
                              {hasDeletedAssignedCar ? 'Assigned Car Deleted' : isCarAssigned ? 'Car Assigned' : 'Car not assigned'}
                            </p>
                          )}
                          <p className="text-xs font-semibold text-green-700">Rs. {toNum(booking.amount_total).toFixed(0)}</p>
                          <p className="text-xs text-gray-500">{booking.start_datetime ? formatDate(booking.start_datetime) : '-'}</p>
                        </div>
                      </div>
                      {/* Desktop: grid layout */}
                      <div className="hidden md:grid grid-cols-7 gap-3 items-center">
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Booking ID</p>
                          <p className={`font-mono text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{displayId}…</p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Customer</p>
                          <p className="font-medium">{booking.user_name || '-'}</p>
                          <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{booking.phone || '-'}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Type</p>
                          <p>{bookingTypeLabel(booking.booking_type)}</p>
                          {compactServiceLabel && (
                            <p className={`text-xs truncate ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>{compactServiceLabel}</p>
                          )}
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Start Date</p>
                          <p>{booking.start_datetime ? formatDate(booking.start_datetime) : '-'}</p>
                          <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>
                            {booking.start_datetime
                              ? new Date(booking.start_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Amount</p>
                          <p className="font-semibold text-green-700">Rs. {toNum(booking.amount_total).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Status</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(booking.booking_status, darkMode)} inline-block`}>
                            {booking.booking_status
                              ? booking.booking_status.charAt(0).toUpperCase() + booking.booking_status.slice(1)
                              : 'Pending'}
                          </span>
                        </div>
                        {booking.booking_status === 'confirmed' && (
                          <div>
                            <p className={`text-xs font-semibold mb-0.5 ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Vehicle</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold inline-block ${
                              hasDeletedAssignedCar
                                ? 'bg-amber-100 text-amber-800'
                                : isCarAssigned
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                            }`}>
                              {hasDeletedAssignedCar ? 'Car Deleted' : isCarAssigned ? 'Assigned' : 'Car not assigned'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <svg
                      className={`ml-2 w-4 h-4 md:w-5 md:h-5 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50/60 p-3 md:p-5">
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-5 xl:items-stretch">

                        {/* ── Booking Details ── */}
                        <div className="bg-white rounded-lg border border-gray-300 shadow-[0_1px_2px_rgba(15,23,42,0.06)] p-4 xl:col-span-5 xl:h-full">
                          <h4 className="font-semibold text-base mb-3 text-gray-800">Booking Details</h4>
                          <dl className="space-y-2 text-sm">
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">booking_id</dt>
                              <dd className="text-right">
                                {booking.booking_id ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(booking.booking_id || '')
                                        toast.success('Booking ID copied')
                                      } catch {
                                        toast.error('Failed to copy Booking ID')
                                      }
                                    }}
                                    className={`font-mono text-xs break-all hover:underline underline-offset-2 ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800'}`}
                                    title="Click to copy booking ID"
                                  >
                                    {booking.booking_id}
                                  </button>
                                ) : (
                                  <span className="font-mono text-xs">-</span>
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">booking_type</dt>
                              <dd className="font-medium">{bookingTypeLabel(booking.booking_type)}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">user_name</dt>
                              <dd>{booking.user_name || '-'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">user_email</dt>
                              <dd>{booking.user_email || '-'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">phone</dt>
                              <dd>{booking.phone || '-'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">passenger_count</dt>
                              <dd>{booking.passenger_count ?? '-'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">car_model</dt>
                              <dd>{booking.car_model || '-'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">start_datetime</dt>
                              <dd className="text-right">{booking.start_datetime ? new Date(booking.start_datetime).toLocaleString('en-IN') : '-'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">end_datetime</dt>
                              <dd className="text-right">{booking.end_datetime ? new Date(booking.end_datetime).toLocaleString('en-IN') : '-'}</dd>
                            </div>
                            {booking.tour_package_id && (
                              <div className="flex justify-between gap-2">
                                <dt className="text-gray-500 shrink-0">tour_package_id</dt>
                                <dd className="text-right">
                                  <div className="font-medium">{tourNameById[booking.tour_package_id] || 'Tour package'}</div>
                                  <div className="font-mono text-xs break-all">{booking.tour_package_id}</div>
                                </dd>
                              </div>
                            )}
                            {booking.destination_id && (
                              <div className="flex justify-between gap-2">
                                <dt className="text-gray-500 shrink-0">destination_id</dt>
                                <dd className="text-right">
                                  <div className="font-medium">{destinationName || 'Destination unavailable'}</div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(booking.destination_id || '')
                                        toast.success('Destination ID copied')
                                      } catch {
                                        toast.error('Failed to copy Destination ID')
                                      }
                                    }}
                                    className={`font-mono text-xs break-all hover:underline underline-offset-2 ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800'}`}
                                    title="Click to copy destination ID"
                                  >
                                    {booking.destination_id}
                                  </button>
                                </dd>
                              </div>
                            )}
                            <div className="flex justify-between gap-2 pt-2 border-t font-semibold">
                              <dt>amount_total</dt>
                              <dd className="text-green-700">Rs. {toNum(booking.amount_total).toFixed(2)}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">booking_status</dt>
                              <dd>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusClass(booking.booking_status, darkMode)}`}>
                                  {booking.booking_status || 'pending'}
                                </span>
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-500 shrink-0">created_at</dt>
                              <dd className="text-xs text-right">{booking.created_at ? new Date(booking.created_at).toLocaleString('en-IN') : '-'}</dd>
                            </div>
                          </dl>

                          {/* Cancellation Request Review */}
                          {booking.cancellation_requested_at && booking.booking_status !== 'cancelled' && (
                            <div className="mt-4 pt-4 border-t border-orange-200 bg-orange-50 rounded-lg p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                <h4 className="font-bold text-orange-800 text-sm">Cancellation Requested</h4>
                                <span className="text-xs text-orange-600 ml-auto">
                                  {new Date(booking.cancellation_requested_at).toLocaleString('en-IN')}
                                </span>
                              </div>
                              {booking.cancellation_reason && (
                                <p className="text-sm text-orange-700 bg-orange-100 rounded-lg px-3 py-2">
                                  <span className="font-semibold">Reason: </span>{booking.cancellation_reason}
                                </p>
                              )}
                              {(() => {
                                const bp = payments.find(p => p.booking_id === (booking.booking_id || booking.id))
                                const onlinePaid = toNum(bp?.amount_online_paid)
                                const bookingKey = booking.id
                                return (
                                  <div className="space-y-2">
                                    <div className="text-xs text-orange-700 font-semibold">
                                      Online payment on record: <span className="text-green-700">Rs. {onlinePaid.toFixed(2)}</span>
                                      {bp?.payment_type === 'partial' && (
                                        <span className="ml-2 text-orange-600">(partial — cash portion must be refunded manually)</span>
                                      )}
                                    </div>
                                    {bp?.refund_status === 'processed' ? (
                                      <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                        Refund already processed — Rs. {toNum(bp.refund_amount).toFixed(2)}
                                        {bp.refund_id && <span className="font-mono ml-1">({bp.refund_id})</span>}
                                      </div>
                                    ) : (
                                      <>
                                        <div>
                                          <label className="text-xs text-orange-700 font-semibold block mb-1">Refund Amount (Rs.)</label>
                                          <input
                                            type="number"
                                            min={0}
                                            max={onlinePaid}
                                            step={0.01}
                                            value={cancellationRefundAmount[bookingKey] ?? String(onlinePaid)}
                                            onChange={e => setCancellationRefundAmount(prev => ({ ...prev, [bookingKey]: e.target.value }))}
                                            className="w-full border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-orange-700 font-semibold block mb-1">Admin Notes (optional)</label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Customer requested, approved per policy"
                                            value={cancellationRefundNotes[bookingKey] ?? ''}
                                            onChange={e => setCancellationRefundNotes(prev => ({ ...prev, [bookingKey]: e.target.value }))}
                                            className="w-full border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500"
                                          />
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                          <button
                                            onClick={() => handleProcessCancellation(booking, 'approve')}
                                            disabled={processingCancellationId === booking.id}
                                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {processingCancellationId === booking.id ? 'Processing…' : '✓ Approve & Refund'}
                                          </button>
                                          <button
                                            onClick={() => handleProcessCancellation(booking, 'reject')}
                                            disabled={processingCancellationId === booking.id}
                                            className="flex-1 px-3 py-2 bg-red-100 text-red-700 border border-red-300 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {processingCancellationId === booking.id ? 'Processing…' : '✕ Reject Request'}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}

                          {/* Status Actions */}
                          {booking.booking_status !== 'completed' && booking.booking_status !== 'cancelled' && (
                            <div className="flex gap-2 mt-4 pt-4 border-t">
                              <button
                                onClick={() => handleUpdateBookingStatus(booking, 'completed')}
                                disabled={updatingStatusId === booking.id}
                                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {updatingStatusId === booking.id ? 'Updating…' : '✓ Mark Completed'}
                              </button>
                              <button
                                onClick={() => handleUpdateBookingStatus(booking, 'cancelled')}
                                disabled={updatingStatusId === booking.id}
                                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {updatingStatusId === booking.id ? 'Updating…' : '✕ Cancel Booking'}
                              </button>
                            </div>
                          )}
                          {(booking.booking_status === 'completed' || booking.booking_status === 'cancelled') && (
                            <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateBookingStatus(booking, 'confirmed')}
                                  disabled={updatingStatusId === booking.id}
                                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {updatingStatusId === booking.id ? 'Updating…' : '↩ Revert to Confirmed'}
                                </button>
                                <button
                                  onClick={() => handleUpdateBookingStatus(booking, 'pending')}
                                  disabled={updatingStatusId === booking.id}
                                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {updatingStatusId === booking.id ? 'Updating…' : '↩ Revert to Pending'}
                                </button>
                              </div>
                              <button
                                onClick={() => handleDeleteBooking(booking)}
                                disabled={deletingBookingId === booking.id}
                                className="w-full px-3 py-2 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingBookingId === booking.id ? 'Deleting…' : 'Delete Booking'}
                              </button>
                            </div>
                          )}
                          {booking.booking_status !== 'completed' && booking.booking_status !== 'cancelled' && (
                            <div className="mt-2">
                              <button
                                onClick={() => handleDeleteBooking(booking)}
                                disabled={deletingBookingId === booking.id}
                                className="w-full px-3 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingBookingId === booking.id ? 'Deleting…' : 'Delete Booking'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* ── Vehicle Assignment Details ── */}
                        {(() => {
                          const assignment = vehicleAssignments.find(
                            (va) => va.booking_id === (booking.booking_id || booking.id)
                          )
                          const assignedCar = assignment ? cars.find((c) => c.id === assignment.car_id) : null
                          const carModel = assignedCar?.model_name || assignment?.car_model_snapshot || 'Vehicle record deleted'
                          const carPlate = assignedCar?.number_plate || assignment?.car_number_plate_snapshot || '-'
                          const carClass = assignedCar?.class || assignment?.car_class_snapshot || '-'
                          const driverName = assignedCar?.driver_name || assignment?.driver_name_snapshot || '-'
                          const driverPhone = assignedCar?.driver_phone || assignment?.driver_phone_snapshot || '-'
                          const carCapacity = assignedCar?.capacity
                          const carIsActive = assignedCar?.is_active
                          const driverEmail = assignedCar?.driver_email || assignment?.driver_email_snapshot || '-'
                          const driverVerified = assignedCar?.driver_verified
                          const vehicleDataSource = assignedCar ? 'Live vehicle record' : 'Assignment snapshot'
                          
                          return assignment ? (
                            <div className="bg-green-50 rounded-lg border border-green-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] p-4 xl:col-span-7 xl:h-full flex flex-col">
                              <h4 className="font-semibold text-base mb-3 text-green-800">✓ Vehicle Assignment</h4>
                              <div className="mb-3">
                                <span className="rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                                  {vehicleDataSource}
                                </span>
                              </div>
                              <dl className="space-y-2 text-sm">
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Car Model</dt>
                                  <dd className="font-semibold text-green-700">{carModel}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Registration</dt>
                                  <dd className="font-mono">{carPlate}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Class</dt>
                                  <dd>{carClass}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Capacity</dt>
                                  <dd>{carCapacity ?? '-'}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Vehicle Status</dt>
                                  <dd>
                                    {carIsActive === undefined
                                      ? '-'
                                      : carIsActive
                                        ? 'Active'
                                        : 'Inactive'}
                                  </dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Driver</dt>
                                  <dd>{driverName}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Driver Phone</dt>
                                  <dd className="font-mono">{driverPhone}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Driver Email</dt>
                                  <dd className="text-right break-all">{driverEmail || '-'}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Driver Verified</dt>
                                  <dd>
                                    {driverVerified === undefined
                                      ? '-'
                                      : driverVerified
                                        ? 'Yes'
                                        : 'No'}
                                  </dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Assignment Start</dt>
                                  <dd className="text-right text-xs">{new Date(assignment.start_datetime).toLocaleString('en-IN')}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-600 shrink-0">Assignment End</dt>
                                  <dd className="text-right text-xs">{new Date(assignment.end_datetime).toLocaleString('en-IN')}</dd>
                                </div>
                                {!assignedCar && (
                                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                                    Linked car was deleted. Snapshot details are shown from assignment history.
                                  </div>
                                )}
                                <div className="flex justify-between gap-2 pt-2 border-t border-green-200">
                                  <dt className="text-gray-600 shrink-0">Assigned At</dt>
                                  <dd className="text-xs">{new Date(assignment.assigned_at).toLocaleString('en-IN')}</dd>
                                </div>
                              </dl>
                              <button
                                onClick={() => openVehicleAssignmentModal(bookingPayment, booking)}
                                className="w-full mt-4 xl:mt-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                              >
                                Reassign Vehicle
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-6 text-center gap-4 xl:col-span-7 xl:h-full">
                              <p className="text-sm text-gray-600">No vehicle assigned yet</p>
                              {bookingPayment?.payment_status === 'paid' && (
                                <button
                                  onClick={() => openVehicleAssignmentModal(bookingPayment, booking)}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm"
                                >
                                  Assign Vehicle
                                </button>
                              )}
                            </div>
                          )
                        })()}

                        {/* ── Payment Details ── */}
                        {bookingPayment ? (
                          <div className="bg-white rounded-lg border border-gray-300 shadow-[0_1px_2px_rgba(15,23,42,0.06)] p-4 xl:col-span-12">
                            <details className="group">
                            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                              <div>
                                <h4 className="font-semibold text-base text-gray-800">Payment Details</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Collection status and transaction trail</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`w-fit px-2.5 py-1 rounded-full text-xs font-semibold ${getPaymentStatusClass(bookingPayment.payment_status)}`}>
                                  {bookingPayment.payment_status}
                                </span>
                                <span className="text-gray-400 transition-transform group-open:rotate-180">⌄</span>
                              </div>
                            </summary>
                            <div className="mt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                              <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                                <p className="text-xs font-semibold text-green-700">Collected</p>
                                <p className="text-lg font-bold text-green-800">
                                  Rs. {(toNum(bookingPayment.amount_online_paid) + toNum(bookingPayment.amount_cash_paid)).toFixed(2)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                                <p className="text-xs font-semibold text-blue-700">Online Paid</p>
                                <p className="text-lg font-bold text-blue-800">Rs. {toNum(bookingPayment.amount_online_paid).toFixed(2)}</p>
                              </div>
                              <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                                <p className="text-xs font-semibold text-orange-700">Balance</p>
                                <p className="text-lg font-bold text-orange-800">
                                  Rs. {Math.max(0, toNum(bookingPayment.amount_total) - (toNum(bookingPayment.amount_online_paid) + toNum(bookingPayment.amount_cash_paid))).toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <details className="group rounded-lg border border-gray-200 bg-gray-50/70" open>
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700">
                                Transaction breakdown
                                <span className="text-gray-400 transition-transform group-open:rotate-180">⌄</span>
                              </summary>
                              <dl className="space-y-2 border-t border-gray-200 bg-white px-3 py-3 text-sm">
                              <div className="flex justify-between gap-2">
                                <dt className="text-gray-500 shrink-0">payment_type</dt>
                                <dd className="font-medium capitalize">{bookingPayment.payment_type}</dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt className="text-gray-500 shrink-0">amount_total</dt>
                                <dd>Rs. {toNum(bookingPayment.amount_total).toFixed(2)}</dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt className="text-gray-500 shrink-0">amount_online_paid</dt>
                                <dd className="text-blue-700 font-medium">Rs. {toNum(bookingPayment.amount_online_paid).toFixed(2)}</dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt className="text-gray-500 shrink-0">amount_cash_paid</dt>
                                <dd>Rs. {toNum(bookingPayment.amount_cash_paid).toFixed(2)}</dd>
                              </div>
                              <div className="flex justify-between gap-2 pt-2 border-t font-semibold">
                                <dt>Total Collected</dt>
                                <dd className="text-green-700">Rs. {(toNum(bookingPayment.amount_online_paid) + toNum(bookingPayment.amount_cash_paid)).toFixed(2)}</dd>
                              </div>
                              {(bookingPayment.payment_type === 'partial' || bookingPayment.payment_type === 'cash') && (
                                <div className="flex justify-between gap-2 font-semibold">
                                  <dt className="text-orange-600">Remaining Balance to Pay</dt>
                                  <dd className="text-orange-700">Rs. {Math.max(0, toNum(bookingPayment.amount_total) - (toNum(bookingPayment.amount_online_paid) + toNum(bookingPayment.amount_cash_paid))).toFixed(2)}</dd>
                                </div>
                              )}
                              <div className="flex justify-between gap-2">
                                <dt className="text-gray-500 shrink-0">payment_status</dt>
                                <dd>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getPaymentStatusClass(bookingPayment.payment_status)}`}>
                                    {bookingPayment.payment_status}
                                  </span>
                                </dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt className="text-gray-500 shrink-0">txn_status</dt>
                                <dd>
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    bookingPayment.txn_status === 'success' ? 'bg-green-100 text-green-800'
                                      : bookingPayment.txn_status === 'failed' ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {bookingPayment.txn_status}
                                  </span>
                                </dd>
                              </div>
                              {bookingPayment.txn_id && (
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-500 shrink-0">txn_id</dt>
                                  <dd className="font-mono text-xs break-all text-right">{bookingPayment.txn_id}</dd>
                                </div>
                              )}
                              {bookingPayment.gateway && (
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-500 shrink-0">gateway</dt>
                                  <dd className="capitalize">{bookingPayment.gateway}</dd>
                                </div>
                              )}
                              {bookingPayment.cash_collected_by && (
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-500 shrink-0">cash_collected_by</dt>
                                  <dd>{bookingPayment.cash_collected_by}</dd>
                                </div>
                              )}
                              {bookingPayment.cash_paid_at && (
                                <div className="flex justify-between gap-2">
                                  <dt className="text-gray-500 shrink-0">cash_paid_at</dt>
                                  <dd>{new Date(bookingPayment.cash_paid_at).toLocaleString('en-IN')}</dd>
                                </div>
                              )}
                              {bookingPayment.refund_status === 'processed' && (
                                <div className="pt-2 border-t space-y-1">
                                  <div className="flex justify-between gap-2 font-semibold">
                                    <dt className="text-green-700">Refund Processed</dt>
                                    <dd className="text-green-700">Rs. {toNum(bookingPayment.refund_amount).toFixed(2)}</dd>
                                  </div>
                                  {bookingPayment.refund_id && (
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-gray-500 shrink-0">refund_id</dt>
                                      <dd className="font-mono text-xs break-all text-right">{bookingPayment.refund_id}</dd>
                                    </div>
                                  )}
                                  {bookingPayment.refunded_at && (
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-gray-500 shrink-0">refunded_at</dt>
                                      <dd className="text-xs">{new Date(bookingPayment.refunded_at).toLocaleString('en-IN')}</dd>
                                    </div>
                                  )}
                                  {bookingPayment.refund_notes && (
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-gray-500 shrink-0">refund_notes</dt>
                                      <dd className="text-xs text-right">{bookingPayment.refund_notes}</dd>
                                    </div>
                                  )}
                                </div>
                              )}
                              {(bookingPayment.payment_status === 'partial' || bookingPayment.payment_status === 'unpaid') && (
                                <div className="flex gap-2 pt-4 border-t">
                                  <button
                                    onClick={() => openCashCollectionModal(bookingPayment, booking)}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                                  >
                                    {bookingPayment.payment_status === 'unpaid' ? 'Record Cash Payment' : 'Confirm Cash Payment'}
                                  </button>
                                </div>
                              )}
                              </dl>
                            </details>
                            </div>
                            </details>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center xl:col-span-12">
                            <p className="text-sm text-yellow-800">No payment record linked to this booking.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )

  const renderCarForm = ({
    onSubmit,
    submitLabel,
    listId,
  }: {
    onSubmit: (e: React.FormEvent) => void
    submitLabel: string
    listId: string
  }) => (
    <form onSubmit={onSubmit} className="space-y-4 md:space-y-6">
      <div>
        <h4 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-700">Car Details</h4>
        <datalist id={listId}>
          {[...new Set(cars.map(c => c.model_name))].sort().map(name => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              list={listId}
              placeholder="Model Name (e.g., Toyota Innova)"
              className="input-field"
              value={formData.model_name}
              onChange={(e) => {
                const nextValue = e.target.value
                setFormData({ ...formData, model_name: nextValue })
                updateCarModelSuggestions(nextValue)
                if (showAddCar && !editingCar) {
                  autoFillCarSpecsFromModel(nextValue)
                }
              }}
              onBlur={(e) => {
                updateCarModelSuggestions(e.target.value)
                if (showAddCar && !editingCar) {
                  autoFillCarSpecsFromModel(e.target.value)
                }
              }}
              required
            />
            {carModelWarning.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-semibold mb-1">
                  {carModelWarningSource === 'existing'
                    ? `Similar model name${carModelWarning.length > 1 ? 's' : ''} already exist in your cars - did you mean:`
                    : 'Did you mean one of these common commercial model names?'}
                </p>
                {carModelWarningSource === 'library' && (
                  <p className="mb-2 text-[11px] text-amber-700">
                    No close match was found in your current car models, so this suggestion comes from the internal reference list.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {carModelWarning.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setFormData(f => ({ ...f, model_name: name }))
                        if (showAddCar && !editingCar) {
                          autoFillCarSpecsFromModel(name)
                        }
                        setCarModelWarning([])
                        setCarModelWarningSource(null)
                        setLastCarModelSuggestions([])
                        setLastCarModelSuggestionSource(null)
                      }}
                      className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 border border-amber-400 rounded font-medium transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCarModelWarning([])
                      setCarModelWarningSource(null)
                    }}
                    className="px-2 py-0.5 text-amber-600 hover:text-amber-800 underline"
                  >
                    Keep what I typed
                  </button>
                </div>
              </div>
            )}
            {carModelWarning.length === 0 && lastCarModelSuggestions.length > 0 && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] text-gray-500">Suggestions hidden.</span>
                <button
                  type="button"
                  onClick={() => {
                    setCarModelWarning(lastCarModelSuggestions)
                    setCarModelWarningSource(lastCarModelSuggestionSource)
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  Show suggestions again
                </button>
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-gray-700">Car Class</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { label: 'Auto', value: '' },
                { label: 'Economy', value: 'Economy' },
                { label: 'Premium', value: 'Premium' },
                { label: 'Luxury', value: 'Luxury' },
                { label: 'Group', value: 'Group' },
              ].map((option) => {
                const checked = formData.class === option.value
                return (
                  <label
                    key={option.label}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                      checked ? 'border-secondary-400 bg-secondary-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          class: checked ? '' : option.value,
                        })
                      }
                      className="h-4 w-4 accent-secondary-500"
                    />
                    <span className="text-sm text-gray-800">{option.label}</span>
                  </label>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              If no class is selected (or Auto is selected), class will be auto-assigned from capacity.
            </p>
            <details className="mt-1 text-xs text-gray-500">
              <summary className="cursor-pointer select-none">Capacity to class mapping</summary>
              <div className="mt-1 whitespace-pre-line">
                {"<= 4 → Economy\n<= 6 → Premium\n<= 8 → Luxury\n> 8 → Group"}
              </div>
            </details>
          </div>
          <input
            type="text"
            placeholder="Number Plate (e.g., AP-01-XY-1234)"
            className="input-field"
            value={formData.number_plate}
            onChange={(e) => setFormData({ ...formData, number_plate: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Capacity (e.g., 4)"
            className="input-field"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <h4 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-700">Driver Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Driver Name (required)"
            className="input-field"
            value={formData.driver_name}
            onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
            required
          />
          <input
            type="tel"
            placeholder="Driver Phone (required)"
            className="input-field"
            value={formData.driver_phone}
            onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Driver Email"
            className="input-field"
            value={formData.driver_email}
            onChange={(e) => setFormData({ ...formData, driver_email: e.target.value })}
          />
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.driver_verified}
                onChange={(e) => setFormData({ ...formData, driver_verified: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-gray-700">Driver Verified</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={cancelEdit}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )

  const renderCarManagement = () => {
    const scheduleWeekStart = (() => {
      const d = new Date()
      const day = d.getDay()
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + scheduleWeekOffset * 7)
      d.setHours(0, 0, 0, 0)
      return d
    })()
    const scheduleWeekEnd = new Date(scheduleWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const scheduleWeekDurationMs = scheduleWeekEnd.getTime() - scheduleWeekStart.getTime()
    const scheduleDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(scheduleWeekStart)
      d.setDate(d.getDate() + i)
      return d
    })

    const handleScheduleDatePick = (dateStr: string) => {
      if (!dateStr) { setScheduleFocusDate(''); return }
      const picked = new Date(dateStr)
      const todayMonday = new Date()
      const dow = todayMonday.getDay()
      todayMonday.setDate(todayMonday.getDate() + (dow === 0 ? -6 : 1 - dow))
      todayMonday.setHours(0, 0, 0, 0)
      const pickedMonday = new Date(picked)
      const pdow = pickedMonday.getDay()
      pickedMonday.setDate(pickedMonday.getDate() + (pdow === 0 ? -6 : 1 - pdow))
      pickedMonday.setHours(0, 0, 0, 0)
      const weeksDiff = Math.round((pickedMonday.getTime() - todayMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
      setScheduleWeekOffset(weeksDiff)
      setScheduleFocusDate(dateStr)
    }

    const carClasses = [...new Set(cars.map(c => c.class))].filter(Boolean).sort()
    const filteredCars = cars.filter(car => {
      if (carFilterStatus === 'active' && !car.is_active) return false
      if (carFilterStatus === 'inactive' && car.is_active) return false
      if (carFilterClass && car.class !== carFilterClass) return false
      if (carSearchQuery.trim()) {
        const q = carSearchQuery.toLowerCase()
        return (
          car.model_name.toLowerCase().includes(q) ||
          car.driver_name.toLowerCase().includes(q) ||
          car.number_plate.toLowerCase().includes(q) ||
          car.driver_phone.includes(q)
        )
      }
      return true
    })
    const hasActiveFilters = carSearchQuery.trim() || carFilterStatus !== 'all' || carFilterClass

    const filteredScheduleCars = cars.filter(car => {
      if (scheduleFilterStatus === 'active' && !car.is_active) return false
      if (scheduleFilterStatus === 'inactive' && car.is_active) return false
      if (scheduleFilterClass && car.class !== scheduleFilterClass) return false
      if (scheduleSearchQuery.trim()) {
        const q = scheduleSearchQuery.toLowerCase()
        return (
          car.model_name.toLowerCase().includes(q) ||
          car.driver_name.toLowerCase().includes(q) ||
          car.number_plate.toLowerCase().includes(q)
        )
      }
      return true
    })
    const hasActiveScheduleFilters = scheduleSearchQuery.trim() || scheduleFilterStatus !== 'all' || scheduleFilterClass

    return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      {/* Add Car Form */}
      {showAddCar && (
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Add New Car</h3>
          {renderCarForm({ onSubmit: handleAddCar, submitLabel: 'Add Car', listId: 'car-model-names-add' })}
        </div>
      )}

      {/* Cars List */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
          <h3 className="text-xl md:text-2xl font-bold">Manage Cars</h3>
          {!showAddCar && (
            <button onClick={() => setShowAddCar(true)} className="btn-primary text-sm md:text-base">
              Add New Car
            </button>
          )}
        </div>

        {/* Filters */}
        {!loadingCars && cars.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-5 pb-5 border-b">
            <input
              type="text"
              placeholder="Search model, driver, plate…"
              value={carSearchQuery}
              onChange={e => setCarSearchQuery(e.target.value)}
              className="input-field !py-2 !text-sm flex-1 min-w-[180px]"
            />
            <select
              value={carFilterClass}
              onChange={e => setCarFilterClass(e.target.value)}
              className="input-field !py-2 !text-sm w-auto"
            >
              <option value="">All Classes</option>
              {carClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
            <select
              value={carFilterStatus}
              onChange={e => setCarFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="input-field !py-2 !text-sm w-auto"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { setCarSearchQuery(''); setCarFilterStatus('all'); setCarFilterClass('') }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {loadingCars ? (
          <p className="text-gray-600">Loading cars...</p>
        ) : cars.length === 0 ? (
          <p className="text-gray-600">No cars available. Add a new car to get started.</p>
        ) : filteredCars.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No cars match the current filters.</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">
              Showing {filteredCars.length} of {cars.length} car{cars.length !== 1 ? 's' : ''}
            </p>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm admin-table">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold w-8"></th>
                    <th className="text-left py-3 px-4 font-semibold">Model</th>
                    <th className="text-left py-3 px-4 font-semibold">Class</th>
                    <th className="text-left py-3 px-4 font-semibold">Number Plate</th>
                    <th className="text-left py-3 px-4 font-semibold">Capacity</th>
                    <th className="text-left py-3 px-4 font-semibold">Driver Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Driver Phone</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCars.map((car) => {
                    const isExpanded = expandedCarId === car.id
                    return (
                      <Fragment key={car.id}>
                        <tr
                          className={`border-b hover:bg-gray-50 cursor-pointer ${editingCar?.id === car.id ? 'bg-secondary-50/40' : !car.is_active ? 'bg-gray-100 opacity-70' : ''}`}
                          onClick={() => setExpandedCarId(isExpanded ? null : car.id)}
                        >
                          <td className="py-3 px-4 text-gray-400">
                            <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
                          </td>
                          <td className="py-3 px-4 font-medium">{car.model_name}</td>
                          <td className="py-3 px-4">{car.class}</td>
                          <td className="py-3 px-4 font-mono">{car.number_plate}</td>
                          <td className="py-3 px-4">{car.capacity} seats</td>
                          <td className="py-3 px-4">{car.driver_name}</td>
                          <td className="py-3 px-4">{car.driver_phone}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              car.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {car.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => startEditCar(car)}
                                className="text-sm text-secondary-500 hover:text-secondary-600"
                              >
                                {editingCar?.id === car.id ? 'Editing' : 'Edit'}
                              </button>
                              <button
                                onClick={() => handleToggleCarActive(car)}
                                className={`text-sm ${car.is_active ? 'text-orange-500 hover:text-orange-600' : 'text-green-500 hover:text-green-600'}`}
                              >
                                {car.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteCar(car)}
                                title="Permanent Delete"
                                aria-label="Permanent Delete"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-900 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingCar?.id === car.id && (
                          <tr className="border-b bg-secondary-50/30">
                            <td colSpan={10} className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="rounded-xl border border-secondary-200 bg-white p-4 shadow-sm">
                                <div className="mb-4">
                                  <p className="text-sm font-bold text-gray-900">Editing {car.model_name}</p>
                                  <p className="text-xs text-gray-500">Update this car in place, then save or cancel.</p>
                                </div>
                                {renderCarForm({
                                  onSubmit: handleUpdateCar,
                                  submitLabel: 'Update Car',
                                  listId: `car-model-names-edit-desktop-${car.id}`,
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                        {isExpanded && (
                          <tr key={`${car.id}-details`} className={`border-b ${!car.is_active ? 'bg-gray-100 opacity-70' : 'bg-gray-50'}`}>
                            <td colSpan={10} className="px-6 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Driver Email</p>
                                  <p className="text-gray-800">{car.driver_email || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Driver Verified</p>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    car.driver_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {car.driver_verified ? 'Verified' : 'Unverified'}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Car ID</p>
                                  <p className="text-gray-500 font-mono text-xs">{car.id}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Added On</p>
                                  <p className="text-gray-800">
                                    {new Date(car.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {filteredCars.map((car) => {
                const isExpanded = expandedCarId === car.id
                return (
                  <div key={car.id} className={`rounded-lg border transition-all ${editingCar?.id === car.id ? 'border-secondary-300 bg-white ring-2 ring-secondary-100' : !car.is_active ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'} shadow-sm hover:shadow-md`}>
                    {/* Card Header */}
                    <button
                      onClick={() => setExpandedCarId(isExpanded ? null : car.id)}
                      className="w-full p-4 text-left flex items-start justify-between gap-3 active:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base text-gray-900 truncate">{car.model_name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{car.class}</p>
                        <p className="text-xs font-mono text-gray-400 mt-1">{car.number_plate}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          car.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {car.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {/* Card Body */}
                    {isExpanded && (
                      <>
                        <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Capacity</p>
                              <p className="text-sm font-medium">{car.capacity} seats</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Driver</p>
                              <p className="text-sm font-medium">{car.driver_name}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Driver Verified</p>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                car.driver_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {car.driver_verified ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Class</p>
                              <p className="text-sm font-medium">{car.class}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Driver</p>
                            <p className="text-sm font-medium">{car.driver_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{car.driver_phone}</p>
                            {car.driver_email && <p className="text-xs text-gray-500">{car.driver_email}</p>}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                          <button
                            onClick={() => startEditCar(car)}
                            className="flex-1 py-2 text-sm font-medium text-secondary-600 hover:bg-secondary-50 rounded active:bg-secondary-100 transition-colors"
                          >
                            {editingCar?.id === car.id ? 'Editing' : 'Edit'}
                          </button>
                          <button
                            onClick={() => handleToggleCarActive(car)}
                            className={`flex-1 py-2 text-sm font-medium rounded transition-colors active:opacity-70 ${
                              car.is_active
                                ? 'text-orange-600 hover:bg-orange-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {car.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteCar(car)}
                            title="Permanent Delete"
                            aria-label="Permanent Delete"
                            className="inline-flex items-center justify-center w-10 h-10 rounded border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 active:bg-red-200 transition-colors shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        {editingCar?.id === car.id && (
                          <div className="mx-4 mb-4 rounded-xl border border-secondary-200 bg-secondary-50/40 p-3">
                            <p className="mb-3 text-sm font-bold text-gray-900">Editing this car</p>
                            {renderCarForm({
                              onSubmit: handleUpdateCar,
                              submitLabel: 'Update Car',
                              listId: `car-model-names-edit-mobile-${car.id}`,
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Fleet Schedule Visualizer */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-4 md:mb-5">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">Fleet Schedule</h3>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1 font-medium">
              {scheduleWeekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {' – '}
              {new Date(scheduleWeekEnd.getTime() - 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <button
              onClick={() => { setScheduleWeekOffset(o => o - 1); setScheduleFocusDate('') }}
              className="px-2.5 md:px-3 py-1.5 md:py-2 border rounded-lg text-xs md:text-sm hover:bg-gray-50 font-medium"
            >
              ← Prev
            </button>
            <button
              onClick={() => { setScheduleWeekOffset(0); setScheduleFocusDate('') }}
              className="px-2.5 md:px-3 py-1.5 md:py-2 border rounded-lg text-xs md:text-sm hover:bg-gray-50 font-bold"
            >
              Today
            </button>
            <button
              onClick={() => { setScheduleWeekOffset(o => o + 1); setScheduleFocusDate('') }}
              className="px-2.5 md:px-3 py-1.5 md:py-2 border rounded-lg text-xs md:text-sm hover:bg-gray-50 font-medium"
            >
              Next →
            </button>
            <div className="w-px h-5 md:h-6 bg-gray-200 mx-0.5 md:mx-1 hidden md:block" />
            <div className="relative">
              <button
                type="button"
                onClick={() => scheduleDateInputRef.current?.showPicker()}
                className="flex items-center gap-1 text-xs md:text-sm text-gray-500 border rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 hover:bg-gray-50 whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 md:w-4 h-3 md:h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">
                  {scheduleFocusDate
                    ? new Date(scheduleFocusDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Jump to date'}
                </span>
                <span className="sm:hidden">📅</span>
              </button>
              <input
                ref={scheduleDateInputRef}
                type="date"
                value={scheduleFocusDate}
                onChange={e => handleScheduleDatePick(e.target.value)}
                style={{ position: 'absolute', bottom: 0, left: 0, width: '1px', height: '1px', opacity: 0, pointerEvents: 'none', fontSize: '16px' }}
              />
            </div>
            {scheduleFocusDate && (
              <button
                onClick={() => setScheduleFocusDate('')}
                className="text-xs text-gray-400 hover:text-gray-600 px-1.5 md:px-2 py-1.5 md:py-2 border rounded-lg hover:bg-gray-50"
                title="Clear focus date"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Desktop Schedule View */}
        <div className="hidden md:block overflow-x-auto">
          <div style={{ minWidth: '700px' }}>
            {/* Day headers */}
            <div className="flex border-b pb-2 mb-1">
              <div className="w-44 shrink-0" />
              {scheduleDays.map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString()
                const isFocused = scheduleFocusDate
                  ? day.toDateString() === new Date(scheduleFocusDate + 'T00:00:00').toDateString()
                  : false
                return (
                  <div
                    key={i}
                    className={`flex-1 text-center text-xs font-semibold py-1 rounded-t ${
                      isFocused ? 'text-amber-700 bg-amber-50' :
                      isToday   ? 'text-secondary-600' : 'text-gray-500'
                    }`}
                  >
                    <div>{day.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                    <div className={`text-base font-bold ${
                      isFocused ? 'text-amber-700' :
                      isToday   ? 'text-secondary-600' : 'text-gray-800'
                    }`}>
                      {day.getDate()}
                    </div>
                    {isFocused && <div className="text-xs font-medium mt-0.5">◀ selected</div>}
                  </div>
                )
              })}
            </div>

            {/* Schedule filters */}
            {cars.length > 0 && (
              <div className="flex flex-wrap gap-2 py-3 border-b mb-1">
                <input
                  type="text"
                  placeholder="Filter by model, driver, plate…"
                  value={scheduleSearchQuery}
                  onChange={e => setScheduleSearchQuery(e.target.value)}
                  className="input-field !py-1.5 !text-xs flex-1 min-w-[160px]"
                />
                <select
                  value={scheduleFilterClass}
                  onChange={e => setScheduleFilterClass(e.target.value)}
                  className="input-field !py-1.5 !text-xs w-auto"
                >
                  <option value="">All Classes</option>
                  {carClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <select
                  value={scheduleFilterStatus}
                  onChange={e => setScheduleFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                  className="input-field !py-1.5 !text-xs w-auto"
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
                {hasActiveScheduleFilters && (
                  <button
                    onClick={() => { setScheduleSearchQuery(''); setScheduleFilterStatus('all'); setScheduleFilterClass('') }}
                    className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 border rounded-lg hover:bg-gray-50"
                  >
                    Clear
                  </button>
                )}
                {hasActiveScheduleFilters && (
                  <span className="self-center text-xs text-gray-400 ml-1">
                    {filteredScheduleCars.length} of {cars.length} shown
                  </span>
                )}
              </div>
            )}

            {/* Car rows */}
            {cars.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No cars to display.</p>
            ) : filteredScheduleCars.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No cars match the schedule filters.</p>
            ) : filteredScheduleCars.map((car) => {
              const carAssignments = vehicleAssignments.filter(a => a.car_id === car.id)
              return (
                <div key={car.id} className="flex items-stretch border-b last:border-0" style={{ minHeight: '60px' }}>
                  {/* Car label */}
                  <div className="w-44 shrink-0 py-3 pr-3 flex flex-col justify-center">
                    <p className="font-semibold text-sm text-gray-900 leading-tight">{car.model_name}</p>
                    <p className="text-xs text-gray-500 leading-tight">{car.driver_name}</p>
                    <p className="text-xs font-mono text-gray-400 leading-tight">{car.number_plate}</p>
                    {!car.is_active && (
                      <span className="text-xs text-red-400 font-medium mt-0.5">Inactive</span>
                    )}
                  </div>
                  {/* Timeline */}
                  <div className="flex-1 relative" style={{ minHeight: '60px' }}>
                    {/* Day grid columns */}
                    {scheduleDays.map((day, i) => {
                      const isToday = day.toDateString() === new Date().toDateString()
                      const isFocused = scheduleFocusDate
                        ? day.toDateString() === new Date(scheduleFocusDate + 'T00:00:00').toDateString()
                        : false
                      return (
                        <div
                          key={i}
                          className={`absolute top-0 bottom-0 border-l ${
                            isFocused ? 'border-amber-300 bg-amber-50/50' :
                            isToday   ? 'border-secondary-200 bg-secondary-50/40' : 'border-gray-100'
                          }`}
                          style={{ left: `${(i / 7) * 100}%`, width: `${(1 / 7) * 100}%` }}
                        />
                      )
                    })}
                    {/* Assignment blocks */}
                    {carAssignments.map((assignment) => {
                      const aStart = new Date(assignment.start_datetime)
                      const aEnd = new Date(assignment.end_datetime)
                      if (aEnd <= scheduleWeekStart || aStart >= scheduleWeekEnd) return null
                      const clampedStart = Math.max(aStart.getTime(), scheduleWeekStart.getTime())
                      const clampedEnd = Math.min(aEnd.getTime(), scheduleWeekEnd.getTime())
                      const leftPct = (clampedStart - scheduleWeekStart.getTime()) / scheduleWeekDurationMs * 100
                      const widthPct = (clampedEnd - clampedStart) / scheduleWeekDurationMs * 100
                      const booking = bookings.find(b => b.booking_id === assignment.booking_id)
                      const typeColor =
                        booking?.booking_type === 'taxi' ? 'bg-blue-500 hover:bg-blue-600' :
                        booking?.booking_type === 'tour'    ? 'bg-emerald-500 hover:bg-emerald-600' :
                                                             'bg-purple-500 hover:bg-purple-600'
                      // Use minWidth so even short bookings (minutes) render as a visible bar
                      const isTiny = widthPct < 1.5
                      return (
                        <button
                          key={assignment.id}
                          className={`absolute top-2 bottom-2 rounded text-white text-xs overflow-hidden text-left transition-colors shadow-sm ${typeColor} ${isTiny ? 'px-0.5' : 'px-1.5'}`}
                          style={{ left: `calc(${leftPct}% + 1px)`, width: `calc(${widthPct}% - 2px)`, minWidth: '6px' }}
                          onClick={() => setSelectedScheduleAssignment({ assignment, booking, car })}
                          title={booking ? `${booking.user_name} · ${booking.booking_type}` : assignment.booking_id}
                        >
                          {!isTiny && (
                            <>
                              <span className="truncate block font-medium leading-tight">
                                {booking?.user_name || assignment.booking_id}
                              </span>
                              <span className="truncate block opacity-80 leading-tight capitalize">
                                {booking?.booking_type || ''}
                              </span>
                            </>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Legend */}
            <div className="flex gap-5 mt-5 pt-4 border-t text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Taxi</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Tour</span>
            </div>
          </div>
        </div>

        {/* Mobile Schedule View - Simplified Day View */}
        <div className="md:hidden space-y-2">
          {/* Schedule filters */}
          {cars.length > 0 && (
            <div className="flex flex-col gap-2 py-2 pb-3 border-b mb-2">
              <input
                type="text"
                placeholder="Filter by model, driver…"
                value={scheduleSearchQuery}
                onChange={e => setScheduleSearchQuery(e.target.value)}
                className="input-field !py-2 !text-xs"
              />
              <div className="flex gap-1.5">
                <select
                  value={scheduleFilterClass}
                  onChange={e => setScheduleFilterClass(e.target.value)}
                  className="input-field !py-2 !text-xs flex-1"
                >
                  <option value="">All Classes</option>
                  {carClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <select
                  value={scheduleFilterStatus}
                  onChange={e => setScheduleFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                  className="input-field !py-2 !text-xs flex-1"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {hasActiveScheduleFilters && (
                <button
                  onClick={() => { setScheduleSearchQuery(''); setScheduleFilterStatus('all'); setScheduleFilterClass('') }}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 border rounded-lg hover:bg-gray-50 text-center"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Cars list - Mobile card view */}
          {cars.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No cars to display.</p>
          ) : filteredScheduleCars.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No cars match the filters.</p>
          ) : (
            filteredScheduleCars.map((car) => {
              const carAssignments = vehicleAssignments.filter(a => a.car_id === car.id)
              const weekAssignments = carAssignments.filter(a => {
                const aStart = new Date(a.start_datetime)
                const aEnd = new Date(a.end_datetime)
                return aEnd > scheduleWeekStart && aStart < scheduleWeekEnd
              })
              return (
                <div key={car.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-3">
                    <p className="font-semibold text-sm">{car.model_name}</p>
                    <p className="text-xs text-gray-300 mt-0.5">{car.driver_name} • {car.number_plate}</p>
                    {!car.is_active && <p className="text-xs text-red-300 mt-1">● Inactive</p>}
                  </div>

                  {/* Week's assignments */}
                  <div className="p-3">
                    {weekAssignments.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">This Week's Schedule</p>
                        {weekAssignments.map((assignment) => {
                          const booking = bookings.find(b => b.booking_id === assignment.booking_id)
                          const startDate = new Date(assignment.start_datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          const startTime = new Date(assignment.start_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
                          const endTime = new Date(assignment.end_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
                          const typeColor = booking?.booking_type === 'taxi' ? 'bg-blue-100 text-blue-800' :
                                           booking?.booking_type === 'tour' ? 'bg-emerald-100 text-emerald-800' :
                                           'bg-purple-100 text-purple-800'
                          return (
                            <button
                              key={assignment.id}
                              onClick={() => setSelectedScheduleAssignment({ assignment, booking, car })}
                              className="w-full text-left p-2 rounded border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-start gap-2">
                                <div className={`px-2 py-0.5 rounded text-xs font-semibold ${typeColor} shrink-0 whitespace-nowrap`}>
                                  {booking?.booking_type || 'booking'}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-gray-900 truncate">{booking?.user_name || assignment.booking_id}</p>
                                  <p className="text-xs text-gray-500">{startDate} • {startTime}–{endTime}</p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 py-2 text-center">No bookings this week</p>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Legend */}
          <div className="flex gap-3 mt-3 pt-3 border-t text-xs text-gray-500 justify-center">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500 inline-block" /> Taxi</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 inline-block" /> Tour</span>
          </div>
        </div>
      </div>

      {/* Assignment detail popup */}
      {selectedScheduleAssignment && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedScheduleAssignment(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-bold">Assignment Details</h4>
              <button
                onClick={() => setSelectedScheduleAssignment(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Vehicle</p>
                  <p className="font-medium">{selectedScheduleAssignment.car.model_name}</p>
                  <p className="text-gray-400 font-mono text-xs">{selectedScheduleAssignment.car.number_plate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Driver</p>
                  <p className="font-medium">{selectedScheduleAssignment.car.driver_name}</p>
                  <p className="text-gray-400 text-xs">{selectedScheduleAssignment.car.driver_phone}</p>
                </div>
              </div>
              {selectedScheduleAssignment.booking ? (
                <>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Customer</p>
                    <p className="font-medium">{selectedScheduleAssignment.booking.user_name}</p>
                    <p className="text-gray-400 text-xs">{selectedScheduleAssignment.booking.phone}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Type</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        selectedScheduleAssignment.booking.booking_type === 'taxi' ? 'bg-blue-100 text-blue-800' :
                        selectedScheduleAssignment.booking.booking_type === 'tour'    ? 'bg-emerald-100 text-emerald-800' :
                                                                                        'bg-purple-100 text-purple-800'
                      }`}>
                        {selectedScheduleAssignment.booking.booking_type}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Passengers</p>
                      <p className="font-medium">{selectedScheduleAssignment.booking.passenger_count}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Booking ID</p>
                    <p className="font-mono text-xs text-gray-600">{selectedScheduleAssignment.booking.booking_id}</p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Booking Ref</p>
                  <p className="font-mono text-xs text-gray-600">{selectedScheduleAssignment.assignment.booking_id}</p>
                </div>
              )}
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Scheduled Window</p>
                <p className="text-gray-700">
                  {new Date(selectedScheduleAssignment.assignment.start_datetime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-gray-400 text-xs">
                  to {new Date(selectedScheduleAssignment.assignment.end_datetime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
  };

  const renderDestinationEditForm = (compact = false) => (
    <form onSubmit={handleUpdateDestination} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Destination Name (e.g., Guwahati)"
          className="input-field"
          value={destinationData.name}
          onChange={(e) => setDestinationData({ ...destinationData, name: e.target.value })}
          required
        />
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Duration - Hours *</label>
            <input
              type="number"
              placeholder="e.g. 4"
              className="input-field w-full"
              min="0"
              max="99"
              value={destinationData.duration_hours}
              onChange={(e) => setDestinationData({ ...destinationData, duration_hours: e.target.value })}
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Minutes</label>
            <select
              className="input-field w-full"
              value={destinationData.duration_mins}
              onChange={(e) => setDestinationData({ ...destinationData, duration_mins: e.target.value })}
            >
              <option value="0">0 mins</option>
              <option value="15">15 mins</option>
              <option value="30">30 mins</option>
              <option value="45">45 mins</option>
            </select>
          </div>
        </div>
        <input
          type="text"
          placeholder="Description (optional)"
          className={`input-field ${compact ? '' : 'md:col-span-2'}`}
          value={destinationData.description}
          onChange={(e) => setDestinationData({ ...destinationData, description: e.target.value })}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={cancelEditDestination}
          className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-semibold"
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary text-sm">
          Update Destination
        </button>
      </div>
    </form>
  )

  const renderDestinations = () => (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      {/* Add Destination Form */}
      {showAddDestination && (
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Add New Destination</h3>
          <form onSubmit={handleAddDestination} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Destination Name (e.g., Guwahati)"
                className="input-field"
                value={destinationData.name}
                onChange={(e) => setDestinationData({ ...destinationData, name: e.target.value })}
                required
              />
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Duration — Hours *</label>
                  <input
                    type="number"
                    placeholder="e.g. 4"
                    className="input-field w-full"
                    min="0"
                    max="99"
                    value={destinationData.duration_hours}
                    onChange={(e) => setDestinationData({ ...destinationData, duration_hours: e.target.value })}
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                  <select
                    className="input-field w-full"
                    value={destinationData.duration_mins}
                    onChange={(e) => setDestinationData({ ...destinationData, duration_mins: e.target.value })}
                  >
                    <option value="0">0 mins</option>
                    <option value="15">15 mins</option>
                    <option value="30">30 mins</option>
                    <option value="45">45 mins</option>
                  </select>
                </div>
              </div>
              <input
                type="text"
                placeholder="Description (optional)"
                className="input-field"
                value={destinationData.description}
                onChange={(e) => setDestinationData({ ...destinationData, description: e.target.value })}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelEditDestination}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Add Destination
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Destinations List */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">Manage Destinations</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filteredDestinations.length} of {destinations.length} destination{destinations.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 min-w-0 md:min-w-[260px]">
              <input
                type="text"
                placeholder="Search destination, description, ID..."
                className="input-field w-full pl-9 text-sm"
                value={destinationSearchQuery}
                onChange={(e) => setDestinationSearchQuery(e.target.value)}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {!showAddDestination && !editingDestination && (
              <button onClick={() => setShowAddDestination(true)} className="btn-primary text-sm md:text-base">
                Add New Destination
              </button>
            )}
          </div>
        </div>

        {loadingDestinations ? (
          <p className="text-gray-600">Loading destinations...</p>
        ) : destinations.length === 0 ? (
          <p className="text-gray-600">No destinations available. Add a new destination to get started.</p>
        ) : filteredDestinations.length === 0 ? (
          <p className="text-gray-600">No destinations match "{destinationSearchQuery.trim()}".</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Estimated Duration</th>
                    <th className="text-left py-3 px-4 font-semibold">Description</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDestinations.map((destination) => (
                    <Fragment key={destination.id}>
                      <tr className={`border-b hover:bg-gray-50 ${editingDestination?.id === destination.id ? 'bg-secondary-50/40' : ''}`}>
                        <td className="py-3 px-4 font-semibold">{destination.name}</td>
                        <td className="py-3 px-4">{formatDurationMinutes(destination.estimated_duration_minutes)}</td>
                        <td className="py-3 px-4">{destination.description || '-'}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openDestinationFareModal(destination)}
                              className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100"
                            >
                              Assign Fares
                            </button>
                            <button
                              onClick={() => startEditDestination(destination)}
                              className="text-sm text-secondary-500 hover:text-secondary-600"
                            >
                              {editingDestination?.id === destination.id ? 'Editing' : 'Edit'}
                            </button>
                            <button
                              onClick={() => handleDeleteDestination(destination.id)}
                              className="text-sm text-red-500 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editingDestination?.id === destination.id && (
                        <tr className="border-b bg-secondary-50/30">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="rounded-xl border border-secondary-200 bg-white p-4 shadow-sm">
                              <div className="mb-3">
                                <p className="text-sm font-bold text-gray-900">Editing {destination.name}</p>
                                <p className="text-xs text-gray-500">Update details in place, then save or cancel.</p>
                              </div>
                              {renderDestinationEditForm()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {filteredDestinations.map((destination) => (
                <div key={destination.id} className={`rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow ${editingDestination?.id === destination.id ? 'border-secondary-300 ring-2 ring-secondary-100' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-base text-gray-900">{destination.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDurationMinutes(destination.estimated_duration_minutes)}
                      </p>
                    </div>
                  </div>
                  
                  {destination.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{destination.description}</p>
                  )}
                  
                  <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                    <button
                      onClick={() => openDestinationFareModal(destination)}
                      className="flex-1 rounded-xl border border-sky-200 bg-sky-50 py-2 text-sm font-semibold text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100 active:bg-sky-100"
                    >
                      Assign Fares
                    </button>
                    <button
                      onClick={() => startEditDestination(destination)}
                      className="flex-1 py-2 text-sm font-medium text-secondary-600 hover:bg-secondary-50 rounded active:bg-secondary-100 transition-colors"
                    >
                      {editingDestination?.id === destination.id ? 'Editing' : 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDeleteDestination(destination.id)}
                      className="flex-1 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded active:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  {editingDestination?.id === destination.id && (
                    <div className="mt-4 rounded-xl border border-secondary-200 bg-secondary-50/40 p-3">
                      <p className="mb-3 text-sm font-bold text-gray-900">Editing this destination</p>
                      {renderDestinationEditForm(true)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showDestinationFareModal && selectedDestinationForFares && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
          <div className={`w-full max-w-2xl max-h-[76dvh] overflow-hidden rounded-[24px] border shadow-2xl flex flex-col ${
            darkMode ? 'border-slate-600 bg-slate-900' : 'border-gray-200 bg-white'
          }`}>
              <div className={`border-b px-6 py-4 ${
                darkMode
                  ? 'border-slate-700 bg-slate-950'
                  : 'border-gray-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_100%)]'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className={`text-lg font-bold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>Assign Fixed Fares - {selectedDestinationForFares.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeDestinationFareModal}
                    className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                      darkMode
                        ? 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className={`flex min-h-0 flex-1 flex-col overflow-hidden p-6 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                {loadingDestinationFares ? (
                  <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Loading current fares...</p>
                ) : activeCarModels.length === 0 ? (
                  <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>No active car models found. Add and activate cars first.</p>
                ) : (
                  <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-2 scrollbar-thin-modern">
                    {activeCarModels.map((modelName) => (
                      <div key={modelName} className={`grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_160px] sm:items-center ${
                        darkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-gray-50/60'
                      }`}>
                        <div>
                          <p className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{modelName}</p>
                        </div>
                        <div className={`rounded-xl border px-3 py-1.5 focus-within:border-secondary-400 transition-colors shadow-sm ${
                          darkMode ? 'border-slate-600 bg-slate-950' : 'border-gray-200 bg-white'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-gray-400'}`}>&#8377;</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="e.g. 3500"
                            className={`w-full bg-transparent text-sm font-bold focus:outline-none ${
                              darkMode ? 'text-white placeholder:text-slate-400' : 'text-gray-900 placeholder:text-gray-400'
                            }`}
                            value={destinationFaresDraft[modelName] || ''}
                            onChange={(e) =>
                              setDestinationFaresDraft((prev) => ({
                                ...prev,
                                [modelName]: e.target.value,
                              }))
                            }
                          />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`flex items-center justify-end gap-3 border-t p-6 ${
                darkMode ? 'border-slate-700 bg-slate-950' : 'border-gray-100 bg-gray-50/30'
              }`}>
                <button
                  type="button"
                  onClick={closeDestinationFareModal}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                    darkMode ? 'text-slate-300 hover:text-white' : 'text-gray-500 hover:text-gray-950'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDestinationFares}
                  disabled={savingDestinationFares}
                  className="rounded-xl bg-secondary-500 px-8 py-2.5 text-sm font-black text-primary-950 shadow-lg shadow-secondary-500/20 transition-all hover:bg-secondary-400 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {savingDestinationFares ? 'Saving...' : 'Save Fares'}
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderTours = () => (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      {/* Add/Edit Tour Form */}
      {(showAddTour || editingTour) && (
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">{editingTour ? 'Edit Tour' : 'Add New Tour'}</h3>
          <form onSubmit={editingTour ? handleUpdateTour : handleAddTour} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Tour Name (required)"
                className="input-field"
                value={tourData.name}
                onChange={(e) => setTourData({ ...tourData, name: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Price (Rs.) (required)"
                className="input-field"
                step="0.01"
                value={tourData.price}
                onChange={(e) => setTourData({ ...tourData, price: e.target.value })}
                required
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Departure Time</label>
                <input
                  type="time"
                  className="input-field"
                  value={tourData.arrival_time}
                  onChange={(e) => setTourData({ ...tourData, arrival_time: e.target.value })}
                />
              </div>
              <input
                type="number"
                placeholder="Duration (Hours)"
                className="input-field"
                value={tourData.duration_hours}
                onChange={(e) => setTourData({ ...tourData, duration_hours: e.target.value })}
              />
              <input
                type="number"
                placeholder="Max Passengers"
                className="input-field"
                value={tourData.max_passengers}
                onChange={(e) => setTourData({ ...tourData, max_passengers: e.target.value })}
              />
              <select
                className="input-field"
                value={tourData.car_model}
                onChange={(e) => setTourData({ ...tourData, car_model: e.target.value })}
              >
                <option value="">Select Car Model (optional)</option>
                {[...new Set(cars.filter(c => c.is_active).map(c => c.model_name))].sort().map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              {/* Image Upload Section */}
              <div className="border rounded-lg p-4 bg-gray-50 col-span-1 md:col-span-2">
                <label className="text-xs text-gray-600 font-semibold mb-3 block">Tour Images ({tourData.image_urls.length} added)</label>
                <div className="space-y-3">
                  {/* Image Grid */}
                  {tourData.image_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tourData.image_urls.map((url, i) => (
                        <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                          <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleDeleteTourImage(url, i)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 transition-colors text-xs"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* File Upload */}
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={tourImageUploading}
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) { handleTourImageUpload(file); e.target.value = '' } }}
                      className="hidden"
                      id="tour-image-upload"
                    />
                    <label
                      htmlFor="tour-image-upload"
                      className={`block w-full p-3 text-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${tourImageUploading ? 'bg-gray-100 border-gray-300 text-gray-400' : 'border-blue-300 hover:bg-blue-50 text-gray-700'}`}
                    >
                      {tourImageUploading ? '⏳ Uploading...' : '📁 Click to upload image'}
                    </label>
                  </div>
                  {/* OR + URL input */}
                  <div className="relative flex items-center gap-2 py-1">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="text-xs text-gray-500 font-medium">OR add by URL</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      className="input-field flex-1"
                      value={tourImageUrlInput}
                      onChange={(e) => setTourImageUrlInput(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={!tourImageUrlInput.trim()}
                      onClick={() => {
                        const url = tourImageUrlInput.trim()
                        if (url) {
                          setTourData(prev => ({ ...prev, image_urls: [...prev.image_urls, url] }))
                          setTourImageUrlInput('')
                        }
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >Add</button>
                  </div>
                </div>
              </div>
            </div>
            <textarea
              placeholder="Description"
              className="input-field w-full"
              rows={3}
              value={tourData.description}
              onChange={(e) => setTourData({ ...tourData, description: e.target.value })}
            />
            <textarea
              placeholder="Itinerary"
              className="input-field w-full"
              rows={3}
              value={tourData.itinerary}
              onChange={(e) => setTourData({ ...tourData, itinerary: e.target.value })}
            />
            <input
              type="text"
              placeholder="Highlights (comma-separated, e.g., Beach, Mountains, Temple)"
              className="input-field w-full"
              value={tourData.highlights}
              onChange={(e) => setTourData({ ...tourData, highlights: e.target.value })}
            />

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelEditTour}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingTour ? 'Update Tour' : 'Add Tour'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tours List */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
          <h3 className="text-xl md:text-2xl font-bold">Manage Tours</h3>
          {!showAddTour && !editingTour && (
            <button
              onClick={() => {
                setShowAddTour(true)
              }}
              className="btn-primary text-sm md:text-base"
            >
              Add New Tour
            </button>
          )}
        </div>

        {loadingTours ? (
          <p className="text-gray-600">Loading tours...</p>
        ) : tours.length === 0 ? (
          <p className="text-gray-600">No tours available. Add a new tour to get started.</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Price</th>
                    <th className="text-left py-3 px-4 font-semibold">Departure Time</th>
                    <th className="text-left py-3 px-4 font-semibold">Duration</th>
                    <th className="text-left py-3 px-4 font-semibold">Max Pax</th>
                    <th className="text-left py-3 px-4 font-semibold">Car Model</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tours.map((tour) => (
                    <Fragment key={tour.id}>
                      <tr 
                        className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedTourId(expandedTourId === tour.id ? null : tour.id)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {(tour.image_urls?.[0] || tour.image_url) ? (
                              <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200">
                                <Image
                                  src={tour.image_urls?.[0] || tour.image_url!}
                                  alt={tour.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center text-secondary-700 font-bold shrink-0 border border-secondary-200 uppercase">
                                {tour.name.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold">{tour.name}</span>
                            <span className={`text-[10px] text-gray-400 ml-auto transition-transform ${expandedTourId === tour.id ? 'rotate-180' : ''}`}>
                              ▼
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">Rs. {toNum(tour.price).toFixed(2)}</td>
                        <td className="py-3 px-4 text-sm">
                          {tour.arrival_time
                            ? (() => {
                                const match = String(tour.arrival_time).match(/[T\s]?(\d{2}):(\d{2})/)
                                return match ? `${match[1]}:${match[2]}` : '-'
                              })()
                            : '-'}
                        </td>
                        <td className="py-3 px-4">{tour.duration_hours ? `${tour.duration_hours}h` : '-'}</td>
                        <td className="py-3 px-4">{tour.max_passengers || '-'}</td>
                        <td className="py-3 px-4">{tour.car_model || '-'}</td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditTour(tour)}
                              className="text-sm text-secondary-500 hover:text-secondary-600 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTour(tour.id)}
                              className="text-sm text-red-500 hover:text-red-600 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedTourId === tour.id && (
                        <tr className="bg-gray-50 border-b">
                          <td colSpan={7} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description</p>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{tour.description || 'No description provided.'}</p>
                              </div>
                              <div className="space-y-6">
                                <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Itinerary</p>
                                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap italic">{tour.itinerary || 'No itinerary detailed.'}</p>
                                </div>
                                {tour.highlights && tour.highlights.length > 0 && (
                                  <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Highlights</p>
                                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                      {tour.highlights.map((h, i) => (
                                        <li key={i}>{h}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {tours.map((tour) => (
                <div 
                  key={tour.id} 
                  className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setExpandedTourId(expandedTourId === tour.id ? null : tour.id)}
                >
                  {/* Card Image/Header */}
                  <div className="bg-gradient-to-r from-secondary-500 to-secondary-600 p-4 text-white relative">
                    <div className="flex items-center gap-3 mb-2">
                      {(tour.image_urls?.[0] || tour.image_url) ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-white/30 shadow-sm">
                          <Image
                            src={tour.image_urls?.[0] || tour.image_url!}
                            alt={tour.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold shrink-0 border-2 border-white/30 shadow-sm uppercase">
                          {tour.name.charAt(0)}
                        </div>
                      )}
                      <h4 className="font-semibold text-base line-clamp-2">{tour.name}</h4>
                    </div>
                    <p className="text-2xl font-bold">Rs. {toNum(tour.price).toLocaleString('en-IN')}</p>
                    <div className={`absolute top-4 right-4 text-white/70 transition-transform ${expandedTourId === tour.id ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Departure Time</p>
                        <p className="text-sm text-gray-900">
                          {tour.arrival_time
                            ? (() => {
                                const match = String(tour.arrival_time).match(/[T\s]?(\d{2}):(\d{2})/)
                                return match ? `${match[1]}:${match[2]}` : '-'
                              })()
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Duration</p>
                        <p className="text-sm text-gray-900">{tour.duration_hours ? `${tour.duration_hours} hrs` : '-'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Passengers</p>
                        <p className="text-sm text-gray-900">{tour.max_passengers || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Car Model</p>
                        <p className="text-sm text-gray-900">{tour.car_model || '-'}</p>
                      </div>
                    </div>

                    {tour.description && (
                      <div className={`pt-2 border-t border-gray-100 transition-all ${expandedTourId === tour.id ? '' : 'line-clamp-2'}`}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
                        <p className={`text-sm text-gray-600 ${expandedTourId === tour.id ? '' : 'line-clamp-2'}`}>{tour.description}</p>
                      </div>
                    )}

                    {expandedTourId === tour.id && (
                      <div className="space-y-3 pt-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        {tour.itinerary && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Itinerary</p>
                            <p className="text-sm text-gray-700 italic">{tour.itinerary}</p>
                          </div>
                        )}
                        {tour.highlights && tour.highlights.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Highlights</p>
                            <p className="text-sm text-gray-700">{tour.highlights.join(' • ')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="px-4 py-3 border-t border-gray-100 flex gap-2 bg-gray-50" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => startEditTour(tour)}
                      className="flex-1 py-2 text-sm font-medium text-secondary-600 hover:bg-secondary-50 rounded active:bg-secondary-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTour(tour.id)}
                      className="flex-1 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded active:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )

  const analytics = useMemo(() => {
    const bookingStatusById = new Map(
      bookings.map((booking) => [booking.booking_id || booking.id, booking.booking_status || 'pending'] as const)
    )
    const revenueRowByBookingId = new Map(
      revenueSnapshot.rows.map((row) => [row.bookingId, row] as const)
    )

    const totalRevenue = revenueSnapshot.totalRevenue
    const completedBookings = bookings.filter((booking) => booking.booking_status === 'completed').length
    const pendingBookings = bookings.filter((booking) => booking.booking_status === 'pending').length
    const confirmedBookings = bookings.filter((booking) => booking.booking_status === 'confirmed').length
    const cancelledBookings = bookings.filter((booking) => booking.booking_status === 'cancelled').length
    const averageBookingValue = revenueSnapshot.averageBookingValue

    // Real payment statistics
    const revenuePayments = payments.filter((payment) => {
      const status = bookingStatusById.get(payment.booking_id)
      return status === 'confirmed' || status === 'completed'
    })
    const totalPaidGross = revenuePayments.reduce((sum, p) => sum + toNum(p.amount_online_paid), 0)
    const totalCashCollectedGross = revenuePayments.reduce((sum, p) => sum + toNum(p.amount_cash_paid), 0)
    const totalRefundsProcessed = revenuePayments.reduce(
      (sum, p) => sum + (p.refund_status === 'processed' ? Math.max(0, toNum(p.refund_amount)) : 0),
      0
    )
    const totalPaid = Math.max(0, totalPaidGross - totalRefundsProcessed)
    const totalCashCollected = totalCashCollectedGross
    const paidBookings = revenuePayments.filter((p) => p.payment_status === 'paid').length
    const partialPayments = revenuePayments.filter((p) => p.payment_status === 'partial').length
    const pendingPayments = revenuePayments.filter((p) => p.payment_status === 'pending').length
    // Free bookings awaiting collection. Deliberately NOT taken from
    // revenuePayments: that set is limited to confirmed/completed bookings,
    // and an unpaid booking is still 'pending' — it would always count zero.
    // Cancelled bookings are excluded since there is nothing left to chase.
    const unpaidPayments = payments.filter((p) => {
      if (p.payment_status !== 'unpaid') return false
      const status = bookingStatusById.get(p.booking_id)
      return status !== 'cancelled'
    })
    const unpaidBookings = unpaidPayments.length
    const unpaidValue = unpaidPayments.reduce(
      (sum, p) => sum + Math.max(0, toNum(p.amount_total) - toNum(p.amount_online_paid) - toNum(p.amount_cash_paid)),
      0
    )
    const totalOutstanding = revenueSnapshot.totalOutstanding

    // Real booking trend - group by date (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toISOString().slice(0, 10)
    })

    const bookingTrend = last7Days.map((dateStr) => {
      const dayBookings = bookings.filter((b) => b.start_datetime && b.start_datetime.slice(0, 10) === dateStr)
      const dayRevenue = dayBookings.reduce((sum, b) => {
        const bookingId = b.booking_id || b.id
        const row = revenueRowByBookingId.get(bookingId)
        return sum + (row?.netCollected || 0)
      }, 0)
      const dayName = new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' })
      return { date: dayName, bookings: dayBookings.length, revenue: dayRevenue }
    })

    // Real top destinations - count bookings per destination
    const destinationBookingCounts = bookings
      .filter((b) => b.destination_id)
      .reduce(
        (acc, b) => {
          acc[b.destination_id!] = (acc[b.destination_id!] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

    const topDestinations = destinations
      .map((dest) => ({
        name: dest.name,
        bookings: destinationBookingCounts[dest.id] || 0,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5)

    // Real top tours - count bookings per tour
    const tourBookingCounts = bookings
      .filter((b) => b.tour_package_id)
      .reduce(
        (acc, b) => {
          acc[b.tour_package_id!] = (acc[b.tour_package_id!] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

    const topTours = tours
      .map((tour) => ({
        name: tour.name,
        bookings: tourBookingCounts[tour.id] || 0,
        revenue: revenueSnapshot.rows
          .filter((row) => row.booking.tour_package_id === tour.id && row.isRevenueStatus)
          .reduce((sum, row) => sum + row.netCollected, 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Calculate tour revenue from topTours
    const tourRevenue = topTours.reduce((sum, tour) => sum + tour.revenue, 0)

    const fleetUtilization = bookings.length > 0 ? (bookings.filter((b) => b.car_model).length / bookings.length) * 100 : 0
    const completionRate = bookings.length > 0 ? (completedBookings / bookings.length) * 100 : 0
    const cancellationRate = bookings.length > 0 ? (cancelledBookings / bookings.length) * 100 : 0
    const paymentCollectionRate = revenueSnapshot.billableValue > 0
      ? ((totalPaid + totalCashCollected) / revenueSnapshot.billableValue) * 100
      : 0

    const activeBookingsForOps = bookings.filter((b) => b.booking_status === 'pending' || b.booking_status === 'confirmed')
    const assignedActiveBookings = activeBookingsForOps.filter((b) =>
      vehicleAssignments.some((a) => a.booking_id === (b.booking_id || b.id))
    ).length
    const assignmentCoverage = activeBookingsForOps.length > 0
      ? (assignedActiveBookings / activeBookingsForOps.length) * 100
      : 0

    const bookingTypeStats = (['taxi', 'tour'] as const).map((type) => {
      const typeBookings = bookings.filter((b) => b.booking_type === type)
      const typeRevenue = revenueSnapshot.rows
        .filter((row) => row.booking.booking_type === type && row.isRevenueStatus)
        .reduce((sum, row) => sum + row.netCollected, 0)
      return { type, count: typeBookings.length, revenue: typeRevenue }
    })

    const upcomingDepartures = bookings
      .filter((b) => {
        if (!b.start_datetime) return false
        const startMs = new Date(b.start_datetime).getTime()
        if (Number.isNaN(startMs)) return false
        return startMs >= Date.now() && (b.booking_status === 'pending' || b.booking_status === 'confirmed')
      })
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
      .slice(0, 8)

    const bookingDemandByHour = Array.from({ length: 24 }, (_, hour) => {
      const count = bookings.filter((b) => {
        if (!b.start_datetime) return false
        const d = new Date(b.start_datetime)
        if (Number.isNaN(d.getTime())) return false
        return d.getHours() === hour
      }).length
      return { hour, count }
    }).sort((a, b) => b.count - a.count)

    const topDemandHours = bookingDemandByHour.slice(0, 5)

    return {
      totalRevenue,
      totalPaid,
      totalCashCollected,
      paidBookings,
      partialPayments,
      pendingPayments,
      unpaidBookings,
      unpaidValue,
      totalOutstanding,
      completedBookings,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      averageBookingValue,
      fleetUtilization,
      completionRate,
      cancellationRate,
      paymentCollectionRate,
      assignmentCoverage,
      bookingTrend,
      topDestinations,
      topTours,
      tourRevenue,
      bookingTypeStats,
      upcomingDepartures,
      topDemandHours,
      assignedActiveBookings,
      activeOpsCount: activeBookingsForOps.length,
    }
  }, [bookings, payments, tours, cars, destinations, vehicleAssignments, revenueSnapshot])

  const handleCreateAdmin = async () => {
    // Validate form
    if (!adminFormData.email || !adminFormData.password || !adminFormData.full_name) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(adminFormData.email)) {
      toast.error('Please enter a valid email address')
      return
    }

    // Validate password length
    if (adminFormData.password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    // Validate password match
    if (adminFormData.password !== adminFormData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setSubmittingAdmin(true)

    try {
      const token = localStorage.getItem('adminToken')
      if (!token) {
        toast.error('Not authenticated. Please log in again.')
        setSubmittingAdmin(false)
        return
      }

      const response = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: adminFormData.email,
          password: adminFormData.password,
          full_name: adminFormData.full_name,
          role: 'admin',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to create admin account')
        return
      }

      toast.success(`Admin account created successfully for ${data.admin.email}`)
      
      // Reset form
      setAdminFormData({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
      })
      setShowAddAdmin(false)
    } catch (error: any) {
      console.error('Error creating admin:', error)
      toast.error(error.message || 'Failed to create admin account')
    } finally {
      setSubmittingAdmin(false)
    }
  }

  const handleUpdateProfile = async () => {
    // Validate form
    if (!editProfileData.full_name || !editProfileData.email) {
      toast.error('Full name and email are required')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editProfileData.email)) {
      toast.error('Please enter a valid email address')
      return
    }

    // If changing password, validate
    if (editProfileData.newPassword) {
      if (!editProfileData.currentPassword) {
        toast.error('Current password is required to change password')
        return
      }

      if (editProfileData.newPassword.length < 8) {
        toast.error('New password must be at least 8 characters long')
        return
      }

      if (editProfileData.newPassword !== editProfileData.confirmNewPassword) {
        toast.error('New passwords do not match')
        return
      }
    }

    setSubmittingProfile(true)

    try {
      const token = localStorage.getItem('adminToken')
      if (!token) {
        toast.error('Not authenticated. Please log in again.')
        setSubmittingProfile(false)
        return
      }

      const response = await fetch('/api/admin/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: editProfileData.full_name,
          email: editProfileData.email,
          ...(editProfileData.newPassword && {
            currentPassword: editProfileData.currentPassword,
            newPassword: editProfileData.newPassword,
          }),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to update profile')
        return
      }

      toast.success('Profile updated successfully')
      updateAdminProfile({
        full_name: data?.admin?.full_name ?? null,
        email: data?.admin?.email ?? null,
      })
      setShowEditProfile(false)

      // Reset form
      setEditProfileData({
        full_name: data.admin.full_name || '',
        email: data.admin.email || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      })
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSubmittingProfile(false)
    }
  }

  const handleDashboardRefresh = async () => {
    await Promise.all([loadBookings(), loadPayments(), loadVehicleAssignments()])
    toast.success('Dashboard refreshed')
  }

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('adminDarkMode', next ? '1' : '0')
  }

  const toggleTabBarCollapsed = () => {
    const next = !tabBarCollapsed
    setTabBarCollapsed(next)
    localStorage.setItem('adminTabBarCollapsed', next ? '1' : '0')
  }

  const renderMisc = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-1">Settings</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">Admin panel configuration and utilities</p>

        <div className="space-y-2 md:space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Free Booking (Pay Later)</p>

          <div className="px-3 md:px-4 py-3 md:py-4 rounded-lg border border-gray-200 space-y-4">
            <p className="text-xs md:text-sm text-gray-500">
              Lets customers submit a booking without paying. The booking is recorded as
              <span className="font-semibold text-orange-700"> unpaid</span> and reserves that vehicle
              <span className="font-semibold"> only for the customer&apos;s own trip slot</span> — every other date
              and time stays bookable. If nobody pays within the window below, the slot reopens to other
              customers while the booking stays in your list for follow-up.
            </p>

            {([
              { key: 'free_booking_enabled_taxi', label: 'Taxi bookings', value: freeBookingTaxi, set: setFreeBookingTaxi },
              { key: 'free_booking_enabled_tour', label: 'Tour bookings', value: freeBookingTour, set: setFreeBookingTour },
            ] as const).map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm md:text-base">{row.label}</p>
                  <p className="text-xs text-gray-500">
                    {row.value ? 'Customers can book without paying' : 'Online payment required'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !row.value
                    row.set(next)
                    void saveFreeBookingSetting(row.key, next, row.label)
                  }}
                  disabled={savingFreeSetting === row.key}
                  aria-label={`Toggle free booking for ${row.label}`}
                  className={`relative inline-flex items-center w-12 md:w-14 h-6 md:h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 shrink-0 disabled:opacity-50 ${row.value ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block w-5 md:w-6 h-5 md:h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${row.value ? 'translate-x-6 md:translate-x-7' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              {([
                { key: 'free_booking_hold_hours_taxi', label: 'Taxi payment window (hours)', value: freeHoldTaxi, set: setFreeHoldTaxi, hint: 'Time to pay before the slot reopens. 0 = never holds a slot' },
                { key: 'free_booking_hold_hours_tour', label: 'Tour payment window (hours)', value: freeHoldTour, set: setFreeHoldTour, hint: 'Time to pay before the slot reopens. 0 = never holds a slot' },
                { key: 'free_booking_min_lead_hours', label: 'Minimum notice (hours)', value: freeMinLead, set: setFreeMinLead, hint: '0 = allow last-minute' },
                { key: 'free_booking_max_open_per_user', label: 'Max open unpaid per customer', value: freeMaxOpen, set: setFreeMaxOpen, hint: 'Counted per login account' },
                { key: 'free_booking_max_advance_days', label: 'Max days in advance', value: freeMaxAdvance, set: setFreeMaxAdvance, hint: '' },
              ] as const).map((row) => (
                <div key={row.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{row.label}</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={row.value}
                      onChange={(e) => row.set(Math.max(0, Number(e.target.value) || 0))}
                      className="input-field text-sm flex-1"
                    />
                    <button
                      onClick={() => void saveFreeBookingSetting(row.key, row.value, row.label)}
                      disabled={savingFreeSetting === row.key}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {savingFreeSetting === row.key ? '...' : 'Save'}
                    </button>
                  </div>
                  {row.hint && <p className="text-[11px] text-gray-400 mt-1">{row.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 md:space-y-3 pt-4 md:pt-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Appearance</p>

          <div className="flex items-center justify-between gap-3 px-3 md:px-4 py-3 md:py-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-smooth cursor-default active:bg-gray-100">
            <div className="flex items-center gap-2 md:gap-3 flex-1">
              <div className="w-8 md:w-9 h-8 md:h-9 rounded-lg bg-gray-100 flex items-center justify-center text-base md:text-lg select-none shrink-0">
                {darkMode ? '🌙' : '☀️'}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm md:text-base">Dark Mode</p>
                <p className="text-xs md:text-sm text-gray-500">Switch admin panel to {darkMode ? 'light' : 'dark'} theme</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Disable dark mode' : 'Enable dark mode'}
              className={`relative inline-flex items-center w-12 md:w-14 h-6 md:h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 shrink-0 ${darkMode ? 'bg-secondary-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block w-5 md:w-6 h-5 md:h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${darkMode ? 'translate-x-6 md:translate-x-7' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="pt-2 md:pt-4 border-t border-gray-100">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>System Logs</p>
            <div className={`rounded-lg border p-3 md:p-4 ${darkMode ? 'border-amber-700/50 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>Logs Retention Limit</p>
                  <p className={`text-xs ${darkMode ? 'text-amber-200/90' : 'text-amber-700'}`}>
                    Higher limits use more database storage and can increase query cost/latency on free tier.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${darkMode ? 'border border-amber-600/60 bg-primary-900 text-amber-200' : 'border border-amber-300 bg-white text-amber-900'}`}>
                    {logsMaxRows.toLocaleString('en-IN')} rows
                  </span>
                  {!editingLogsMaxRows && (
                    <button
                      onClick={() => {
                        setLogsMaxRowsDraft(logsMaxRows)
                        setEditingLogsMaxRows(true)
                      }}
                      className="btn-secondary text-[11px] md:text-sm px-3 py-1.5"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
              {editingLogsMaxRows && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={100}
                    max={50000}
                    step={100}
                    className={`input-field h-9 md:h-10 w-40 text-[12px] md:text-sm px-2.5 ${darkMode ? 'bg-primary-900 text-gray-100 border-amber-700/50' : 'bg-white'}`}
                    value={logsMaxRowsDraft}
                    onChange={(e) => setLogsMaxRowsDraft(parseInt(e.target.value || '0', 10))}
                  />
                  <button
                    onClick={handleSaveLogsMaxRows}
                    disabled={savingLogsMaxRows}
                    className="btn-secondary text-[11px] md:text-sm px-3 py-1.5 disabled:opacity-50"
                  >
                    {savingLogsMaxRows ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setLogsMaxRowsDraft(logsMaxRows)
                      setEditingLogsMaxRows(false)
                    }}
                    disabled={savingLogsMaxRows}
                    className={`px-3 py-1.5 text-[11px] md:text-sm font-semibold rounded-lg border disabled:opacity-50 ${darkMode ? 'border-amber-700/50 text-amber-200 hover:bg-amber-900/30' : 'border-amber-300 text-amber-800 hover:bg-amber-100'}`}
                  >
                    Cancel
                  </button>
                </div>
              )}
              <p className={`mt-1 text-[10px] md:text-xs ${darkMode ? 'text-amber-200/80' : 'text-amber-700'}`}>
                Recommended: 1,000 to 3,000 for current database tier.
              </p>
            </div>
          </div>

          <div className="pt-2 md:pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">About</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
              <div className="p-3 md:p-4 rounded-lg border border-gray-200 bg-gray-50">
                <p className="text-gray-500 font-medium mb-1">Admin Panel Version</p>
                <p className="font-semibold text-gray-900">v2.0</p>
              </div>
              <div className="p-3 md:p-4 rounded-lg border border-gray-200 bg-gray-50">
                <p className="text-gray-500 font-medium mb-1">Last Updated</p>
                <p className="font-semibold text-gray-900">{new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Conflict Control Toggle ─────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-1">Booking Conflict Control</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">
          When enabled, the system prevents double-booking cars for overlapping time slots.
        </p>

        {loadingConflictSetting ? (
          <p className="text-sm text-gray-400">Loading setting…</p>
        ) : (
          <div className="space-y-4">
            {/* Toggle row */}
            <div className="flex items-center justify-between gap-3 px-3 md:px-4 py-3 md:py-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-smooth cursor-default">
              <div className="flex items-center gap-2 md:gap-3 flex-1">
                <div className={`w-8 md:w-9 h-8 md:h-9 rounded-lg flex items-center justify-center text-base select-none shrink-0 ${conflictControlEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
                  {conflictControlEnabled ? '🔒' : '🔓'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm md:text-base">
                    Conflict Control is <span className={conflictControlEnabled ? 'text-green-600' : 'text-red-600'}>{conflictControlEnabled ? 'ON' : 'OFF'}</span>
                  </p>
                  <p className="text-xs md:text-sm text-gray-500">
                    {conflictControlEnabled
                      ? 'Cars are hidden when fully booked for a time slot.'
                      : 'All active cars show as available regardless of existing bookings.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => conflictControlEnabled ? setShowConflictOffWarning(true) : handleToggleConflictControl(true)}
                disabled={togglingConflictControl}
                aria-label="Toggle conflict control"
                className={`relative inline-flex items-center w-12 md:w-14 h-6 md:h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 shrink-0 disabled:opacity-50 ${conflictControlEnabled ? 'bg-green-500' : 'bg-red-400'}`}
              >
                <span className={`inline-block w-5 md:w-6 h-5 md:h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${conflictControlEnabled ? 'translate-x-6 md:translate-x-7' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Warning modal for turning OFF */}
            {showConflictOffWarning && (
              <div className="border border-red-300 bg-red-50 rounded-lg p-4 space-y-3">
                <p className="font-bold text-red-800 text-sm">⚠ Warning — Read before disabling</p>
                <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                  <li>All active cars (except inactive ones) will appear available during booking, even if already booked.</li>
                  <li>Users may book the same physical car for the same time slot.</li>
                  <li>Car availability warnings in the tour booking flow will be suppressed.</li>
                  <li>Admin will need to manually handle all scheduling and assignment conflicts.</li>
                  <li>Re-enabling this later will surface existing conflicts for you to resolve.</li>
                </ul>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => handleToggleConflictControl(false)}
                    disabled={togglingConflictControl}
                    className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {togglingConflictControl ? 'Disabling…' : 'Yes, Disable Anyway'}
                  </button>
                  <button
                    onClick={() => setShowConflictOffWarning(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Conflict resolution panel — shown when enabled and conflicts found */}
            {conflictControlEnabled && (
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Conflict Checker</p>
                  <button
                    onClick={fetchConflicts}
                    disabled={loadingConflicts}
                    className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50"
                  >
                    {loadingConflicts ? 'Scanning…' : '🔍 Scan for Conflicts'}
                  </button>
                </div>

                {conflictData === null && !loadingConflicts && (
                  <p className="text-xs text-gray-400">Click "Scan for Conflicts" to check the current booking state.</p>
                )}

                {conflictData !== null && conflictData.total === 0 && (
                  <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <span>✓</span><span className="font-semibold">No conflicts found. All bookings are clean.</span>
                  </div>
                )}

                {conflictData !== null && conflictData.total > 0 && (
                  <div className="space-y-4">
                    {/* Assignment conflicts — hard conflicts */}
                    {conflictData.assignment_conflicts.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
                          🚨 Hard Conflicts ({conflictData.assignment_conflicts.length}) — Vehicle assignment overlaps that need admin resolution
                        </p>
                        <div className="space-y-3">
                          {conflictData.assignment_conflicts.map((c: any, i: number) => (
                            <div key={i} className="border border-red-200 bg-red-50 rounded-lg p-3 text-xs space-y-2">
                              <p className="font-semibold text-red-800">
                                {c.issue_type === 'booking_double_assignment'
                                  ? `One booking has overlapping vehicles: ${c.car_number_plate}`
                                  : `${c.car_model} — ${c.car_number_plate}`}
                              </p>
                              {(c.issue_type === 'booking_double_assignment'
                                ? [c.booking_a].filter(Boolean)
                                : [c.booking_a, c.booking_b].filter(Boolean)
                              ).map((bk: any, bi: number) => (
                                <div key={bi} className="bg-white border border-red-100 rounded p-2 space-y-0.5">
                                  <p className="font-semibold">{bk.user_name} <span className="text-gray-400 font-normal">({bk.booking_id?.slice(0, 12)})</span></p>
                                  <p className="text-gray-600">{new Date(bk.start_datetime).toLocaleString('en-IN')} → {new Date(bk.end_datetime).toLocaleString('en-IN')}</p>
                                  <p className="text-gray-500">{bk.booking_type} · {bk.booking_status}</p>
                                  <button
                                    onClick={() => {
                                      const fullBk = bookings.find(b => (b.booking_id || b.id) === (bk.booking_id || bk.id))
                                      const pmt = payments.find(p => p.booking_id === (bk.booking_id || bk.id)) || payments[0]
                                      if (fullBk && pmt) {
                                        setSelectedPaymentForVehicle(pmt)
                                        setSelectedBookingForVehicle(fullBk)
                                        setSelectedCarForAssignment(null)
                                        setShowVehicleAssignmentModal(true)
                                      }
                                    }}
                                    className="mt-1 px-3 py-1 bg-red-600 text-white rounded font-semibold hover:bg-red-700"
                                  >
                                    Reassign Vehicle
                                  </button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Model over-subscription — soft conflicts */}
                    {conflictData.model_conflicts.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">
                          ⚠ Soft Conflicts ({conflictData.model_conflicts.length}) — More bookings than available cars of a model
                        </p>
                        <div className="space-y-3">
                          {conflictData.model_conflicts.map((c: any, i: number) => (
                            <div key={i} className="border border-orange-200 bg-orange-50 rounded-lg p-3 text-xs space-y-2">
                              <p className="font-semibold text-orange-800">
                                {c.car_model} — {c.demand_count ?? c.conflicting_bookings.length} booking demand, {c.physical_count} car{c.physical_count !== 1 ? 's' : ''} available
                              </p>
                              {c.conflicting_bookings.map((bk: any, bi: number) => (
                                <div key={bi} className="bg-white border border-orange-100 rounded p-2 space-y-0.5">
                                  <p className="font-semibold">{bk.user_name} <span className="text-gray-400 font-normal">({bk.booking_id?.slice(0, 12)})</span></p>
                                  <p className="text-gray-600">{new Date(bk.start_datetime).toLocaleString('en-IN')} → {new Date(bk.end_datetime).toLocaleString('en-IN')}</p>
                                  <p className="text-gray-500">{bk.booking_type} · {bk.booking_status}</p>
                                  <div className="flex gap-2 mt-1">
                                    <button
                                      onClick={() => {
                                        const fullBk = bookings.find(b => (b.booking_id || b.id) === (bk.booking_id || bk.id))
                                        const pmt = payments.find(p => p.booking_id === (bk.booking_id || bk.id)) || payments[0]
                                        if (fullBk && pmt) {
                                          setSelectedPaymentForVehicle(pmt)
                                          setSelectedBookingForVehicle(fullBk)
                                          setSelectedCarForAssignment(null)
                                          setShowVehicleAssignmentModal(true)
                                        }
                                      }}
                                      className="px-3 py-1 bg-orange-600 text-white rounded font-semibold hover:bg-orange-700"
                                    >
                                      Reassign
                                    </button>
                                    <button
                                      onClick={() => {
                                        const fullBk = bookings.find(b => (b.booking_id || b.id) === (bk.booking_id || bk.id))
                                        if (fullBk) handleUpdateBookingStatus(fullBk, 'cancelled')
                                      }}
                                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300"
                                    >
                                      Cancel Booking
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pending Booking Management ──────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-1">Pending Booking Management</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">
          Unconfirmed bookings (payment not completed) are automatically removed once they exceed the cleanup window you set. The scheduler runs once daily and only deletes bookings that have exceeded the configured window.
        </p>

        <div className="space-y-4">
          {/* Auto-cleanup toggle */}
          <div className="flex items-center justify-between gap-3 px-3 md:px-4 py-3 md:py-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-smooth cursor-default">
            <div className="flex items-center gap-2 md:gap-3 flex-1">
              <div className={`w-8 md:w-9 h-8 md:h-9 rounded-lg flex items-center justify-center text-base select-none shrink-0 ${autoCleanupEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                {autoCleanupEnabled ? '🤖' : '⏸'}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm md:text-base">
                  Auto-cleanup is <span className={autoCleanupEnabled ? 'text-green-600' : 'text-gray-400'}>{autoCleanupEnabled ? 'ON' : 'OFF'}</span>
                </p>
                <p className="text-xs md:text-sm text-gray-500">
                  {autoCleanupEnabled
                    ? 'Scheduler runs daily, deletes only after the configured window has elapsed.'
                    : 'Pending bookings stay indefinitely until manually cleaned or confirmed.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleAutoCleanup(!autoCleanupEnabled)}
              disabled={togglingAutoCleanup}
              aria-label="Toggle auto-cleanup"
              className={`relative inline-flex items-center w-12 md:w-14 h-6 md:h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 shrink-0 disabled:opacity-50 ${autoCleanupEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block w-5 md:w-6 h-5 md:h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${autoCleanupEnabled ? 'translate-x-6 md:translate-x-7' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Timeout setting */}
          <div className={`flex flex-col sm:flex-row sm:items-center gap-3 px-3 md:px-4 py-3 md:py-4 rounded-lg border bg-gray-50 transition-opacity ${autoCleanupEnabled ? 'border-gray-200 opacity-100' : 'border-gray-100 opacity-40 pointer-events-none'}`}>
            <div className="flex items-center gap-2 md:gap-3 flex-1">
              <div className="w-8 md:w-9 h-8 md:h-9 rounded-lg bg-yellow-100 flex items-center justify-center text-base select-none shrink-0">
                ⏳
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm md:text-base">Cleanup Window</p>
                <p className="text-xs md:text-sm text-gray-500">Deletion runs once this much time has passed since the last cleanup.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number"
                min={1}
                max={30}
                value={pendingTimeoutDays}
                onChange={e => setPendingTimeoutDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-secondary-500"
              />
              <span className="text-sm text-gray-500 whitespace-nowrap">day{pendingTimeoutDays !== 1 ? 's' : ''}</span>
              <button
                onClick={handleSavePendingTimeout}
                disabled={savingPendingTimeout}
                className="px-3 py-1.5 bg-secondary-500 text-primary-950 text-xs font-bold rounded-lg hover:bg-secondary-400 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {savingPendingTimeout ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Info + manual trigger */}
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-blue-100 bg-blue-50 text-xs text-blue-700">
            <span>
              Currently <span className="font-bold">{bookings.filter(b => b.booking_status === 'pending').length}</span> pending booking{bookings.filter(b => b.booking_status === 'pending').length !== 1 ? 's' : ''} awaiting payment.
            </span>
            <button
              onClick={handleCleanupPending}
              disabled={cleaningUp}
              className="px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap text-xs"
            >
              {cleaningUp ? 'Cleaning…' : '🗑 Clean Up Now'}
            </button>
          </div>

          <p className="text-[11px] text-gray-400 italic">
            Example: set 3 days → pending bookings older than 3 days are deleted the next time the daily scheduler runs. &ldquo;Clean Up Now&rdquo; always runs immediately, ignoring the schedule.
          </p>
        </div>
      </div>

      {/* Payment Reconciliation */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-1">Payment Reconciliation</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4">
          Cross-checks Razorpay against the database and records any captured payment that is missing — e.g. if a customer&apos;s
          browser closed before the booking finished confirming. Safe to run anytime; it only fills gaps and never duplicates.
        </p>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-green-100 bg-green-50 text-xs text-green-700">
          <span>Scans the last 7 days of payments and heals any missing records instantly.</span>
          <button
            onClick={handleReconcilePayments}
            disabled={reconciling}
            className="px-3 py-1.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap text-xs"
          >
            {reconciling ? 'Reconciling…' : '🔄 Reconcile Now'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 italic mt-2">
          Runs automatically every day. Use this to heal a payment immediately without waiting for the scheduler.
        </p>
      </div>

      {/* Profile Management */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-1">Your Profile</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">Manage your account information</p>

        <div className="space-y-3 md:space-y-4">
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Current Information</p>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Full Name</p>
                  <p className="text-sm md:text-base font-semibold text-gray-900">{adminFullName || '-'}</p>
                </div>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Email</p>
                  <p className="text-sm md:text-base font-semibold text-gray-900">{adminEmail || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setEditProfileData({
                full_name: adminFullName || '',
                email: adminEmail || '',
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: '',
              })
              setShowEditProfile(true)
            }}
            className="w-full md:w-auto px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-secondary-400 to-secondary-600 hover:from-secondary-500 hover:to-secondary-700 text-primary-950 font-semibold rounded-lg transition-smooth shadow-md text-sm md:text-base"
          >
            ✎ Edit Profile
          </button>
        </div>
      </div>

      {/* Admin Management */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-1">Admin Management</h2>
        <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">Create and manage admin accounts</p>

        <button
          onClick={() => setShowAddAdmin(true)}
          className="w-full md:w-auto px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-secondary-400 to-secondary-600 hover:from-secondary-500 hover:to-secondary-700 text-primary-950 font-semibold rounded-lg transition-smooth shadow-md text-sm md:text-base"
        >
          + Add New Admin
        </button>
      </div>

      {/* Add Admin Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-3 sm:mx-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Add New Admin</h2>
              <button
                onClick={() => setShowAddAdmin(false)}
                disabled={submittingAdmin}
                className="text-gray-500 hover:text-gray-700 text-2xl disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g., John Doe"
                  value={adminFormData.full_name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, full_name: e.target.value })}
                  disabled={submittingAdmin}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  placeholder="e.g., admin@example.com"
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  disabled={submittingAdmin}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Must be a valid email address</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password *</label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={adminFormData.password}
                  onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                  disabled={submittingAdmin}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters long with a mix of letters, numbers, and symbols</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password *</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={adminFormData.confirmPassword}
                  onChange={(e) => setAdminFormData({ ...adminFormData, confirmPassword: e.target.value })}
                  disabled={submittingAdmin}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Security Note:</strong> The new admin will be able to log in immediately with the provided email and password. Make sure to use a strong password.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddAdmin(false)}
                disabled={submittingAdmin}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAdmin}
                disabled={submittingAdmin}
                className="px-6 py-2.5 bg-gradient-to-r from-secondary-400 to-secondary-600 hover:from-secondary-500 hover:to-secondary-700 text-primary-950 font-semibold rounded-lg transition-smooth disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submittingAdmin ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Admin'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-3 sm:mx-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Edit Profile</h2>
              <button
                onClick={() => setShowEditProfile(false)}
                disabled={submittingProfile}
                className="text-gray-500 hover:text-gray-700 text-2xl disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={editProfileData.full_name}
                  onChange={(e) => setEditProfileData({ ...editProfileData, full_name: e.target.value })}
                  disabled={submittingProfile}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  placeholder="Your email address"
                  value={editProfileData.email}
                  onChange={(e) => setEditProfileData({ ...editProfileData, email: e.target.value })}
                  disabled={submittingProfile}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-4">Change Password (Optional)</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                    <input
                      type="password"
                      placeholder="Enter current password"
                      value={editProfileData.currentPassword}
                      onChange={(e) => setEditProfileData({ ...editProfileData, currentPassword: e.target.value })}
                      disabled={submittingProfile}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password (min 8 characters)"
                      value={editProfileData.newPassword}
                      onChange={(e) => setEditProfileData({ ...editProfileData, newPassword: e.target.value })}
                      disabled={submittingProfile}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="Re-enter new password"
                      value={editProfileData.confirmNewPassword}
                      onChange={(e) => setEditProfileData({ ...editProfileData, confirmNewPassword: e.target.value })}
                      disabled={submittingProfile}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Leave password fields empty if you don&apos;t want to change your password.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-end gap-3">
              <button
                onClick={() => setShowEditProfile(false)}
                disabled={submittingProfile}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProfile}
                disabled={submittingProfile}
                className="px-6 py-2.5 bg-gradient-to-r from-secondary-400 to-secondary-600 hover:from-secondary-500 hover:to-secondary-700 text-primary-950 font-semibold rounded-lg transition-smooth disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submittingProfile ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Profile'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderAnalytics = () => (
    <div className="space-y-6 md:space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="card p-4 md:p-6 bg-gradient-to-br from-blue-50 to-blue-100">
          <p className="text-gray-600 text-xs md:text-sm font-semibold mb-2">Total Revenue</p>
          <p className="text-xl md:text-3xl font-bold text-blue-700">Rs. {analytics.totalRevenue.toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 })}</p>
          <p className="text-xs text-gray-500 mt-1 md:mt-2">All bookings combined</p>
        </div>

        <div className="card p-4 md:p-6 bg-gradient-to-br from-green-50 to-green-100">
          <p className="text-gray-600 text-xs md:text-sm font-semibold mb-2">Completed Bookings</p>
          <p className="text-xl md:text-3xl font-bold text-green-700">{analytics.completedBookings}</p>
          <p className="text-xs text-gray-500 mt-1 md:mt-2">Successfully delivered</p>
        </div>

        <div className="card p-4 md:p-6 bg-gradient-to-br from-yellow-50 to-yellow-100">
          <p className="text-gray-600 text-xs md:text-sm font-semibold mb-2">Avg Booking Value</p>
          <p className="text-xl md:text-3xl font-bold text-yellow-700">Rs. {analytics.averageBookingValue.toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 })}</p>
          <p className="text-xs text-gray-500 mt-1 md:mt-2">Per booking average</p>
        </div>

        <div className="card p-4 md:p-6 bg-gradient-to-br from-purple-50 to-purple-100">
          <p className="text-gray-600 text-xs md:text-sm font-semibold mb-2">Fleet Utilization</p>
          <p className="text-xl md:text-3xl font-bold text-purple-700">{analytics.fleetUtilization.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1 md:mt-2">Cars in active use</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className={`card p-4 md:p-6 bg-gradient-to-br ${darkMode ? 'from-emerald-950/40 to-emerald-900/30' : 'from-emerald-50 to-emerald-100'}`}>
          <p className={`text-xs md:text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Completion Rate</p>
          <p className={`text-xl md:text-3xl font-bold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{analytics.completionRate.toFixed(1)}%</p>
          <p className={`text-xs mt-1 md:mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{analytics.completedBookings} completed bookings</p>
        </div>

        <div className={`card p-4 md:p-6 bg-gradient-to-br ${darkMode ? 'from-rose-950/40 to-rose-900/30' : 'from-rose-50 to-rose-100'}`}>
          <p className={`text-xs md:text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Cancellation Rate</p>
          <p className={`text-xl md:text-3xl font-bold ${darkMode ? 'text-rose-300' : 'text-rose-700'}`}>{analytics.cancellationRate.toFixed(1)}%</p>
          <p className={`text-xs mt-1 md:mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{analytics.cancelledBookings} cancelled bookings</p>
        </div>

        <div className={`card p-4 md:p-6 bg-gradient-to-br ${darkMode ? 'from-cyan-950/40 to-cyan-900/30' : 'from-cyan-50 to-cyan-100'}`}>
          <p className={`text-xs md:text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Collection Rate</p>
          <p className={`text-xl md:text-3xl font-bold ${darkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>{analytics.paymentCollectionRate.toFixed(1)}%</p>
          <p className={`text-xs mt-1 md:mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Collected vs booking value</p>
        </div>

        <div className={`card p-4 md:p-6 bg-gradient-to-br ${darkMode ? 'from-amber-950/40 to-amber-900/30' : 'from-amber-50 to-amber-100'}`}>
          <p className={`text-xs md:text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Outstanding</p>
          <p className={`text-xl md:text-3xl font-bold ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
            Rs. {analytics.totalOutstanding.toLocaleString('en-IN', { notation: 'compact', maximumFractionDigits: 1 })}
          </p>
          <p className={`text-xs mt-1 md:mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Pending collection amount</p>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4">Booking Status</h3>
          <div className="space-y-2 md:space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-xs md:text-sm text-gray-600">Pending</span>
              </div>
              <span className="font-semibold text-sm md:text-base">{analytics.pendingBookings}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs md:text-sm text-gray-600">Completed</span>
              </div>
              <span className="font-semibold text-sm md:text-base">{analytics.completedBookings}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-xs md:text-sm text-gray-600">Confirmed</span>
              </div>
              <span className="font-semibold text-sm md:text-base">{analytics.confirmedBookings}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-xs md:text-sm text-gray-600">Cancelled</span>
              </div>
              <span className="font-semibold text-sm md:text-base">{analytics.cancelledBookings}</span>
            </div>
            <hr className="my-2 md:my-3" />
            <div className="flex items-center justify-between font-semibold text-sm md:text-base">
              <span>Total</span>
              <span>{bookings.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4">Fleet Information</h3>
          <div className="space-y-2 md:space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-gray-600">Total Cars</span>
              <span className="font-semibold text-sm md:text-base">{cars.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-gray-600">Destinations</span>
              <span className="font-semibold text-sm md:text-base">{destinations.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-gray-600">Active Tours</span>
              <span className="font-semibold text-sm md:text-base">{tours.length}</span>
            </div>
            <hr className="my-2 md:my-3" />
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-gray-600">Total Services</span>
              <span className="font-semibold text-sm md:text-base">{cars.length + destinations.length + tours.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4">Revenue Breakdown</h3>
          <div className="space-y-2 md:space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-gray-600">Online Collected</span>
              <span className="font-semibold text-xs md:text-sm">Rs. {analytics.totalPaid.toLocaleString('en-IN', { notation: 'compact' })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-gray-600">Cash Collected</span>
              <span className="font-semibold text-xs md:text-sm">Rs. {analytics.totalCashCollected.toLocaleString('en-IN', { notation: 'compact' })}</span>
            </div>
            <hr className="my-2 md:my-3" />
            <div className="flex items-center justify-between font-semibold text-xs md:text-sm">
              <span>Total Collected</span>
              <span className="md:text-base">Rs. {(analytics.totalPaid + analytics.totalCashCollected).toLocaleString('en-IN', { notation: 'compact' })}</span>
            </div>
            <div className="flex items-center justify-between text-xs md:text-sm">
              <span className="text-gray-600">Pending Payments</span>
              <span className="font-semibold">{analytics.pendingPayments}</span>
            </div>
            <div className="flex items-center justify-between text-xs md:text-sm">
              <span className="text-gray-600">Partial Payments</span>
              <span className="font-semibold">{analytics.partialPayments}</span>
            </div>
            <div className="flex items-center justify-between text-xs md:text-sm">
              <span className="text-orange-700 font-semibold">Unpaid — to collect</span>
              <span className="font-semibold text-orange-700">
                {analytics.unpaidBookings}
                {analytics.unpaidBookings > 0 && (
                  <span className="font-normal"> · Rs. {analytics.unpaidValue.toLocaleString('en-IN', { notation: 'compact' })}</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <div className={`rounded-lg shadow-lg p-4 md:p-8 ${darkMode ? 'bg-slate-800/95 border border-slate-700/60' : 'bg-white'}`}>
          <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Booking Type Mix</h3>
          <div className="space-y-2 md:space-y-4">
            {analytics.bookingTypeStats.map((row) => (
              <div key={row.type} className={`p-3 border rounded-lg ${darkMode ? 'border-slate-700/70 bg-slate-900/45' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm md:text-base capitalize">{row.type}</p>
                  <p className="font-semibold text-sm md:text-base">{row.count} bookings</p>
                </div>
                <div className={`flex items-center justify-between text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <span>Revenue</span>
                  <span className={`font-medium ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Rs. {row.revenue.toLocaleString('en-IN', { notation: 'compact' })}</span>
                </div>
                <div className={`mt-2 h-2 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700/80' : 'bg-gray-100'}`}>
                  <div
                    className="h-full bg-secondary-500"
                    style={{ width: `${bookings.length > 0 ? (row.count / bookings.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-lg shadow-lg p-4 md:p-8 ${darkMode ? 'bg-slate-800/95 border border-slate-700/60' : 'bg-white'}`}>
          <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Operations Coverage</h3>
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between text-sm md:text-base">
              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Active Bookings (Pending + Confirmed)</span>
              <span className="font-semibold">{analytics.activeOpsCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm md:text-base">
              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Assigned Active Bookings</span>
              <span className="font-semibold">{analytics.assignedActiveBookings}</span>
            </div>
            <div className="flex items-center justify-between text-sm md:text-base">
              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Assignment Coverage</span>
              <span className="font-semibold">{analytics.assignmentCoverage.toFixed(1)}%</span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700/80' : 'bg-gray-100'}`}>
              <div className="h-full bg-blue-500" style={{ width: `${analytics.assignmentCoverage}%` }} />
            </div>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Higher coverage means fewer unassigned near-term rides.</p>
          </div>
        </div>
      </div>

      {/* Weekly Booking Trend */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
        <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Weekly Booking Trend</h3>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="grid grid-cols-7 gap-2 md:gap-4">
              {analytics.bookingTrend.map((day) => (
                <div key={day.date} className="text-center">
                  <div className="text-xs md:text-sm font-semibold text-gray-600 mb-1 md:mb-2">{day.date}</div>
                  <div className="bg-blue-100 rounded-lg p-2 md:p-4 mb-1 md:mb-2">
                    <div className="h-16 md:h-24 flex items-end justify-center gap-1">
                      <div
                        className="bg-secondary-500 rounded"
                        style={{
                          height: `${(day.bookings / 35) * 100}%`,
                          width: '60%',
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    <p className="font-semibold">{day.bookings}</p>
                    <p className="text-gray-500">Rs. {(day.revenue / 1000).toFixed(0)}k</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Destinations and Tours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
          <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Top Destinations</h3>
          <div className="space-y-2 md:space-y-4">
            {analytics.topDestinations.length > 0 ? (
              analytics.topDestinations.map((dest, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 md:p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <div className="w-6 md:w-8 h-6 md:h-8 rounded-full bg-secondary-100 flex items-center justify-center text-xs md:text-sm font-semibold text-secondary-700 shrink-0">
                      {idx + 1}
                    </div>
                    <span className="font-semibold text-sm md:text-base truncate">{dest.name}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold text-secondary-600 text-xs md:text-base">{dest.bookings}</p>
                    <p className="text-xs text-gray-500">bookings</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4 text-sm">No destination data available</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
          <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Top Tours</h3>
          <div className="space-y-2 md:space-y-4">
            {analytics.topTours.length > 0 ? (
              analytics.topTours.map((tour, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 md:p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <div className="w-6 md:w-8 h-6 md:h-8 rounded-full bg-green-100 flex items-center justify-center text-xs md:text-sm font-semibold text-green-700 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm md:text-base truncate">{tour.name}</p>
                      <p className="text-xs text-gray-500 truncate">{tour.bookings} bookings</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-semibold text-green-600 text-xs md:text-base">Rs. {(tour.revenue / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-gray-500">revenue</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No tour data available</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <div className={`rounded-lg shadow-lg p-4 md:p-8 ${darkMode ? 'bg-slate-800/95 border border-slate-700/60' : 'bg-white'}`}>
          <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Upcoming Departures</h3>
          {analytics.upcomingDepartures.length === 0 ? (
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No upcoming pending/confirmed departures found.</p>
          ) : (
            <div className="space-y-2">
              {analytics.upcomingDepartures.map((bk) => (
                <div key={bk.id} className={`flex items-center justify-between border rounded-lg px-3 py-2 ${darkMode ? 'border-slate-700/70 bg-slate-900/45' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{bk.user_name || 'Customer'} • {bookingTypeLabel(bk.booking_type)}</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {bk.start_datetime ? new Date(bk.start_datetime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusClass(bk.booking_status)}`}>
                    {bk.booking_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`rounded-lg shadow-lg p-4 md:p-8 ${darkMode ? 'bg-slate-800/95 border border-slate-700/60' : 'bg-white'}`}>
          <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Peak Booking Hours</h3>
          <div className="space-y-2 md:space-y-3">
            {analytics.topDemandHours.map((slot) => (
              <div key={slot.hour} className="flex items-center gap-3">
                <div className={`w-16 text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {String(slot.hour).padStart(2, '0')}:00
                </div>
                <div className={`flex-1 h-2 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700/80' : 'bg-gray-100'}`}>
                  <div
                    className="h-full bg-indigo-500"
                    style={{
                      width: `${analytics.topDemandHours[0]?.count ? (slot.count / analytics.topDemandHours[0].count) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="w-10 text-right text-xs font-semibold">{slot.count}</div>
              </div>
            ))}
          </div>
          <p className={`text-xs mt-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Use this for staffing, driver shifts, and assignment planning.</p>
        </div>
      </div>
    </div>
  )

  const renderLogs = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-3 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 md:gap-3 mb-3 md:mb-4">
          <h3 className="text-lg md:text-2xl font-bold">System Logs</h3>
          <button
            onClick={() => loadLogs(logsPage)}
            className="btn-secondary text-[11px] md:text-sm px-2.5 md:px-3 py-1.5"
          >
            Refresh Logs
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5 md:gap-2 mb-3 md:mb-4">
          <select
            className="input-field text-[12px] md:text-sm h-10 min-h-[2.5rem] px-2.5 leading-6 pt-0.5 pb-2"
            value={logsSeverity}
            onChange={(e) => { setLogsPage(1); setLogsSeverity(e.target.value as 'all' | 'info' | 'warn' | 'error' | 'security') }}
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="security">Security</option>
          </select>

          <input
            className="input-field text-[12px] md:text-sm h-10 min-h-[2.5rem] px-2.5 leading-6"
            placeholder="Event type (exact)"
            value={logsEventType}
            onChange={(e) => { setLogsPage(1); setLogsEventType(e.target.value) }}
          />

          <input
            className="input-field text-[12px] md:text-sm h-10 min-h-[2.5rem] px-2.5 leading-6 md:col-span-2"
            placeholder="Search message, actor, entity..."
            value={logsQuery}
            onChange={(e) => { setLogsPage(1); setLogsQuery(e.target.value) }}
          />
        </div>

        {loadingLogs ? (
          <p className="text-gray-600 text-sm">Loading logs...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500 text-sm">No logs found for selected filters.</p>
        ) : (
          <div className="space-y-1.5 md:space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="border rounded-lg p-2.5 md:p-4">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                  <span className={`px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold ${getSeverityClass(log.severity)}`}>{log.severity}</span>
                  <span className="px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold bg-gray-100 text-gray-700 max-w-full truncate">{log.event_type}</span>
                  <span className="text-[10px] md:text-xs text-gray-500 ml-auto">{new Date(log.created_at).toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[12px] md:text-sm text-gray-900 font-medium leading-snug">{log.message}</p>
                <div className="mt-1 text-[11px] md:text-xs text-gray-600 leading-snug">
                  <span>Actor: {log.actor_label || log.actor_type}</span>
                  {log.entity_type && <span> · Entity: {log.entity_type}</span>}
                  {log.entity_id && <span> · ID: {log.entity_id}</span>}
                </div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <>
                    <details className="mt-2 md:hidden">
                      <summary className="text-[11px] text-gray-600 cursor-pointer select-none">View metadata</summary>
                      <pre className="mt-1 text-[10px] bg-gray-50 border rounded p-2 overflow-x-auto text-gray-700">
{JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                    <pre className="mt-2 hidden md:block text-[11px] bg-gray-50 border rounded p-2 overflow-x-auto text-gray-700">
{JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 md:mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
            disabled={logsPage <= 1}
            className="btn-secondary text-[11px] md:text-sm px-2.5 md:px-3 py-1.5 disabled:opacity-50"
          >
            Previous
          </button>
          <p className="text-[11px] md:text-sm text-gray-600 whitespace-nowrap">Page {logsPage}/{logsTotalPages}</p>
          <button
            onClick={() => setLogsPage((p) => Math.min(logsTotalPages, p + 1))}
            disabled={logsPage >= logsTotalPages}
            className="btn-secondary text-[11px] md:text-sm px-2.5 md:px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )

  const adminFirstName = adminFullName?.trim().split(/\s+/)[0] || 'Admin'

  return (
    <ProtectedAdminPage>
      <div
        className="scrollbar-thin-modern flex h-[100dvh] flex-col overflow-y-auto overflow-x-hidden"
        data-admin-theme={darkMode ? 'dark' : 'light'}
        style={{ scrollbarGutter: 'stable' }}
      >
      {/* Admin Panel Header */}
      <header className="sticky top-0 z-50 bg-primary-950/95 backdrop-blur-md border-b border-white/[0.07]">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-14">

            {/* Identity */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-secondary-500 flex items-center justify-center text-primary-950 font-black text-sm shrink-0 select-none">
                {adminFirstName[0].toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">{adminFirstName}</p>
                {adminEmail && <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{adminEmail}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setNavigatingToDocs(true); router.push('/admin/docs') }}
                disabled={navigatingToDocs}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white rounded-lg border border-white/10 hover:border-white/25 hover:bg-white/8 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {navigatingToDocs ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {navigatingToDocs ? 'Loading…' : 'Docs'}
              </button>

              <button
                onClick={handleAdminLogout}
                title="Logout from Admin Panel"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg border border-red-500/20 hover:border-red-500/50 transition-all"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      <main className="flex-1 py-3 md:py-4 lg:py-12 bg-gray-50">
        <div className="container mx-auto px-3 md:px-4 lg:px-6">
          <div className="flex items-center justify-between mb-3 md:mb-4 lg:mb-8 gap-3">
            <h1 className="text-lg md:text-3xl lg:text-4xl font-bold">Dashboard</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveTab('logs')
                  setLogsPage(1)
                }}
                aria-pressed={activeTab === 'logs'}
                className={`relative text-xs md:text-sm px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg border font-semibold tracking-wide transition-all duration-200 ${
                  activeTab === 'logs'
                    ? 'bg-slate-900 text-emerald-300 border-emerald-500/70 ring-2 ring-emerald-400/45 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'bg-slate-900/80 text-slate-200 border-slate-600 hover:bg-slate-900 hover:border-emerald-500/50 hover:text-emerald-200'
                }`}
              >
                <span>Logs</span>
                <span
                  className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${
                    activeTab === 'logs' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
              </button>
              <button onClick={handleDashboardRefresh} className="btn-secondary text-xs md:text-sm px-2.5 md:px-4 py-1.5 md:py-2">
                Refresh
              </button>
            </div>
          </div>

          {/* Tab bar — responsive wrapping on mobile, no scroll needed.
              Collapsible: on views like Fleet Schedule the sticky bar eats
              vertical space, so it can be minimised down to a single strip. */}
          {(() => {
            const pendingCancellations = bookings.filter(b => b.cancellation_requested_at && b.booking_status !== 'cancelled').length
            const tabs = [
              { id: 'overview', label: 'Overview', badge: 0 },
              { id: 'bookings', label: 'Bookings', badge: pendingCancellations },
              { id: 'car-management', label: 'Cars', badge: 0 },
              { id: 'destinations', label: 'Destinations', badge: 0 },
              { id: 'tours', label: 'Tours', badge: 0 },
              { id: 'analytics', label: 'Analytics', badge: 0 },
              { id: 'misc', label: 'Misc', badge: 0 },
            ]
            const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Menu'
            const totalBadge = tabs.reduce((sum, t) => sum + t.badge, 0)

            if (tabBarCollapsed) {
              return (
                <div className={`sticky top-[60px] md:top-[72px] z-40 flex items-center justify-between mb-4 md:mb-6 lg:mb-8 rounded-lg border backdrop-blur-sm shadow-[0_12px_30px_rgba(15,23,42,0.14)] px-3 py-2 md:px-4 md:py-2.5 ${
                  darkMode
                    ? 'border-primary-700/70 bg-primary-900/92'
                    : 'border-gray-200/80 bg-white/95'
                }`}>
                  <button
                    onClick={toggleTabBarCollapsed}
                    className={`flex items-center gap-2 text-xs sm:text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}
                    aria-expanded={false}
                    aria-label="Expand tab bar"
                  >
                    <ChevronDown size={16} />
                    <span>{activeTabLabel}</span>
                    {totalBadge > 0 && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                        {totalBadge}
                      </span>
                    )}
                  </button>
                </div>
              )
            }

            return (
              <div className={`sticky top-[60px] md:top-[72px] z-40 flex flex-wrap items-center gap-1 md:gap-2 mb-4 md:mb-6 lg:mb-8 rounded-lg border backdrop-blur-sm shadow-[0_12px_30px_rgba(15,23,42,0.14)] p-2 md:p-3 lg:p-4 ${
                darkMode
                  ? 'border-primary-700/70 bg-primary-900/92'
                  : 'border-gray-200/80 bg-white/95'
              }`}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-2 sm:px-3 md:px-5 lg:px-6 py-1.5 sm:py-2 md:py-2.5 lg:py-3 rounded-lg font-semibold transition-smooth text-xs sm:text-sm md:text-base whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-secondary-500 text-primary-950'
                        : darkMode
                        ? 'text-gray-300 hover:bg-primary-800'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                    {tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={toggleTabBarCollapsed}
                  aria-expanded={true}
                  aria-label="Collapse tab bar"
                  className={`ml-auto flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg transition-smooth ${
                    darkMode ? 'text-gray-400 hover:bg-primary-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <ChevronUp size={18} />
                </button>
              </div>
            )
          })()}

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'bookings' && renderBookings()}
          {activeTab === 'car-management' && renderCarManagement()}
          {activeTab === 'destinations' && renderDestinations()}
          {activeTab === 'tours' && renderTours()}
          {activeTab === 'analytics' && renderAnalytics()}
          {activeTab === 'logs' && renderLogs()}
          {activeTab === 'misc' && renderMisc()}
        </div>
      </main>

      {/* Cash Collection Modal */}
      {showCashCollectionModal && selectedPaymentForCash && selectedBookingForCash && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-3 sm:mx-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Confirm Cash Payment</h2>
                <p className="text-sm text-gray-600 mt-1">Booking ID: {(selectedBookingForCash.booking_id || selectedBookingForCash.id).slice(0, 12)}…</p>
              </div>
              <button
                onClick={closeCashCollectionModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Booking Summary */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold mb-3">Booking Summary</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Customer Name:</dt>
                    <dd className="font-medium">{selectedBookingForCash.user_name || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Email:</dt>
                    <dd className="font-medium">{selectedBookingForCash.user_email || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Phone:</dt>
                    <dd className="font-medium">{selectedBookingForCash.phone || '-'}</dd>
                  </div>
                </dl>
              </div>

              {/* Payment Summary */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold mb-3">Payment Summary</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Total Amount:</dt>
                    <dd className="font-semibold text-green-700">Rs. {toNum(selectedPaymentForCash.amount_total).toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Already Paid (Online):</dt>
                    <dd className="font-medium text-blue-700">Rs. {toNum(selectedPaymentForCash.amount_online_paid).toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Already Paid (Cash):</dt>
                    <dd className="font-medium">Rs. {toNum(selectedPaymentForCash.amount_cash_paid).toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-300 font-semibold">
                    <dt>Remaining Balance:</dt>
                    <dd className="text-orange-600">Rs. {Math.max(0, toNum(selectedPaymentForCash.amount_total) - (toNum(selectedPaymentForCash.amount_online_paid) + toNum(selectedPaymentForCash.amount_cash_paid))).toFixed(2)}</dd>
                  </div>
                </dl>
              </div>

              {/* Cash Collection Form */}
              <form onSubmit={handleConfirmCashPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cash Amount to Collect <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-600 font-semibold">Rs.</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="input-field pl-10"
                      value={cashCollectionData.amount_cash_paid}
                      onChange={(e) => setCashCollectionData({ ...cashCollectionData, amount_cash_paid: e.target.value })}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Suggested: Rs. {Math.max(0, toNum(selectedPaymentForCash.amount_total) - (toNum(selectedPaymentForCash.amount_online_paid) + toNum(selectedPaymentForCash.amount_cash_paid))).toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Collected By <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your name or admin ID"
                    className="input-field"
                    value={cashCollectionData.cash_collected_by}
                    onChange={(e) => setCashCollectionData({ ...cashCollectionData, cash_collected_by: e.target.value })}
                    required
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <p className="font-semibold mb-1">📧 Invoice will be sent to:</p>
                  <p className="font-mono">{selectedBookingForCash.user_email || 'N/A'}</p>
                  <p className="text-xs mt-2 text-yellow-700">(Placeholder: Email system not implemented yet)</p>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeCashCollectionModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                    disabled={submittingCashPayment}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submittingCashPayment}
                  >
                    {submittingCashPayment ? 'Processing...' : 'Confirm & Send Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Assignment Modal */}
      {showVehicleAssignmentModal && selectedPaymentForVehicle && selectedBookingForVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            {(() => {
              const existingAssignment = vehicleAssignments.find(
                (va) => va.booking_id === (selectedBookingForVehicle.booking_id || selectedBookingForVehicle.id)
              )
              const assignedCar = existingAssignment ? cars.find((c) => c.id === existingAssignment.car_id) : null
              return (
                <>
                  <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{existingAssignment ? 'Reassign Vehicle' : 'Assign Vehicle'}</h2>
                      <p className="text-sm text-gray-600 mt-1">Booking ID: {(selectedBookingForVehicle.booking_id || selectedBookingForVehicle.id).slice(0, 12)}…</p>
                      {existingAssignment && assignedCar && (
                        <p className="text-sm text-blue-600 mt-2">Currently assigned: <span className="font-semibold">{assignedCar.model_name}</span> ({assignedCar.number_plate})</p>
                      )}
                      {existingAssignment && !assignedCar && (
                        <p className="text-sm text-amber-700 mt-2">
                          Previously assigned vehicle record was deleted.
                          {existingAssignment.car_model_snapshot ? ` Last known model: ${existingAssignment.car_model_snapshot}` : ''}
                          {existingAssignment.car_number_plate_snapshot ? ` (${existingAssignment.car_number_plate_snapshot})` : ''}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={closeVehicleAssignmentModal}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-6">
              {/* Booking Details */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold mb-3">Booking Details</h3>
                <dl className="space-y-2 text-sm grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-gray-600">Customer:</dt>
                    <dd className="font-medium">{selectedBookingForVehicle.user_name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">Phone:</dt>
                    <dd className="font-medium">{selectedBookingForVehicle.phone || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">Preferred Model:</dt>
                    <dd className="font-medium">{selectedBookingForVehicle.car_model || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">Passengers:</dt>
                    <dd className="font-medium">{selectedBookingForVehicle.passenger_count ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">Start Date/Time:</dt>
                    <dd className="font-medium">{selectedBookingForVehicle.start_datetime ? new Date(selectedBookingForVehicle.start_datetime).toLocaleString('en-IN') : '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-600">End Date/Time:</dt>
                    <dd className="font-medium">{selectedBookingForVehicle.end_datetime ? new Date(selectedBookingForVehicle.end_datetime).toLocaleString('en-IN') : '-'}</dd>
                  </div>
                </dl>
              </div>

              {/* Vehicle Selection */}
              <form onSubmit={handleAssignVehicle} className="space-y-6">
                {(() => {
                  const matchingCars = cars.filter((car) => car.model_name === selectedBookingForVehicle.car_model && car.is_active)
                  const availableMatching = matchingCars.filter((car) => isCarAvailableForBooking(car, selectedBookingForVehicle))
                  const bookedMatching = matchingCars.filter((car) => !isCarAvailableForBooking(car, selectedBookingForVehicle))

                  const alternativeCars = cars.filter((car) => car.model_name !== selectedBookingForVehicle.car_model && car.is_active)
                  const availableAlternative = alternativeCars.filter((car) => isCarAvailableForBooking(car, selectedBookingForVehicle))
                  const bookedAlternative = alternativeCars.filter((car) => !isCarAvailableForBooking(car, selectedBookingForVehicle))

                  return (
                    <>
                      {/* Available Matching Cars */}
                      {availableMatching.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-green-700 mb-3">✓ Available - Preferred Model</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {availableMatching.map((car) => {
                              const isLowCapacity = hasInsufficientCapacity(car, selectedBookingForVehicle)
                              return (
                              <button
                                key={car.id}
                                type="button"
                                onClick={() => handleCarSelectionForAssignment(car)}
                                className={`p-4 border-2 rounded-lg transition-all text-left ${
                                  isLowCapacity
                                    ? 'border-red-400 hover:border-red-500'
                                    : selectedCarForAssignment?.id === car.id
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-200 hover:border-green-300'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-800">{car.model_name}</p>
                                    <p className="text-xs text-gray-600">{car.number_plate}</p>
                                    <p className="text-xs text-gray-500 mt-1">{car.class}</p>
                                    {isLowCapacity && (
                                      <span className="inline-block mt-2 px-2 py-1 bg-red-200 text-red-800 text-xs font-semibold rounded">
                                        Low Capacity ({car.capacity} seats)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right text-xs">
                                    <p className="font-semibold">{car.capacity} seats</p>
                                    <p className="text-gray-600">Driver: {car.driver_name}</p>
                                  </div>
                                </div>
                              </button>
                            )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Available Alternative Cars */}
                      {availableAlternative.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-blue-700 mb-3">✓ Available - Alternative Models</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {availableAlternative.map((car) => {
                              const isLowCapacity = hasInsufficientCapacity(car, selectedBookingForVehicle)
                              return (
                              <button
                                key={car.id}
                                type="button"
                                onClick={() => handleCarSelectionForAssignment(car)}
                                className={`p-4 border-2 rounded-lg transition-all text-left ${
                                  isLowCapacity
                                    ? 'border-red-400 hover:border-red-500'
                                    : selectedCarForAssignment?.id === car.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-800">{car.model_name}</p>
                                    <p className="text-xs text-gray-600">{car.number_plate}</p>
                                    <p className="text-xs text-gray-500 mt-1">{car.class}</p>
                                    {isLowCapacity && (
                                      <span className="inline-block mt-2 px-2 py-1 bg-red-200 text-red-800 text-xs font-semibold rounded">
                                        Low Capacity ({car.capacity} seats)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right text-xs">
                                    <p className="font-semibold">{car.capacity} seats</p>
                                    <p className="text-gray-600">Driver: {car.driver_name}</p>
                                  </div>
                                </div>
                              </button>
                            )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Booked Matching Cars */}
                      {bookedMatching.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-orange-700 mb-3">⚠ Booked - Preferred Model</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {bookedMatching.map((car) => {
                              const isLowCapacity = hasInsufficientCapacity(car, selectedBookingForVehicle)
                              return (
                              <button
                                key={car.id}
                                type="button"
                                onClick={() => handleCarSelectionForAssignment(car)}
                                className={`p-4 border-2 rounded-lg transition-all text-left opacity-60 ${
                                  selectedCarForAssignment?.id === car.id
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-300 hover:border-orange-300 bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-700">{car.model_name}</p>
                                    <p className="text-xs text-gray-600">{car.number_plate}</p>
                                    <p className="text-xs text-gray-500 mt-1">{car.class}</p>
                                    <div className="mt-2 space-y-1">
                                      <span className="inline-block px-2 py-1 bg-orange-200 text-orange-800 text-xs font-semibold rounded mr-2">
                                        Booked
                                      </span>
                                      {isLowCapacity && (
                                        <span className="inline-block px-2 py-1 bg-red-200 text-red-800 text-xs font-semibold rounded">
                                          Low Capacity ({car.capacity} seats)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right text-xs">
                                    <p className="font-semibold">{car.capacity} seats</p>
                                    <p className="text-gray-600">Driver: {car.driver_name}</p>
                                  </div>
                                </div>
                              </button>
                            )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Booked Alternative Cars */}
                      {bookedAlternative.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-orange-700 mb-3">⚠ Booked - Alternative Models</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {bookedAlternative.map((car) => {
                              const isLowCapacity = hasInsufficientCapacity(car, selectedBookingForVehicle)
                              return (
                              <button
                                key={car.id}
                                type="button"
                                onClick={() => handleCarSelectionForAssignment(car)}
                                className={`p-4 border-2 rounded-lg transition-all text-left opacity-60 ${
                                  selectedCarForAssignment?.id === car.id
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-gray-300 hover:border-orange-300 bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-700">{car.model_name}</p>
                                    <p className="text-xs text-gray-600">{car.number_plate}</p>
                                    <p className="text-xs text-gray-500 mt-1">{car.class}</p>
                                    <div className="mt-2 space-y-1">
                                      <span className="inline-block px-2 py-1 bg-orange-200 text-orange-800 text-xs font-semibold rounded mr-2">
                                        Booked
                                      </span>
                                      {isLowCapacity && (
                                        <span className="inline-block px-2 py-1 bg-red-200 text-red-800 text-xs font-semibold rounded">
                                          Low Capacity ({car.capacity} seats)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right text-xs">
                                    <p className="font-semibold">{car.capacity} seats</p>
                                    <p className="text-gray-600">Driver: {car.driver_name}</p>
                                  </div>
                                </div>
                              </button>
                            )
                            })}
                          </div>
                        </div>
                      )}

                      {/* No cars available message */}
                      {matchingCars.length === 0 && alternativeCars.length === 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-red-800">No active vehicles available for assignment.</p>
                        </div>
                      )}

                      {/* Inactive Matching Cars */}
                      {(() => {
                        const inactiveMatching = cars.filter((car) => car.model_name === selectedBookingForVehicle.car_model && !car.is_active)
                        return inactiveMatching.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-gray-500 mb-3">🚫 Inactive - Preferred Model</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {inactiveMatching.map((car) => (
                                <div
                                  key={car.id}
                                  className="p-4 border-2 border-gray-300 rounded-lg text-left opacity-40 bg-gray-200 cursor-not-allowed"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-600">{car.model_name}</p>
                                      <p className="text-xs text-gray-500">{car.number_plate}</p>
                                      <p className="text-xs text-gray-500 mt-1">{car.class}</p>
                                      <span className="inline-block mt-2 px-2 py-1 bg-gray-400 text-white text-xs font-semibold rounded">
                                        Inactive
                                      </span>
                                    </div>
                                    <div className="text-right text-xs">
                                      <p className="font-semibold text-gray-600">{car.capacity} seats</p>
                                      <p className="text-gray-500">Driver: {car.driver_name}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Inactive Alternative Cars */}
                      {(() => {
                        const inactiveAlternative = cars.filter((car) => car.model_name !== selectedBookingForVehicle.car_model && !car.is_active)
                        return inactiveAlternative.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-gray-500 mb-3">🚫 Inactive - Alternative Models</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {inactiveAlternative.map((car) => (
                                <div
                                  key={car.id}
                                  className="p-4 border-2 border-gray-300 rounded-lg text-left opacity-40 bg-gray-200 cursor-not-allowed"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-600">{car.model_name}</p>
                                      <p className="text-xs text-gray-500">{car.number_plate}</p>
                                      <p className="text-xs text-gray-500 mt-1">{car.class}</p>
                                      <span className="inline-block mt-2 px-2 py-1 bg-gray-400 text-white text-xs font-semibold rounded">
                                        Inactive
                                      </span>
                                    </div>
                                    <div className="text-right text-xs">
                                      <p className="font-semibold text-gray-600">{car.capacity} seats</p>
                                      <p className="text-gray-500">Driver: {car.driver_name}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )
                })()}


                {/* Selected Car Summary */}
                {selectedCarForAssignment && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold mb-3 text-gray-900">Selected Vehicle</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Model:</dt>
                        <dd className="font-medium text-gray-900">{selectedCarForAssignment.model_name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Registration:</dt>
                        <dd className="font-medium text-gray-900">{selectedCarForAssignment.number_plate}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Driver:</dt>
                        <dd className="font-medium text-gray-900">{selectedCarForAssignment.driver_name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Driver Phone:</dt>
                        <dd className="font-medium text-gray-900">{selectedCarForAssignment.driver_phone}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Capacity:</dt>
                        <dd className="font-medium text-gray-900">{selectedCarForAssignment.capacity} passengers</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeVehicleAssignmentModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                    disabled={submittingVehicleAssignment}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submittingVehicleAssignment || !selectedCarForAssignment}
                  >
                    {submittingVehicleAssignment 
                      ? (vehicleAssignments.find((va) => va.booking_id === (selectedBookingForVehicle?.booking_id || selectedBookingForVehicle?.id)) ? 'Reassigning...' : 'Assigning...')
                      : (vehicleAssignments.find((va) => va.booking_id === (selectedBookingForVehicle?.booking_id || selectedBookingForVehicle?.id)) ? 'Reassign Vehicle' : 'Assign Vehicle')}
                  </button>
                </div>
              </form>

              {/* Booked Car Confirmation Dialog */}
              {confirmBookedCarAssignment && selectedBookingForVehicle && (() => {
                const conflict = getConflictingAssignment(confirmBookedCarAssignment, selectedBookingForVehicle)
                const conflictingBooking = conflict ? bookings.find(b => b.booking_id === conflict.booking_id || b.id === conflict.booking_id) : null
                
                return (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                      <div className="flex items-center justify-center w-12 h-12 mx-auto bg-orange-100 rounded-full mb-4">
                        <span className="text-2xl">⚠️</span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-center mb-2">Car Already Assigned</h3>
                      <p className="text-gray-600 text-center text-sm mb-4">
                        This car is assigned to a different active booking for this timeframe. If you continue, the system will record this as an admin override and the conflict scanner will keep surfacing it until you resolve one of the assignments.
                      </p>

                      {conflictingBooking && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm">
                          <p className="font-semibold text-orange-800 mb-2">Conflicting Booking:</p>
                          <dl className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <dt className="text-gray-600">Customer:</dt>
                              <dd className="font-medium">{conflictingBooking.user_name || '-'}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-600">Time:</dt>
                              <dd className="font-medium">{new Date(conflictingBooking.start_datetime).toLocaleString('en-IN').split(',')[1]} - {new Date(conflictingBooking.end_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</dd>
                            </div>
                          </dl>
                        </div>
                      )}

                      <p className="text-gray-700 text-sm mb-6">
                        Only continue if there is an operational reason, such as a planned vehicle swap outside the system. Resolve it later by reassigning one booking, changing timing, or cancelling one booking.
                      </p>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfirmBookedCarAssignment(null)}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmBookedCarSelection}
                          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-colors"
                        >
                          Override and Assign
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Low Capacity Confirmation Dialog */}
              {confirmLowCapacityCarAssignment && selectedBookingForVehicle && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                    <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-center mb-2">Insufficient Car Capacity</h3>
                    <p className="text-gray-600 text-center text-sm mb-4">
                      The selected car does not have enough seats for the number of passengers.
                    </p>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
                      <p className="font-semibold text-red-800 mb-2">Capacity Mismatch:</p>
                      <dl className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Required Passengers:</dt>
                          <dd className="font-medium text-red-700">{selectedBookingForVehicle.passenger_count ?? '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Car Capacity:</dt>
                          <dd className="font-medium text-red-700">{confirmLowCapacityCarAssignment.capacity}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Shortage:</dt>
                          <dd className="font-medium text-red-700">{(selectedBookingForVehicle.passenger_count ?? 0) - confirmLowCapacityCarAssignment.capacity} seats</dd>
                        </div>
                      </dl>
                    </div>

                    <p className="text-gray-700 text-sm mb-6">
                      Are you sure you want to assign <span className="font-semibold">{confirmLowCapacityCarAssignment.model_name}</span> ({confirmLowCapacityCarAssignment.number_plate}) with only <span className="font-semibold">{confirmLowCapacityCarAssignment.capacity} seats</span> to this booking?
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmLowCapacityCarAssignment(null)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmLowCapacityCarSelection}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors"
                      >
                        Yes, Assign Anyway
                      </button>
                    </div>
                  </div>
                </div>
              )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      </div>
    </ProtectedAdminPage>
  )
}
