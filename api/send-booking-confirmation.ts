// Sends two transactional emails after a public booking lands:
//
//  1) Confirmation to the patient (if their email was provided) with the
//     appointment details and a .ics attachment for one-tap calendar add.
//  2) Notification to the doctor with the patient details + a panel link.
//
// Called from the client (src/lib/publicBooking.ts) immediately after the
// appointments INSERT succeeds. The client doesn't await this in a blocking
// way — a failure here shouldn't block the booking confirmation UI.
//
// Lives at /api/send-booking-confirmation on Vercel. Uses Resend for delivery
// and the service-role Supabase client to look up the full booking context
// from a single appointmentId (no need to trust the client with all the data
// — we re-fetch from the source of truth).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import * as React from 'react'
import { BookingConfirmation } from './_emails/BookingConfirmation'
import { NewBookingNotification } from './_emails/NewBookingNotification'
import { buildIcs } from './_lib/ics'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').trim()
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'https://tecito.com.ar').trim()

const FROM = 'Tecito <hola@send.tecito.com.ar>'
const REPLY_TO = 'hola@tecito.com.ar'

// See note in mp-create-subscription.ts — typed as `any` to dodge Supabase's
// `never[]` inference on untyped `.from()` queries.
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
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "2026-05-25" → "lunes 25 de mayo" (Argentina local). */
function formatDateLabel(iso: string): string {
  // Parse as local — no TZ shift. Use noon to avoid DST edge cases (AR has no DST anyway).
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`
}

/** "10:30:00" → "10:30". */
function formatTime(s: string): string {
  return (s || '').slice(0, 5)
}

/** Parse "00:50:00" duration string into minutes. Defaults to 50. */
function parseDurationMinutes(duration: string | null | undefined): number {
  if (!duration) return 50
  const m = /^(\d{1,2}):(\d{2})/.exec(duration)
  if (!m) return 50
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/** Builds a mailto: link the patient can tap to cancel, pre-filled with all the context. */
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
    `Hola ${args.doctorFullName},\n\n` +
      `Soy ${args.patientName} y no voy a poder asistir al turno del ` +
      `${args.dateLabel} a las ${args.timeLabel} hs.\n\n` +
      `Gracias!`
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
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

    // Pull the full booking context with three small queries (one network
    // round-trip each, but the data is tiny and the function is invoked once
    // per booking).
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
      db
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', apt.doctor_id)
        .single(),
      db
        .from('patients')
        .select('name, email, phone, insurance')
        .eq('id', apt.patient_id)
        .single(),
      apt.location_id
        ? db
            .from('locations')
            .select('name, address, city')
            .eq('id', apt.location_id)
            .single()
        : Promise.resolve({ data: null }),
    ])

    if (!doctor) {
      console.error('[send-booking] doctor profile not found')
      return res.status(404).json({ error: 'Doctor profile not found' })
    }

    const doctorFullName = `${doctor.first_name ?? ''} ${doctor.last_name ?? ''}`.trim()
    // No gender field on profiles; leave the courtesy prefix blank. Future
    // versions can derive it from a `title` column if added.
    const doctorPrefix = ''
    const dateLabel = formatDateLabel(apt.date)
    const timeLabel = formatTime(apt.time)
    const durationMin = parseDurationMinutes(apt.duration as unknown as string)
    const location = locationRes.data as { name: string; address: string; city: string } | null
    const locationName = location?.name
    const locationAddress = location ? [location.address, location.city].filter(Boolean).join(', ') : undefined
    const patientFirstName = (patient?.name ?? '').split(' ')[0] || 'Hola'

    const cancelMailto = buildCancelMailto({
      doctorEmail: doctor.email,
      doctorFullName: doctorPrefix ? `${doctorPrefix} ${doctorFullName}` : doctorFullName,
      patientName: patient?.name ?? '',
      dateLabel,
      timeLabel,
    })

    const result = { sentToPatient: false, sentToDoctor: false }

    // ============== PATIENT EMAIL ==============
    if (patient?.email) {
      const html = await render(
        React.createElement(BookingConfirmation, {
          patientFirstName,
          doctorPrefix,
          doctorFullName,
          dateLabel,
          timeLabel,
          durationMin,
          locationName,
          locationAddress,
          coverage: patient.insurance ?? undefined,
          cancelMailto,
        })
      )

      const ics = buildIcs({
        uid: apt.id,
        date: apt.date,
        time: apt.time,
        durationMin,
        summary: `Turno con ${doctorPrefix ? doctorPrefix + ' ' : ''}${doctorFullName}`,
        description:
          (apt.detail ?? '') +
          (locationAddress ? `\nDirección: ${locationAddress}` : ''),
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
          {
            filename: 'turno.ics',
            content: Buffer.from(ics, 'utf-8').toString('base64'),
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
      const html = await render(
        React.createElement(NewBookingNotification, {
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
      )

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
