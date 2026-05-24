// Sends the doctor-facing cancellation email (Mail 03 in the design system).
//
// Triggers: the patient cancels their appointment. The current design uses a
// `mailto:` link in the patient's confirmation; this endpoint will be wired
// once we ship the token-based public cancellation page. For now it's
// invokable directly with { appointmentId, cancellationReason?, cancelledAt? }.
//
// Subject: "{patientName} canceló su turno del {dateLabel}"
//
// Each `/api/send-*` endpoint is intentionally self-contained — we tried
// sharing helpers via /api/_lib/ subdirectories and Vercel's serverless
// bundler couldn't resolve them at runtime. The repetition is the price of a
// reliable cold start until we have a real monorepo build setup.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').trim()
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'https://tecito.com.ar').trim()
const BOOKING_WEBHOOK_SECRET = (process.env.BOOKING_WEBHOOK_SECRET ?? '').trim()

const FROM = 'Tecito <hola@tecito.com.ar>'
const REPLY_TO = 'hola@tecito.com.ar'

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

const TEMPLATES_DIR = join(process.cwd(), 'api', '_compiled-emails')
let _template: string | null = null
function getTemplate(): string {
  if (!_template) {
    _template = readFileSync(join(TEMPLATES_DIR, 'cancellation-notification.html'), 'utf-8')
  }
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
      console.warn(`[send-cancellation] missing template var "${key}"`)
      return ''
    }
    return esc(value)
  })
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`
}

function formatTime(s: string): string {
  return (s || '').slice(0, 5)
}

function parseDurationMinutes(duration: string | null | undefined): number {
  if (!duration) return 50
  const m = /^(\d{1,2}):(\d{2})/.exec(duration)
  if (!m) return 50
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/** "fue hace X tiempo" — relative time in Spanish, coarse-grained. */
function relativeTimeFromNow(when: Date): string {
  const diffMs = Date.now() - when.getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} minuto${min === 1 ? '' : 's'}`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} hora${h === 1 ? '' : 's'}`
  const d = Math.round(h / 24)
  return `hace ${d} día${d === 1 ? '' : 's'}`
}

/** "X horas/días antes del turno" — advance notice. */
function noticeBeforeAppointment(cancelledAt: Date, apptISO: string, apptTime: string): string {
  const [y, m, d] = apptISO.split('-').map(Number)
  const [hh, mm] = apptTime.slice(0, 5).split(':').map(Number)
  // Argentina local → UTC by adding 3h.
  const apptUtc = new Date(Date.UTC(y, m - 1, d, hh + 3, mm))
  const diffMs = apptUtc.getTime() - cancelledAt.getTime()
  if (diffMs < 0) return 'después del turno'
  const h = Math.round(diffMs / (1000 * 60 * 60))
  if (h < 1) return 'menos de una hora antes del turno'
  if (h < 24) return `${h} hora${h === 1 ? '' : 's'} antes del turno`
  const d2 = Math.round(h / 24)
  return `${d2} día${d2 === 1 ? '' : 's'} antes del turno`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  if (BOOKING_WEBHOOK_SECRET) {
    const provided = req.headers['x-webhook-secret']
    if (typeof provided !== 'string' || provided !== BOOKING_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const body = (req.body ?? {}) as {
    appointmentId?: string
    cancellationReason?: string
    cancelledAt?: string
  }
  if (!body.appointmentId || typeof body.appointmentId !== 'string') {
    return res.status(400).json({ error: 'appointmentId is required' })
  }

  try {
    const db = admin()

    const { data: apt, error: aptErr } = await db
      .from('appointments')
      .select('id, doctor_id, patient_id, date, time, duration, status')
      .eq('id', body.appointmentId)
      .single()
    if (aptErr || !apt) {
      console.error('[send-cancellation] appointment not found', aptErr)
      return res.status(404).json({ error: 'Appointment not found' })
    }

    const [{ data: doctor }, { data: patient }] = await Promise.all([
      db.from('profiles').select('first_name, email').eq('id', apt.doctor_id).single(),
      db.from('patients').select('name, email, phone').eq('id', apt.patient_id).single(),
    ])
    if (!doctor?.email) {
      return res.status(404).json({ error: 'Doctor email missing' })
    }

    const dateLabel = formatDateLabel(apt.date)
    const dateLabelWeekday = dateLabel.split(' ')[0]
    const timeLabel = formatTime(apt.time)
    const durationMin = parseDurationMinutes(apt.duration as unknown as string)
    const cancelledAt = body.cancelledAt ? new Date(body.cancelledAt) : new Date()
    const cancelledAtRelative = relativeTimeFromNow(cancelledAt)
    const cancelledAtAdvance = noticeBeforeAppointment(cancelledAt, apt.date, apt.time)
    const patientFirstName = (patient?.name ?? '').split(' ')[0] || 'el paciente'
    const patientPhoneRaw = (patient?.phone ?? '').replace(/[^0-9+]/g, '')

    const html = renderTemplate(getTemplate(), {
      doctorFirstName: doctor.first_name ?? '',
      patientFirstName,
      patientName: patient?.name ?? 'Un paciente',
      patientPhone: patient?.phone ?? '—',
      patientPhoneRaw,
      patientEmail: patient?.email ?? '—',
      dateLabel,
      dateLabelWeekday,
      timeLabel,
      durationMin: String(durationMin),
      cancelledAtRelative,
      cancelledAtAdvance,
      cancellationReason: body.cancellationReason ?? '',
      agendaUrl: `${PUBLIC_SITE_URL}/?date=${apt.date}`,
      messagePatientUrl: patient?.phone
        ? `https://wa.me/${patientPhoneRaw}?text=${encodeURIComponent(`Hola ${patientFirstName}, vi tu cancelación del turno del ${dateLabelWeekday}.`)}`
        : `mailto:${patient?.email ?? ''}`,
      footerMessage:
        'El paciente recibió su confirmación de cancelación por separado. Podés ajustar qué te notificamos desde tu panel.',
    })

    const { error: sendErr } = await resend().emails.send({
      from: FROM,
      to: doctor.email,
      replyTo: REPLY_TO,
      subject: `${patient?.name ?? 'Un paciente'} canceló su turno del ${dateLabelWeekday}`,
      html,
    })

    if (sendErr) {
      console.error('[send-cancellation] resend send failed', sendErr)
      return res.status(502).json({ error: 'Resend send failed', detail: String(sendErr) })
    }

    return res.status(200).json({ sentToDoctor: true })
  } catch (err) {
    console.error('[send-cancellation] unexpected error', err)
    return res.status(500).json({ error: String(err) })
  }
}
