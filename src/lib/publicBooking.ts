import { supabase } from './supabase'

export interface PublicDoctor {
  id: string
  first_name: string
  last_name: string
  specialty: string
  license: string | null
  bio: string
  phone: string
  email: string
  address: string
  city: string
  work_days: string[]
  work_from: string
  work_to: string
  session_duration: number
  price_particular: number
  booking_code: string
  avatar_url: string | null
}

export interface DaySlots {
  date: string
  dayLabel: string
  slots: string[]
}

export async function getDoctorByBookingCode(code: string): Promise<PublicDoctor | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, specialty, license, bio, phone, email, address, city, work_days, work_from, work_to, session_duration, price_particular, booking_code, avatar_url')
    .eq('booking_code', code)
    .single()
  return data
}

const dayMap: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' }
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function formatDayLabel(date: Date): string {
  return `${weekdayNames[date.getDay()]} ${String(date.getDate()).padStart(2, '0')} ${monthNames[date.getMonth()]}`
}

function toLocalISO(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface PublicLocation {
  id: string
  name: string
  address: string
  city: string
  work_days: string[]
  work_from: string | null
  work_to: string | null
  is_primary: boolean
}

// Deterministic pin palette used to color-code each location in the public
// booking page. Index 0 (primary) always gets the house sage.
export const LOCATION_PALETTE = [
  { swatch: '#3B4A38', key: 'primary' }, // sage
  { swatch: '#A24A32', key: 'coral' },   // coral
  { swatch: '#4F7565', key: 'teal' },    // teal
  { swatch: '#B4893A', key: 'amber' },   // amber
] as const

export function locationColor(index: number): string {
  return LOCATION_PALETTE[index % LOCATION_PALETTE.length].swatch
}

export interface DaySlotsGrouped extends DaySlots {
  locationId: string | null
}

export async function getPublicDoctorLocations(doctorId: string): Promise<PublicLocation[]> {
  const { data } = await supabase
    .from('locations')
    .select('id, name, address, city, work_days, work_from, work_to, is_primary')
    .eq('doctor_id', doctorId)
    .order('is_primary', { ascending: false })
    .order('created_at')
  return (data as PublicLocation[]) || []
}

export async function getAvailableSlotsRange(doctorId: string, daysAhead = 14, locationId?: string | null): Promise<DaySlots[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fromISO = toLocalISO(today)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + daysAhead)
  const toISO = toLocalISO(endDate)

  // Get doctor config (session duration fallback)
  const { data: profile } = await supabase
    .from('profiles')
    .select('work_days, work_from, work_to, session_duration')
    .eq('id', doctorId)
    .single()
  if (!profile) return []

  // Get the location to use (the specified one, or the primary)
  let locationConfig: { work_days: string[]; work_from: string | null; work_to: string | null } = {
    work_days: profile.work_days || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
    work_from: profile.work_from,
    work_to: profile.work_to,
  }
  if (locationId) {
    const { data: loc } = await supabase
      .from('locations')
      .select('work_days, work_from, work_to')
      .eq('id', locationId)
      .single()
    if (loc) locationConfig = loc
  }

  // Get booked appointments for this doctor.
  // If location filter is active, only count appointments FOR THAT LOCATION — so two
  // offices on the same date-time don't conflict (doctor can only be at one at a time,
  // but for booking purposes we treat each as its own calendar).
  let apptQuery = supabase
    .from('appointments')
    .select('date, time, status, location_id')
    .eq('doctor_id', doctorId)
    .gte('date', fromISO)
    .lte('date', toISO)
  if (locationId) apptQuery = apptQuery.eq('location_id', locationId)
  const { data: appointments } = await apptQuery

  // Get date blocks
  const { data: blocks } = await supabase
    .from('date_blocks')
    .select('from_date, to_date')
    .eq('doctor_id', doctorId)

  const blockedDates = new Set<string>()
  for (const b of blocks || []) {
    const start = new Date(b.from_date + 'T12:00:00')
    const end = new Date(b.to_date + 'T12:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      blockedDates.add(d.toISOString().split('T')[0])
    }
  }

  const bookedByDate: Record<string, Set<string>> = {}
  for (const a of appointments || []) {
    if (a.status === 'cancelado') continue
    const key = a.date
    if (!bookedByDate[key]) bookedByDate[key] = new Set()
    bookedByDate[key].add(String(a.time).slice(0, 5))
  }

  const workDays = locationConfig.work_days || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
  const duration = profile.session_duration || 50
  const [startH, startM] = String(locationConfig.work_from || '09:00').slice(0, 5).split(':').map(Number)
  const [endH, endM] = String(locationConfig.work_to || '18:00').slice(0, 5).split(':').map(Number)
  const startMin = startH * 60 + startM
  const endMin = endH * 60 + endM

  const result: DaySlots[] = []
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const todayStr = now.toISOString().split('T')[0]

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const iso = d.toISOString().split('T')[0]

    if (blockedDates.has(iso)) continue
    if (!workDays.includes(dayMap[d.getDay()])) continue

    const booked = bookedByDate[iso] || new Set()
    const slots: string[] = []

    for (let m = startMin; m + duration <= endMin; m += duration) {
      // Skip past times today
      if (iso === todayStr && m <= nowMin + 30) continue
      const h = Math.floor(m / 60)
      const mn = m % 60
      const time = `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`
      if (!booked.has(time)) {
        slots.push(time)
      }
    }

    if (slots.length > 0) {
      result.push({ date: iso, dayLabel: formatDayLabel(d), slots })
    }
  }

  return result
}

