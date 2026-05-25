// Daily 24h-before-appointment reminder cron.
//
// Schedule (vercel.json): `0 11 * * *` — 11:00 UTC == 08:00 in Argentina
// (UTC-3, no DST). Picks up every appointment scheduled for the next
// calendar day in Argentina that:
//   1. has a patient email (we can't mail what we don't have),
//   2. isn't cancelled,
//   3. hasn't been reminded yet (`reminder_24h_sent_at IS NULL`).
//
// For each, it renders the precompiled `reminder-24h.html` template with
// the actual values and sends via Resend, then marks the appointment so
// the next cron run is a no-op for that row. Idempotency is the whole
// reason we added the column — without it, a manual re-run of the cron
// (or two cron runs during a Vercel hiccup) would double-mail patients.
//
// Auth: Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to every
// cron invocation. We verify and reject anything else.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHmac } from 'node:crypto'

// ─── Env ─────────────────────────────────────────────────────────────────────

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').trim()
const CANCEL_TOKEN_SECRET = (process.env.CANCEL_TOKEN_SECRET ?? '').trim()
const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim()
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'https://tecito.com.ar').trim()

const FROM_PATIENT = 'Tecito <hola@tecito.com.ar>'

// ─── Lazy clients ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function admin(): any {
  if (!_admin) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
    }
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  }
  return _admin
}

let _resend: Resend | null = null
function resend(): Resend {
  if (!_resend) {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing')
    _resend = new Resend(RESEND_API_KEY)
  }
  return _resend
}

// ─── Template loader (cached for warm invocations) ──────────────────────────

let _template: string | null = null
function getTemplate(): string {
  if (_template) return _template
  // The compiled HTML lives next to the function in the deployment bundle
  // thanks to `functions.includeFiles` in vercel.json. Locally (`vercel
  // dev`) the path resolves to the same place.
  const path = join(process.cwd(), 'api', '_compiled-emails', 'reminder-24h.html')
  _template = readFileSync(path, 'utf-8')
  return _template
}

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key]
    if (value === undefined) {
      console.warn(`[send-reminders] missing template var "${key}"`)
      return ''
    }
    return esc(value)
  })
}

// ─── Date helpers ────────────────────────────────────────────────────────────

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`
}

/**
 * Returns tomorrow's date in Argentina (UTC-3, no DST) as `YYYY-MM-DD`.
 *
 * We don't use `Date#toLocaleDateString({ timeZone })` because it returns
 * locale-formatted strings (`25/05/2026`) that vary by runtime locale.
 * Adding 24 hours of UTC ms gives the canonical answer.
 */
