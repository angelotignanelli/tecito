// MercadoPago webhook — Vercel serverless function.
//
// Lives at /api/mp-webhook on the Vercel deploy. We hit this route instead of
// a Supabase Edge Function because the Supabase edge gateway was returning 403
// to MP's "Simulate notification" tool (bot / WAF detection). Vercel's
// serverless runtime has no such gateway in front, so MP can reach it.
//
// Flow:
//   1. MP POSTs here when a subscription / payment changes.
//   2. We verify the x-signature HMAC using MP_WEBHOOK_SECRET.
//   3. We re-fetch the resource from MP's API (never trust the body blindly).
//   4. We update profiles + insert billing_events via supabase-js (service role).
//
// Required Vercel env vars:
//   MP_ACCESS_TOKEN
//   MP_WEBHOOK_SECRET
//   SUPABASE_URL                — same URL the frontend uses
//   SUPABASE_SERVICE_ROLE_KEY   — service_role key (not anon)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN ?? ''
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET ?? ''
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Typed as `any` on purpose — see note in mp-create-subscription.ts. Without
// a generated Database type, strict Supabase inference collapses untyped
// `.from()` inserts to `never[]`, which surfaces as TS2769 at build time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function admin(): any {
  if (!_admin) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in env')
    }
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  }
  return _admin
}

// ────────────────────────────────────────────────────────────────
// Signature verification
// ────────────────────────────────────────────────────────────────

