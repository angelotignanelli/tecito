// Public cancellation endpoint — backs the /cancel/:token flow that the
// patient lands on when they click "No voy a poder ir" in the booking
// confirmation email.
//
// Two methods on the same path:
//   GET  /api/cancel-booking?token=...      preview the appointment (no side effects)
//   POST /api/cancel-booking { token, reason? }   cancel + notify doctor
//
// Tokens are signed with HMAC-SHA256 using CANCEL_TOKEN_SECRET. Payload:
//   { apt: <appointmentId>, exp: <unix-seconds> }
// Encoded as `<payloadB64>.<sigB64>`. No external JWT library — keeps the
// function self-contained (we learned the hard way that subdirectory
// imports break Vercel's serverless bundler in this project).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const CANCEL_TOKEN_SECRET = (process.env.CANCEL_TOKEN_SECRET ?? '').trim()
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'https://tecito.com.ar').trim()

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

// ─── Token helpers ───────────────────────────────────────────────────────────

interface TokenPayload {
  apt: string
  exp: number
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signToken(payload: TokenPayload, secret: string): string {
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf-8'))
  const sig = createHmac('sha256', secret).update(payloadB64).digest()
  return `${payloadB64}.${b64urlEncode(sig)}`
}

export function verifyToken(token: string, secret: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  const expected = b64urlEncode(createHmac('sha256', secret).update(payloadB64).digest())
  // Constant-time compare to dodge timing leaks. Buffers must be equal length
  // for timingSafeEqual; pre-check with cheap length comparison.
  if (expected.length !== sigB64.length) return null
  // Lazy import so failing constant-time compare isn't a top-level concern.
  const a = Buffer.from(expected, 'utf-8')
  const b = Buffer.from(sigB64, 'utf-8')
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i]
  if (mismatch !== 0) return null

  let payload: TokenPayload
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf-8'))
  } catch {
    return null
  }
  if (typeof payload.apt !== 'string' || typeof payload.exp !== 'number') return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

// ─── Date formatting ─────────────────────────────────────────────────────────

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!CANCEL_TOKEN_SECRET) {
    return res.status(500).json({ error: 'Server not configured (CANCEL_TOKEN_SECRET missing)' })
  }

  let token: string | undefined
  let reason: string | undefined

  if (req.method === 'GET') {
    token = typeof req.query.token === 'string' ? req.query.token : undefined
  } else if (req.method === 'POST') {
    const body = (req.body ?? {}) as { token?: string; reason?: string }
    token = body.token
    reason = body.reason
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  if (!token) {
    return res.status(400).json({ error: 'token is required' })
  }

  const payload = verifyToken(token, CANCEL_TOKEN_SECRET)
  if (!payload) {
    return res.status(400).json({ error: 'Token inválido o expirado' })
  }

  try {
    const db = admin()

    const { data: apt, error: aptErr } = await db
      .from('appointments')
      .select('id, doctor_id, patient_id, location_id, date, time, duration, status')
      .eq('id', payload.apt)
      .single()

    if (aptErr || !apt) {
      return res.status(404).json({ error: 'No encontramos este turno' })
    }

    const [{ data: doctor }, { data: patient }, locationRes] = await Promise.all([
      db.from('profiles').select('first_name, last_name').eq('id', apt.doctor_id).single(),
      db.from('patients').select('name').eq('id', apt.patient_id).single(),
      apt.location_id
        ? db.from('locations').select('name, address, city').eq('id', apt.location_id).single()
        : Promise.resolve({ data: null }),
    ])

    const doctorFullName = `${doctor?.first_name ?? ''} ${doctor?.last_name ?? ''}`.trim()
    const location = locationRes.data as { name: string; address: string; city: string } | null
    const locationLine = location
      ? [location.name, [location.address, location.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
      : null

    if (req.method === 'GET') {
      // Preview — surface everything the cancellation page needs to render.
      return res.status(200).json({
        appointment: {
          id: apt.id,
          status: apt.status,
          date: apt.date,
          dateLabel: formatDateLabel(apt.date),
          time: (apt.time as string).slice(0, 5),
          doctorFullName,
          patientName: patient?.name ?? 'Paciente',
          location: locationLine,
          alreadyCancelled: apt.status === 'cancelado',
        },
      })
    }

    // POST — execute the cancellation. Idempotent on re-submit: if it's
    // already cancelled we acknowledge and skip the notify.
    if (apt.status === 'cancelado') {
      return res.status(200).json({ ok: true, alreadyCancelled: true })
    }

    const { error: updErr } = await db
      .from('appointments')
      .update({
        status: 'cancelado',
        detail: reason ? `Cancelado por el paciente. Motivo: ${reason}` : 'Cancelado por el paciente.',
      })
      .eq('id', apt.id)
    if (updErr) {
      console.error('[cancel-booking] update failed', updErr)
      return res.status(500).json({ error: 'No pudimos cancelar el turno. Probá de nuevo.' })
    }

    // Notify the doctor by mail. We tried fire-and-forget first (void fetch
    // + .catch) and the email never landed: in Vercel serverless, once the
    // handler resolves its response the container is frozen — any promise
    // not yet settled is killed. Awaiting blocks the user for ~1-2s but
    // guarantees the side effect actually happens. The user already paid
    // for the latency by clicking "cancelar", a couple seconds for the
    // mail-out is acceptable.
    try {
      const notifyResp = await fetch(`${PUBLIC_SITE_URL}/api/send-cancellation-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: apt.id,
          cancellationReason: reason ?? '',
          cancelledAt: new Date().toISOString(),
        }),
      })
      if (!notifyResp.ok) {
        const text = await notifyResp.text().catch(() => '')
        console.warn('[cancel-booking] notify non-2xx', notifyResp.status, text.slice(0, 200))
      }
    } catch (err) {
      console.warn('[cancel-booking] notify dispatch failed', err)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[cancel-booking] unexpected error', err)
    return res.status(500).json({ error: String(err) })
  }
}
