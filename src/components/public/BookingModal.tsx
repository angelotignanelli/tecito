import { useState } from 'react'
import { createBooking, type PublicDoctor, type PublicLocation } from '../../lib/publicBooking'
import Icon from '../Icon'
import Logo from '../Logo'

interface Props {
  doctor: PublicDoctor
  slot: { date: string; time: string; dayLabel: string }
  location: PublicLocation | null
  onClose: () => void
  onSuccess: () => void
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

const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DAYS_LONG = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

function longDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
}

export default function BookingModal({ doctor, slot, location, onClose, onSuccess }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dni, setDni] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [insurance, setInsurance] = useState('Particular')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const addrSource = location ?? { address: doctor.address, city: doctor.city }
  const fullAddress = addrSource.address ? `${addrSource.address}${addrSource.city ? ', ' + addrSource.city : ''}` : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim()) {
      setError('Ingresá nombre y apellido.')
      return
    }
    if (dni.replace(/\D/g, '').length < 7) {
      setError('Ingresá un DNI válido.')
      return
    }
    if (phone.replace(/\D/g, '').length < 8) {
      setError('Ingresá un teléfono válido.')
      return
    }

    setLoading(true)
    const result = await createBooking({
      doctorId: doctor.id,
      locationId: location?.id ?? null,
      date: slot.date,
      time: slot.time,
      duration: `${doctor.session_duration || 50} min`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dni: dni.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      insurance,
    })
    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Hubo un error al agendar. Intentá de nuevo.')
      return
    }
    setSuccess(true)
  }

  // SUCCESS STATE — editorial sage hero
  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}
      >
        <div className="w-full max-w-[640px] h-full bg-bg flex flex-col">
          {/* Sage full-bleed hero */}
          <div className="flex-1 bg-primary text-surface text-center px-7 py-12 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-surface grid place-items-center mb-7">
              <Icon name="check" size={26} stroke={2.2} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div
              className="text-[22px] leading-[1.2] tracking-[-0.015em] opacity-90"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Te esperamos el
            </div>
            <div
              className="text-[28px] italic leading-[1.1] tracking-[-0.025em] mt-1"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {longDate(slot.date)}
            </div>
            <div
              className="text-[56px] leading-[1] tracking-[-0.045em] mt-5"
              style={{ fontFamily: 'var(--font-serif)', fontVariantNumeric: 'tabular-nums' }}
            >
              {slot.time}
            </div>

            <div className="mt-10 pt-6 border-t border-white/15 w-full max-w-[320px]">
              <div className="text-[13px] font-medium">{doctor.first_name} {doctor.last_name}</div>
              {fullAddress && (
                <div className="text-[12px] opacity-75 mt-1 leading-[1.55]">{fullAddress}</div>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="px-6 py-6 bg-bg border-t border-gray-border">
            <button
              onClick={onSuccess}
              className="w-full py-[14px] rounded-[12px] text-[15px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] transition-colors"
            >
              Listo
            </button>
            <div className="text-center text-[11px] text-text-hint mt-4 leading-[1.55]">
              Te llega la confirmación por WhatsApp al <strong className="text-text">{phone}</strong>.
              <br />
              Avisamos 24 hs antes.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // FORM STATE
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/40"
      onClick={onClose}
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <div
        className="bg-bg w-full sm:max-w-[440px] sm:rounded-[20px] sm:max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="bg-surface border-b border-gray-border px-5 py-3.5 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-gray-border bg-surface grid place-items-center cursor-pointer text-text hover:bg-surface-2"
          >
            <Icon name="chevL" size={14} />
          </button>
          <div className="flex flex-col items-center">
            <Logo variant="full" size={22} />
            <div
              className="text-[9px] text-text-hint uppercase tracking-[0.14em] mt-0.5"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Tus datos
            </div>
          </div>
          <div className="w-9" />
        </div>

        {/* Pinned turno (sage) */}
        <div className="bg-primary text-surface px-5 py-3.5 flex items-center gap-3 shrink-0">
          <div
            className="flex-1 text-[13px] font-medium"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {slot.dayLabel} · {slot.time} hs
          </div>
          <button
            onClick={onClose}
            className="text-[12px] underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Cambiar
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scrollbar-hide px-6 pt-7 pb-5">
          <div
            className="text-[26px] font-normal text-text leading-[1.15] tracking-[-0.015em] mb-5"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Tus datos.
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <Field label="Nombre" value={firstName} onChange={setFirstName} placeholder="María" />
            <Field label="Apellido" value={lastName} onChange={setLastName} placeholder="López" />
          </div>

          <Field label="DNI" value={dni} onChange={setDni} placeholder="32.481.204" inputMode="numeric" />
          <Field label="WhatsApp" value={phone} onChange={setPhone} placeholder="+54 9 11 5555-0001" type="tel" helper="Te enviamos la confirmación por acá." />
          <Field label="Email" value={email} onChange={setEmail} placeholder="tu@email.com (opcional)" type="email" />

          {/* Insurance chips */}
          <div className="mt-4">
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
            <div className="mt-5 text-[12px] text-coral bg-coral-light rounded-[10px] px-3.5 py-2.5">
              {error}
            </div>
          )}
        </form>

        {/* Sticky CTA */}
        <div className="px-6 py-4 bg-bg border-t border-gray-border shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-[14px] rounded-[12px] text-[15px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Confirmando…' : 'Confirmar turno'}
          </button>
          <div className="text-center text-[11px] text-text-hint mt-3 leading-[1.5]">
            Al confirmar aceptás nuestra{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-text">
              Política de privacidad
            </a>
            .
          </div>
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
  helper,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  helper?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
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
        className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[15px] text-text placeholder:text-text-hint focus:border-primary-mid"
      />
      {helper && <div className="text-[11px] text-text-hint mt-1.5">{helper}</div>}
    </div>
  )
}