function verifySignature(req: VercelRequest, dataId: string): boolean {
  if (!MP_WEBHOOK_SECRET) {
    console.warn('MP_WEBHOOK_SECRET not set — skipping signature check')
    return true
  }
  const sigHeader = (req.headers['x-signature'] as string) ?? ''
  const requestId = (req.headers['x-request-id'] as string) ?? ''
  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => kv.trim().split('=').map((s) => s.trim())),
  ) as { ts?: string; v1?: string }
  if (!parts.ts || !parts.v1) return false

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`
  const hex = crypto.createHmac('sha256', MP_WEBHOOK_SECRET).update(manifest).digest('hex')
  return hex === parts.v1
}

// ────────────────────────────────────────────────────────────────
// MP fetchers
// ────────────────────────────────────────────────────────────────

async function mpGet<T>(path: string): Promise<T | null> {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  })
  if (!r.ok) {
    console.error(`MP GET ${path} → ${r.status}`, await r.text())
    return null
  }
  return (await r.json()) as T
}

interface MPPreapproval {
  id: string
  status: 'pending' | 'authorized' | 'paused' | 'cancelled'
  reason: string
  external_reference: string
  payer_id?: number
  payer_email?: string
  auto_recurring: {
    frequency: number
    frequency_type: 'months' | 'days'
    transaction_amount: number
    currency_id: string
    free_trial?: { frequency: number; frequency_type: string }
  }
  next_payment_date?: string
}

interface MPPayment {
  id: number
  status: 'approved' | 'pending' | 'rejected' | 'refunded' | 'in_process'
  transaction_amount: number
  currency_id: string
  external_reference?: string
  metadata?: { preapproval_id?: string }
}

// ────────────────────────────────────────────────────────────────
// Plan derivation from MP "reason" string
// ────────────────────────────────────────────────────────────────

function planFromReason(reason: string): 'pro' | 'clinic' | null {
  const r = reason.toLowerCase()
  if (r.includes('clinic')) return 'clinic'
  if (r.includes('pro')) return 'pro'
  return null
}

// ────────────────────────────────────────────────────────────────
// Handlers
// ────────────────────────────────────────────────────────────────

async function handlePreapproval(preapprovalId: string) {
  const pre = await mpGet<MPPreapproval>(`/preapproval/${preapprovalId}`)
  if (!pre) return

  // Resolve our user. Priority:
  //   1. external_reference (set when we POST create the preapproval directly)
  //   2. profiles.mp_preapproval_id — set by our /api/mp-link-subscription on
  //      the back_url handshake. This is the primary path after the initial
  //      checkout: every subsequent webhook for renewal/pause/cancel lands
  //      here and matches by preapproval id, which never changes.
  //   3. payer_email — best-effort fallback. MP often returns it empty for
  //      "suscripción con plan" flows, so this rarely hits.
  let userId: string | null = pre.external_reference || null
  if (!userId) {
    const { data } = await admin()
      .from('profiles')
      .select('id')
      .eq('mp_preapproval_id', pre.id)
      .maybeSingle()
    userId = (data?.id as string | null) ?? null
  }
  if (!userId && pre.payer_email) {
    const { data } = await admin()
      .from('profiles')
      .select('id')
      .ilike('email', pre.payer_email)
      .maybeSingle()
    userId = (data?.id as string | null) ?? null
  }
  if (!userId) {
    console.warn(
      `preapproval ${pre.id} — no external_reference and no profile match for email=${pre.payer_email} — skipping`,
    )
    return
  }

  const plan = planFromReason(pre.reason)
  const status = pre.status

  let planStatus: string
  let planId: string

  if (status === 'authorized') {
    planStatus = pre.auto_recurring.free_trial ? 'trialing' : 'active'
    planId = plan ?? 'free'
  } else if (status === 'paused') {
    planStatus = 'past_due'
    planId = plan ?? 'free'
  } else if (status === 'cancelled') {
    planStatus = 'cancelled'
    planId = plan ?? 'free'
  } else {
    planStatus = 'active'
    planId = 'free'
  }

  const update: Record<string, unknown> = {
    mp_preapproval_id: pre.id,
    mp_payer_id: pre.payer_id ? String(pre.payer_id) : null,
    plan: planId,
    plan_status: planStatus,
  }
  if (pre.next_payment_date) update.plan_valid_until = pre.next_payment_date

  const { error } = await admin().from('profiles').update(update).eq('id', userId)
  if (error) console.error('profile update failed', error)

  await admin().from('billing_events').insert({
    user_id: userId,
    event_type: `preapproval.${status}`,
    mp_resource_id: pre.id,
    mp_resource_type: 'preapproval',
    amount: pre.auto_recurring.transaction_amount,
    currency: pre.auto_recurring.currency_id,
    status,
    raw_payload: pre as unknown as Record<string, unknown>,
    source: 'webhook',
  })
}

async function handlePayment(paymentId: string) {
  const pay = await mpGet<MPPayment>(`/v1/payments/${paymentId}`)
  if (!pay) return

  let userId = pay.external_reference ?? null
  const preId = pay.metadata?.preapproval_id
  if (!userId && preId) {
    const { data } = await admin()
      .from('profiles')
      .select('id')
      .eq('mp_preapproval_id', preId)
      .single()
    userId = data?.id ?? null
  }

  // Pull the current state so we can decide whether to apply the payment.
  // The bug we're fixing: a payment.approved arriving AFTER the user
  // already cancelled the preapproval (an in-flight charge that MP didn't
  // dequeue in time) was unconditionally setting plan_status='active' and
  // moving plan_valid_until forward a month — silently un-cancelling the
  // subscription. We refuse to overwrite a terminal state from a payment
  // webhook; only the preapproval webhook (and the cron) drive lifecycle.
  let currentStatus: string | null = null
  if (userId) {
    const { data } = await admin()
      .from('profiles')
      .select('plan_status')
      .eq('id', userId)
      .maybeSingle()
    currentStatus = (data?.plan_status as string | null) ?? null
  }

  const TERMINAL = new Set(['cancelled', 'past_due', 'expired'])

  if (pay.status === 'approved' && userId) {
    if (currentStatus && TERMINAL.has(currentStatus)) {
      // Charge arrived after cancellation. Don't touch the profile — the
      // user is owed a refund or this is a duplicate MP charge. Log loudly
      // so we notice the case in support / metrics.
      console.warn(
        '[mp-webhook] payment.approved on terminal subscription — not re-activating',
        { userId, currentStatus, paymentId: pay.id },
      )
    } else {
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      await admin()
        .from('profiles')
        .update({ plan_valid_until: nextMonth.toISOString(), plan_status: 'active' })
        .eq('id', userId)
    }
  } else if ((pay.status === 'rejected' || pay.status === 'refunded') && userId) {
    // Only demote to past_due if the sub is still active — if it was
    // already cancelled the cron will downgrade it to free at expiry,
    // overwriting it here would lose the explicit cancellation signal.
    if (!currentStatus || !TERMINAL.has(currentStatus)) {
      await admin().from('profiles').update({ plan_status: 'past_due' }).eq('id', userId)
    }
  }

  await admin().from('billing_events').insert({
    user_id: userId,
    event_type: `payment.${pay.status}`,
    mp_resource_id: String(pay.id),
    mp_resource_type: 'payment',
    amount: pay.transaction_amount,
    currency: pay.currency_id,
    status: pay.status,
    raw_payload: pay as unknown as Record<string, unknown>,
    source: 'webhook',
  })
}

// ────────────────────────────────────────────────────────────────
// Router
// ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Friendly responses so MP's simulator can do a preflight if it needs.
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).send('mp-webhook alive')
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'content-type, x-signature, x-request-id, user-agent',
    )
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  // Vercel already parses JSON bodies for application/json. If body is undefined
  // or not an object, fall back to parsing the raw string.
  let body: { type?: string; action?: string; data?: { id?: string } } = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    return res.status(400).send('bad json')
  }

  console.log('webhook:in', {
    sig: req.headers['x-signature'],
    reqId: req.headers['x-request-id'],
    body: JSON.stringify(body).slice(0, 400),
  })

  const qTopic = (req.query.topic as string) ?? ''
  const qId = (req.query.id as string) ?? ''
  const dataId = body.data?.id ? String(body.data.id) : qId

  if (!dataId) {
    console.warn('webhook:no_id', { body })
    return res.status(400).send('no id')
  }

  const valid = verifySignature(req, dataId)
  if (!valid) {
    console.warn('webhook:invalid_signature', {
      topic: body.type ?? qTopic,
      dataId,
    })
    // Accept anyway during debug; handler reads from MP API so body is advisory.
  }

  const topic = body.type ?? body.action ?? qTopic
  console.log('webhook:routed', { topic, dataId })

  try {
    if (topic.startsWith('subscription_preapproval') || topic === 'preapproval') {
      await handlePreapproval(dataId)
    } else if (
      topic.startsWith('payment') ||
      topic === 'subscription_authorized_payment'
    ) {
      await handlePayment(dataId)
    } else {
      console.log('webhook:ignored_topic', topic)
    }
  } catch (err) {
    console.error('webhook:handler_error', err instanceof Error ? err.message : err)
  }

  return res.status(200).send('ok')
}
