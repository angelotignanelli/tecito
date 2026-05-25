import { useState } from 'react'
import { getPublicBaseUrl } from '../../lib/publicUrl'
import Icon from '../Icon'
import PageHeader from '../PageHeader'
import EditableBookingUrl from './EditableBookingUrl'

interface Props {
  userId: string
  bookingCode: string
  bookingSlug: string | null
  doctorFirstName?: string
  onSlugUpdated: (newSlug: string) => void
}

/**
 * Mobile-only "Mi link" full-screen view. On phones the modal pattern
 * doesn't fit our bottom-tab navigation paradigm — the user expects
 * "Mi link" to feel like its own destination, not an overlay. So we
 * extract the body of MyLinkModal into a section that renders inline
 * with the rest of the views (agenda, pacientes, etc).
 *
 * Desktop continues to use MyLinkModal — the modal makes sense on a
 * pointer-driven UI where the user wants quick share without leaving
 * their current view.
 */
export default function MyLinkSection({
  userId,
  bookingCode,
  bookingSlug,
  doctorFirstName,
  onSlugUpdated,
}: Props) {
  // Slug wins over code for share copy — that's the whole point of the
  // personal handle. We still keep the random code as fallback for
  // brand-new accounts where the slug couldn't be derived yet.
  const handle = bookingSlug || bookingCode
  const url = `${getPublicBaseUrl()}/p/${handle}`
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Older browsers / non-secure contexts: fall back silently.
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
    <div className="bg-bg lg:flex-1 lg:flex lg:flex-col lg:h-full lg:overflow-hidden">
      <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-28 lg:pb-10 lg:overflow-y-auto lg:flex-1 lg:scrollbar-hide">
        <PageHeader
          title="Mi link."
          subtitle="Compartilo con pacientes para que reserven turnos sin registrarse."
        />

        {/* URL block — editable handle (slug or legacy hex code) */}
        <div className="mb-6">
          <div
            className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            URL pública
          </div>
          <EditableBookingUrl
            userId={userId}
            bookingCode={bookingCode}
            bookingSlug={bookingSlug}
            variant="section"
            onSlugUpdated={onSlugUpdated}
          />
        </div>

        {/* Direct share */}
        <div>
          <div
            className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2.5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Compartir directo
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] transition-colors"
            >
              💬 WhatsApp
            </a>
            <a
              href={emailHref}
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-medium cursor-pointer border border-gray-border-2 bg-surface text-text hover:bg-surface-2 transition-colors"
            >
              <Icon name="email" size={14} /> Email
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-medium cursor-pointer border border-gray-border-2 bg-surface text-text hover:bg-surface-2 transition-colors"
            >
              <Icon name="external" size={14} /> Ver mi página
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-medium cursor-pointer border border-gray-border-2 bg-surface text-text hover:bg-surface-2 transition-colors"
            >
              <Icon name="copy" size={14} /> {copied ? '¡Copiado!' : 'Copiar URL'}
            </button>
          </div>

          <p className="text-[12px] text-text-hint mt-5 leading-[1.55]">
            Cualquier paciente con este link puede ver tu agenda y reservar un turno solo, sin registrarse.
          </p>
        </div>
      </div>
    </div>
  )
}
