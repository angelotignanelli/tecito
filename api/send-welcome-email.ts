// Sends the doctor welcome email (Mail 04 in the design system).
//
// Triggers: a new doctor profile is created. Called from the client after
// signup completes — both the registration flow and the onboarding flow can
// invoke this; idempotency is enforced via profiles.welcome_email_sent_at.
//
// Wait — that column doesn't exist yet. For the first iteration we don't
// gate on it; the client only calls this once per profile creation. If the
// user resends manually we'd resend; an idempotency column is a follow-up
// improvement once we see real abuse.
//
// Subject: "Bienvenido a Tecito · 3 pasos para arrancar"

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').trim()
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'https://tecito.com.ar').trim()

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
    _template = readFileSync(join(TEMPLATES_DIR, 'welcome.html'), 'utf-8')
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
      console.warn(`[send-welcome] missing template var "${key}"`)
      return ''
    }
    return esc(value)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { profileId } = (req.body ?? {}) as { profileId?: string }
  if (!profileId || typeof profileId !== 'string') {
    return res.status(400).json({ error: 'profileId is required' })
  }

  try {
    const db = admin()

    const { data: profile, error } = await db
      .from('profiles')
      .select('first_name, email, booking_code')
      .eq('id', profileId)
      .single()
    if (error || !profile?.email) {
      console.error('[send-welcome] profile/email missing', error)
      return res.status(404).json({ error: 'Profile or email missing' })
    }

    const publicLink = profile.booking_code
      ? `tecito.com.ar/p/${profile.booking_code}`
      : 'tecito.com.ar/p/[código]'

    const html = renderTemplate(getTemplate(), {
      doctorFirstName: profile.first_name ?? '',
      publicLink,
      onboardingUrl: `${PUBLIC_SITE_URL}/`,
      guideUrl: `${PUBLIC_SITE_URL}/about.html`,
      footerMessage:
        'Te suscribiste a Tecito hoy. Podés gestionar tus notificaciones desde tu panel o escribirnos.',
    })

    const { error: sendErr } = await resend().emails.send({
      from: FROM,
      to: profile.email,
      replyTo: REPLY_TO,
      subject: 'Bienvenido a Tecito · 3 pasos para arrancar',
      html,
    })

    if (sendErr) {
      console.error('[send-welcome] resend send failed', sendErr)
      return res.status(502).json({ error: 'Resend send failed', detail: String(sendErr) })
    }

    return res.status(200).json({ sentToDoctor: true })
  } catch (err) {
    console.error('[send-welcome] unexpected error', err)
    return res.status(500).json({ error: String(err) })
  }
}
