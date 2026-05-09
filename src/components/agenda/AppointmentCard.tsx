import type { Appointment } from '../../data/appointments'
import type { LocationRow } from '../../lib/hooks'
import { resolveLocationForDate } from '../../lib/locationResolver'
import Icon from '../Icon'
import Btn from '../Btn'

const statusLineColor: Record<string, string> = {
  confirmado: 'bg-teal',
  pendiente: 'bg-amber',
  cancelado: 'bg-coral',
  libre: 'bg-gray-border-2',
  bloqueado: 'bg-text-dim',
}

const badgeStyles: Record<string, string> = {
  confirmado: 'bg-teal-light text-teal',
  pendiente: 'bg-amber-light text-amber',
  cancelado: 'bg-coral-light text-coral',
  libre: 'bg-surface-2 text-text-hint',
  bloqueado: 'bg-surface-2 text-text-hint',
}

const badgeLabel: Record<string, string> = {
  confirmado: 'Confirmado',
  pendiente: 'Sin confirmar',
  cancelado: 'Cancelado',
  libre: 'Disponible',
  bloqueado: 'Bloqueado',
}

interface Props {
  appointment: Appointment
  isSelected: boolean
  onSelect: (appointment: Appointment) => void
  onCancel: (id: string) => void
  onRecordar: (appointment: Appointment) => void
  onReasignar?: (appointment: Appointment) => void
  locations?: LocationRow[]
}

export default function AppointmentCard({
  appointment,
  isSelected,
  onSelect,
  onCancel,
  onRecordar,
  onReasignar,
  locations,
}: Props) {
  const isLibre = appointment.status === 'libre'
  const isBloqueado = appointment.status === 'bloqueado'
  const isInactive = isLibre || isBloqueado

  // Resolve effective location (explicit FK, then day-of-week inference)
  const effectiveLocation =
    locations && locations.length > 0
      ? resolveLocationForDate(appointment.locationId, appointment.date, locations)
      : null
  const displayLocationName = effectiveLocation?.name ?? appointment.locationName

  // Compare the appointment's end time to "now"
  const isPast = (() => {
    if (!appointment.date || !appointment.time) return false
    const [h, m] = appointment.time.split(':').map(Number)
    const durMin = parseInt(appointment.duration) || 50
    const apt = new Date(appointment.date + 'T00:00:00')
    apt.setHours(h, m + durMin, 0, 0)
    return apt.getTime() < Date.now()
  })()

  return (
    <div
      onClick={() => onSelect(appointment)}
      className={`group border rounded-[12px] px-[18px] py-[14px] mb-2 flex flex-wrap sm:flex-nowrap items-center gap-4 cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary-mid bg-primary-light'
          : isBloqueado
            ? 'border-gray-border bg-surface-2'
            : 'border-gray-border bg-surface hover:border-gray-border-2'
      }`}
    >
      {/* Time */}
      <div className="min-w-[56px] text-center">
        <div
          className={`text-[18px] tracking-[-0.015em] leading-none ${isInactive ? 'text-text-dim' : 'text-primary'}`}
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {appointment.time}
        </div>
        <div className="text-[10px] text-text-hint mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
          {appointment.duration}
        </div>
      </div>

      {/* Status line */}
      <div className={`w-[2px] h-9 rounded-[1px] shrink-0 hidden sm:block ${statusLineColor[appointment.status]}`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-medium ${isInactive ? 'text-text-hint font-normal' : 'text-text'}`}>
          {isBloqueado
            ? 'Horario bloqueado'
            : isLibre ? 'Horario libre' : appointment.patientName}
        </div>
        <div className="text-[12px] text-text-muted mt-[3px] flex items-center gap-2.5 flex-wrap">
          {appointment.doctorLabel && (
            <span className="inline-block text-[11px] font-medium px-2 py-[2px] rounded-full bg-primary-light text-primary">
              {appointment.doctorLabel}
            </span>
          )}
          {displayLocationName && !isLibre && !isBloqueado && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-hint" style={{ fontFamily: 'var(--font-mono)' }}>
              <Icon name="building" size={10} /> {displayLocationName}
            </span>
          )}
          {!isLibre && !isBloqueado && appointment.detail && <span>{appointment.detail}</span>}
          <span className={`inline-block text-[11px] font-medium px-[9px] py-[2px] rounded-full ${badgeStyles[appointment.status]}`}>
            {badgeLabel[appointment.status]}
          </span>
        </div>
      </div>

      {/* Actions
          Layout intent: the primary CTA ("Avisar por WhatsApp" for
          pendiente, "Cancelar" otherwise) sits always at the right
          edge of the card so cards line up cleanly across the list,
          regardless of whether secondary actions are visible.
          Secondary actions (e.g. Cancelar on a pendiente turno) appear
          to the LEFT of the primary, hover-gated on desktop and
          always visible on touch. */}
      <div className="flex gap-1.5 shrink-0 items-center">
        {isPast && (appointment.status === 'confirmado' || appointment.status === 'pendiente') ? (
          <span className="inline-block text-[11px] font-medium px-[9px] py-[2px] rounded-full bg-surface-2 text-text-hint" style={{ fontFamily: 'var(--font-mono)' }}>
            Turno pasado
          </span>
        ) : (
          <>
            {/* Secondary actions — left of primary, hover-gated */}
            <span
              className={`flex gap-1.5 shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} max-lg:opacity-100`}
            >
              {appointment.status === 'pendiente' && (
                <Btn size="sm" onClick={(e) => { e.stopPropagation(); onCancel(appointment.id) }}>Cancelar</Btn>
              )}
            </span>

            {/* Primary action — always anchored to the right edge */}
            {appointment.status === 'pendiente' && (
              <Btn size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); onRecordar(appointment) }}>
                <Icon name="chat" size={12} /> Avisar por WhatsApp
              </Btn>
            )}
            {appointment.status === 'confirmado' && (
              <Btn size="sm" onClick={(e) => { e.stopPropagation(); onCancel(appointment.id) }}>Cancelar</Btn>
            )}
            {appointment.status === 'cancelado' && onReasignar && (
              <Btn size="sm" onClick={(e) => { e.stopPropagation(); onReasignar(appointment) }}>
                <Icon name="plus" size={12} /> Reasignar
              </Btn>
            )}
            {appointment.status === 'libre' && !isPast && (
              <Btn size="sm" onClick={(e) => e.stopPropagation()}>Bloquear</Btn>
            )}
          </>
        )}
      </div>
    </div>
  )
}
