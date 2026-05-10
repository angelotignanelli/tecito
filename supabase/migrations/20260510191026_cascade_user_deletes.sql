-- Make user deletion from the Supabase Auth Dashboard actually work.
--
-- The baseline schema created several FKs into auth.users / profiles
-- with the default ON DELETE NO ACTION. That blocks deleting a user
-- from the Dashboard because the row in auth.users can't be removed
-- while children (profile, appointments, patients, etc.) still
-- reference it. We retro-fit ON DELETE CASCADE everywhere a deletion
-- should propagate, and ON DELETE SET NULL for "attribution" columns
-- where we want the orphaned record (e.g. an org survives its
-- founder).
--
-- Idempotent: each constraint is dropped only if present, then
-- recreated with the desired cascade rule.

-- ─── profiles.id → auth.users ─────────────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── appointments.doctor_id → profiles ────────────────────────────
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_doctor_id_fkey;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ─── patients.doctor_id → profiles ────────────────────────────────
ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_doctor_id_fkey;
ALTER TABLE public.patients
  ADD CONSTRAINT patients_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ─── date_blocks.doctor_id → profiles ─────────────────────────────
ALTER TABLE public.date_blocks
  DROP CONSTRAINT IF EXISTS date_blocks_doctor_id_fkey;
ALTER TABLE public.date_blocks
  ADD CONSTRAINT date_blocks_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ─── bot_templates.doctor_id → profiles ───────────────────────────
ALTER TABLE public.bot_templates
  DROP CONSTRAINT IF EXISTS bot_templates_doctor_id_fkey;
ALTER TABLE public.bot_templates
  ADD CONSTRAINT bot_templates_doctor_id_fkey
  FOREIGN KEY (doctor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ─── organization_members.user_id (the public.profiles mirror) ────
-- The auth.users side is already CASCADE, but the second FK on the
-- same column points at public.profiles without cascade. Align it.
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS fk_org_members_profile;
ALTER TABLE public.organization_members
  ADD CONSTRAINT fk_org_members_profile
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ─── organizations.created_by → auth.users (SET NULL on delete) ───
-- We want the org to survive its founder leaving, but the column
-- becomes NULL so the foreign key doesn't dangle. Requires the column
-- to be nullable; it already is in baseline.
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_created_by_fkey;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── organization_invites.created_by → auth.users (SET NULL) ──────
-- Same attribution-only rationale: invite history shouldn't block
-- deletion of the issuer.
ALTER TABLE public.organization_invites
  DROP CONSTRAINT IF EXISTS organization_invites_created_by_fkey;
ALTER TABLE public.organization_invites
  ADD CONSTRAINT organization_invites_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
