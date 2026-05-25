// Sends two transactional emails after a public booking lands:
//
//  1) Confirmation to the patient (if their email was provided) with the
//     appointment details and a .ics attachment for one-tap calendar add.
//  2) Notification to the doctor with the patient details + a panel link.
//
// Called from the client (src/lib/publicBooking.ts) immediately after the
// appointments INSERT succeeds.
//
// Email HTML is precompiled by scripts/build-emails.ts from the React Email
// templates in /emails/. The compiled HTML files live in /api/_compiled-emails/
// with {{placeholder}} tokens; we substitute the runtime values here. Vercel
// is told to ship those files alongside the function via the `includeFiles`
// directive in vercel.json.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHmac } from 'node:crypto'

// ─── Inline ICS (single-event RFC 5545) ──────────────────────────────────────

interface IcsEvent {
  uid: string
  date: string
  time: string
  durationMin: number
  summary: string
  description?: string
  location?: string
  organizerName?: string
  organizerEmail?: string
  withReminders?: boolean
}

function icsUtcStamp(date: string, time: string, offsetMin = 0): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.slice(0, 5).split(':').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d, hh + 3, mm + offsetMin, 0))
  return icsFormatStamp(utc)
}
function icsNowStamp(): string {
  return icsFormatStamp(new Date())
}
function icsFormatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}
function icsEscape(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n').replace(/\r/g, '')
}
function icsFoldLine(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = []
  let rest = line
  out.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    out.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length > 0) out.push(' ' + rest)
  return out.join('\r\n')
}
function buildIcs(evt: IcsEvent): string {
  // METHOD:PUBLISH, not REQUEST. PUBLISH is "this is an event I'm sharing
  // with you"; REQUEST is "I'm inviting you, please RSVP". REQUEST is
  // stricter (RFC 5546 requires ATTENDEE + ORGANIZER with valid mailtos)
  // and Gmail rejects malformed REQUEST events with "no se puede cargar el
  // evento". PUBLISH parses cleanly even without an organizer/attendee.
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tecito//Booking Confirmation//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evt.uid}@tecito.com.ar`,
    `DTSTAMP:${icsNowStamp()}`,
    `DTSTART:${icsUtcStamp(evt.date, evt.time, 0)}`,
    `DTEND:${icsUtcStamp(evt.date, evt.time, evt.durationMin)}`,
    icsFoldLine(`SUMMARY:${icsEscape(evt.summary)}`),
  ]
  if (evt.description) lines.push(icsFoldLine(`DESCRIPTION:${icsEscape(evt.description)}`))
  if (evt.location) lines.push(icsFoldLine(`LOCATION:${icsEscape(evt.location)}`))
  // ORGANIZER is optional in PUBLISH but Gmail uses it to render "from".
  // Fall back to the Tecito brand mailbox when the doctor doesn't have an
  // email on file so the parser still gets a valid mailto.
  const organizerEmail = evt.organizerEmail || 'hola@tecito.com.ar'
  const organizerName = evt.organizerName || 'Tecito'
  lines.push(icsFoldLine(`ORGANIZER;CN=${icsEscape(organizerName)}:mailto:${organizerEmail}`))
  lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'SEQUENCE:0')
  if (evt.withReminders) {
    lines.push(
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio: turno mañana', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio: turno en 2 horas', 'END:VALARM',
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').trim()
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'https://tecito.com.ar').trim()
const CANCEL_TOKEN_SECRET = (process.env.CANCEL_TOKEN_SECRET ?? '').trim()
// Optional shared secret used to authenticate the Supabase DB Webhook. When
// the env var is set, every request must carry the same value in the
// `x-webhook-secret` header or it gets 401. Leaving it unset disables the
// check, which is useful during the migration window where the legacy
// client-side fetch (no header) is still firing.
const BOOKING_WEBHOOK_SECRET = (process.env.BOOKING_WEBHOOK_SECRET ?? '').trim()

// Resend verified the root domain — DKIM lives at resend._domainkey.tecito.com.ar
// and the API key is scoped to tecito.com.ar. Keep the visible From on the root
// so they match; send.tecito.com.ar exists only as Resend's MX/SPF envelope.
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

// ─── Template loading + rendering ────────────────────────────────────────────
// Read once at module init, reused across invocations within the same warm
// container. Pre-warming the cache here means the first cold-start pays the
// disk read once and never again.

const TEMPLATES_DIR = join(process.cwd(), 'api', '_compiled-emails')

let _patientTemplate: string | null = null
let _doctorTemplate: string | null = null

function loadTemplate(name: string): string {
  return readFileSync(join(TEMPLATES_DIR, `${name}.html`), 'utf-8')
}

function getPatientTemplate(): string {
  if (!_patientTemplate) _patientTemplate = loadTemplate('booking-confirmation')
  return _patientTemplate
}

function getDoctorTemplate(): string {
  if (!_doctorTemplate) _doctorTemplate = loadTemplate('new-booking-notification')
  return _doctorTemplate
}

/** Replace every `{{key}}` placeholder in `html` with HTML-escaped `vars[key]`. */
function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key]
    if (value === undefined) {
      // Missing key → render empty rather than leave the literal {{key}} in
      // the message body. Worth a console warning in case a template gets out
      // of sync with the data we pass in.
      console.warn(`[send-booking] missing template var "${key}"`)
      return ''
    }
    return esc(value)
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Minimal HTML escape for text injected into the markup or attribute values. */
function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Generates an opaque signed token for the patient's "cancel" link.
// Mirrors the verifyToken logic in api/cancel-booking.ts — both must keep
// the same HMAC + base64url encoding so the round-trip works.
function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildCancelUrl(appointmentId: string): string {
  if (!CANCEL_TOKEN_SECRET) {
    // Fallback during local dev when the secret hasn't been wired yet: the
    // link still goes to the cancellation page, but the page will surface
    // an "invalid token" error rather than letting an unsigned cancel slip
    // through. Returning the link anyway is preferable to leaving an empty
    // href in the CTA.
    return `${PUBLIC_SITE_URL}/cancel/missing-secret`
  }
  // Expire the token a generous 60 days after now so even patients booking
  // far in advance still have a working link the day of their appointment.
  const exp = Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60
  const payload = JSON.stringify({ apt: appointmentId, exp })
  const payloadB64 = b64urlEncode(Buffer.from(payload, 'utf-8'))
  const sig = createHmac('sha256', CANCEL_TOKEN_SECRET).update(payloadB64).digest()
  const token = `${payloadB64}.${b64urlEncode(sig)}`
  return `${PUBLIC_SITE_URL}/cancel/${token}`
}

