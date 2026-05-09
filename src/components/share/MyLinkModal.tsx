import { useState } from 'react'
import { getPublicBaseUrl } from '../../lib/publicUrl'
import Icon from '../Icon'

interface Props {
  bookingCode: string
  doctorFirstName?: string
  onClose: () => void
}

/**
 * Modal exposed from the left-sidebar "Mi link" item. Centralizes the
 * share affordances that were previously scattered (right-panel card,
 * "Mi perfil" page) into a single discoverable surface — and gives the
 * doctor every common channel for getting their link in front of
 * patients in one place.
 *
 * v1 covers: copy URL, share via WhatsApp, share via Email. QR / embed /
 * slug customization come in a later iteration; the structure is kept
 * loose so we can add tabs without rebuilding.
 */
export default function MyLinkModal({ bookingCode, doctorFirstName, onClose }: Props) {
  const url = `${getPublicBaseUrl()}/p/${bookingCode}`
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Older browsers / non-secure contexts: fall back to selectable
      // text without showing a confirmation.
    }
  }

  const safeFirstName = (doctorFirstName ?? '').trim()
  const intro = safeFirstName ? `Soy ${safeFirstName}. ` : ''

  const whatsappText = encodeURIComponent(
    `Hola! ${intro}Si querés sacar un turno conmigo, podés hacerlo desde acá: ${url}`,
  )
  const whatsappHref = `https://wa.me/?text=${whatsappText}`

  const emailSubject = encodeURIComponent(
    safeFirstName ? `Turnos online con ${safeFirstName}` : 'Turnos online',
  )
  const emailBody = encodeURIComponent(
    `Hola!\n\n${intro}Te dejo el link para que saques un turno conmigo cuando te quede cómodo:\n${url}\n\n¡Gracias!`,
  )
  const emailHref = `mailto:?subject=${emailSubject}&body=${emailBody}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full sm:max-w-[560px] sm:rounded-[16px] flex flex-col overflow-hidden border border-gray-border shadow-[0_24px_80px_rgba(26,24,21,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Head */}
        <div className="px-6 py-5 border-b border-gray-border flex items-center justify-between shrink-0">
          <h4
            className="text-[22px] font-normal tracking-[-0.02em] text-text m-0"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Mi link de turnos
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md grid place-items-center cursor-pointer text-text-hint hover:bg-surface-2 transition-colors"
            aria-label="Cerrar"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-5">
          {/* URL block */}
          <div>
            <div
              className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              URL pública
            </div>
            <div className="border border-gray-border bg-bg rounded-[10px] p-1 pl-3.5 flex items-center gap-2">
              <span
                className="flex-1 text-[12px] truncate"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
                title={url}
              >
                {url}
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer border border-primary bg-primary text-surface hover:bg-[#2F3C2D] transition-colors shrink-0"
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-[12px] text-text-hint mt-2 leading-[1.55]">
              Cualquier paciente con este link puede ver tu agenda y reservar un turno solo, sin registrarse.
            </p>
          </div>

          {/* Direct share */}
          <div>
            <div
              className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2.5"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Compartir directo
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] text-[13px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] transition-colors"
              >
                💬 WhatsApp
              </a>
              <a
                href={emailHref}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] text-[13px] font-medium cursor-pointer border border-gray-border-2 bg-surface text-text hover:bg-surface-2 transition-colors"
              >
                <Icon name="email" size={14} /> Email
              </a>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] text-[13px] font-medium cursor-pointer border border-gray-border-2 bg-surface text-text hover:bg-surface-2 transition-colors"
              >
                <Icon name="external" size={14} /> Ver mi página
              </a>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] text-[13px] font-medium cursor-pointer border border-gray-border-2 bg-surface text-text hover:bg-surface-2 transition-colors"
              >
                <Icon name="copy" size={14} /> {copied ? '¡Copiado!' : 'Copiar URL'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