function tomorrowInArgentina(): string {
  // Vercel runs in UTC; "now" in Argentina is now-UTC minus 3h. Add a day
  // and read the date components of that shifted moment.
  const now = Date.now()
  const arNow = new Date(now - 3 * 60 * 60 * 1000)
  const arTomorrow = new Date(arNow.getTime() + 24 * 60 * 60 * 1000)
  const y = arTomorrow.getUTCFullYear()
  const m = String(arTomorrow.getUTCMonth() + 1).padStart(2, '0')
  const d = String(arTomorrow.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDurationMinutes(duration: string | null | undefined): number {
  if (!duration) return 50
  const m = /^(\d{1,2}):(\d{2})/.exec(duration)
  if (!m) return 50
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

// ─── Cancel URL signing (mirror of send-booking-confirmation logic) ─────────

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildCancelUrl(appointmentId: string): string {
  if (!CANCEL_TOKEN_SECRET) return `${PUBLIC_SITE_URL}/cancel/missing-secret`
  const exp = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60
  const payload = JSON.stringify({ apt: appointmentId, exp })
  const payloadB64 = b64urlEncode(Buffer.from(payload, 'utf-8'))
  const sig = createHmac('sha256', CANCEL_TOKEN_SECRET).update(payloadB64).digest()
  const token = `${payloadB64}.${b64urlEncode(sig)}`
  return `${PUBLIC_SITE_URL}/cancel/${token}`
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function authorized(req: VercelRequest): boolean {
  // Vercel cron sets `Authorization: Bearer ${CRON_SECRET}` on every
  // scheduled invocation. If the secret isn't configured we let local
  // dev hit the endpoint with no header so we can test by hand.
  if (!CRON_SECRET) return true
  const header = req.headers['authorization']
  return typeof header === 'string' && header === `Bearer ${CRON_SECRET}`
}

// ─── Handler ─────────────────────────────────────────────────────────────────

interface AppointmentRow {
  id: string
  doctor_id: string
  patient_id: string | null
  location_id: string | null
  date: string
  time: string
  duration: string | null
  status: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const db = admin()
    const targetDate = tomorrowInArgentina()

    // Pull every appointment scheduled for "tomorrow" in AR that hasn't
    // been reminded yet. We exclude cancelled rows in SQL so we don't
    // pay the join cost on rows we'd discard anyway.
    const { data: appointments, error: fetchErr } = await db
      .from('appointments')
      .select('id, doctor_id, patient_id, location_id, date, time, duration, status')
      .eq('date', targetDate)
      .neq('status', 'cancelado')
      .is('reminder_24h_sent_at', null)

    if (fetchErr) {
      console.error('[send-reminders] fetch failed', fetchErr)
      return res.status(500).json({ error: 'Fetch failed', details: fetchErr.message })
    }

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({ date: targetDate, sent: 0, skipped: 0, errors: 0 })
    }

    // Resolve all the join data (doctor / patient / location) in three
    // batched queries instead of N round-trips. For a busy day with 50
    // turnos this turns a ~5s walk into ~150ms.
    const doctorIds = [...new Set(appointments.map((a: AppointmentRow) => a.doctor_id))]
    const patientIds = appointments
      .map((a: AppointmentRow) => a.patient_id)
      .filter((id: string | null): id is string => !!id)
    const locationIds = appointments
      .map((a: AppointmentRow) => a.location_id)
      .filter((id: string | null): id is string => !!id)

    const [doctorsRes, patientsRes, locationsRes] = await Promise.all([
      db.from('profiles').select('id, first_name, last_name').in('id', doctorIds),
      patientIds.length
        ? db.from('patients').select('id, name, email, insurance').in('id', patientIds)
        : Promise.resolve({ data: [] }),
      locationIds.length
        ? db.from('locations').select('id, name, address, city').in('id', locationIds)
        : Promise.resolve({ data: [] }),
    ])

    type Doctor = { id: string; first_name: string; last_name: string }
    type Patient = { id: string; name: string; email: string | null; insurance: string | null }
    type Location = { id: string; name: string; address: string; city: string }

    const doctors = new Map<string, Doctor>(
      (doctorsRes.data ?? []).map((d: Doctor) => [d.id, d]),
    )
    const patients = new Map<string, Patient>(
      (patientsRes.data ?? []).map((p: Patient) => [p.id, p]),
    )
    const locations = new Map<string, Location>(
      (locationsRes.data ?? []).map((l: Location) => [l.id, l]),
    )

    const template = getTemplate()
    let sent = 0
    let skipped = 0
    let errors = 0

    for (const apt of appointments as AppointmentRow[]) {
      const doctor = doctors.get(apt.doctor_id)
      const patient = apt.patient_id ? patients.get(apt.patient_id) : null
      const location = apt.location_id ? locations.get(apt.location_id) : null

      if (!patient?.email) {
        // No mail to send to — but mark the row so we don't keep
        // checking it every hour for the rest of the day.
        await db
          .from('appointments')
          .update({ reminder_24h_sent_at: new Date().toISOString() })
          .eq('id', apt.id)
        skipped++
        continue
      }

      const doctorFullName = `${doctor?.first_name ?? ''} ${doctor?.last_name ?? ''}`.trim() || 'tu profesional'
      const patientFirstName = (patient.name ?? '').split(' ')[0] || 'Hola'
      const timeLabel = (apt.time ?? '').slice(0, 5)
      const dateLabel = formatDateLabel(apt.date)
      const durationMin = parseDurationMinutes(apt.duration)
      const locationName = location?.name || 'Consultorio'
      const locationAddress = location
        ? [location.address, location.city].filter(Boolean).join(', ')
        : 'Consultá con tu profesional'

      const html = renderTemplate(template, {
        doctorFullName,
        patientFirstName,
        dateLabel,
        timeLabel,
        durationMin: String(durationMin),
        locationName,
        locationAddress,
        coverage: patient.insurance || '—',
        cancelUrl: buildCancelUrl(apt.id),
      })

      try {
        const { error: mailErr } = await resend().emails.send({
          from: FROM_PATIENT,
          to: patient.email,
          subject: `Recordá: mañana tenés turno con ${doctorFullName}`,
          html,
        })
        if (mailErr) {
          console.error('[send-reminders] resend error', apt.id, mailErr)
          errors++
          continue
        }
      } catch (err) {
        console.error('[send-reminders] resend threw', apt.id, err)
        errors++
        continue
      }

      // Mark sent. We do this AFTER the mail clears Resend so a transient
      // Resend failure doesn't burn the appointment's only chance.
      const { error: markErr } = await db
        .from('appointments')
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq('id', apt.id)
      if (markErr) {
        // We sent the mail but couldn't mark it — next cron run will
        // re-send. Log loudly so we notice in observability.
        console.error('[send-reminders] mark failed after send', apt.id, markErr)
      }
      sent++
    }

    return res.status(200).json({ date: targetDate, sent, skipped, errors, total: appointments.length })
  } catch (err) {
    console.error('[send-reminders] unexpected', err)
    return res.status(500).json({ error: String(err) })
  }
}