// ─── Request normalization ───────────────────────────────────────────────────

/**
 * Accepts both invocation shapes:
 *  - Legacy client fetch: `{ "appointmentId": "uuid" }`
 *  - Supabase DB Webhook: `{ "type": "INSERT", "table": "appointments",
 *                            "record": { "id": "uuid", ... }, ... }`
 *
 * Returns null when the payload is for a different table/event (we still
 * respond 200 in that case — webhooks shouldn't be punished for over-firing).
 */
function extractAppointmentId(body: unknown): { id: string | null; ignored: boolean } {
  if (!body || typeof body !== 'object') return { id: null, ignored: false }
  const b = body as Record<string, unknown>

  // Supabase webhook payload — { type, table, record }.
  if (typeof b.type === 'string' && typeof b.table === 'string') {
    if (b.table !== 'appointments' || b.type !== 'INSERT') {
      return { id: null, ignored: true }
    }
    const record = b.record as { id?: unknown } | undefined
    if (record && typeof record.id === 'string') return { id: record.id, ignored: false }
    return { id: null, ignored: false }
  }

  // Legacy client payload — { appointmentId }.
  if (typeof b.appointmentId === 'string') return { id: b.appointmentId, ignored: false }

  return { id: null, ignored: false }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Optional shared-secret check. Only enforced when the env var is set, so
  // the migration window (where the client-side fetch is still firing
  // without the header) keeps working.
  if (BOOKING_WEBHOOK_SECRET) {
    const provided = req.headers['x-webhook-secret']
    const ok = typeof provided === 'string' && provided === BOOKING_WEBHOOK_SECRET
    if (!ok) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const { id: appointmentId, ignored } = extractAppointmentId(req.body)
  if (ignored) {
    // Webhook fired for an unrelated event — quietly ack so Supabase doesn't
    // retry. Don't log because this can happen many times per day.
    return res.status(200).json({ ignored: true })
  }
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' })
  }

  try {
    const db = admin()

    const { data: apt, error: aptErr } = await db
      .from('appointments')
      .select('id, doctor_id, patient_id, location_id, date, time, duration, detail, status, email_sent_at')
      .eq('id', appointmentId)
      .single()

    if (aptErr || !apt) {
      console.error('[send-booking] appointment not found', appointmentId, aptErr)
      return res.status(404).json({ error: 'Appointment not found' })
    }

    // Idempotency check — if the emails already went out for this turno, do
    // nothing. Lets the DB webhook fire safely even if the client also fired.
    if (apt.email_sent_at) {
      return res.status(200).json({ alreadySent: true })
    }

    const [{ data: doctor }, { data: patient }, locationRes] = await Promise.all([
      db.from('profiles').select('first_name, last_name, email, booking_code').eq('id', apt.doctor_id).single(),
      db.from('patients').select('name, email, phone, insurance').eq('id', apt.patient_id).single(),
      apt.location_id
        ? db.from('locations').select('name, address, city').eq('id', apt.location_id).single()
        : Promise.resolve({ data: null }),
    ])

    if (!doctor) {
      console.error('[send-booking] doctor profile not found')
      return res.status(404).json({ error: 'Doctor profile not found' })
    }

    const doctorFullName = `${doctor.first_name ?? ''} ${doctor.last_name ?? ''}`.trim()
    const dateLabel = formatDateLabel(apt.date)
    const timeLabel = formatTime(apt.time)
    const durationMin = parseDurationMinutes(apt.duration as unknown as string)
    const location = locationRes.data as { name: string; address: string; city: string } | null
    const locationName = location?.name || 'Consultorio'
    const locationAddress = location ? [location.address, location.city].filter(Boolean).join(', ') : 'Consultá con tu profesional'
    const patientFirstName = (patient?.name ?? '').split(' ')[0] || 'Hola'
    const coverage = patient?.insurance || '—'

    const dateCompact = apt.date.replace(/-/g, '')
    // icsFilename is what the recipient sees when their mail client lists
    // the real attachment at the bottom of the message — we no longer show
    // a mock card for it inside the body.
    const icsFilename = `turno-${dateCompact}.ics`
    // Top-level panel link (used when we just want the doctor to land on
    // their agenda on the right day).
    const panelUrl = `${PUBLIC_SITE_URL}/?date=${apt.date}`
    // Deep-link directly into this appointment's detail panel. The Dashboard
    // component picks up the ?turno param on mount and pops open the modal.
    const turnoUrl = `${PUBLIC_SITE_URL}/?turno=${apt.id}`

    const patientPhoneRaw = (patient?.phone ?? '').replace(/[^0-9+]/g, '')

    const cancelUrl = buildCancelUrl(apt.id)

    const result = { sentToPatient: false, sentToDoctor: false }

    // ============== PATIENT EMAIL ==============
    if (patient?.email) {
      const html = renderTemplate(getPatientTemplate(), {
        patientFirstName,
        doctorFullName,
        dateLabel,
        dateLabelLower: dateLabel.toLowerCase(),
        timeLabel,
        durationMin: String(durationMin),
        locationName,
        locationAddress,
        coverage,
        cancelUrl,
        footerMessage:
          'Reservaste un turno con un profesional que usa Tecito. Si tenés una duda médica, escribíle directamente al consultorio. Para todo lo demás, contestá este mail.',
      })

      const ics = buildIcs({
        uid: apt.id,
        date: apt.date,
        time: apt.time,
        durationMin,
        summary: `Turno con ${doctorFullName}`,
        description: (apt.detail ?? '') + (location ? `\nDirección: ${locationAddress}` : ''),
        location: location ? locationAddress : undefined,
        organizerName: doctorFullName,
        organizerEmail: doctor.email ?? undefined,
        withReminders: true,
      })

      const { error: sendErr } = await resend().emails.send({
        from: FROM,
        to: patient.email,
        replyTo: REPLY_TO,
        subject: `Tu turno con ${doctorFullName} — ${dateLabel} ${timeLabel} hs`,
        html,
        attachments: [
          {
            filename: icsFilename,
            content: Buffer.from(ics, 'utf-8').toString('base64'),
            // Force the correct MIME so Gmail's inline calendar parser picks
            // it up. Without this, Resend defaults to application/octet-stream
            // and Gmail just shows "Cannot load event".
            contentType: 'text/calendar; charset=UTF-8; method=PUBLISH',
          },
        ],
      })

      if (sendErr) {
        console.error('[send-booking] patient send failed', sendErr)
      } else {
        result.sentToPatient = true
      }
    }

    // ============== DOCTOR EMAIL ==============
    if (doctor.email) {
      const html = renderTemplate(getDoctorTemplate(), {
        doctorFirstName: doctor.first_name ?? '',
        patientName: patient?.name ?? 'Paciente',
        patientPhone: patient?.phone ?? '—',
        patientPhoneRaw,
        patientEmail: patient?.email ?? '',
        dateLabel,
        timeLabel,
        durationMin: String(durationMin),
        locationName,
        coverage,
        panelUrl,
        // "Reagendar" sends the doctor straight to the appointment detail
        // where they can edit / move it. The Dashboard reads ?turno on mount.
        reschedulePath: turnoUrl,
        footerMessage:
          'Estás recibiendo esto porque usás Tecito para gestionar tu agenda. Podés silenciar las notificaciones desde tu panel o escribirnos.',
      })

      const { error: sendErr } = await resend().emails.send({
        from: FROM,
        to: doctor.email,
        replyTo: REPLY_TO,
        subject: `Nuevo turno: ${patient?.name ?? 'paciente'} — ${dateLabel} ${timeLabel} hs`,
        html,
      })

      if (sendErr) {
        console.error('[send-booking] doctor send failed', sendErr)
      } else {
        result.sentToDoctor = true
      }
    }

    // Mark the appointment as "emails sent" as soon as at least one of the
    // two mails actually went out. If only the doctor or only the patient
    // landed (e.g. one had no email on file), we still flip the flag so a
    // retried webhook doesn't re-send the one that succeeded. If both failed,
    // we leave it null so the next trigger can retry.
    if (result.sentToPatient || result.sentToDoctor) {
      const { error: updateErr } = await db
        .from('appointments')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', appointmentId)
      if (updateErr) {
        console.error('[send-booking] failed to stamp email_sent_at', updateErr)
        // Don't fail the request — the mails already went out, the flag is
        // only an optimization for the idempotency check. Worst case the
        // next webhook fires and re-sends; we'd rather be at-least-once than
        // skip the user-visible work entirely.
      }
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error('[send-booking] unexpected error', err)
    return res.status(500).json({ error: String(err) })
  }
}
