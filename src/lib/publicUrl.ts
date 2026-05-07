/**
 * Canonical public base URL for links the user *shares with the world* —
 * patient booking pages, ICS calendar feeds, etc.
 *
 * We avoid `window.location.origin` for those URLs because doctors might be
 * browsing the dashboard from `tecito-topaz.vercel.app` (the technical Vercel
 * URL) instead of `tecito.com.ar` (the brand). Sharing the technical URL
 * leaks our infrastructure and can break if we ever rename the project.
 *
 * Order of precedence:
 *   1. `VITE_PUBLIC_URL` env var (set in Vercel for prod / preview)
 *   2. `window.location.origin` for local dev (localhost), so the dev
 *      workflow still works without setting env vars locally.
 *
 * In production this should ALWAYS resolve to `https://tecito.com.ar` (no
 * trailing slash).
 */
export function getPublicBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
