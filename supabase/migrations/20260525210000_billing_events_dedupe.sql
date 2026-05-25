-- billing_events — dedupe webhook retries.
--
-- MercadoPago sometimes redelivers the same notification (typical reasons:
-- our response was slow, our TLS handshake hiccupped, their internal retry
-- ladder). Each redelivery currently inserts a new audit row even though
-- it's the same logical event, polluting the table and making the audit
-- trail noisy.
--
-- We add a partial UNIQUE index on (mp_resource_id, event_type) scoped to
-- source='webhook' — i.e. webhook retries collapse to a single row, but
-- 'api' (the row we write from mp-create-subscription) and 'manual' (e.g.
-- the support reset SQL we wrote earlier) inserts can coexist for the
-- same logical resource without conflict.
--
-- Existing duplicates: dedupe BEFORE creating the index, otherwise CREATE
-- UNIQUE INDEX fails. We keep the OLDEST row per (resource, event, source=
-- 'webhook') because the first observation has the original timestamp.

-- 1) Collapse any pre-existing duplicates on the webhook source.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY mp_resource_id, event_type
      ORDER BY created_at ASC
    ) AS rn
  FROM public.billing_events
  WHERE source = 'webhook'
    AND mp_resource_id IS NOT NULL
)
DELETE FROM public.billing_events
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Partial unique index. Partial so non-webhook sources stay flexible.
CREATE UNIQUE INDEX IF NOT EXISTS billing_events_webhook_dedupe_idx
  ON public.billing_events (mp_resource_id, event_type)
  WHERE source = 'webhook' AND mp_resource_id IS NOT NULL;