/**
 * Fetch availability across ALL the doctor's locations at once.
 *
 * Each future date is assigned to the FIRST location (in the given order —
 * primary is expected to be first) whose `work_days` matches that weekday.
 * This mirrors `resolveLocationForDate` so the public page picks the same
 * office the agenda would.
 *
 * Returns days sorted ascending, each with its owning `locationId`.
 * Dates where no location matches are omitted.
 */
export async function getGroupedAvailableSlots(
  doctorId: string,
  locations: PublicLocation[],
  daysAhead = 30,
): Promise<DaySlotsGrouped[]> {
  if (!locations || locations.length === 0) {
    const flat = await getAvailableSlotsRange(doctorId, daysAhead, null)
    return flat.map((s) => ({ ...s, locationId: null }))
  }

  // Query each location's slots in parallel.
  const perLocation = await Promise.all(
    locations.map(async (loc) => {
      const slots = await getAvailableSlotsRange(doctorId, daysAhead, loc.id)
      return slots.map((s) => ({ ...s, locationId: loc.id }))
    }),
  )

  // Merge: first occurrence of a date wins (locations are expected primary-first).
  const byDate = new Map<string, DaySlotsGrouped>()
  for (const dayList of perLocation) {
    for (const day of dayList) {
      if (!byDate.has(day.date)) byDate.set(day.date, day)
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface BookingRequest {
  doctorId: string
  locationId?: string | null
  date: string
  time: string
  duration: string
  firstName: string
  lastName: string
  dni: string
  phone: string
  email?: string
  insurance?: string
}

export async function createBooking(req: BookingRequest): Promise<{ success: boolean; error?: string }> {
  // Check if patient exists for this doctor
  const { data: existingPatient } = await supabase
    .from('patients')
    .select('id')
    .eq('doctor_id', req.doctorId)
    .eq('phone', req.phone)
    .maybeSingle()

  let patientId = existingPatient?.id

  if (!patientId) {
    // Enforce plan limit before creating a new patient.
    // Free plan = 10 patients max. Pro/Clinic have null (unlimited).
    const { data: doctor } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', req.doctorId)
      .single()
    const plan = (doctor?.plan || 'free') as 'free' | 'pro' | 'clinic'
    if (plan === 'free') {
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', req.doctorId)
      if ((count ?? 0) >= 10) {
        return {
          success: false,
          error: 'El profesional alcanzó el límite de pacientes de su plan. Contactalo por otro medio para reservar.',
        }
      }
    }

    const { data: newPatient, error: patientErr } = await supabase
      .from('patients')
      .insert({
        doctor_id: req.doctorId,
        name: `${req.firstName} ${req.lastName}`,
        phone: req.phone,
        email: req.email || null,
        dni: req.dni,
        insurance: req.insurance || 'Particular',
        since: `Paciente desde ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
        total_sessions: 0,
        tags: [],
      })
      .select('id')
      .single()
    if (patientErr || !newPatient) {
      return { success: false, error: patientErr?.message || 'No se pudo crear el paciente' }
    }
    patientId = newPatient.id
  }

  const { data: insertedApt, error: aptErr } = await supabase
    .from('appointments')
    .insert({
      doctor_id: req.doctorId,
      patient_id: patientId,
      location_id: req.locationId || null,
      date: req.date,
      time: req.time,
      duration: req.duration,
      patient_name: `${req.firstName} ${req.lastName}`,
      detail: 'Turno solicitado desde la página pública',
      status: 'pendiente',
    })
    .select('id')
    .single()

  if (aptErr) return { success: false, error: aptErr.message }

  // Fire-and-forget: kick off the email notifications. We deliberately don't
  // await this in a blocking way, but we DO await with a short timeout so we
  // can log failures without keeping the user staring at a spinner. The
  // booking is already saved at this point; an email failure shouldn't roll
  // it back or surface to the UI — the doctor sees the turno in their panel
  // either way.
  if (insertedApt?.id) {
    void notifyBookingCreated(insertedApt.id)
  }

  return { success: true }
}

/**
 * Calls the Vercel function that sends the patient confirmation + doctor
 * notification mails. Fire-and-forget from the caller's perspective; this
 * function never throws. Failures land in the browser console for debugging
 * but don't propagate.
 */
async function notifyBookingCreated(appointmentId: string): Promise<void> {
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 8000)
    const resp = await fetch('/api/send-booking-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId }),
      signal: ctrl.signal,
    })
    clearTimeout(timeout)
    if (!resp.ok) {
      console.warn('[booking-email] non-2xx response', resp.status)
    }
  } catch (err) {
    console.warn('[booking-email] notify failed', err)
  }
}
