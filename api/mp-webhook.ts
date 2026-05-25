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

  // Read current state before deciding. Same reason as in handlePayment:
  // we won't let a stale webhook for an old preapproval reanimate a
  // subscription the user has already fully exited (manual reset, cron
  // expiration, etc).
  const { data: existing } = await admin()
    .from('profiles')
    .select('plan, plan_status')
    .eq('id', userId)
    .maybeSingle()
  const currentPlan = (existing?.plan as string | null) ?? 'free'
  const currentStatus = (existing?.plan_status as string | null) ?? 'active'

  // Terminal state = user has fully moved on. Only an `authorized` event
  // (a fresh subscription) should be able to lift them out of here. A
  // paused/cancelled webhook for the OLD preapproval id is just trailing
  // noise — log it and bail. Without this guard, a refund in MP would
  // cascade into us re-creating the plan='pro' row with status='past_due'.
  const isTerminal = currentPlan === 'free' && currentStatus === 'expired'
  if (isTerminal && status !== 'authorized') {
    console.warn(
      '[mp-webhook] preapproval.' + status + ' on terminal subscription — ignoring',
      { userId, currentPlan, currentStatus, preapprovalId: pre.id },
    )
    await admin().from('billing_events').insert({
      user_id: userId,
      event_type: `preapproval.${status}.ignored_terminal`,
      mp_resource_id: pre.id,
      mp_resource_type: 'preapproval',
      amount: pre.auto_recurring.transaction_amount,
      currency: pre.auto_recurring.currency_id,
      status,
      raw_payload: pre as unknown as Record<string, unknown>,
      source: 'webhook',
    })
    return
  }

  // `pending` = MP is still validating the preapproval (card pre-check,
  // etc). Don't touch the user's current plan — just log and bail. The
  // old `else` branch reset plan='free'/status='active', which silently
  // killed an in-flight upgrade if MP went through a `pending` blip.
  if (status === 'pending') {
    console.log('[mp-webhook] preapproval.pending — leaving profile untouched', {
      userId,
      preapprovalId: pre.id,
    })
    await admin().from('billing_events').insert({
      user_id: userId,
      event_type: 'preapproval.pending',
      mp_resource_id: pre.id,
      mp_resource_type: 'preapproval',
      amount: pre.auto_recurring.transaction_amount,
      currency: pre.auto_recurring.currency_id,
      status: 'pending',
      raw_payload: pre as unknown as Record<string, unknown>,
      source: 'webhook',
    })
    return
  }

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
    // Any unknown future status — log and bail rather than reset. Keeps
    // us safe against MP introducing a new lifecycle state we don't
    // recognize yet (the old default was active+free, which masked
    // anything weird as a downgrade).
    console.warn('[mp-webhook] unknown preapproval status — ignoring', {
      userId,
      status,
      preapprovalId: pre.id,
    })
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
    return
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
    // .maybeSingle() instead of .single() — single() throws on 0 rows
    // (e.g. payment metadata references a preapproval that isn't tied to
    // any current profile, like a dev simulator hit or a stale id) which
    // would also short-circuit the billing_events insert below.
    const { data } = await admin()
      .from('profiles')
      .select('id')
      .eq('mp_preapproval_id', preId)
      .maybeSingle()
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
      // Use the REAL next_payment_date from MP's preapproval when we can,
      // not a JS +30d. A retried cobro (MP recovered after past_due, charge
      // succeeded N days late) would otherwise produce a drifted cycle.
      // We still need the preapproval id to fetch — get it from the
      // payment metadata, or fall back to the profile we just resolved.
      let nextChargeIso: string | null = null
      const preIdForLookup =
        pay.metadata?.preapproval_id ||
        (userId
          ? ((
              await admin()
                .from('profiles')
                .select('mp_preapproval_id')
                .eq('id', userId)
                .maybeSingle()
            ).data?.mp_preapproval_id as string | null) || null
          : null)
      if (preIdForLookup) {
        const pre = await mpGet<MPPreapproval>(`/preapproval/${preIdForLookup}`)
        nextChargeIso = pre?.next_payment_date ?? null
      }
      if (!nextChargeIso) {
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextChargeIso = nextMonth.toISOString()
      }
      await admin()
        .from('profiles')
        .update({ plan_valid_until: nextChargeIso, plan_status: 'active' })
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
    // Reject. Without the secret an attacker can forge `data.id` values to
    // trigger our handlers — and even though we re-fetch from MP (so they
    // can't inject crafted state), they could DoS the endpoint and burn
    // through our MP_ACCESS_TOKEN rate limits. We only short-circuit when
    // MP_WEBHOOK_SECRET is configured: in local dev without the secret,
    // verifySignature() returns true and this branch never runs.
    return res.status(401).send('invalid signature')
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
