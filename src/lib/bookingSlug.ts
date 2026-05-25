// Helpers around the personalized public booking handle (profiles.booking_slug).
//
// `booking_slug` is the human-readable identifier that backs /p/<slug>
// (e.g. /p/angelo-tignanelli). It coexists with the random
// `booking_code` we ship at signup — both resolve to the same profile,
// so changing the slug never breaks links already shared with the old
// code or a previous slug.

import { supabase } from './supabase'

// Mirror of the CHECK constraint in
// supabase/migrations/20260525120000_profiles_booking_slug.sql so the
// client can give immediate feedback before round-tripping to Postgres.
// Keep these two in sync if you ever loosen / tighten either side.
const SLUG_MIN = 3
const SLUG_MAX = 40
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/

// Reserved handles that would clash with first-class URL paths or look
// like spoofing. The router today only owns /p/* and a few root paths
// (/cancel/:token, /legal, /seguridad, /about), so this list is short.
const RESERVED = new Set([
  'admin', 'api', 'app', 'auth', 'login', 'signup', 'cancel',
  'legal', 'seguridad', 'about', 'blog', 'p', 'home', 'panel',
  'tecito', 'soporte', 'help', 'ayuda',
])

export interface SlugValidation {
  ok: boolean
  /** Plain-Spanish reason — safe to surface to the user. */
  reason?: string
}

/** Cheap client-side validation. Backend still enforces uniqueness. */
export function validateSlug(raw: string): SlugValidation {
  const s = raw.trim().toLowerCase()
  if (!s) return { ok: false, reason: 'El link no puede estar vacío.' }
  if (s.length < SLUG_MIN) return { ok: false, reason: `Al menos ${SLUG_MIN} caracteres.` }
  if (s.length > SLUG_MAX) return { ok: false, reason: `Máximo ${SLUG_MAX} caracteres.` }
  if (!SLUG_RE.test(s)) {
    return {
      ok: false,
      reason: 'Solo letras (a–z), números y guiones. Empieza y termina con letra o número.',
    }
  }
  if (RESERVED.has(s)) return { ok: false, reason: 'Ese link está reservado, probá otro.' }
  return { ok: true }
}

/** Light client-side slugifier — strips accents, lowercases, dashes. */
export function suggestSlug(input: string): string {
  return input
    .toLowerCase()
    // NFD splits accented chars into base + combining mark; we then drop
    // the combining marks block (U+0300–U+036F). Explicit hex escapes
    // keep this readable instead of staring at literal diacritics.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
}

export interface SlugUpdateResult {
  ok: boolean
  /** Surface to the user as inline error. */
  error?: string
}

/**
 * Persist a new slug for the given profile. Handles the common
 * uniqueness collision (Postgres error code 23505) with a friendly
 * Spanish message instead of leaking the raw constraint name.
 */
export async function updateBookingSlug(
  userId: string,
  slug: string,
): Promise<SlugUpdateResult> {
  const v = validateSlug(slug)
  if (!v.ok) return { ok: false, error: v.reason }

  const { error } = await supabase
    .from('profiles')
    .update({ booking_slug: slug.trim().toLowerCase() })
    .eq('id', userId)

  if (!error) return { ok: true }

  // Postgres unique_violation. supabase-js surfaces it as either
  // error.code === '23505' or message includes 'duplicate key'.
  if (error.code === '23505' || /duplicate key/i.test(error.message ?? '')) {
    return { ok: false, error: 'Ese link ya lo está usando otro profesional.' }
  }
  // CHECK constraint failure — should be caught by validateSlug first,
  // but if the rules ever drift we still show something useful.
  if (error.code === '23514') {
    return { ok: false, error: 'Ese link tiene caracteres no permitidos.' }
  }
  return { ok: false, error: 'No pudimos guardar el cambio. Probá de nuevo.' }
}
