import { supabase } from './supabase'

// ==================== DESTINATIONS ====================
export async function getDestinations() {
  const { data, error } = await supabase.from('destinations').select('*').order('name')
  return { data, error }
}

export async function createDestination(destination: any) {
  const { data, error } = await supabase
    .from('destinations')
    .insert([destination])
    .select()
    .single()
  return { data, error }
}

export async function updateDestination(id: string, destination: any) {
  const { data, error } = await supabase
    .from('destinations')
    .update(destination)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteDestination(id: string) {
  const { error } = await supabase.from('destinations').delete().eq('id', id)
  return { error }
}

// ==================== PRICING ====================
export async function getPricingRules() {
  const { data, error } = await supabase.from('pricing_rules').select('*')
  return { data, error }
}

export async function calculateTaxiFare(destinationId: string, carType: string) {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('price')
    .eq('destination_id', destinationId)
    .eq('car_type', carType)
    .single()
  return { data, error }
}

// ==================== TOUR PACKAGES ====================
export async function getTourPackages() {
  const { data, error } = await supabase
    .from('tour_packages')
    .select('*')
    .eq('is_active', true)
    .order('name')
  return { data, error }
}

export async function getTourPackageById(id: string) {
  const { data, error } = await supabase.from('tour_packages').select('*').eq('id', id).single()
  return { data, error }
}

export async function createTourPackage(pkg: any) {
  const { data, error } = await supabase.from('tour_packages').insert([pkg]).select().single()
  return { data, error }
}

export async function updateTourPackage(id: string, pkg: any) {
  const { data, error } = await supabase
    .from('tour_packages')
    .update(pkg)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ==================== BOOKINGS ====================
export async function createBooking(booking: any) {
  const { data, error } = await supabase
    .from('bookings')
    .insert([booking])
    .select()
    .single()
  return { data, error }
}

export async function getBookingById(id: string) {
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single()
  return { data, error }
}

export async function getBookingsByUser(email: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_email', email)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function getAllBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function updateBookingStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function updateBookingPaymentStatus(id: string, paymentStatus: string) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ==================== ASSIGNMENTS ====================
export async function createAssignment(assignment: any) {
  const { data, error } = await supabase
    .from('assignments')
    .insert([assignment])
    .select()
    .single()
  return { data, error }
}

export async function getAssignmentByBooking(bookingId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('booking_id', bookingId)
    .single()
  return { data, error }
}

export async function getAssignmentsByDriver(driverId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('driver_id', driverId)
    .order('assigned_at', { ascending: false })
  return { data, error }
}

export async function updateAssignment(id: string, assignment: any) {
  const { data, error } = await supabase
    .from('assignments')
    .update(assignment)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ==================== VEHICLES ====================
export async function getVehicles() {
  const { data, error } = await supabase.from('vehicles').select('*').order('name')
  return { data, error }
}

export async function getAvailableVehicles(carType: string, date: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('car_type', carType)
    .eq('is_active', true)
  return { data, error }
}

export async function createVehicle(vehicle: any) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert([vehicle])
    .select()
    .single()
  return { data, error }
}

export async function updateVehicle(id: string, vehicle: any) {
  const { data, error } = await supabase
    .from('vehicles')
    .update(vehicle)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ==================== DRIVERS ====================
export async function getDrivers() {
  const { data, error } = await supabase.from('drivers').select('*').order('name')
  return { data, error }
}

export async function createDriver(driver: any) {
  const { data, error } = await supabase.from('drivers').insert([driver]).select().single()
  return { data, error }
}

export async function updateDriver(id: string, driver: any) {
  const { data, error } = await supabase
    .from('drivers')
    .update(driver)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ==================== PAYMENTS ====================
export async function createPayment(payment: any) {
  const { data, error } = await supabase.from('payments').insert([payment]).select().single()
  return { data, error }
}

export async function getPaymentsByBooking(bookingId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function updatePayment(id: string, payment: any) {
  const { data, error } = await supabase
    .from('payments')
    .update(payment)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}
