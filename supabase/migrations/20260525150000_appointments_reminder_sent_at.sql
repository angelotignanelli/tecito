-- Appointments — reminder idempotency.
--
-- The /api/cron/send-reminders endpoint runs every morning, scans the
-- appointments scheduled for the next ~24h, and sends a "Recordá: tu
-- turno mañana" mail. Without a marker the cron would re-send every
-- time it fires (Vercel's smallest cron is hourly, so for the same
-- appointment we'd hit Resend up to 24 times in the lead-up window).
--
-- We mark the send with a TIMESTAMPTZ so we can also report on send
-- latency / observability later. The partial index covers the typical
-- query: "appointments where reminder is still pending" — that subset
-- shrinks fast after each cron run, so the index stays cheap.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS appointments_reminder_24h_null_idx
  ON public.appointments (date, time)
  WHERE reminder_24h_sent_at IS NULL;
