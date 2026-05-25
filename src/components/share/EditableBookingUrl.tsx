import { useState } from 'react'
import { getPublicBaseUrl } from '../../lib/publicUrl'
import { suggestSlug, updateBookingSlug, validateSlug } from '../../lib/bookingSlug'
import Icon from '../Icon'

interface Props {
  /** Profile id, used to persist the slug update. */
  userId: string
  /** Random hex fallback. Always present — set by trigger on signup. */
  bookingCode: string
  /** Human slug (e.g. "angelo-tignanelli"). Preferred when present. */
  bookingSlug: string | null
  /** Visual variant — section is a slightly bigger version of modal. */
  variant?: 'section' | 'modal'
  /** Called after a successful update so the parent can refresh its profile copy. */
  onSlugUpdated: (newSlug: string) => void
}

/**
 * URL row for the "Mi link" surfaces with inline slug editing.
 *
 * Renders `https://tecito.com.ar/p/<slug || code>` and a "Copiar" button.
 * Clicking the pencil flips the row into an editor: a controlled input
 * showing just the slug portion (the base URL stays as a visual prefix
 * so the doctor reads the full address while typing). Save calls
 * updateBookingSlug() — uniqueness conflicts surface inline.
 *
 * The component is intentionally self-contained: no Redux / context.
 * The parent owns the profile and just receives the new slug via
 * onSlugUpdated to keep its cache fresh.
 */
export default function EditableBookingUrl({
  userId,
  bookingCode,
  bookingSlug,
  variant = 'section',
  onSlugUpdated,
}: Props) {
  const handle = bookingSlug || bookingCode
  const baseUrl = `${getPublicBaseUrl()}/p/`
  const url = `${baseUrl}${handle}`

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(handle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* non-secure context fallback: noop */
    }
  }

  const startEdit = () => {
    // Seed the input with the current handle. If we're showing the
    // legacy hex code (no slug yet) we'd rather suggest a slug derived
    // from… well, we don't have the name here. Keep the code so the
    // doctor sees what they're replacing.
    setDraft(handle)
    setError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setError(null)
  }

  const submitEdit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    const proposed = draft.trim().toLowerCase()

    // No-op save: just close.
    if (proposed === handle) {
      setEditing(false)
      return
    }
    const v = validateSlug(proposed)
    if (!v.ok) {
      setError(v.reason ?? 'Link inválido.')
      return
    }
    setSaving(true)
    const result = await updateBookingSlug(userId, proposed)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo guardar.')
      return
    }
    onSlugUpdated(proposed)
    setEditing(false)
  }

  // Visual tokens — the section variant is the mobile/desktop "Mi link"
  // page, slightly chunkier than the modal that lives over the agenda.
  const rowRadius = variant === 'section' ? 'rounded-[12px]' : 'rounded-[10px]'
  const rowBg = variant === 'section' ? 'bg-surface' : 'bg-bg'

  // ─── Read mode ─────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className={`border border-gray-border ${rowBg} ${rowRadius} p-1 pl-3.5 flex items-center gap-2`}>
        <span
          className="flex-1 text-[12px] truncate min-w-0"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
          title={url}
        >
          {url}
        </span>
        <button
          type="button"
          onClick={startEdit}
          className="w-8 h-8 grid place-items-center rounded-md cursor-pointer text-text-hint hover:bg-surface-2 transition-colors shrink-0"
          aria-label="Editar link"
          title="Editar link"
        >
          <Icon name="edit" size={14} />
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-2 rounded-[8px] text-[12px] font-medium cursor-pointer border border-primary bg-primary text-surface hover:bg-[#2F3C2D] transition-colors shrink-0"
        >
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
    )
  }

  // ─── Edit mode ────────────────────────────────────────────────────────
  return (
    <form onSubmit={submitEdit}>
      <div
        className={`border ${error ? 'border-coral' : 'border-primary'} ${rowBg} ${rowRadius} p-1 pl-3.5 flex items-center gap-1`}
      >
        <span
          className="text-[12px] shrink-0"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-hint)' }}
        >
          {baseUrl}
        </span>
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            // Light auto-sanitize so the doctor doesn't fight the field
            // with capital letters / spaces while typing. We still
            // validate strictly before save.
            const next = suggestSlug(e.target.value)
            setDraft(next)
            if (error) setError(null)
          }}
          autoFocus
          maxLength={40}
          placeholder="mi-nombre"
          className="flex-1 min-w-0 bg-transparent text-[12px] outline-none border-0"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}
          aria-label="Nuevo link personalizado"
          disabled={saving}
        />
        <button
          type="button"
          onClick={cancelEdit}
          disabled={saving}
          className="px-3 py-2 rounded-[8px] text-[12px] font-medium cursor-pointer text-text-muted hover:bg-surface-2 transition-colors shrink-0 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !draft.trim()}
          className="px-3 py-2 rounded-[8px] text-[12px] font-medium cursor-pointer border border-primary bg-primary text-surface hover:bg-[#2F3C2D] transition-colors shrink-0 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {error && (
        <p className="text-[12px] text-coral mt-1.5 leading-[1.4]" role="alert">
          {error}
        </p>
      )}
      {!error && (
        <p className="text-[11px] text-text-hint mt-1.5 leading-[1.4]">
          Letras, números y guiones. El link viejo va a seguir funcionando.
        </p>
      )}
    </form>
  )
}
