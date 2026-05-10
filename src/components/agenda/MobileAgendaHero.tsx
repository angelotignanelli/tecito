import type { Appointment } from '../../data/appointments'
import Icon from '../Icon'

interface Props {
  /** Appointments for the SELECTED day (pre-filtered by App). */
  appointments: Appointment[]
  selectedDate: string
  doctorFirstName?: string
  /** "Avisar por WhatsApp" handler — opens RemindersModal for that turno. */
  onRecordar: (a: Appointment) => void
  /** Open the appointment detail. */
  onSelect: (a: Appointment) => void
}

const LONG_DAYS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
]
const LONG_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function greetingForHour(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function eyebrowDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return `${LONG_DAYS[d.getDay()]} ${d.getDate()} ${LONG_MONTHS[d.getMonth()]}`
}

function isTodayISO(iso: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  return iso === today
}

function minutesUntil(timeHHMM: string, dateISO: string): number | null {
  const [h, m] = timeHHMM.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const target = new Date(dateISO + 'T00:00:00')
  target.setHours(h, m, 0, 0)
  const diffMs = target.getTime() - Date.now()
  return Math.round(diffMs / 60_000)
}

function humanizeWait(mins: number): string {
  if (mins < 0) return 'ahora'
  if (mins < 60) return `en ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `en ${hours} h`
  return `en ${Math.round(hours / 24)} días`
}

/**
 * Mobile-only agenda hero. Sits above the existing week strip on small
 * screens and consolidates the at-a-glance view that the desktop's
 * right rail provides:
 * - Time-of-day greeting + day eyebrow
 * - Big "Próximo turno" card (next non-cancelled appointment whose
 *   start is still ahead) with one-tap "Avisar por WhatsApp"
 * - 4-tile stats strip (Total / Confirmados / Pendientes / Cancelados)
 *
 * Hidden on lg+ via the `lg:hidden` wrapper at the call site.
 */
export default function MobileAgendaHero({
  appointments,
  selectedDate,
  doctorFirstName,
  onRecordar,
  onSelect,
}: Props) {
  const total = appointments.length
  const confirmados = appointments.filter((a) => a.status === 'confirmado').length
  const pendientes = appointments.filter((a) => a.status === 'pendiente').length
  const cancelados = appointments.filter((a) => a.status === 'cancelado').length

  // The "next" turno: first non-cancelled with start time in the future.
  // Only meaningful if the selected day is today — otherwise just pick
  // the earliest non-cancelled turno of the day.
  const today = isTodayISO(selectedDate)
  const candidates = appointments
    .filter((a) => a.status === 'confirmado' || a.status === 'pendiente')
    .sort((a, b) => a.time.localeCompare(b.time))
  const next = today
    ? candidates.find((a) => {
        const m = minutesUntil(a.time, a.date)
        return m === null || m >= -10 // include within last 10 min as "in progress"
      })
    : candidates[0]

  const indexOfNext = next
    ? appointments.findIndex((a) => a.id === next.id) + 1
    : null

  const minsAway = next ? minutesUntil(next.time, next.date) : null
  const eyebrow = next
    ? today
      ? minsAway === null
        ? 'Próximo'
        : `Próximo · ${humanizeWait(minsAway)}`
      : `Próximo turno`
    : null

  return (
    <div className="lg:hidden">
      {/* Greeting */}
      <div className="px-1 pb-4">
        <div
          className="text-[10px] text-text-hint uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {eyebrowDate(selectedDate)}
        </div>
        <h1
          className="text-[28px] font-normal leading-[1.05] tracking-[-0.025em] mt-1.5 text-text"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {greetingForHour()}
          {doctorFirstName && (
            <>
              ,{' '}
              <span className="italic" style={{ color: 'var(--color-primary)' }}>
                {doctorFirstName}
              </span>
            </>
          )}
          .
        </h1>
        <div className="text-[13px] text-text-muted mt-2 leading-[1.5]">
          {total === 0 ? (
            <>Sin turnos hoy.</>
          ) : (
            <>
              Tenés {total} {total === 1 ? 'turno' : 'turnos'}
              {today ? ' hoy' : ''}.{' '}
              {pendientes > 0 && (
                <>
                  <span className="font-medium" style={{ color: 'var(--color-amber)' }}>
                    {pendientes} sin avisar
                  </span>
                  .
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Próximo turno hero card */}
      {next && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => onSelect(next)}
            className="w-full text-left rounded-[16px] p-5 cursor-pointer"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              boxShadow: '0 8px 24px rgba(59,74,56,0.18)',
            }}
          >
            <div className="flex items-center justify-between mb-3.5">
              <div
                className="text-[10px] uppercase tracking-[0.1em] flex items-center gap-1.5 opacity-75"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--color-teal-light)' }}
                />
                {eyebrow}
              </div>
              {indexOfNext != null && (
                <div className="text-[11px] opacity-75">
                  {indexOfNext} / {total}
                </div>
              )}
            </div>
            <div className="flex items-start gap-3.5">
              <div
                className="text-[34px] leading-none tracking-[-0.04em]"
                style={{ fontFamily: 'var(--font-serif)', fontVariantNumeric: 'tabular-nums' }}
              >
                {next.time}
              </div>
              <div className="flex-1 pt-1 min-w-0">
                <div className="text-[15px] font-medium leading-[1.2] truncate">
                  {next.patientName ?? 'Sin paciente'}
                </div>
                <div className="text-[11px] opacity-75 mt-1 truncate">
                  {next.detail || 'Consulta'} · {next.duration}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRecordar(next)
                }}
                className="flex-1 py-2.5 rounded-[10px] text-[12px] font-medium cursor-pointer flex items-center justify-center gap-1.5"
                style={{ background: 'var(--color-surface)', color: 'var(--color-primary)' }}
              >
                <Icon name="chat" size={13} /> Avisar por WhatsApp
              </button>
            </div>
          </button>
        </div>
      )}

      {/* Stats strip — 4 tiles */}
      {total > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {[
            { label: 'Total', value: total, dot: 'var(--color-text-hint)' },
            { label: 'Confirm.', value: confirmados, dot: 'var(--color-teal)' },
            { label: 'Pendientes', value: pendientes, dot: 'var(--color-amber)' },
            { label: 'Cancel.', value: cancelados, dot: 'var(--color-coral)' },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-surface border border-gray-border rounded-[12px] py-2.5 px-2 text-center"
            >
              <div
                className="text-[20px] leading-none tracking-[-0.02em] text-text"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {s.value}
              </div>
              <div
                className="text-[9px] text-text-hint mt-1.5 uppercase tracking-[0.1em] flex items-center justify-center gap-1"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <span
                  className="inline-block w-1 h-1 rounded-full"
                  style={{ background: s.dot }}
                />
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
