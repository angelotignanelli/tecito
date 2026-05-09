import { useState } from 'react'
import type { Appointment } from '../../data/appointments'
import { getPublicBaseUrl } from '../../lib/publicUrl'
import Icon from '../Icon'
import Btn from '../Btn'

interface Props {
  appointment: Appointment | null
  dayAppointments: Appointment[]
  dayLabel: string
  selectedDate?: string
  isBlocked?: boolean
  blockReason?: string
  onUnblock?: () => void
  onBlockHours?: (date: string, from: string, to: string) => void
  onRecordarTodos?: () => void
  onScheduleAppointment?: (appointment: Appointment) => void
  /** Doctor's public booking code — drives the "Tu link de turnos" card
   * surfaced in the day overview so the link is one glance away from
   * the agenda instead of buried in Mi perfil. */
  bookingCode?: string | null
  /** Doctor's first name (for pre-filling the WhatsApp share text). */
  doctorFirstName?: string
}

export default function PatientPanel({ appointment, dayAppointments, dayLabel, selectedDate, isBlocked, blockReason, onUnblock, onBlockHours, onRecordarTodos, onScheduleAppointment, bookingCode, doctorFirstName }: Props) {
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [blockFrom, setBlockFrom] = useState('09:00')
  const [blockTo, setBlockTo] = useState('13:00')

  // Selected turno: show patient detail
  if (appointment) {
    if (appointment.status === 'libre') {
      return (
        <Panel>
          <div className="p-6">
            <Eyebrow>Horario libre</Eyebrow>
            <p className="text-[13px] text-text-muted mt-3 leading-[1.55]">
              Este horario está disponible para reservas desde el bot de WhatsApp.
            </p>
            <Btn className="mt-4 w-full justify-center" style={{ width: '100%' }}>
              <Icon name="block" size={13} /> Bloquear horario
            </Btn>
          </div>
        </Panel>
      )
    }

    const patient = appointment.patient || {
      name: appointment.patientName || 'Sin datos',
      phone: '',
      email: '',
      age: '',
      since: '',
      insurance: 'Particular',
      lastVisit: '',
      totalSessions: 0,
      tags: [] as string[],
      history: [] as { date: string; text: string }[],
    }

    return (
      <Panel>
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Patient header */}
          <div className="flex items-center gap-3.5 mb-5">
            <div
              className="w-[52px] h-[52px] rounded-full bg-primary-light text-primary grid place-items-center text-[18px] shrink-0"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div
                className="text-[20px] tracking-[-0.02em] leading-[1.15] text-text"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {patient.name}
              </div>
              <div className="text-[11px] text-text-hint mt-[3px]" style={{ fontFamily: 'var(--font-mono)' }}>
                {patient.age || '—'} {patient.since && `· desde ${patient.since}`}
              </div>
            </div>
          </div>

          {/* Info pills */}
          <div className="grid grid-cols-2 gap-2 mb-[18px]">
            <InfoPill label="Obra social" value={patient.insurance || '—'} />
            <InfoPill label="Sesiones" value={String(patient.totalSessions ?? 0)} />
          </div>

          {/* Next appointment */}
          <div className="p-[14px] bg-primary-light rounded-[10px] mb-[18px]">
            <div
              className="text-[10px] text-primary font-semibold uppercase tracking-[0.12em]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Turno actual
            </div>
            <div
              className="text-[18px] mt-1 tracking-[-0.015em] text-text"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {appointment.time} · {appointment.duration}
            </div>
            {appointment.detail && (
              <div className="text-[12px] text-text-muted mt-1">{appointment.detail}</div>
            )}
          </div>

          {/* Contact */}
          {(patient.phone || patient.email) && (
            <div className="mb-[18px]">
              <Eyebrow style={{ marginBottom: 8 }}>Contacto</Eyebrow>
              <div className="text-[12px] text-text-muted leading-[1.7]">
                {patient.phone && (
                  <div className="flex items-center gap-2">
                    <Icon name="phone" size={12} style={{ color: 'var(--color-text-hint)' }} />
                    {patient.phone}
                  </div>
                )}
                {patient.email && (
                  <div className="flex items-center gap-2">
                    <Icon name="email" size={12} style={{ color: 'var(--color-text-hint)' }} />
                    {patient.email}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {(patient.tags || []).length > 0 && (
            <div className="mb-[18px]">
              <Eyebrow style={{ marginBottom: 8 }}>Etiquetas</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {(patient.tags || []).map((tag) => (
                  <span key={tag} className="inline-block text-[11px] px-[9px] py-[2px] rounded-full bg-primary-light text-primary font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>
              Historial · {patient.history?.length ?? 0}
            </Eyebrow>
            {(!patient.history || patient.history.length === 0) ? (
              <div className="text-xs text-text-hint">Sin historial previo</div>
            ) : (
              patient.history.map((h, i) => (
                <div
                  key={i}
                  className={`py-[10px] ${i > 0 ? 'border-t border-gray-border' : ''}`}
                >
                  <div className="text-[10px] text-text-hint" style={{ fontFamily: 'var(--font-mono)' }}>
                    {h.date}
                  </div>
                  <div className="text-[12px] text-text-muted mt-1 leading-[1.55]">{h.text}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-border flex flex-col gap-2 shrink-0">
          {onScheduleAppointment && (
            <Btn
              variant="primary"
              onClick={() => onScheduleAppointment(appointment)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Icon name="plus" size={13} /> Agendar turno
            </Btn>
          )}
          <Btn style={{ width: '100%', justifyContent: 'center' }}>
            <Icon name="chat" size={13} /> Abrir WhatsApp
          </Btn>
        </div>
      </Panel>
    )
  }

  // No turno selected: day summary
  const total = dayAppointments.length
  const withPatient = dayAppointments.filter((a) => a.status !== 'libre')
  const pacientes = new Set(withPatient.map((a) => a.patientName).filter(Boolean)).size
  const confirmados = dayAppointments.filter((a) => a.status === 'confirmado').length
  const pendientes = dayAppointments.filter((a) => a.status === 'pendiente').length
  const cancelados = dayAppointments.filter((a) => a.status === 'cancelado').length
  const libres = dayAppointments.filter((a) => a.status === 'libre').length

  const sorted = [...dayAppointments].sort((a, b) => a.time.localeCompare(b.time))
  const firstTime = sorted[0]?.time ?? '—'
  const lastAppt = sorted[sorted.length - 1]

  let endTime = '—'
  if (lastAppt) {
    const [h, m] = lastAppt.time.split(':').map(Number)
    const durMin = parseInt(lastAppt.duration) || 50
    const endDate = new Date(2026, 0, 1, h, m + durMin)
    endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
  }

  const ocupacion = total > 0 ? Math.round(((total - libres) / total) * 100) : 0

  return (
    <Panel>
      <div className="p-6 flex-1 overflow-y-auto">
        <Eyebrow>Resumen del día</Eyebrow>
        <div
          className="text-[22px] mt-1 mb-5 tracking-[-0.02em] text-text capitalize"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {dayLabel}
        </div>

        {isBlocked && (
          <div className="flex items-center gap-2.5 bg-coral-light rounded-[10px] px-3.5 py-3 mb-4">
            <Icon name="block" size={14} style={{ color: 'var(--color-coral)' }} />
            <div>
              <div className="text-xs font-medium text-coral">{blockReason ?? 'Bloqueado'}</div>
              <div className="text-[10px] text-coral opacity-75">No se aceptan turnos</div>
            </div>
          </div>
        )}

        {total === 0 && !isBlocked ? (
          <p className="text-[13px] text-text-hint">No hay turnos agendados para este día.</p>
        ) : total === 0 && isBlocked ? (
          <p className="text-[13px] text-text-hint">Día sin turnos — bloqueado.</p>
        ) : (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <StatCard label="Pacientes" value={String(pacientes)} />
              <StatCard label="Turnos" value={String(total)} />
              <StatCard label="Inicio" value={firstTime} />
              <StatCard label="Fin" value={endTime} />
            </div>

            {/* Status breakdown */}
            <div className="mb-5">
              <Eyebrow style={{ marginBottom: 10 }}>Estado de turnos</Eyebrow>
              <div className="space-y-2">
                {confirmados > 0 && <StatusRow color="bg-teal" label="Confirmados" count={confirmados} />}
                {pendientes > 0 && <StatusRow color="bg-amber" label="Pendientes" count={pendientes} />}
                {cancelados > 0 && <StatusRow color="bg-coral" label="Cancelados" count={cancelados} />}
                {libres > 0 && <StatusRow color="bg-text-dim" label="Libres" count={libres} />}
              </div>
            </div>

            {/* Occupancy */}
            <div className="mb-5">
              <Eyebrow style={{ marginBottom: 10 }}>Ocupación</Eyebrow>
              <div className="w-full bg-surface-2 rounded-full h-1.5 mb-2 border border-gray-border">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${ocupacion}%` }}
                />
              </div>
              <div className="text-[11px] text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                {ocupacion}% asignados
              </div>
            </div>

            {/* Patients list */}
            <div>
              <Eyebrow style={{ marginBottom: 10 }}>Pacientes del día</Eyebrow>
              {Array.from(new Set(withPatient.map((a) => a.patientName))).filter(Boolean).map((name, i, arr) => {
                const apt = withPatient.find((a) => a.patientName === name)!
                return (
                  <div
                    key={name}
                    className={`flex items-center gap-2.5 py-2 ${i < arr.length - 1 ? 'border-b border-gray-border' : ''}`}
                  >
                    <div
                      className="w-7 h-7 rounded-full bg-primary-light grid place-items-center text-[10px] text-primary shrink-0"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      {name!.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate text-text">{name}</div>
                    </div>
                    <div className="text-[11px] text-text-hint" style={{ fontFamily: 'var(--font-mono)' }}>
                      {apt.time}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Booking link — always visible on the day overview so the
            doctor doesn't have to dig into Mi perfil to grab and share
            it. The most-used affordance is "compartir por WhatsApp". */}
        {bookingCode && (
          <BookingLinkCard bookingCode={bookingCode} doctorFirstName={doctorFirstName} />
        )}
      </div>

      {/* Footer actions */}
      {isBlocked ? (
        <div className="p-4 border-t border-gray-border shrink-0">
          <Btn variant="danger" onClick={onUnblock} style={{ width: '100%', justifyContent: 'center' }}>
            Desbloquear este período
          </Btn>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-border shrink-0 flex flex-col gap-2">
          {total > 0 && onRecordarTodos && (
            <Btn
              variant="primary"
              onClick={onRecordarTodos}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Icon name="chat" size={13} /> Recordar a todos
            </Btn>
          )}

          {showBlockForm ? (
            <BlockHoursForm
              dayAppointments={dayAppointments}
              blockFrom={blockFrom}
              blockTo={blockTo}
              showConfirm={showBlockConfirm}
              onChangeFrom={(v) => { setBlockFrom(v); setShowBlockConfirm(false) }}
              onChangeTo={(v) => { setBlockTo(v); setShowBlockConfirm(false) }}
              onContinue={() => setShowBlockConfirm(true)}
              onBlockHours={() => { if (selectedDate && onBlockHours) onBlockHours(selectedDate, blockFrom, blockTo) }}
              onBack={() => setShowBlockConfirm(false)}
              onConfirm={() => { setShowBlockForm(false); setShowBlockConfirm(false) }}
              onCancel={() => { setShowBlockForm(false); setShowBlockConfirm(false) }}
            />
          ) : (
            <Btn onClick={() => setShowBlockForm(true)} style={{ width: '100%', justifyContent: 'center' }}>
              <Icon name="block" size={13} /> Bloquear horario/s
            </Btn>
          )}
        </div>
      )}
    </Panel>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden lg:flex w-[340px] bg-surface border-l border-gray-border flex-col shrink-0 h-full">
      {children}
    </div>
  )
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="text-[10px] text-text-hint uppercase tracking-[0.12em]"
      style={{ fontFamily: 'var(--font-mono)', ...style }}
    >
      {children}
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 bg-surface-2 border border-gray-border rounded-[10px]">
      <Eyebrow>{label}</Eyebrow>
      <div
        className="text-[15px] mt-[3px] text-text tracking-[-0.01em]"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {value}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 border border-gray-border rounded-[10px] px-3 py-2.5 text-center">
      <div
        className="text-[20px] leading-none tracking-[-0.015em] text-text"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {value}
      </div>
      <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mt-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
    </div>
  )
}

function StatusRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px]">
      <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <span className="text-text-muted flex-1">{label}</span>
      <span className="text-text" style={{ fontFamily: 'var(--font-mono)' }}>{count}</span>
    </div>
  )
}

function BlockHoursForm({ dayAppointments, blockFrom, blockTo, showConfirm, onChangeFrom, onChangeTo, onContinue, onBack, onConfirm, onCancel, onBlockHours }: {
  dayAppointments: Appointment[]
  blockFrom: string
  blockTo: string
  showConfirm: boolean
  onChangeFrom: (v: string) => void
  onChangeTo: (v: string) => void
  onContinue: () => void
  onBack: () => void
  onConfirm: () => void
  onCancel: () => void
  onBlockHours: () => void
}) {
  const affectedAppts = dayAppointments.filter(
    (a) => a.status !== 'libre' && a.status !== 'bloqueado' && a.time >= blockFrom && a.time < blockTo
  )
  const affectedNames = Array.from(new Set(affectedAppts.map((a) => a.patientName).filter(Boolean)))
  const validRange = blockTo > blockFrom

  if (showConfirm && validRange) {
    return (
      <div className="bg-amber-light rounded-[10px] p-3.5">
        <div className="text-[11px] text-amber font-semibold mb-2">Confirmar bloqueo</div>
        <div className="text-xs text-amber mb-1">
          Bloquear de <strong>{blockFrom}</strong> a <strong>{blockTo}</strong>
        </div>
        {affectedNames.length > 0 ? (
          <>
            <div className="text-xs text-coral font-medium mb-1.5 mt-2">
              {affectedNames.length} paciente{affectedNames.length !== 1 ? 's' : ''} afectado{affectedNames.length !== 1 ? 's' : ''}:
            </div>
            <div className="space-y-1 mb-2.5">
              {affectedAppts.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5 text-[11px]">
                  <div
                    className="w-4 h-4 rounded-full bg-coral-light text-coral grid place-items-center text-[8px] shrink-0"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {a.patientName!.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="text-text">{a.patientName}</span>
                  <span className="text-text-hint ml-auto" style={{ fontFamily: 'var(--font-mono)' }}>{a.time}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-coral opacity-80 mb-2">
              Se cancelarán estos turnos y se notificará a los pacientes.
            </div>
          </>
        ) : (
          <div className="text-xs text-teal mb-2.5 mt-2">No hay pacientes afectados.</div>
        )}
        <div className="flex gap-2">
          <Btn
            size="sm"
            variant="primary"
            onClick={() => { onBlockHours(); onConfirm() }}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {affectedNames.length > 0 ? 'Bloquear y notificar' : 'Bloquear'}
          </Btn>
          <Btn size="sm" onClick={onBack}>Volver</Btn>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-2 border border-gray-border rounded-[10px] p-3.5">
      <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
        Bloquear horario/s
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1">
          <label className="text-[10px] text-text-hint mb-0.5 block">Desde</label>
          <input
            type="time"
            value={blockFrom}
            onChange={(e) => onChangeFrom(e.target.value)}
            className="w-full px-2 py-1.5 rounded-[8px] border border-gray-border text-xs bg-surface focus:border-primary-mid"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-text-hint mb-0.5 block">Hasta</label>
          <input
            type="time"
            value={blockTo}
            onChange={(e) => onChangeTo(e.target.value)}
            className="w-full px-2 py-1.5 rounded-[8px] border border-gray-border text-xs bg-surface focus:border-primary-mid"
          />
        </div>
      </div>
      {!validRange && (
        <div className="text-[10px] text-coral mb-2">La hora de fin debe ser posterior a la de inicio</div>
      )}
      <div className="flex gap-2">
        <Btn
          size="sm"
          variant="primary"
          disabled={!validRange}
          onClick={onContinue}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          Continuar
        </Btn>
        <Btn size="sm" onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  )
}


/**
 * Compact "Tu link de turnos" card surfaced on the day overview. The
 * doctor previously had to navigate to Mi perfil to grab the URL — now
 * it sits one glance below the daily stats so they can copy/share
 * during a regular agenda session without context-switching.
 */
function BookingLinkCard({
  bookingCode,
  doctorFirstName,
}: {
  bookingCode: string
  doctorFirstName?: string
}) {
  const url = `${getPublicBaseUrl()}/p/${bookingCode}`
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const intro = doctorFirstName ? `Soy ${doctorFirstName}. ` : ""
  const shareText = encodeURIComponent(
    `Hola! ${intro}Si querés sacar un turno conmigo, podés hacerlo desde acá: ${url}`,
  )

  return (
    <div className="mt-6 pt-5 border-t border-gray-border">
      <Eyebrow>Tu link de turnos</Eyebrow>
      <p className="text-[12px] text-text-muted mt-1.5 mb-3 leading-[1.55]">
        Compartilo con tus pacientes para que reserven solos.
      </p>
      <div className="bg-surface-2 rounded-[10px] px-3 py-2.5 mb-2 flex items-center gap-2">
        <div className="text-[11px] font-mono text-text truncate flex-1" title={url}>
          {url}
        </div>
        <button
          onClick={handleCopy}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer border border-primary bg-primary text-white hover:bg-[#2F3C2D] transition-colors shrink-0"
        >
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${shareText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline cursor-pointer"
      >
        💬 Compartir por WhatsApp
      </a>
    </div>
  )
}
