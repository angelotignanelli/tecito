import { useState, useMemo, useEffect } from 'react'
import type { Patient, Appointment } from '../../data/appointments'
import type { LocationRow } from '../../lib/hooks'
import Btn from '../Btn'
import Icon from '../Icon'

interface Props {
  open: boolean
  onClose: () => void
  patients: Patient[]
  patientRows: { id: string; name: string }[]
  appointments: Appointment[]          // existing appointments to check conflicts
  locations: LocationRow[]             // doctor's consultorios
  defaultDate: string                   // YYYY-MM-DD
  defaultDuration: number               // minutes
  /**
   * If provided, the modal opens pre-filled with this patient and jumps straight
   * to the details step (used for "Reasignar" flow).
   */
  prefilledPatient?: Patient | null
  /** Optional title override for the header (e.g. "Reasignar turno") */
  title?: string
  /**
   * Presentation mode.
   * - `'modal'` (default) → fixed overlay with backdrop, used on desktop.
   * - `'section'` → renders inline as a full-screen view, no overlay,
   *   participates in the app's view routing. Used on mobile so the
   *   flow feels like a real page (back button works, no scrim).
   */
  mode?: 'modal' | 'section'
  onCreateAppointment: (input: {
    patient_id: string | null
    patient_name: string
    location_id: string | null
    date: string
    time: string
    duration: string
    detail: string
    status: 'confirmado' | 'pendiente'
  }) => Promise<unknown>
  onCreatePatient: (name: string, insurance: string) => Promise<{ id: string } | null>
}

