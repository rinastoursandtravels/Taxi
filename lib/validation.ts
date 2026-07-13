/**
 * Validation utilities for strict type checking on user inputs
 */

/**
 * Returns true only for a canonical UUID (any version). Used to guard values
 * that get placed into PostgREST filter strings so a caller can never inject
 * extra filter syntax (commas, parentheses, other columns) through them.
 */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

/**
 * Validates email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' }
  }

  const trimmed = email.trim()
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email cannot be empty' }
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' }
  }

  // RFC 5322 simplified regex for email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' }
  }

  return { valid: true }
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' }
  }

  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' }
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password is too long' }
  }

  return { valid: true }
}

/**
 * Validates full name
 */
export function validateFullName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Full name is required' }
  }

  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return { valid: false, error: 'Full name cannot be empty' }
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters' }
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Full name is too long' }
  }

  // Only allow letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'Full name can only contain letters, spaces, hyphens, and apostrophes' }
  }

  // Require at least two words
  const words = trimmed.split(/\s+/).filter(word => word.length > 0)
  if (words.length < 2) {
    return { valid: false, error: 'Full name must contain at least two words' }
  }

  return { valid: true }
}

/**
 * Validates phone number using libphonenumber-js.
 * Accepts international format (+91 9876543210) emitted by PhoneInput,
 * or legacy plain 10-digit Indian numbers (treated as +91).
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' }
  }

  const trimmed = phone.trim()
  if (!trimmed) {
    return { valid: false, error: 'Phone number is required' }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isValidPhoneNumber } = require('libphonenumber-js') as typeof import('libphonenumber-js')

  const isObviouslyFake = (digits: string) => digits.length >= 4 && /^(\d)\1+$/.test(digits)

  // Plain digits (no country prefix) → assume India
  if (!trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '')
    if (/^[6-9]\d{9}$/.test(digits) && !isObviouslyFake(digits)) return { valid: true }
    return { valid: false, error: 'Invalid phone number' }
  }

  // Indian number with country code
  if (trimmed.startsWith('+91')) {
    const digits = trimmed.slice(3).replace(/\D/g, '')
    if (/^[6-9]\d{9}$/.test(digits) && !isObviouslyFake(digits)) return { valid: true }
    return { valid: false, error: 'Invalid phone number' }
  }

  // International: use libphonenumber-js + fake-pattern check
  const nationalDigits = trimmed.replace(/^\+\d{1,4}/, '').replace(/\D/g, '')
  if (isObviouslyFake(nationalDigits)) {
    return { valid: false, error: 'Invalid phone number' }
  }
  if (!isValidPhoneNumber(trimmed)) {
    return { valid: false, error: 'Invalid phone number' }
  }

  return { valid: true }
}
