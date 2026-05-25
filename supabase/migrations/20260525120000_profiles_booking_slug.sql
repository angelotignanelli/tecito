-- Profiles booking slug.
--
-- Today the public booking URL is /p/<8-char hex of a UUID>. Works but is
-- forgettable and not shareable in voice ("siete-ce-dos-be-...").
-- We add a human slug derived from first_name + last_name, editable by the
-- doctor from "Mi link". The old random `booking_code` stays as a parallel
-- alias so links already shared (WhatsApp, email signatures, etc.) keep
-- resolving — the public lookup just checks both columns.

-- ─── Helper: slugify(text) ──────────────────────────────────────────────────
--
-- Lowercases, strips Latin accents, collapses non-alphanumerics into
-- single dashes, trims leading/trailing dashes. We don't depend on the
-- `unaccent` extension (not always available on managed Postgres) — we
-- replace the Latin-1 accented letters explicitly. Anything else just
-- becomes a dash and gets squeezed.
--
-- IMMUTABLE so it can be used in indexes / generated columns later.

CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;
  s := lower(input);
  -- Strip the most common Spanish/Portuguese accented chars.
  s := translate(s,
    'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
  );
  -- Anything not [a-z0-9] becomes a dash, then squeeze repeats, then trim.
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '^-+|-+$', '', 'g');
  RETURN s;
END;
$$;

-- ─── Column ─────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS booking_slug text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_booking_slug_key UNIQUE (booking_slug);

-- Length / charset guard. We allow 3-40 chars of [a-z0-9-]. This applies
-- both to the auto-generated value and any future user-edited value, so
-- the API layer can rely on it instead of re-validating.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_booking_slug_format
  CHECK (
    booking_slug IS NULL OR (
      booking_slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$'
      AND char_length(booking_slug) BETWEEN 3 AND 40
    )
  );

-- ─── Auto-generate on INSERT ────────────────────────────────────────────────
--
-- When a new profile is created (signup), derive a slug from name. If the
-- naive `firstname-lastname` is taken, append -2, -3, ... until it fits.
-- We never fail the INSERT just because the slug is busy — worst case we
-- leave booking_slug NULL and the user keeps the random booking_code.

CREATE OR REPLACE FUNCTION public.generate_booking_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 1;
BEGIN
  -- Only generate on INSERT when the value wasn't already supplied.
  IF NEW.booking_slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  base := public.slugify(
    coalesce(NEW.first_name, '') || '-' || coalesce(NEW.last_name, '')
  );

  -- If name is empty / non-ASCII-only, leave it null and let the random
  -- booking_code be the public handle.
  IF base IS NULL OR char_length(base) < 3 THEN
    RETURN NEW;
  END IF;

  -- Trim to 38 chars so we have room for "-NN" suffix without busting
  -- the 40-char limit imposed by the check constraint.
  base := substring(base, 1, 38);
  candidate := base;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE booking_slug = candidate) LOOP
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
    -- Pathological safety net.
    IF suffix > 999 THEN
      candidate := base || '-' || substring(gen_random_uuid()::text, 1, 4);
      EXIT;
    END IF;
  END LOOP;

  NEW.booking_slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_generate_booking_slug ON public.profiles;
CREATE TRIGGER auto_generate_booking_slug
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_booking_slug();

-- ─── Backfill existing rows ─────────────────────────────────────────────────
--
-- For every profile that already exists without a slug, try to assign one.
-- We loop in plpgsql rather than a single UPDATE so the collision logic
-- in the trigger gets a chance to run — the trigger only fires on INSERT,
-- so on backfill we resolve collisions by hand here.

DO $$
DECLARE
  r record;
  base text;
  candidate text;
  suffix int;
BEGIN
  FOR r IN
    SELECT id, first_name, last_name FROM public.profiles WHERE booking_slug IS NULL
  LOOP
    base := public.slugify(
      coalesce(r.first_name, '') || '-' || coalesce(r.last_name, '')
    );
    CONTINUE WHEN base IS NULL OR char_length(base) < 3;

    base := substring(base, 1, 38);
    candidate := base;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE booking_slug = candidate) LOOP
      suffix := suffix + 1;
      candidate := base || '-' || suffix;
      IF suffix > 999 THEN
        candidate := base || '-' || substring(gen_random_uuid()::text, 1, 4);
        EXIT;
      END IF;
    END LOOP;

    UPDATE public.profiles SET booking_slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- ─── RLS: public read by slug ───────────────────────────────────────────────
--
-- The existing `public_profile_read` policy already allows SELECT on any
-- profile where booking_code IS NOT NULL. Since every profile gets a code
-- on INSERT, that policy already covers slug lookups. No new policy
-- needed — the fetchPublicProfile() resolver just filters by either column.
