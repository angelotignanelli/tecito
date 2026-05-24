// Sends two transactional emails after a public booking lands:
//
//  1) Confirmation to the patient (if their email was provided) with the
//     appointment details and a .ics attachment for one-tap calendar add.
//  2) Notification to the doctor with the patient details + a panel link.
//
// Called from the client (src/lib/publicBooking.ts) immediately after the
// appointments INSERT succeeds.
//
// Email HTML is composed inline as plain strings rather than via React
// Email. We tried the React Email + .tsx subfolder approach first; Vercel's
// serverless bundler was throwing FUNCTION_INVOCATION_FAILED on cold start
// (couldn't resolve the .tsx files at runtime). The pragmatic choice while
// we don't have a build step that pre-renders templates is to ship the
// markup inline — it's repetitive but every line is exactly what the
// recipient sees, no surprise compilation step in the middle.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ─── Inline ICS (single-event RFC 5545) ──────────────────────────────────────
// Previously lived at ./_lib/ics — moved here because Vercel's bundler was
// throwing FUNCTION_INVOCATION_FAILED when this endpoint imported relative
// files from /api/_lib/. Until we have a proper monorepo-style build for the
// /api/ folder, everything this endpoint needs lives in this single file.

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
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tecito//Booking Confirmation//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${evt.uid}@tecito.com.ar`,
    `DTSTAMP:${icsNowStamp()}`,
    `DTSTART:${icsUtcStamp(evt.date, evt.time, 0)}`,
    `DTEND:${icsUtcStamp(evt.date, evt.time, evt.durationMin)}`,
    icsFoldLine(`SUMMARY:${icsEscape(evt.summary)}`),
  ]
  if (evt.description) lines.push(icsFoldLine(`DESCRIPTION:${icsEscape(evt.description)}`))
  if (evt.location) lines.push(icsFoldLine(`LOCATION:${icsEscape(evt.location)}`))
  if (evt.organizerEmail) {
    const cn = evt.organizerName ? `;CN=${icsEscape(evt.organizerName)}` : ''
    lines.push(icsFoldLine(`ORGANIZER${cn}:mailto:${evt.organizerEmail}`))
  }
  lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE')
  if (evt.withReminders) {
    lines.push(
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio: turno mañana', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio: turno en 2 horas', 'END:VALARM',
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').trim()
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'https://tecito.com.ar').trim()

const FROM = 'Tecito <hola@send.tecito.com.ar>'
const REPLY_TO = 'hola@tecito.com.ar'

const COLORS = {
  primary: '#3B4A38',
  bg: '#F5F2EC',
  surface: '#FFFFFF',
  border: '#E8E2D4',
  text: '#1A1815',
  textMuted: '#55504A',
  textHint: '#8A847C',
}
const F_SERIF = 'Georgia, "Times New Roman", serif'
const F_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
const F_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

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

/** Minimal HTML escape for text injected into the markup. */
function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildCancelMailto(args: {
  doctorEmail?: string | null
  doctorFullName: string
  patientName: string
  dateLabel: string
  timeLabel: string
}): string {
  const to = args.doctorEmail || REPLY_TO
  const subject = encodeURIComponent(`Cancelación de turno — ${args.dateLabel} ${args.timeLabel}`)
  const body = encodeURIComponent(
    `Hola ${args.doctorFullName},\n\nSoy ${args.patientName} y no voy a poder asistir al turno del ${args.dateLabel} a las ${args.timeLabel} hs.\n\nGracias!`
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
}

/** Shared chrome used by both emails. */
function shell(opts: { preheader: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>Tecito</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:${F_SANS};color:${COLORS.text};">
<div style="display:none;font-size:0;line-height:0;color:transparent;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(opts.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.bg};">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;margin:0 auto;">
      <tr><td style="padding:40px 24px 0 24px;">
        <div style="font-family:${F_SERIF};font-style:italic;font-size:24px;color:${COLORS.primary};letter-spacing:-0.4px;line-height:1;margin-bottom:24px;">Tecito</div>
      </td></tr>
      <tr><td style="padding:0 24px;">
        ${opts.body}
      </td></tr>
      <tr><td style="padding:32px 24px 48px 24px;">
        <hr style="border:0;border-top:1px solid ${COLORS.border};margin:0 0 20px 0;">
        <div style="font-family:${F_MONO};font-size:11px;color:${COLORS.textHint};margin-bottom:6px;letter-spacing:.02em;">© 2026 Tecito · Buenos Aires</div>
        <div style="font-family:${F_SANS};font-size:12px;color:${COLORS.textHint};line-height:1.5;">
          Recibiste este mail porque reservaste un turno con un profesional que usa Tecito.
          ¿Dudas? <a href="mailto:hola@tecito.com.ar" style="color:${COLORS.primary};text-decoration:none;">hola@tecito.com.ar</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function patientHtml(opts: {
  patientFirstName: string
  doctorFullName: string
  dateLabel: string
  timeLabel: string
  durationMin: number
  locationName?: string
  locationAddress?: string
  coverage?: string
  cancelMailto: string
}): string {
  const detailsRow = (label: string, value: string) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:14px;">
      <tr>
        <td valign="top" style="width:90px;">
          <div style="font-family:${F_MONO};font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:${COLORS.textHint};padding-top:4px;">${esc(label)}</div>
        </td>
        <td valign="top">
          <div style="font-family:${F_SANS};font-size:15px;color:${COLORS.text};line-height:1.5;">${value}</div>
        </td>
      </tr>
    </table>`

  const whenValue = `${esc(opts.dateLabel)}<br><span style="font-family:${F_MONO};font-size:13px;color:${COLORS.textMuted};">${esc(opts.timeLabel)} hs · ${opts.durationMin} min</span>`

  let whereValue: string
  if (opts.locationName || opts.locationAddress) {
    const lines: string[] = []
    if (opts.locationName) lines.push(`<span style="font-weight:500;">${esc(opts.locationName)}</span>`)
    if (opts.locationAddress) lines.push(`<span style="color:${COLORS.textMuted};font-size:14px;">${esc(opts.locationAddress)}</span>`)
    whereValue = lines.join('<br>')
  } else {
    whereValue = `<span style="color:${COLORS.textMuted};font-style:italic;">Consultá con tu profesional</span>`
  }

  const body = `
    <div style="font-family:${F_MONO};font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:${COLORS.textHint};margin-bottom:14px;">Tu turno está confirmado</div>
    <h1 style="font-family:${F_SERIF};font-size:30px;line-height:1.15;letter-spacing:-.6px;color:${COLORS.text};margin:0 0 8px 0;font-weight:400;">
      Te esperamos el <span style="font-style:italic;color:${COLORS.primary};">${esc(opts.dateLabel.toLowerCase())}</span>.
    </h1>
    <p style="font-family:${F_SANS};font-size:16px;color:${COLORS.textMuted};margin:12px 0 0 0;line-height:1.6;">
      Hola ${esc(opts.patientFirstName)}, reservaste un turno con
      <span style="color:${COLORS.text};font-weight:500;">${esc(opts.doctorFullName)}</span>.
      Te dejamos los detalles abajo y un archivo adjunto (.ics) para que lo agendes en tu calendario.
    </p>
    <div style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:14px;padding:22px;margin:28px 0 24px 0;">
      ${detailsRow('Cuándo', whenValue)}
      ${detailsRow('Dónde', whereValue)}
      ${opts.coverage ? detailsRow('Cobertura', esc(opts.coverage)) : ''}
    </div>
    <p style="font-family:${F_SANS};font-size:14px;color:${COLORS.textMuted};margin:0 0 16px 0;line-height:1.55;">
      Adjuntamos un archivo <strong style="color:${COLORS.text};">.ics</strong> — tocalo desde tu celular y se agrega a Google Calendar, Apple Calendar o Outlook en un toque, con recordatorios programados 24 h y 2 h antes.
    </p>
    <p style="margin:24px 0 0 0;line-height:1.5;">
      <a href="${esc(opts.cancelMailto)}" style="color:${COLORS.textMuted};font-family:${F_SANS};font-size:13px;text-decoration:underline;">¿No vas a poder venir? Cancelar este turno</a>
    </p>`

  return shell({
    preheader: `Tu turno con ${opts.doctorFullName} — ${opts.dateLabel} a las ${opts.timeLabel} hs`,
    body,
  })
}

function doctorHtml(opts: {
  doctorFirstName: string
  patientName: string
  patientPhone?: string
  patientEmail?: string
  dateLabel: string
  timeLabel: string
  durationMin: number
  locationName?: string
  coverage?: string
  panelUrl: string
}): string {
  const detailsRow = (label: string, value: string) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:14px;">
      <tr>
        <td valign="top" style="width:90px;">
          <div style="font-family:${F_MONO};font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:${COLORS.textHint};padding-top:4px;">${esc(label)}</div>
        </td>
        <td valign="top">
          <div style="font-family:${F_SANS};font-size:15px;color:${COLORS.text};line-height:1.5;">${value}</div>
        </td>
      </tr>
    </table>`

  const contactLine = [opts.patientPhone, opts.patientEmail].filter(Boolean).join(' · ')
  const patientValue = `<span style="font-weight:500;">${esc(opts.patientName)}</span>${contactLine ? `<br><span style="font-family:${F_MONO};font-size:12px;color:${COLORS.textMuted};">${esc(contactLine)}</span>` : ''}`
  const whenValue = `${esc(opts.dateLabel)}<br><span style="font-family:${F_MONO};font-size:13px;color:${COLORS.textMuted};">${esc(opts.timeLabel)} hs · ${opts.durationMin} min</span>`

  const body = `
    <div style="font-family:${F_MONO};font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:${COLORS.textHint};margin-bottom:14px;">Nuevo turno reservado</div>
    <h1 style="font-family:${F_SERIF};font-size:30px;line-height:1.15;letter-spacing:-.6px;color:${COLORS.text};margin:0 0 8px 0;font-weight:400;">
      Te reservaron <span style="font-style:italic;color:${COLORS.primary};">un</span> turno.
    </h1>
    <p style="font-family:${F_SANS};font-size:16px;color:${COLORS.textMuted};margin:12px 0 0 0;line-height:1.6;">
      Hola ${esc(opts.doctorFirstName)}, un paciente acaba de reservar desde tu link público. El turno ya quedó cargado en tu agenda.
    </p>
    <div style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:14px;padding:22px;margin:28px 0 24px 0;">
      ${detailsRow('Paciente', patientValue)}
      ${detailsRow('Cuándo', whenValue)}
      ${opts.locationName ? detailsRow('Dónde', esc(opts.locationName)) : ''}
      ${opts.coverage ? detailsRow('Cobertura', esc(opts.coverage)) : ''}
    </div>
    <p style="margin:0;">
      <a href="${esc(opts.panelUrl)}" style="display:inline-block;background:${COLORS.primary};color:${COLORS.surface};padding:12px 22px;border-radius:10px;font-family:${F_SANS};font-size:14px;font-weight:500;text-decoration:none;letter-spacing:-.1px;">Ver en mi panel →</a>
    </p>`

  return shell({
    preheader: `Nuevo turno: ${opts.patientName} — ${opts.dateLabel} a las ${opts.timeLabel}`,
    body,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { appointmentId } = (req.body ?? {}) as { appointmentId?: string }
  if (!appointmentId || typeof appointmentId !== 'string') {
    return res.status(400).json({ error: 'appointmentId is required' })
  }

  try {
    const db = admin()

    const { data: apt, error: aptErr } = await db
      .from('appointments')
      .select('id, doctor_id, patient_id, location_id, date, time, duration, detail, status')
      .eq('id', appointmentId)
      .single()

    if (aptErr || !apt) {
      console.error('[send-booking] appointment not found', appointmentId, aptErr)
      return res.status(404).json({ error: 'Appointment not found' })
    }

    const [{ data: doctor }, { data: patient }, locationRes] = await Promise.all([
      db.from('profiles').select('first_name, last_name, email').eq('id', apt.doctor_id).single(),
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
    const locationName = location?.name
    const locationAddress = location ? [location.address, location.city].filter(Boolean).join(', ') : undefined
    const patientFirstName = (patient?.name ?? '').split(' ')[0] || 'Hola'

    const cancelMailto = buildCancelMailto({
      doctorEmail: doctor.email,
      doctorFullName,
      patientName: patient?.name ?? '',
      dateLabel,
      timeLabel,
    })

    const result = { sentToPatient: false, sentToDoctor: false }

    // ============== PATIENT EMAIL ==============
    if (patient?.email) {
      const html = patientHtml({
        patientFirstName,
        doctorFullName,
        dateLabel,
        timeLabel,
        durationMin,
        locationName,
        locationAddress,
        coverage: patient.insurance ?? undefined,
        cancelMailto,
      })

      const ics = buildIcs({
        uid: apt.id,
        date: apt.date,
        time: apt.time,
        durationMin,
        summary: `Turno con ${doctorFullName}`,
        description: (apt.detail ?? '') + (locationAddress ? `\nDirección: ${locationAddress}` : ''),
        location: locationAddress || locationName,
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
          { filename: 'turno.ics', content: Buffer.from(ics, 'utf-8').toString('base64') },
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
      const html = doctorHtml({
        doctorFirstName: doctor.first_name ?? '',
        patientName: patient?.name ?? 'Paciente',
        patientPhone: patient?.phone ?? undefined,
        patientEmail: patient?.email ?? undefined,
        dateLabel,
        timeLabel,
        durationMin,
        locationName,
        coverage: patient?.insurance ?? undefined,
        panelUrl: `${PUBLIC_SITE_URL}/?date=${apt.date}`,
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

    return res.status(200).json(result)
  } catch (err) {
    console.error('[send-booking] unexpected error', err)
    return res.status(500).json({ error: String(err) })
  }
}
