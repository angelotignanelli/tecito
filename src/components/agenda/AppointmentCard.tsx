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

  // Public-booking turnos are tagged with a sentinel detail string by
  // src/lib/publicBooking.ts. The patient already filled in their phone +
  // confirmed at the moment of booking, so the doctor doesn't need to
  // "avisar" them — they're already aware. Visually we render these
  // differently and demote the WhatsApp action from primary "Avisar"
  // (urgent, first contact) to secondary "Recordar" (24h-before nudge).
  const isPublicBooked =
    appointment.detail === 'Turno solicitado desde la página pública'

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

  // Build the action elements once. We render them either in a
  // right-aligned cluster (desktop) or as a full second row below the
  // info (mobile). Without the split, "Avisar por WhatsApp" plus
  // "Cancelar" plus the status chip overflow on a 360px viewport and
  // the flex-wrap fallback produces a jagged layout.
  const showPastBadge =
    isPast && (appointment.status === 'confirmado' || appointment.status === 'pendiente')

  const actions = showPastBadge ? (
    <span
      className="inline-block text-[11px] font-medium px-[9px] py-[2px] rounded-full bg-surface-2 text-text-hint"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      Turno pasado
    </span>
  ) : (
    <>
      {appointment.status === 'pendiente' && isPublicBooked && (
        <Btn size="sm" onClick={(e) => { e.stopPropagation(); onRecordar(appointment) }}>
          <Icon name="chat" size={12} /> Recordar
        </Btn>
      )}
      {appointment.status === 'pendiente' && (
        <Btn size="sm" onClick={(e) => { e.stopPropagation(); onCancel(appointment.id) }}>
          Cancelar
        </Btn>
      )}
      {appointment.status === 'pendiente' && !isPublicBooked && (
        <Btn size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); onRecordar(appointment) }}>
          {/* Shorten the label on mobile so the pendiente row fits in
              one line of action buttons — full prose returns at sm+ */}
          <Icon name="chat" size={12} />
          <span className="sm:hidden">WhatsApp</span>
          <span className="hidden sm:inline">Avisar por WhatsApp</span>
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
  )

  // Show the action cluster only when there's actually something
  // actionable. Otherwise the empty row eats vertical space on mobile.
  const hasActions =
    showPastBadge ||
    appointment.status === 'pendiente' ||
    appointment.status === 'confirmado' ||
    (appointment.status === 'cancelado' && !!onReasignar) ||
    (appointment.status === 'libre' && !isPast)

  return (
    <div
      onClick={() => onSelect(appointment)}
      className={`group border rounded-[12px] px-4 sm:px-[18px] py-[14px] mb-2 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary-mid bg-primary-light'
          : isBloqueado
            ? 'border-gray-border bg-surface-2'
            : 'border-gray-border bg-surface hover:border-gray-border-2'
      }`}
    >
      {/* Top (mobile) / Left (desktop) — Time + status line + info */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:flex-1">
        {/* Time */}
        <div className="min-w-[56px] text-center shrink-0">
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

        {/* Status line — desktop only; on mobile the status chip below
            the name carries the same visual cue without taking width */}
        <div className={`w-[2px] h-9 rounded-[1px] shrink-0 hidden sm:block ${statusLineColor[appointment.status]}`} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className={`text-[14px] font-medium ${isInactive ? 'text-text-hint font-normal' : 'text-text'}`}>
            {isBloqueado
              ? 'Horario bloqueado'
              : isLibre ? 'Horario libre' : appointment.patientName}
          </div>
          <div className="text-[12px] text-text-muted mt-[3px] flex items-center gap-2 flex-wrap">
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
            {!isLibre && !isBloqueado && appointment.detail && !isPublicBooked && (
              <span className="truncate">{appointment.detail}</span>
            )}
            {/* Status chip. Suppressed for past turnos: the "Turno
                pasado" badge in the actions cluster already conveys
                the state, and showing "Sin confirmar" / "Confirmado"
                next to it is misleading — the doctor can't act on
                either anymore. Public-booking turnos still use the
                teal "Reservado online" pill when current. */}
            {!showPastBadge && (
              isPublicBooked && appointment.status === 'pendiente' ? (
                <span className="inline-block text-[11px] font-medium px-[9px] py-[2px] rounded-full bg-teal-light text-teal">
                  Reservado online
                </span>
              ) : (
                <span className={`inline-block text-[11px] font-medium px-[9px] py-[2px] rounded-full ${badgeStyles[appointment.status]}`}>
                  {badgeLabel[appointment.status]}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Bottom (mobile) / Right (desktop) — Actions
          On mobile the row sits below the info on its own line,
          right-aligned, so wide buttons never collide with the chip
          row. On desktop the cluster anchors to the right edge as
          before. Hover-gating on desktop, always-visible on touch. */}
      {hasActions && (
        <div
          className={`flex gap-1.5 items-center w-full sm:w-auto justify-end shrink-0 sm:transition-opacity ${
            isSelected ? 'sm:opacity-100' : 'sm:opacity-0 sm:group-hover:opacity-100'
          }`}
        >
          {actions}
        </div>
      )}
    </div>
  )
}
