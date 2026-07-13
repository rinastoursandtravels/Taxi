// ==================== FORMATTING ====================
export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  if (currency === 'INR') {
    return `₹${amount.toFixed(2)}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatTime = (time: string): string => {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// ==================== VALIDATION ====================
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[0-9]{10}$/
  return phoneRegex.test(phone.replace(/\D/g, ''))
}

export const validateName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 50
}

// ==================== CALCULATION ====================
export const calculateAdvancePayment = (totalAmount: number): number => {
  return Math.round(totalAmount * 0.3 * 100) / 100
}

export const calculateRemainingPayment = (totalAmount: number): number => {
  return Math.round(totalAmount * 0.7 * 100) / 100
}

export const calculateTotalPrice = (
  basePrice: number,
  hours?: number,
  days?: number
): number => {
  if (hours) {
    return basePrice * hours
  }
  if (days) {
    return basePrice * days
  }
  return basePrice
}

// ==================== BOOKING UTILITIES ====================
export const generateBookingId = (): string => {
  // Cryptographically-strong UUID v4 (DB column is UUID). Prefer the native
  // randomUUID; fall back to getRandomValues so it stays secure and works in
  // both the browser and Node. Math.random() is deliberately NOT used — booking
  // ids double as unguessable access tokens for guest lookup endpoints.
  const g: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined

  if (g?.randomUUID) {
    return g.randomUUID()
  }

  if (g?.getRandomValues) {
    const bytes = g.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // Extremely old environment with no Web Crypto — should never happen on
  // Vercel or any modern browser, but keep a last-resort so booking never fails.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const generateInvoiceNumber = (): string => {
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const day = String(new Date().getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(5, '0')
  return `INV-${year}${month}${day}-${random}`
}

export const canCancelBooking = (bookingDate: string): boolean => {
  const booking = new Date(bookingDate)
  const now = new Date()
  const hoursDifference = (booking.getTime() - now.getTime()) / (1000 * 60 * 60)
  return hoursDifference >= 24
}

export const getBookingStatus = (
  status: string
): {
  label: string
  color: string
  icon: string
} => {
  const statusMap: Record<
    string,
    {
      label: string
      color: string
      icon: string
    }
  > = {
    pending: { label: 'Pending', color: 'yellow', icon: '⏳' },
    confirmed: { label: 'Confirmed', color: 'blue', icon: '✅' },
    assigned: { label: 'Assigned', color: 'purple', icon: '🎯' },
    in_progress: { label: 'In Progress', color: 'green', icon: '🚗' },
    completed: { label: 'Completed', color: 'gray', icon: '🏁' },
    cancelled: { label: 'Cancelled', color: 'red', icon: '❌' },
  }
  return statusMap[status] || { label: 'Unknown', color: 'gray', icon: '❓' }
}

export const getPaymentStatusBadge = (
  status: string
): {
  label: string
  color: string
} => {
  const statusMap: Record<
    string,
    {
      label: string
      color: string
    }
  > = {
    pending: { label: 'Pending', color: 'yellow' },
    completed: { label: 'Paid', color: 'green' },
    failed: { label: 'Failed', color: 'red' },
    refunded: { label: 'Refunded', color: 'gray' },
  }
  return statusMap[status] || { label: 'Unknown', color: 'gray' }
}

// ==================== STRING UTILITIES ====================
export const truncateString = (str: string, length: number): string => {
  return str.length > length ? str.substring(0, length) + '...' : str
}

export const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const toTitleCase = (str: string): string => {
  return str
    .split(' ')
    .map((word) => capitalizeFirstLetter(word.toLowerCase()))
    .join(' ')
}

// ==================== MISC ====================
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development'
}

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}
