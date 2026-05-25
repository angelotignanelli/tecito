-- Location schedules — multiple time ranges per consultorio.
--
-- Today each row in `locations` carries a single continuous range
-- (work_days + work_from + work_to). That doesn't cover the real
-- Argentine schedule pattern: most clinics atienden mañana y tarde
-- with a midday break ("Lun-Vie 9-13 y 16-20"). It also can't
-- represent variable days per range ("Lun-Vie 9-13 + Sáb 10-12").
--
-- This migration normalizes that into a child table. The original
-- columns stay on `locations` for one release as a fallback so the
-- slot generator can serve either source while we ship the UI; we'll
-- drop them in a follow-up once the editor writes only to the new
-- table.

CREATE TABLE IF NOT EXISTS public.location_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  -- Days this range covers — same vocabulary as locations.work_days
  -- (`['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']`). Stored as text[]
  -- so the slot generator can keep using `.includes()`.
  days        text[] NOT NULL DEFAULT ARRAY[]::text[],
  from_time   time NOT NULL,
  to_time     time NOT NULL,
  -- Visual ordering for the editor. 0 = first row, increasing. Lets
  -- "Mañana" stay above "Tarde" without depending on creation order
  -- or alphabetical sort.
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Guard against the obvious data-entry error. Overlap detection
  -- between rows is intentionally NOT enforced here — we let the
  -- editor handle it, because overlap is sometimes legal (e.g.
  -- doctor charges differently for two products that share an hour).
  CONSTRAINT location_schedules_time_order CHECK (from_time < to_time)
);

CREATE INDEX IF NOT EXISTS location_schedules_location_idx
  ON public.location_schedules (location_id, position);

-- ─── RLS: same rules as the parent table ────────────────────────────────────
--
-- Doctors can read/write their own schedules; the public booking endpoint
-- (anon role) needs SELECT so the slot generator works without a logged-in
-- user. We mirror the policies that already exist on `locations`.

ALTER TABLE public.location_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY location_schedules_owner_all ON public.location_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = location_schedules.location_id
        AND l.doctor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = location_schedules.location_id
        AND l.doctor_id = auth.uid()
    )
  );

CREATE POLICY location_schedules_public_read ON public.location_schedules
  FOR SELECT
  USING (
    -- Match the public_profile_read pattern: surface a doctor's schedule
    -- whenever the parent profile is publicly listable (has a booking
    -- code). The slot generator runs as anon and needs this row.
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.profiles p ON p.id = l.doctor_id
      WHERE l.id = location_schedules.location_id
        AND p.booking_code IS NOT NULL
    )
  );

-- ─── Backfill from the existing single-range columns ─────────────────────────
--
-- For every location that already has work_days + work_from + work_to,
-- create one schedule row mirroring those values. Locations with NULL
-- times get no schedule rows — same effective behavior as today
-- (the slot generator falls back to defaults).

INSERT INTO public.location_schedules (location_id, days, from_time, to_time, position)
SELECT
  id,
  COALESCE(work_days, ARRAY[]::text[]),
  work_from,
  work_to,
  0
FROM public.locations
WHERE work_from IS NOT NULL
  AND work_to IS NOT NULL;
