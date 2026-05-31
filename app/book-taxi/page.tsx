'use client'

import { useState, useEffect, useMemo, useRef, memo, Fragment } from 'react'
import Header from '@/components/Header'
import { Users, Search, X, MapPin, Calendar, Clock, Car, User, Mail, Phone, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import PhoneInput from '@/components/PhoneInput'
import AuthGate from '@/components/AuthGate'
import toast from 'react-hot-toast'
import dayjs, { Dayjs } from 'dayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { TimeClock } from '@mui/x-date-pickers/TimeClock'
import { generateBookingId } from '@/lib/utils'
import { validateFullName, validatePhoneNumber, validateEmail } from '@/lib/validation'
import { useAuth } from '@/context/AuthContext'

type Destination = {
  id: string
  name: string
  estimated_duration_minutes: number
  description: string | null
}

type CarModel = {
  model_name: string
  class: string
  capacity: number
  fixed_fare: number
}

type AirportStep = 'route' | 'schedule' | 'car' | 'contact' | 'confirm'
const AIRPORT_STEPS: AirportStep[] = ['route', 'schedule', 'car', 'contact', 'confirm']
const STEP_META: Record<AirportStep, { label: string; caption: string }> = {
  route: { label: 'Route', caption: 'Choose destination' },
  schedule: { label: 'Schedule', caption: 'Set pickup slot' },
  car: { label: 'Car', caption: 'Pick a model' },
  contact: { label: 'Contact', caption: 'Confirm details' },
  confirm: { label: 'Review', caption: 'Proceed to pay' },
}

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''}`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr${h !== 1 ? 's' : ''}` : `${h} hr${h !== 1 ? 's' : ''} ${m} mins`
}

