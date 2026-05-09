import { useState } from 'react'
import type { Patient } from '../../data/appointments'
import Icon from '../Icon'

interface Props {
  onClose: () => void
  /** Persists the patient. Returns an Error if creation failed (e.g. plan
   * limit hit, network error, validation), or null on success. */
  onAdd: (p: Patient) => Promise<Error | null>
}

const insuranceOptions = [
  'Particular',
  'OSDE',
  'Swiss Medical',
  'Medifé',
  'Galeno',
  'IOMA',
  'PAMI',
  'Otra',
]

/**
 * Lightweight "create patient" form. Used from the Patients view's "Nuevo
 * paciente" button — covers the case where a doctor wants to register a
 * patient without immediately scheduling an appointment (the
 * NewAppointmentModal already handles the "schedule + create" combined
 * flow).
 */
export default function AddPatientModal({ onClose, onAdd }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [insurance, setInsurance] = useState('Particular')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Ingresá el nombre del paciente')
      return
    }
    setSaving(true)
    const err = await onAdd({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      age: age.trim(),
      since: new Date().toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
      insurance,
      lastVisit: '',
      totalSessions: 0,
      tags: [],
      history: [],
    })
    setSaving(false)
    if (err) {
      setError(err.message || 'No se pudo agregar el paciente')
      return
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg w-full sm:max-w-[480px] sm:rounded-[16px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="border-b border-gray-border px-5 py-4 flex items-center justify-between shrink-0">
          <div className="text-[15px] font-medium text-text">Nuevo paciente</div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full grid place-items-center cursor-pointer text-text-muted hover:bg-surface-2"
            aria-label="Cerrar"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pt-5 pb-3">
          <Field
            label="Nombre y apellido *"
            value={name}
            onChange={setName}
            placeholder="María López"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Teléfono"
              value={phone}
              onChange={setPhone}
              placeholder="+54 9 11 5555-0001"
              type="tel"
              inputMode="tel"
            />
            <Field
              label="Edad"
              value={age}
              onChange={setAge}
              placeholder="32"
              inputMode="numeric"
            />
          </div>
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="paciente@email.com (opcional)"
            type="email"
          />

          {/* Insurance chips */}
          <div className="mt-2">
            <label className="text-[12px] text-text-muted font-medium mb-2 block">Cobertura</label>
            <div className="flex flex-wrap gap-1.5">
              {insuranceOptions.map((opt) => {
                const active = insurance === opt
                return (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => setInsurance(opt)}
                    className={`px-3.5 py-2 rounded-full text-[13px] font-medium border cursor-pointer transition-colors ${
                      active
                        ? 'bg-primary text-surface border-primary'
                        : 'bg-surface text-text border-gray-border-2 hover:bg-surface-2'
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="mt-4 text-[12px] text-coral bg-coral-light rounded-[10px] px-3.5 py-2.5">
              {error}
            </div>
          )}
        </form>

        {/* Sticky CTA */}
        <div className="px-6 py-4 bg-bg border-t border-gray-border shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-[12px] rounded-[10px] text-[13px] font-medium cursor-pointer border border-gray-border-2 bg-surface text-text-muted hover:bg-surface-2 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] py-[12px] rounded-[10px] text-[13px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] disabled:opacity-60 transition-colors"
          >
            {saving ? 'Guardando…' : 'Agregar paciente'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoFocus?: boolean
}) {
  return (
    <div className="mb-3.5">
      <label className="text-[12px] text-text-muted font-medium mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoFocus={autoFocus}
        className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[15px] text-text placeholder:text-text-hint focus:border-primary-mid"
      />
    </div>
  )
}
