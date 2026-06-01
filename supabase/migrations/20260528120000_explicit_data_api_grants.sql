-- Explicit Data API grants for every public table.
--
-- Why this migration exists:
--
-- Today (May 28, 2026) Supabase auto-grants `anon` and `authenticated`
-- access to anything we create in the public schema. Our baseline
-- migration ships zero explicit GRANTs and just rides that default.
--
-- Per the announcement from May 28, 2026, that default goes away:
--   • May 30, 2026:  removed for all NEW Supabase projects.
--   • October 30, 2026:  enforced for NEW TABLES across all EXISTING
--     projects (including ours).
--
-- Tables created BEFORE October 30 keep whatever grants they have when
-- the cutover hits. So our running prod DB is fine. The risk is the
-- "from scratch" path — a teammate cloning the repo, a preview branch,
-- a disaster-recovery rebuild — anyone running `supabase db push`
-- against a fresh DB after October would get a schema where supabase-js
-- can't see anything because PostgREST doesn't have grants.
--
-- This migration is defensive: it restates the grants we want for every
-- table that exists today. GRANT is idempotent (re-issuing has no
-- effect), so applying this against prod is a no-op for the live DB.
-- Against a fresh DB it bakes the grants in so the schema works under
-- the post-October regime.
--
-- Per-table reasoning (what `anon` actually needs is the security-
-- relevant question — RLS policies still control rows, but the table
-- needs to be in the API surface first):
--
--   profiles            anon SELECT — public booking resolves by code/slug
--   locations           anon SELECT — slot generator reads
--   location_schedules  anon SELECT — slot generator reads
--   appointments        anon SELECT + INSERT — see booked slots, write booking
--   date_blocks         anon SELECT — slot generator honors blocks
--   patients            anon SELECT + INSERT — existing-patient match + create
--   billing_events      authenticated only — doctor reads own audit
--   bot_sessions        authenticated only — bot config (WhatsApp pending)
--   bot_templates       authenticated only — bot config
--   organizations       authenticated only — clinic admin
--   organization_members authenticated only
--   organization_invites authenticated only

-- ─── Schema USAGE ────────────────────────────────────────────────────────────
-- Both roles need USAGE on the schema before any table grant resolves.
-- Default privileges grant this today; restating it explicitly survives
-- October.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ─── Public-booking surface (anon can touch) ────────────────────────────────

GRANT SELECT ON public.profiles            TO anon, authenticated;
GRANT SELECT ON public.locations           TO anon, authenticated;
GRANT SELECT ON public.location_schedules  TO anon, authenticated;
GRANT SELECT ON public.date_blocks         TO anon, authenticated;

-- Anon writes only happen during a booking: insert a patient (or match an
-- existing one) and insert the appointment row. The RLS policies in the
-- baseline restrict WHAT they can insert (doctor_id has to come from a
-- valid booking_code, etc) — these grants just open the door.
GRANT SELECT, INSERT ON public.appointments  TO anon;
GRANT SELECT, INSERT ON public.patients      TO anon;

-- Authenticated doctors do full DML on their own rows (RLS filters).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients      TO authenticated;

-- profile and locations are mostly read but the doctor needs to update
-- their own profile / manage their consultorios.
GRANT INSERT, UPDATE, DELETE ON public.profiles            TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.locations           TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.location_schedules  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.date_blocks         TO authenticated;

-- ─── Doctor-only surface (no anon at all) ──────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_events        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_sessions          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_templates         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites  TO authenticated;

-- ─── Sequences ──────────────────────────────────────────────────────────────
-- INSERT on a table that uses a SERIAL/GENERATED column needs USAGE on
-- the underlying sequence. Most of ours use gen_random_uuid() so this is
-- a no-op safety net, but harmless to issue.

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