function formatCurrency(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const ContactStep = memo(function ContactStep({
  name,
  phone,
  email,
  nameInputRef,
  phoneInputRef,
  emailInputRef,
  onNameChange,
  onPhoneChange,
  onEmailChange,
}: {
  name: string
  phone: string
  email: string
  nameInputRef: React.RefObject<HTMLInputElement>
  phoneInputRef: React.RefObject<HTMLInputElement>
  emailInputRef: React.RefObject<HTMLInputElement>
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onEmailChange: (value: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
          <User className="h-4 w-4 text-secondary-300" />
          Full Name *
        </label>
        <input 
          ref={nameInputRef} 
          type="text" 
          value={name} 
          onChange={(e) => onNameChange(e.target.value)} 
          placeholder="John Doe"
          className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-white placeholder:text-gray-500 focus:border-secondary-400 focus:bg-white/[0.08] focus:outline-none transition-colors" 
          required 
        />
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
          <Phone className="h-4 w-4 text-secondary-300" />
          Phone Number *
        </label>
        <PhoneInput 
          ref={phoneInputRef} 
          value={phone} 
          onChange={onPhoneChange}
        />
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
          <Mail className="h-4 w-4 text-secondary-300" />
          Email *
        </label>
        <input 
          ref={emailInputRef} 
          type="email" 
          value={email} 
          onChange={(e) => onEmailChange(e.target.value)} 
          placeholder="john@example.com"
          className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-white placeholder:text-gray-500 cursor-not-allowed opacity-70 focus:outline-none" 
          disabled 
          required 
        />
      </div>
    </div>
  )
})

export default function BookTaxi() {
  const { user, isLoading } = useAuth()
  const [step, setStep] = useState<AirportStep>('route')
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null)
  const [loadingDest, setLoadingDest] = useState(true)
  const [availableCarModels, setAvailableCarModels] = useState<CarModel[]>([])
  const [loadingCars, setLoadingCars] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const [destinationSearch, setDestinationSearch] = useState('')
  const [destinationSortOrder, setDestinationSortOrder] = useState<'default' | 'asc' | 'desc'>('default')
  const [carSearch, setCarSearch] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [passengers, setPassengers] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [selectedCarModel, setSelectedCarModel] = useState<CarModel | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/destinations')
      .then((r) => r.json())
      .then((d) => setDestinations(d.success ? d.destinations || [] : []))
      .catch(() => toast.error('Failed to load destinations'))
      .finally(() => setLoadingDest(false))
  }, [])

  useEffect(() => {
    if (user?.email) setEmail(user.email || '')
  }, [user])

  useEffect(() => {
    if (step === 'contact') nameInputRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (!user || !showAuthGate) return
    setShowAuthGate(false)
    setStep('contact')
  }, [user, showAuthGate])

  const persistForOAuth = () => {
    sessionStorage.setItem(
      'bookingResume',
      JSON.stringify({ name, phone, passengers, date, startTime, selectedDest, selectedCarModel, availableCarModels })
    )
    sessionStorage.setItem('postAuthRedirect', '/book-taxi')
  }

  useEffect(() => {
    if (isLoading) return
    const saved = sessionStorage.getItem('bookingResume')
    if (!saved || !user) return
    try {
      const s = JSON.parse(saved)
      sessionStorage.removeItem('bookingResume')
      if (s.name) setName(s.name)
      if (s.phone) setPhone(s.phone)
      if (s.passengers) setPassengers(s.passengers)
      if (s.date) setDate(s.date)
      if (s.startTime) setStartTime(s.startTime)
      if (s.selectedDest) setSelectedDest(s.selectedDest)
      if (s.selectedCarModel) setSelectedCarModel(s.selectedCarModel)
      if (s.availableCarModels) setAvailableCarModels(s.availableCarModels)
      setStep('contact')
    } catch {
      sessionStorage.removeItem('bookingResume')
    }
  }, [isLoading, user])

  const filteredDestinations = useMemo(() => {
    const q = destinationSearch.trim().toLowerCase()
    const filtered = q
      ? destinations.filter((d) => d.name.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q))
      : destinations

    if (destinationSortOrder === 'asc') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    }
    if (destinationSortOrder === 'desc') {
      return [...filtered].sort((a, b) => b.name.localeCompare(a.name, 'en', { sensitivity: 'base' }))
    }
    return filtered
  }, [destinations, destinationSearch, destinationSortOrder])

  const filteredCars = useMemo(() => {
    if (!carSearch.trim()) return availableCarModels
    const q = carSearch.toLowerCase()
    return availableCarModels.filter((c) => c.model_name.toLowerCase().includes(q) || c.class.toLowerCase().includes(q))
  }, [availableCarModels, carSearch])

  const currentStepIndex = AIRPORT_STEPS.indexOf(step)
  const totalCost = selectedCarModel ? Number(selectedCarModel.fixed_fare || 0) : 0
  const advance = Math.round(totalCost * 0.3 * 100) / 100
  const remaining = Math.round(totalCost * 0.7 * 100) / 100

  const loadCars = async () => {
    if (!selectedDest) return
    setLoadingCars(true)
    try {
      const [h, m] = startTime.split(':').map(Number)
      const totalMinutes = h * 60 + m + selectedDest.estimated_duration_minutes * 2
      const dayOffset = Math.floor(totalMinutes / 1440)
      const normalizedMinutes = totalMinutes % 1440
      const endTime = `${String(Math.floor(normalizedMinutes / 60)).padStart(2, '0')}:${String(normalizedMinutes % 60).padStart(2, '0')}`
      const baseDate = new Date(`${date}T00:00:00`)
      baseDate.setDate(baseDate.getDate() + dayOffset)
      const endDate = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`
      const params = new URLSearchParams({
        destination_id: selectedDest.id,
        booking_date: date,
        start_time: startTime,
        end_time: endTime,
        end_date: endDate,
      })
      const r = await fetch(`/api/cars/available-models?${params}`)
      const d = await r.json()
      if (d.success) {
        const count = parseInt(passengers)
        setAvailableCarModels((d.models || []).filter((c: CarModel) => c.capacity >= count))
      } else {
        toast.error(d.error || 'Failed to load available cars')
      }
    } catch {
      toast.error('Failed to load available cars')
    } finally {
      setLoadingCars(false)
    }
  }

  const onNext = (e: React.FormEvent) => {
    e.preventDefault()
    const idx = AIRPORT_STEPS.indexOf(step)
    if (step === 'route' && (!selectedDest || !passengers)) return toast.error('Please select destination and passengers')
    if (step === 'schedule') {
      if (!date || !startTime) return toast.error('Please select date and time')
      void loadCars()
    }
    if (step === 'car') {
      if (!selectedCarModel) return toast.error('Please select a car model')
      if (!user) return setShowAuthGate(true)
    }
    if (step === 'contact') {
      if (!validateFullName(name).valid) return toast.error('Invalid name')
      if (!validatePhoneNumber(phone).valid) return toast.error('Invalid phone')
      if (!validateEmail(email).valid) return toast.error('Invalid email')
    }
    setStep(AIRPORT_STEPS[idx + 1])
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDest || !selectedCarModel || isSubmitting) return
    setIsSubmitting(true)
    const bookingId = generateBookingId()

    const payload = {
      booking_id: bookingId,
      booking_type: 'taxi',
      user_name: name,
      user_email: email,
      phone,
      passenger_count: parseInt(passengers),
      booking_date: date,
      start_time: startTime,
      destination_id: selectedDest.id,
      car_model: selectedCarModel.model_name,
      amount_total: totalCost,
      booking_status: 'pending',
    }

    try {
      const res = await fetch('/api/bookings/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await res.json()
      if (!result.success || !result.booking) {
        toast.error(result.error || 'Failed to create booking')
        setIsSubmitting(false)
        return
      }
      const confirmedTotal = Number(result.booking.amount_total || totalCost)
      const confirmedAdvance = Math.round(confirmedTotal * 0.3 * 100) / 100
      sessionStorage.setItem(
        'bookingData',
        JSON.stringify({
          bookingId,
          bookingType: 'taxi',
          name,
          email,
          phone,
          destination: selectedDest.name,
          car: selectedCarModel.model_name,
          passengers,
          date,
          startTime,
          totalPrice: confirmedTotal,
          advancePayment: confirmedAdvance,
          dbBookingId: result.booking.id,
          endTime: new Date(result.booking.end_datetime).toTimeString().slice(0, 5),
        })
      )
      window.location.href = `/payment?bookingId=${bookingId}&amount=${confirmedAdvance}`
    } catch {
      toast.error('Booking failed')
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-primary-950" />

  // Modern step indicator helper
  const StepIndicator = () => {
    return (
      <div className="px-1">
        <div className="flex items-center">
          {AIRPORT_STEPS.map((item, index) => {
            const active = index === currentStepIndex
            const done = index < currentStepIndex
            return (
              <Fragment key={item}>
                <div className="shrink-0">
                  <div
                    className={`h-10 w-10 md:h-12 md:w-12 rounded-full border-2 flex items-center justify-center font-bold text-sm md:text-base transition-all duration-300 ${
                      active
                        ? 'border-secondary-400 bg-secondary-500/25 text-secondary-100 shadow-[0_0_20px_rgba(255,214,10,0.25)]'
                        : done
                          ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                          : 'border-white/15 bg-white/[0.03] text-gray-400'
                    }`}
                  >
                    {done ? <Check className="h-5 w-5 md:h-6 md:w-6" /> : index + 1}
                  </div>
                </div>

                {index < AIRPORT_STEPS.length - 1 && (
                  <div
                    className={`mx-1 md:mx-2 h-1 flex-1 rounded-full transition-all duration-300 ${
                      done ? 'bg-emerald-400/40' : active ? 'bg-secondary-400/50' : 'bg-white/10'
                    }`}
                  />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
    )
  }

  const toDayjsDate = (input: string): Dayjs => {
    if (!input) return dayjs().startOf('day')
    const parsed = dayjs(input, 'YYYY-MM-DD', true)
    return parsed.isValid() ? parsed.startOf('day') : dayjs().startOf('day')
  }

  const toDayjsTime = (input: string): Dayjs => {
    const base = dayjs()
    if (!input) return base.hour(9).minute(0).second(0)
    const [hours, minutes] = input.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return base.hour(9).minute(0).second(0)
    return base.hour(hours).minute(minutes).second(0)
  }

  const formatDisplayTime = (input: string): string => {
    if (!input) return '-- : --'
    const parsed = dayjs(input, 'HH:mm', true)
    if (!parsed.isValid()) return '-- : --'
    return parsed.format('hh:mm A')
  }

  // Industry-standard calendar picker
  const DatePickerModal = ({ isOpen, onClose, value, onChange }: { isOpen: boolean; onClose: () => void; value: string; onChange: (date: string) => void }) => {
    const [draftDate, setDraftDate] = useState<Dayjs>(toDayjsDate(value))

    useEffect(() => {
      if (isOpen) setDraftDate(toDayjsDate(value))
    }, [isOpen, value])

    if (!isOpen) return null

    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm">
        <div className="w-full md:w-auto rounded-t-3xl md:rounded-2xl border border-white/15 bg-primary-900/95 backdrop-blur-xl md:bg-primary-900 p-5 md:p-6 shadow-2xl md:max-w-sm">
          <p className="text-white text-sm font-semibold tracking-wide uppercase mb-3">Select Date</p>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-2 md:p-3">
            <div className="flex justify-center">
              <DateCalendar
                value={draftDate}
                minDate={dayjs().startOf('day')}
                onChange={(next) => {
                  if (next) setDraftDate(next.startOf('day'))
                }}
                sx={{
                  width: { xs: 300, sm: 330 },
                  maxWidth: '100%',
                  minHeight: { xs: 310, sm: 330 },
                  color: '#fff',
                  '& .MuiPickersCalendarHeader-label': {
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                  },
                  '& .MuiIconButton-root': {
                    color: '#FACC15',
                  },
                  '& .MuiDayCalendar-weekDayLabel': {
                    color: '#d0d0d0',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                  },
                  '& .MuiPickerDay-root, & .MuiPickersDay-root': {
                    color: '#ffffff !important',
                    WebkitTextFillColor: '#ffffff',
                    border: '1px solid transparent',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                  },
                  '& .MuiPickerDay-root *, & .MuiPickersDay-root *': {
                    color: '#ffffff !important',
                    WebkitTextFillColor: '#ffffff',
                  },
                  '& .MuiPickerDay-root:hover, & .MuiPickersDay-root:hover': {
                    backgroundColor: 'rgba(255,214,10,0.25)',
                    color: '#ffffff !important',
                  },
                  '& .MuiPickerDay-root.Mui-selected, & .MuiPickersDay-root.Mui-selected': {
                    backgroundColor: '#0066ff',
                    color: '#ffffff !important',
                    WebkitTextFillColor: '#ffffff',
                    fontWeight: 800,
                  },
                  '& .MuiPickerDay-root.Mui-selected:hover, & .MuiPickersDay-root.Mui-selected:hover': {
                    backgroundColor: '#0052cc',
                    color: '#ffffff !important',
                  },
                  '& .MuiPickerDay-root.Mui-disabled, & .MuiPickersDay-root.Mui-disabled': {
                    color: 'rgba(241, 245, 249, 0.82) !important',
                    WebkitTextFillColor: 'rgba(241, 245, 249, 0.82)',
                    fontSize: '1.05rem',
                    fontWeight: 500,
                  },
                  '& .MuiPickerDay-root.Mui-disabled *, & .MuiPickersDay-root.Mui-disabled *': {
                    color: 'rgba(241, 245, 249, 0.82) !important',
                    WebkitTextFillColor: 'rgba(241, 245, 249, 0.82)',
                  },
                  '& .MuiPickerDay-root.MuiPickersDay-today, & .MuiPickersDay-root.MuiPickersDay-today, & .MuiPickerDay-root[aria-current="date"], & .MuiPickersDay-root[aria-current="date"]': {
                    border: '2px solid rgba(0, 0, 0, 0.92) !important',
                    boxSizing: 'border-box',
                  },
                  '& .MuiPickerDay-root.MuiPickersDay-today.Mui-selected, & .MuiPickersDay-root.MuiPickersDay-today.Mui-selected, & .MuiPickerDay-root[aria-current="date"].Mui-selected, & .MuiPickersDay-root[aria-current="date"].Mui-selected': {
                    boxShadow: 'inset 0 0 0 2px rgba(0, 0, 0, 0.92)',
                  },
                }}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/15 text-white py-3 font-bold hover:bg-white/5 transition">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draftDate.format('YYYY-MM-DD'))
                onClose()
              }}
              className="flex-1 rounded-lg bg-secondary-500 text-primary-950 py-3 font-bold hover:bg-secondary-400 transition shadow-lg"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Industry-standard analog time picker
  const TimePickerModal = ({ isOpen, onClose, value, onChange }: { isOpen: boolean; onClose: () => void; value: string; onChange: (time: string) => void }) => {
    const [draftTime, setDraftTime] = useState<Dayjs>(toDayjsTime(value))
    const [timeView, setTimeView] = useState<'hours' | 'minutes'>('hours')
    const [meridiem, setMeridiem] = useState<'AM' | 'PM'>('AM')

    const applyMeridiem = (nextMeridiem: 'AM' | 'PM') => {
      const hour24 = draftTime.hour()
      const isCurrentlyPM = hour24 >= 12
      const shouldBePM = nextMeridiem === 'PM'
      if (isCurrentlyPM === shouldBePM) {
        setMeridiem(nextMeridiem)
        return
      }
      const adjustedHour = shouldBePM ? hour24 + 12 : hour24 - 12
      setDraftTime(draftTime.hour(adjustedHour))
      setMeridiem(nextMeridiem)
    }

    useEffect(() => {
      if (isOpen) {
        const initial = toDayjsTime(value)
        setDraftTime(initial)
        setMeridiem(initial.hour() >= 12 ? 'PM' : 'AM')
        setTimeView('hours')
      }
    }, [isOpen, value])

    useEffect(() => {
      setMeridiem(draftTime.hour() >= 12 ? 'PM' : 'AM')
    }, [draftTime])

    if (!isOpen) return null

    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm">
        <div className="w-full md:w-auto rounded-t-3xl md:rounded-2xl border border-white/15 bg-primary-900/95 backdrop-blur-xl md:bg-primary-900 p-5 md:p-6 shadow-2xl md:max-w-sm">
          <p className="text-white text-sm font-semibold tracking-wide uppercase mb-2">Select Time</p>
          <div className="flex items-center justify-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setTimeView('hours')}
              className={`rounded-lg px-3 py-1.5 text-4xl md:text-5xl font-black font-mono tracking-wider transition ${
                timeView === 'hours'
                  ? 'bg-secondary-500/20 text-secondary-100'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {draftTime.format('hh')}
            </button>
            <span className="text-4xl md:text-5xl font-black text-white font-mono tracking-wider">:</span>
            <button
              type="button"
              onClick={() => setTimeView('minutes')}
              className={`rounded-lg px-3 py-1.5 text-4xl md:text-5xl font-black font-mono tracking-wider transition ${
                timeView === 'minutes'
                  ? 'bg-secondary-500/20 text-secondary-100'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {draftTime.format('mm')}
            </button>
            <div className="ml-1 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => applyMeridiem('AM')}
                className={`rounded-md px-2.5 py-1 text-xs font-bold tracking-wide transition ${
                  meridiem === 'AM'
                    ? 'bg-secondary-500 text-primary-950'
                    : 'border border-white/15 text-white hover:bg-white/10'
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => applyMeridiem('PM')}
                className={`rounded-md px-2.5 py-1 text-xs font-bold tracking-wide transition ${
                  meridiem === 'PM'
                    ? 'bg-secondary-500 text-primary-950'
                    : 'border border-white/15 text-white hover:bg-white/10'
                }`}
              >
                PM
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mb-3">
            Tap <span className="font-semibold text-white">hour</span> or <span className="font-semibold text-white">minute</span> to switch views
          </p>

          <div className="flex justify-center">
            <TimeClock
              value={draftTime}
              ampm
              views={['hours', 'minutes']}
              view={timeView}
              onViewChange={(nextView) => {
                if (nextView === 'hours' || nextView === 'minutes') setTimeView(nextView)
              }}
              onChange={(next) => {
                if (next) setDraftTime(next)
              }}
              sx={{
                width: { xs: 280, sm: 310 },
                maxWidth: '100%',
                minHeight: { xs: 300, sm: 320 },
                color: '#fff',
                '& .MuiClock-root': {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                },
                '& .MuiClock-clock': {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                },
                '& .MuiClockNumber-root': {
                  color: 'rgba(255,255,255,0.84)',
                  fontWeight: 700,
                },
                '& .MuiClockNumber-root.Mui-selected': {
                  color: '#1a120f',
                },
                '& .MuiClockPointer-root': {
                  backgroundColor: '#FFD60A',
                },
                '& .MuiClockPointer-thumb': {
                  backgroundColor: '#FFD60A',
                  borderColor: '#FFD60A',
                },
                '& .MuiClock-pin': {
                  backgroundColor: '#FFD60A',
                },
              }}
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/15 text-white py-3 font-bold hover:bg-white/5 transition">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draftTime.format('HH:mm'))
                onClose()
              }}
              className="flex-1 rounded-lg bg-secondary-500 text-primary-950 py-3 font-bold hover:bg-secondary-400 transition shadow-lg"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-primary-950">
      <Header />
      <main className="mt-[72px] h-[calc(100vh-72px)] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,214,10,0.08),transparent_24%),linear-gradient(180deg,#1a120f_0%,#140f0d_100%)] md:mt-[84px] md:h-[calc(100vh-84px)]">
        <div className="container mx-auto h-full max-w-4xl px-3 pt-[5px] pb-3 md:px-4 md:pt-[5px] md:pb-4">
          <div className="flex h-full max-w-full flex-col gap-4">
            {/* Step Indicator */}
            <StepIndicator />

            {/* Main Content Form */}
            <form onSubmit={step === 'confirm' ? onSubmit : onNext} className="flex min-h-0 flex-1 flex-col gap-4">
              {/* Content Area */}
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 md:p-6 shadow-xl">
                <div className="h-full min-h-0 overflow-y-auto pr-2 scrollbar-thin-modern">
                  {step === 'route' && (
                    <div className="flex flex-col gap-4 h-full min-h-0">
                      {/* Fixed Passengers Section */}
                      <div>
                        <label className="flex items-center gap-2 text-lg font-bold text-white mb-2">
                          <Users className="h-5 w-5 text-secondary-300" />
                          How Many Passengers?
                        </label>
                        <div className="grid grid-cols-6 gap-1.5 md:gap-2">
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setPassengers(String(n))}
                              className={`w-full rounded-lg border-2 py-1.5 md:py-3 text-xs md:text-base font-bold transition-all duration-200 ${
                                passengers === String(n)
                                  ? 'border-secondary-400 bg-secondary-500/20 text-secondary-100 shadow-[0_0_15px_rgba(255,214,10,0.15)]'
                                  : 'border-white/15 bg-white/[0.03] text-gray-300 hover:border-secondary-400/50'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Scrollable Destination Section */}
                      <div className="flex flex-col gap-2 min-h-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-lg font-bold text-white">
                            <MapPin className="h-5 w-5 text-secondary-300" />
                            Select Destination
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setDestinationSortOrder((v) =>
                                v === 'default' ? 'asc' : v === 'asc' ? 'desc' : 'default'
                              )
                            }
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                              destinationSortOrder !== 'default'
                                ? 'border-secondary-400 bg-secondary-500/20 text-secondary-100'
                                : 'border-white/20 bg-white/[0.03] text-gray-300 hover:border-secondary-400/50'
                            }`}
                          >
                            {destinationSortOrder === 'asc' ? 'A-Z' : destinationSortOrder === 'desc' ? 'Z-A' : 'Sort'}
                          </button>
                        </div>
                        <div className="relative mb-1">
                          <Search className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                          <input
                            value={destinationSearch}
                            onChange={(e) => setDestinationSearch(e.target.value)}
                            placeholder="Search destination..."
                            className="w-full rounded-xl border border-white/15 bg-white/[0.05] py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:border-secondary-400 focus:bg-white/[0.08] focus:outline-none transition-colors"
                          />
                          {destinationSearch && (
                            <button 
                              type="button" 
                              onClick={() => setDestinationSearch('')} 
                              className="absolute right-4 top-3.5 text-gray-400 hover:text-white transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {loadingDest ? (
                          <div className="flex items-center justify-center py-8">
                            <p className="text-gray-300">Loading destinations...</p>
                          </div>
                        ) : (
                          <div className="grid content-start auto-rows-max gap-3 overflow-y-auto pr-2 scrollbar-thin-modern min-h-0 flex-1">
                            {filteredDestinations.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => setSelectedDest(d)}
                                className={`relative rounded-xl border-2 px-4 py-4 text-left transition-all duration-200 group ${
                                  selectedDest?.id === d.id
                                    ? 'border-secondary-400 bg-secondary-500/15 shadow-[0_0_20px_rgba(255,214,10,0.15)]'
                                    : 'border-white/15 bg-white/[0.03] hover:border-secondary-400/50 hover:bg-white/[0.06]'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-white text-sm md:text-base">{d.name}</p>
                                    <p className="mt-1 text-xs md:text-sm text-gray-400">
                                      ⏱ {formatDurationMinutes(d.estimated_duration_minutes)}
                                    </p>
                                  </div>
                                  {selectedDest?.id === d.id && (
                                    <div className="h-6 w-6 rounded-full bg-secondary-400 flex items-center justify-center">
                                      <Check className="h-4 w-4 text-primary-950 font-bold" />
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {step === 'schedule' && (
                    <div className="space-y-4">
                      {/* Date Selection */}
                      <div>
                        <label className="flex items-center gap-2 text-lg font-bold text-white mb-3">
                          <Calendar className="h-5 w-5 text-secondary-300" />
                          Pickup Date
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowDatePicker(true)}
                          className="w-full rounded-xl border-2 border-white/15 bg-white/[0.05] px-4 py-4 text-left hover:border-secondary-400 hover:bg-white/[0.08] transition-all"
                        >
                          <p className="text-gray-400 text-sm mb-1">Selected Date</p>
                          <p className="text-white font-bold text-lg">
                            {date ? new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-- / -- / ----'}
                          </p>
                        </button>
                      </div>

                      {/* Time Selection */}
                      <div>
                        <label className="flex items-center gap-2 text-lg font-bold text-white mb-3">
                          <Clock className="h-5 w-5 text-secondary-300" />
                          Pickup Time
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowTimePicker(true)}
                          className="w-full rounded-xl border-2 border-white/15 bg-white/[0.05] px-4 py-4 text-left hover:border-secondary-400 hover:bg-white/[0.08] transition-all"
                        >
                          <p className="text-gray-400 text-sm mb-1">Selected Time</p>
                          <p className="text-white font-bold text-lg font-mono tracking-widest">
                            {formatDisplayTime(startTime)}
                          </p>
                        </button>
                      </div>

                      {/* Journey Summary */}
                      <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 backdrop-blur-sm">
                        <p className="text-sm text-gray-400 mb-2">Journey Summary</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Destination:</span>
                            <span className="font-semibold text-white">{selectedDest?.name || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Estimated Duration:</span>
                            <span className="font-semibold text-white">{selectedDest ? formatDurationMinutes(selectedDest.estimated_duration_minutes) : '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 'car' && (
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-lg font-bold text-white mb-3">
                        <Car className="h-5 w-5 text-secondary-300" />
                        Select Car Type
                      </label>

                      {loadingCars ? (
                        <div className="flex items-center justify-center py-8">
                          <p className="text-gray-300">Loading available cars...</p>
                        </div>
                      ) : availableCarModels.length > 0 ? (
                        <div className="space-y-3">
                          {filteredCars.map((c) => (
                            <button
                              key={c.model_name}
                              type="button"
                              onClick={() => setSelectedCarModel(c)}
                              className={`relative rounded-xl border-2 px-4 py-4 text-left transition-all duration-200 ${
                                selectedCarModel?.model_name === c.model_name
                                  ? 'border-secondary-400 bg-secondary-500/15 shadow-[0_0_20px_rgba(255,214,10,0.15)]'
                                  : 'border-white/15 bg-white/[0.03] hover:border-secondary-400/50 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-bold text-white text-sm md:text-base">{c.model_name}</p>
                                  <p className="mt-1 text-xs md:text-sm text-gray-400">
                                    {c.class} • {c.capacity} {c.capacity === 1 ? 'passenger' : 'passengers'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-secondary-200 text-sm md:text-base">{formatCurrency(c.fixed_fare)}</p>
                                  <p className="text-xs text-gray-400">fixed rate</p>
                                </div>
                              </div>
                              {selectedCarModel?.model_name === c.model_name && (
                                <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-secondary-400 flex items-center justify-center">
                                  <Check className="h-4 w-4 text-primary-950 font-bold" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
                          <p className="text-yellow-200 text-sm">No cars available for this time slot. Please select a different time.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 'contact' && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-white mb-4">Contact Details</h2>
                      <ContactStep
                        name={name}
                        phone={phone}
                        email={email}
                        nameInputRef={nameInputRef}
                        phoneInputRef={phoneInputRef}
                        emailInputRef={emailInputRef}
                        onNameChange={setName}
                        onPhoneChange={setPhone}
                        onEmailChange={setEmail}
                      />
                    </div>
                  )}

                  {step === 'confirm' && (
                    <div className="space-y-4">
                      <h2 className="text-lg font-bold text-white mb-4">Review Your Booking</h2>

                      {/* Booking Summary Cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3 md:p-4 backdrop-blur-sm">
                          <p className="text-xs md:text-sm text-gray-400">Destination</p>
                          <p className="mt-2 font-semibold text-white text-sm md:text-base">{selectedDest?.name || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3 md:p-4 backdrop-blur-sm">
                          <p className="text-xs md:text-sm text-gray-400">Car Type</p>
                          <p className="mt-2 font-semibold text-white text-sm md:text-base">{selectedCarModel?.model_name || '—'}</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3 md:p-4 backdrop-blur-sm">
                          <p className="text-xs md:text-sm text-gray-400">Pickup</p>
                          <p className="mt-2 font-semibold text-white text-sm md:text-base">{date}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatDisplayTime(startTime)}</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3 md:p-4 backdrop-blur-sm">
                          <p className="text-xs md:text-sm text-gray-400">Passengers</p>
                          <p className="mt-2 font-semibold text-white text-sm md:text-base">{passengers || '—'}</p>
                        </div>
                      </div>

                      {/* Pricing Breakdown */}
                      <div className="rounded-xl border-2 border-secondary-400/50 bg-secondary-500/15 p-4 backdrop-blur-sm">
                        <p className="text-sm font-bold text-secondary-100 mb-4">Pricing Breakdown</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-gray-300">
                            <span>Total Amount</span>
                            <span className="font-semibold text-white">{formatCurrency(totalCost)}</span>
                          </div>
                          <div className="h-px bg-white/10 my-2" />
                          <div className="flex justify-between text-gray-300">
                            <span>Prebook Advance (30%)</span>
                            <span className="font-semibold text-secondary-200">{formatCurrency(advance)}</span>
                          </div>
                          <div className="flex justify-between text-gray-300">
                            <span>Pay at Airport Counter (70%)</span>
                            <span className="font-semibold text-secondary-200">{formatCurrency(remaining)}</span>
                          </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-white/15 bg-white/[0.04] p-3 text-xs md:text-sm text-gray-200 space-y-2">
                          <p className="font-semibold text-white">Payment Options on next step:</p>
                          <p>1. Pay <span className="font-bold text-white">{formatCurrency(totalCost)}</span> now online (full payment).</p>
                          <p>2. Pay <span className="font-bold text-white">{formatCurrency(advance)}</span> now to prebook, then pay <span className="font-bold text-white">{formatCurrency(remaining)}</span> in cash at the airport counter.</p>
                        </div>
                      </div>

                      {/* Contact Info Display */}
                      <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 backdrop-blur-sm">
                        <p className="text-sm text-gray-400 mb-3">Contact Information</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-300">
                            <User className="h-4 w-4 text-secondary-300" />
                            <span>{name || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Phone className="h-4 w-4 text-secondary-300" />
                            <span>{phone || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Mail className="h-4 w-4 text-secondary-300" />
                            <span>{email || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {step !== 'route' && (
                  <button
                    type="button"
                    onClick={() => setStep(AIRPORT_STEPS[AIRPORT_STEPS.indexOf(step) - 1])}
                    className="flex items-center justify-center gap-2 flex-1 rounded-xl border-2 border-white/20 bg-white/[0.05] px-4 py-3 md:py-4 text-sm md:text-base font-bold text-white hover:bg-white/[0.08] hover:border-white/30 transition-all duration-200"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 flex-1 rounded-xl bg-secondary-500 px-4 py-3 md:py-4 text-sm md:text-base font-bold text-primary-950 hover:bg-secondary-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-secondary-500 transition-all duration-200 shadow-[0_8px_20px_rgba(255,214,10,0.25)]"
                >
                  {step === 'confirm' ? (
                    <>
                      {isSubmitting ? (
                        <>
                          <span className="inline-block h-4 w-4 rounded-full border-2 border-primary-950 border-t-transparent animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Proceed to Payment
                          <ChevronRight className="h-5 w-5" />
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {showAuthGate && <AuthGate onClose={() => setShowAuthGate(false)} onOAuthStart={persistForOAuth} />}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePickerModal isOpen={showDatePicker} onClose={() => setShowDatePicker(false)} value={date} onChange={setDate} />
        <TimePickerModal isOpen={showTimePicker} onClose={() => setShowTimePicker(false)} value={startTime} onChange={setStartTime} />
      </LocalizationProvider>
    </div>
  )
}