export default function NewAppointmentModal({
  open,
  onClose,
  patients,
  patientRows,
  appointments,
  locations,
  defaultDate,
  defaultDuration,
  prefilledPatient,
  title,
  mode = 'modal',
  onCreateAppointment,
  onCreatePatient,
}: Props) {
  const [step, setStep] = useState<'patient' | 'details'>('patient')
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isNewPatient, setIsNewPatient] = useState(false)
  const [newPatientInsurance, setNewPatientInsurance] = useState('Particular')

  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(String(defaultDuration))
  const [detail, setDetail] = useState('')
  const [status, setStatus] = useState<'confirmado' | 'pendiente'>('pendiente')
  const [locationId, setLocationId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const primaryLocation = locations.find((l) => l.is_primary) || locations[0] || null
  const selectedLocation = locations.find((l) => l.id === locationId) || null
  const effectiveLocation = selectedLocation || primaryLocation

  // Reset when modal closes/opens
  useEffect(() => {
    if (open) {
      if (prefilledPatient) {
        setStep('details')
        setSelectedPatient(prefilledPatient)
        setPatientSearch(prefilledPatient.name)
        setIsNewPatient(false)
      } else {
        setStep('patient')
        setPatientSearch('')
        setSelectedPatient(null)
        setIsNewPatient(false)
      }
      setNewPatientInsurance('Particular')
      setDate(defaultDate)
      setTime('')
      setDuration(String(defaultDuration))
      setDetail('')
      setStatus('pendiente')
      setLocationId(primaryLocation?.id ?? null)
      setError(null)
    }
  }, [open, defaultDate, defaultDuration, prefilledPatient, primaryLocation?.id])

  // Generate time slot suggestions every 30 min between the location's work hours
  const slots = useMemo(() => {
    const from = effectiveLocation?.work_from?.slice(0, 5) || '09:00'
    const to = effectiveLocation?.work_to?.slice(0, 5) || '18:00'
    const result: string[] = []
    const [fh, fm] = from.split(':').map(Number)
    const [th, tm] = to.split(':').map(Number)
    let mins = fh * 60 + fm
    const end = th * 60 + tm
    while (mins + 30 <= end) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      result.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      mins += 30
    }
    return result
  }, [effectiveLocation?.work_from, effectiveLocation?.work_to])

  // Check which slots are occupied for the chosen date
  const occupiedSlots = useMemo(() => {
    const set = new Set<string>()
    for (const a of appointments) {
      if (a.date === date && a.status !== 'libre' && a.status !== 'cancelado') {
        set.add(a.time.slice(0, 5))
      }
    }
    return set
  }, [appointments, date])

  // Dedupe by case-insensitive name to avoid showing duplicate entries (legacy data)
  const filteredPatients = patients
    .filter((p) => p.name.toLowerCase().includes(patientSearch.toLowerCase()))
    .filter((p, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase()) === i)

  const canSave = (selectedPatient || (isNewPatient && patientSearch.trim().length >= 2)) && date && time

  const handleSave = async () => {
    setError(null)
    setSaving(true)

    // Hard 20-second cap so the button can't get permanently stuck on
    // "Guardando..." if Supabase / the network hangs without resolving.
    // We wrap each await in `Promise.race` with a timeout.
    const withTimeout = <T,>(p: Promise<T>, ms = 20_000, label = 'op'): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout:${label}`)), ms),
        ),
      ])

    let closedOk = false
    try {
      let patientId: string | null = null
      let patientName = ''

      if (isNewPatient) {
        patientName = patientSearch.trim()
        const created = await withTimeout(
          onCreatePatient(patientName, newPatientInsurance),
          20_000,
          'create-patient',
        )
        if (!created) {
          setError('No se pudo crear el paciente')
          return
        }
        patientId = created.id
      } else if (selectedPatient) {
        patientName = selectedPatient.name
        const row = patientRows.find((r) => r.name === selectedPatient.name)
        patientId = row?.id ?? null
      }

      const err = await withTimeout(
        onCreateAppointment({
          patient_id: patientId,
          patient_name: patientName,
          location_id: locationId ?? primaryLocation?.id ?? null,
          date,
          time,
          duration: `${duration} min`,
          detail,
          status,
        }),
        20_000,
        'create-appointment',
      )

      if (err) {
        // err can be a Supabase PostgrestError — surface its message if it
        // has one, otherwise fall back to a generic line.
        const message = (err as { message?: string })?.message
        setError(message ? `No se pudo crear el turno: ${message}` : 'No se pudo crear el turno')
        return
      }

      closedOk = true
      onClose()
    } catch (e) {
      const isTimeout = (e as Error)?.message?.startsWith('timeout:')
      setError(
        isTimeout
          ? 'La operación tardó demasiado. Revisá tu conexión y volvé a intentar.'
          : 'Error inesperado al guardar.',
      )
      // Surface to console so we can debug from real-user reports.
      console.error('[new-appointment] save failed', e)
    } finally {
      // Guarantee we leave the loading state even on success+unmount or on
      // any thrown path — the previous code only cleared it in some
      // branches and the button could end up permanently in "Guardando…".
      if (!closedOk) setSaving(false)
    }
  }

  if (!open) return null

  // SECTION MODE — full-bleed page. No overlay, no fixed positioning,
  // sits inline in the app's view router. Used on mobile.
  if (mode === 'section') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
        {renderInner()}
      </div>
    )
  }

  // MODAL MODE — fixed overlay + centered card. Used on desktop.
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 sm:bg-black/30 bg-bg"
      onClick={onClose}
    >
      <div
        className="bg-surface sm:rounded-[16px] sm:border sm:border-gray-border sm:shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full sm:max-w-[520px] h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {renderInner()}
      </div>
    </div>
  )

  // Inner content shared by both modes. We hoist it here so the JSX
  // tree can stay flat above and we don't duplicate the 300+ lines of
  // form markup. Defined as a function so it captures all the closure
  // state (step, selectedPatient, etc.) without prop drilling.
  function renderInner() {
    return (
      <>
        {/* Header — back arrow on mobile (acts like a section navigation),
            X on desktop (acts like a modal close). */}
        <div
          className="px-4 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-gray-border flex items-center gap-3 shrink-0"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <button
            onClick={() => {
              if (step === 'details' && !prefilledPatient) {
                // On mobile the back arrow first walks back to the patient
                // step; tap it again on step 1 to close.
                setStep('patient')
              } else {
                onClose()
              }
            }}
            className="sm:hidden w-9 h-9 -ml-1 rounded-full grid place-items-center cursor-pointer text-text active:bg-surface-2"
            aria-label="Volver"
          >
            <Icon name="chevL" size={16} stroke={2} />
          </button>
          <div className="flex-1 min-w-0">
            <h2
              className="text-[20px] sm:text-[24px] leading-none tracking-[-0.02em] text-text m-0 truncate"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {title ?? 'Nuevo turno'}.
            </h2>
            {!prefilledPatient && (
              <div className="text-[10px] sm:text-[11px] text-text-hint mt-1.5 uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--font-mono)' }}>
                Paso {step === 'patient' ? '1' : '2'} de 2
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="hidden sm:grid w-8 h-8 rounded-full hover:bg-surface-2 place-items-center cursor-pointer text-text-hint"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 scrollbar-hide">
          {step === 'patient' && (
            <>
              <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                Paciente
              </label>
              <div className="relative mb-3">
                <Icon
                  name="search"
                  size={14}
                  style={{ position: 'absolute', left: 12, top: 13, color: 'var(--color-text-hint)' }}
                />
                <input
                  type="text"
                  // No autoFocus on purpose: on mobile this is a full
                  // section view, and auto-popping the keyboard on
                  // mount pushes the existing-patient list off-screen
                  // and disorients the user. They tap the field when
                  // they actually want to type.
                  placeholder="Buscar paciente o escribir un nombre nuevo…"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value)
                    setSelectedPatient(null)
                    setIsNewPatient(false)
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-gray-border bg-surface-2 text-[13px] text-text focus:border-primary-mid"
                />
              </div>

              {/* Existing patient list */}
              <div className="overflow-y-auto scrollbar-hide flex flex-col gap-1 sm:max-h-[240px]">
                {filteredPatients.slice(0, 12).map((p) => {
                  const active = selectedPatient?.name === p.name
                  return (
                    <button
                      key={p.name}
                      onClick={() => {
                        setSelectedPatient(p)
                        setIsNewPatient(false)
                        // Auto-advance to step 2 on tap. Without this, on
                        // mobile the soft keyboard from the search input
                        // hides the "Continuar" button in the footer and
                        // the user feels stuck. Tapping a patient is a
                        // strong intent signal — no need to confirm.
                        // Blur the search first so the keyboard dismisses
                        // before the next step renders.
                        ;(document.activeElement as HTMLElement | null)?.blur?.()
                        setStep('details')
                      }}
                      className={`text-left flex items-center gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer transition-colors ${
                        active
                          ? 'border-primary-mid bg-primary-light'
                          : 'border-gray-border bg-surface hover:bg-surface-2'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full bg-primary-light grid place-items-center text-[12px] text-primary shrink-0"
                        style={{ fontFamily: 'var(--font-serif)' }}
                      >
                        {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text truncate">{p.name}</div>
                        <div className="text-[11px] text-text-hint truncate">
                          {p.insurance} {p.age && `· ${p.age}`}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* New patient option — always available when the user has
                  typed a name, even if there are matches. Two patients can
                  share a name (homonimia / same first name etc.) and the
                  doctor needs to be able to register the new one without
                  being forced into the existing record. */}
              {patientSearch.trim().length >= 2 && (
                <button
                  onClick={() => {
                    setIsNewPatient(true)
                    setSelectedPatient(null)
                  }}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer transition-colors mt-2 ${
                    isNewPatient
                      ? 'border-primary-mid bg-primary-light'
                      : 'border-dashed border-gray-border-2 bg-surface-2 hover:border-primary-mid'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full bg-teal-light grid place-items-center text-teal shrink-0"
                  >
                    <Icon name="plus" size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-text">
                      {filteredPatients.length > 0 ? 'Crear paciente nuevo con este nombre' : 'Crear paciente nuevo'}
                    </div>
                    <div className="text-[11px] text-text-hint truncate">«{patientSearch.trim()}»</div>
                  </div>
                </button>
              )}

              {isNewPatient && (
                <div className="mt-4 bg-surface-2 border border-gray-border rounded-[12px] p-3.5">
                  <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                    Obra social
                  </label>
                  <select
                    value={newPatientInsurance}
                    onChange={(e) => setNewPatientInsurance(e.target.value)}
                    className="w-full px-3 h-[42px] rounded-[10px] border border-gray-border bg-surface text-[14px] text-text focus:border-primary-mid focus:outline-none"
                  >
                    <option>Particular</option>
                    <option>OSDE</option>
                    <option>Swiss Medical</option>
                    <option>Galeno</option>
                    <option>Medicus</option>
                    <option>PAMI</option>
                    <option>Otra</option>
                  </select>
                  {/* Inline advance CTA so the user can reach step 2 without
                      hunting for the footer button (keyboard / safe-area
                      can hide it on mobile). */}
                  <button
                    type="button"
                    onClick={() => {
                      ;(document.activeElement as HTMLElement | null)?.blur?.()
                      setStep('details')
                    }}
                    disabled={patientSearch.trim().length < 2}
                    className="mt-3 w-full px-4 py-3 rounded-[10px] bg-primary text-surface text-[14px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Continuar →
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'details' && (
            <>
              {/* Selected patient card */}
              {(() => {
                const displayName = selectedPatient?.name ?? (isNewPatient ? patientSearch.trim() : '')
                const displayInsurance = selectedPatient?.insurance ?? (isNewPatient ? newPatientInsurance : '')
                const displayAge = selectedPatient?.age ?? ''
                const isNewBadge = isNewPatient && !selectedPatient
                if (!displayName) return null
                return (
                  <div className="mb-5">
                    <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                      Paciente
                    </label>
                    <button
                      type="button"
                      onClick={() => { if (!prefilledPatient) setStep('patient') }}
                      disabled={!!prefilledPatient}
                      className={`w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-[12px] border border-gray-border bg-surface-2 transition-colors ${
                        prefilledPatient ? 'cursor-default' : 'cursor-pointer hover:border-primary-mid hover:bg-surface'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-full bg-primary-light grid place-items-center text-[13px] text-primary shrink-0"
                        style={{ fontFamily: 'var(--font-serif)' }}
                      >
                        {displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-text truncate flex items-center gap-2">
                          {displayName}
                          {isNewBadge && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-[1px] rounded-full bg-teal-light text-teal" style={{ fontFamily: 'var(--font-sans)' }}>
                              Nuevo
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-hint truncate mt-0.5">
                          {displayInsurance}{displayAge && ` · ${displayAge}`}
                        </div>
                      </div>
                      {!prefilledPatient && (
                        <span className="text-[11px] text-primary font-medium shrink-0" style={{ fontFamily: 'var(--font-sans)' }}>
                          Cambiar
                        </span>
                      )}
                    </button>
                  </div>
                )
              })()}

              {/* Location — only if the doctor has more than one */}
              {locations.length > 1 && (
                <div className="mb-4">
                  <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                    Consultorio
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {locations.map((loc) => {
                      const active = (locationId || primaryLocation?.id) === loc.id
                      return (
                        <button
                          type="button"
                          key={loc.id}
                          onClick={() => { setLocationId(loc.id); setTime('') }}
                          className={`px-3 py-1.5 rounded-full text-[12px] border cursor-pointer transition-colors ${
                            active
                              ? 'bg-primary-light border-primary-mid text-primary font-medium'
                              : 'bg-surface border-gray-border text-text-muted hover:bg-surface-2'
                          }`}
                        >
                          {loc.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Date */}
              <div className="mb-4">
                <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setTime('') }}
                  className="w-full px-3 py-2.5 rounded-[10px] border border-gray-border bg-surface-2 text-[13px] text-text focus:border-primary-mid"
                />
              </div>

              {/* Time slots */}
              <div className="mb-4">
                <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  Hora
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {slots.map((slot) => {
                    const occupied = occupiedSlots.has(slot)
                    const active = time === slot
                    return (
                      <button
                        key={slot}
                        disabled={occupied}
                        onClick={() => setTime(slot)}
                        className={`px-1 py-1.5 rounded-[8px] text-[12px] transition-colors cursor-pointer ${
                          active
                            ? 'bg-primary text-surface border border-primary'
                            : occupied
                              ? 'bg-surface-2 text-text-dim border border-gray-border line-through cursor-not-allowed'
                              : 'bg-surface text-text border border-gray-border hover:bg-surface-2'
                        }`}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
                {slots.length === 0 && (
                  <div className="text-[12px] text-text-hint">
                    No hay horarios configurados. Ajustá tu horario de atención en el perfil.
                  </div>
                )}
              </div>

              {/* Duration */}
              <div className="mb-4">
                <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  Duración
                </label>
                <div className="flex gap-1.5">
                  {['30', '45', '50', '60', '90'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 rounded-full text-[12px] border cursor-pointer transition-colors ${
                        duration === d
                          ? 'border-primary-mid bg-primary-light text-primary'
                          : 'border-gray-border bg-surface text-text-muted hover:bg-surface-2'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail */}
              <div className="mb-4">
                <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  Motivo / notas <span className="text-text-dim normal-case">· opcional</span>
                </label>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Ej: primera consulta, control, seguimiento…"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-[10px] border border-gray-border bg-surface-2 text-[13px] text-text resize-none focus:border-primary-mid"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  Estado inicial
                </label>
                <div className="flex gap-1.5">
                  {([
                    { v: 'pendiente', label: 'Sin confirmar', hint: 'Notifica al paciente' },
                    { v: 'confirmado', label: 'Confirmado', hint: 'Ya avisado' },
                  ] as const).map((o) => {
                    const active = status === o.v
                    return (
                      <button
                        key={o.v}
                        onClick={() => setStatus(o.v)}
                        className={`flex-1 px-3 py-2.5 rounded-[10px] border text-left cursor-pointer transition-colors ${
                          active
                            ? 'border-primary-mid bg-primary-light'
                            : 'border-gray-border bg-surface hover:bg-surface-2'
                        }`}
                      >
                        <div className={`text-[13px] font-medium ${active ? 'text-primary' : 'text-text'}`}>{o.label}</div>
                        <div className="text-[10px] text-text-hint mt-0.5">{o.hint}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && (
                <div className="mt-4 text-[12px] text-coral bg-coral-light rounded-[8px] px-3 py-2">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — sticky bottom with safe-area pad on mobile so the
            primary CTA is never covered by the iOS home indicator. On
            step 1 we hide the footer on mobile entirely: tapping a
            patient already auto-advances and the inline "Continuar"
            inside the new-patient panel handles that path too. */}
        <div
          className={`px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-border flex items-center justify-between gap-2 shrink-0 bg-surface ${
            step === 'patient' ? 'hidden sm:flex' : 'flex'
          }`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
        >
          {step === 'details' && !prefilledPatient && (
            <Btn onClick={() => setStep('patient')}>← Volver</Btn>
          )}
          <div className="flex-1" />
          <Btn onClick={onClose}>Cancelar</Btn>
          {step === 'patient' ? (
            <Btn
              variant="primary"
              disabled={!selectedPatient && !(isNewPatient && patientSearch.trim().length >= 2)}
              onClick={() => setStep('details')}
            >
              Continuar →
            </Btn>
          ) : (
            <Btn
              variant="primary"
              disabled={!canSave || saving}
              onClick={handleSave}
            >
              {saving ? 'Guardando…' : 'Crear turno'}
            </Btn>
          )}
        </div>
      </>
    )
  }
}
