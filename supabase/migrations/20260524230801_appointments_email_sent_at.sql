-- Tecito — track when the booking confirmation emails were sent.
--
-- The /api/send-booking-confirmation endpoint will start being triggered
-- by a Supabase Database Webhook on every INSERT into appointments, in
-- addition to the client-side fetch we already have. To avoid sending the
-- pair of mails twice (once per trigger), the endpoint checks this column
-- before sending: if non-null, it returns 200 with `{ alreadySent: true }`
-- and does nothing. After a successful send it stamps the current time.
--
-- Idempotent — safe to run more than once.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Optional: index for "find me appointments where the email never went out"
-- maintenance queries. Partial index on NULL keeps it cheap.
CREATE INDEX IF NOT EXISTS appointments_email_sent_at_null_idx
  ON public.appointments (created_at DESC)
  WHERE email_sent_at IS NULL;

COMMENT ON COLUMN public.appointments.email_sent_at IS
  'Set by /api/send-booking-confirmation when the patient + doctor mails go out. '
  'Used to make the endpoint idempotent against double-firing (e.g. DB webhook + client fetch).';
