// Daily cron: downgrade subscriptions whose grace period has ended.
//
// Triggered by Vercel's cron scheduler (config in vercel.json). Picks up
// profiles where the subscription was cancelled, paused, or expired on MP's
// side and the paid-through date (`plan_valid_until`) has passed — then
// flips them to plan='free', plan_status='expired'.
//
// Why a cron instead of doing this inline somewhere:
//   - We don't want to check "is my plan expired?" on every auth roundtrip.
//   - A daily sweep is cheap, predictable, and auditable via billing_events.
//
// Auth: Vercel injects `Authorization: Bearer <CRON_SECRET>` on every cron
// invocation when CRON_SECRET is set in the project env. We verify that
// header so a random internet request can't trigger a mass-downgrade.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim()

// Typed as any — see note in mp-create-subscription.ts.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only Vercel's scheduler should hit this. If CRON_SECRET isn't set we
  // fail closed — better to no-op than to expose an unauth'd downgrade.
  const auth = (req.headers.authorization as string) ?? ''
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const nowIso = new Date().toISOString()

  // Candidates: paid plan (not already free), with an expired valid_until,
  // and a terminal status (cancelled / past_due / expired upstream). We
  // intentionally leave `active` + `trialing` alone — if valid_until has
  // passed on those, the webhook will extend it on the next cobro and we
  // shouldn't preempt that.
  const { data: expiring, error: selErr } = await admin()
    .from('profiles')
    .select('id, plan, plan_status, plan_valid_until, mp_preapproval_id')
    .neq('plan', 'free')
    .in('plan_status', ['cancelled', 'past_due', 'expired'])
    .lt('plan_valid_until', nowIso)

  if (selErr) {
    console.error('cron-expire: select failed', selErr)
    return res.status(500).json({ error: 'select_failed' })
  }

  const rows = (expiring ?? []) as Array<{
    id: string
    plan: string
    plan_status: string
    plan_valid_until: string | null
    mp_preapproval_id: string | null
  }>

  if (rows.length === 0) {
    return res.status(200).json({ ok: true, expired: 0, at: nowIso })
  }

  const ids = rows.map((r) => r.id)
  const { error: upErr } = await admin()
    .from('profiles')
    .update({
      plan: 'free',
      plan_status: 'expired',
      // Leave mp_preapproval_id in place for audit — it's not an active sub
      // anymore, but knowing which MP preapproval the user came from is
      // useful when they re-subscribe (analytics, support, etc.).
    })
    .in('id', ids)

  if (upErr) {
    console.error('cron-expire: update failed', upErr)
    return res.status(500).json({ error: 'update_failed' })
  }

  // Audit trail — one billing_event per expiration.
  const events = rows.map((r) => ({
    user_id: r.id,
    event_type: 'plan.expired',
    mp_resource_id: r.mp_preapproval_id,
    mp_resource_type: 'preapproval',
    status: 'expired',
    source: 'cron',
    raw_payload: {
      previous_plan: r.plan,
      previous_status: r.plan_status,
      previous_valid_until: r.plan_valid_until,
    },
  }))
  await admin().from('billing_events').insert(events)

  console.log(`cron-expire: downgraded ${rows.length} profile(s)`)
  return res.status(200).json({ ok: true, expired: rows.length, ids, at: nowIso })
}
