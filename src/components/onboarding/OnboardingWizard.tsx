import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getPublicBaseUrl } from '../../lib/publicUrl'
import Logo from '../Logo'

interface LocationInput {
  name: string
  address: string
  city: string
  workDays: string[]
  workFrom: string
  workTo: string
}

interface ProfileData {
  specialty: string
  license: string
  phone: string
  bio: string
  locations: LocationInput[]
  sessionDuration: string
  priceParticular: string
  bankAlias: string
}

interface Props {
  firstName: string
  lastName: string
  onComplete: (profile: ProfileData) => void
}

const allDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const steps = [
  { label: 'Profesional', icon: '🩺' },
  { label: 'Consultorios', icon: '🏥' },
  { label: 'Facturación', icon: '💳' },
]

const emptyLocation = (): LocationInput => ({
  name: 'Consultorio principal',
  address: '',
  city: '',
  workDays: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
  workFrom: '09:00',
  workTo: '18:00',
})

export default function OnboardingWizard({ firstName, lastName, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<ProfileData>({
    specialty: '',
    license: '',
    phone: '',
    bio: '',
    locations: [emptyLocation()],
    sessionDuration: '50',
    priceParticular: '',
    bankAlias: '',
  })
  const [error, setError] = useState('')
  // After the wizard saves, we don't bounce straight to the dashboard. We
  // show a "ready" screen with the public booking link so the doctor sees
  // their first usable artifact (and learns where to find it later).
  const [bookingCode, setBookingCode] = useState<string | null>(null)

  const updateLocation = (index: number, patch: Partial<LocationInput>) => {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((l, i) => i === index ? { ...l, ...patch } : l),
    }))
    setError('')
  }

  const addLocation = () => {
    setData((prev) => ({
      ...prev,
      locations: [...prev.locations, { ...emptyLocation(), name: `Consultorio ${prev.locations.length + 1}` }],
    }))
  }

  const removeLocation = (index: number) => {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index),
    }))
  }

  const toggleLocationDay = (index: number, day: string) => {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((l, i) => {
        if (i !== index) return l
        return {
          ...l,
          workDays: l.workDays.includes(day) ? l.workDays.filter((d) => d !== day) : [...l.workDays, day],
        }
      }),
    }))
  }

  const update = (field: keyof Omit<ProfileData, 'locations'>, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!data.specialty || !data.license) {
        setError('Completá especialidad y matrícula')
        return false
      }
    }
    if (step === 1) {
      if (data.locations.length === 0) {
        setError('Agregá al menos un consultorio')
        return false
      }
      for (const [i, loc] of data.locations.entries()) {
        if (!loc.address || !loc.city) {
          setError(`Completá dirección y ciudad del consultorio ${i + 1}`)
          return false
        }
        if (loc.workDays.length === 0) {
          setError(`Seleccioná al menos un día de atención en ${loc.name || `consultorio ${i + 1}`}`)
          return false
        }
      }
    }
    return true
  }

  const [saving, setSaving] = useState(false)

  const handleNext = async () => {
    if (!validateStep()) return
    setError('')
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const primary = data.locations[0]
        // Save profile core + keep legacy address/schedule fields mirroring the primary location
        const { error: profileErr } = await supabase.from('profiles').update({
          specialty: data.specialty,
          license: data.license,
          phone: data.phone,
          bio: data.bio,
          address: primary.address,
          city: primary.city,
          work_days: primary.workDays,
          work_from: primary.workFrom,
          work_to: primary.workTo,
          session_duration: parseInt(data.sessionDuration) || 50,
          price_particular: parseInt(data.priceParticular) || 0,
          bank_alias: data.bankAlias,
          needs_onboarding: false,
        }).eq('id', user.id)

        if (profileErr) {
          setSaving(false)
          setError('Error al guardar: ' + profileErr.message)
          return
        }

        // Only create locations if the user doesn't have any yet.
        // If they're re-doing the onboarding (needs_onboarding=true again), we skip
        // so we don't cascade-null the location_id of existing appointments.
        const { data: existingLocs } = await supabase
          .from('locations')
          .select('id')
          .eq('doctor_id', user.id)
          .limit(1)

        if (!existingLocs || existingLocs.length === 0) {
          const { error: locErr } = await supabase.from('locations').insert(
            data.locations.map((loc, i) => ({
              doctor_id: user.id,
              name: loc.name || `Consultorio ${i + 1}`,
              address: loc.address,
              city: loc.city,
              work_days: loc.workDays,
              work_from: loc.workFrom,
              work_to: loc.workTo,
              is_primary: i === 0,
            })),
          )
          if (locErr) {
            setSaving(false)
            setError('Error al guardar consultorios: ' + locErr.message)
            return
          }
        }

        // Pull the booking handle now that the profile row is settled, so
        // we can hand the doctor their public link on the celebration
        // screen. Both booking_slug and booking_code are auto-generated
        // by the DB trigger on insert. We prefer the human slug
        // (`angelo-tignanelli`) — the random code is a fallback only
        // for accounts where the slug couldn't be derived from the name.
        const { data: profileWithCode } = await supabase
          .from('profiles')
          .select('booking_code, booking_slug')
          .eq('id', user.id)
          .single()

        setSaving(false)

        // Welcome email — fire-and-forget the moment the profile is fully set
        // up (booking_code in hand, locations created). We deliberately don't
        // wait for the response: an email failure shouldn't block the
        // celebration screen. The endpoint logs failures server-side.
        void fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: user.id }),
        }).catch((err) => console.warn('[welcome-email] notify failed', err))

        // The celebration screen takes a single `bookingCode` prop —
        // we feed it the slug when present so the URL preview reads
        // "tecito.com.ar/p/angelo-tignanelli" instead of a hex blob.
        const handle = profileWithCode?.booking_slug ?? profileWithCode?.booking_code
        if (handle) {
          setBookingCode(handle)
          return
        }
      }
      onComplete(data)
    }
  }

  const handleBack = () => {
    setError('')
    if (step > 0) setStep(step - 1)
  }

  const progress = ((step + 1) / steps.length) * 100
  // Defensive — fall back gracefully if either name is missing instead of
  // rendering "Aundefined". RegisterView splits the full name by space, so
  // a single-word name leaves lastName empty.
  const initials = (
    (firstName?.[0] ?? '') + (lastName?.[0] ?? '')
  ).toUpperCase() || '?'

  // Celebration / link reveal screen — shown after the wizard saves
  // successfully, so the doctor sees their first share-able artifact and
  // learns where it lives in the app for later.
  if (bookingCode) {
    return (
      <BookingLinkReveal
        firstName={firstName}
        bookingCode={bookingCode}
        onContinue={() => onComplete(data)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-bg flex flex-col">
      {/* Progress bar */}
      <div className="bg-white border-b border-gray-border px-6 py-4 shrink-0">
        <div className="max-w-[600px] mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Logo variant="full" size={20} />
            <div className="text-xs text-text-hint">Paso {step + 1} de {steps.length}</div>
          </div>
          {/* Step indicators */}
          <div className="flex gap-2 mb-2">
            {steps.map((s, i) => (
              <div key={i} className="flex-1 flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                  i <= step ? 'bg-primary text-white' : 'bg-gray-bg text-text-hint'
                }`}>
                  {i < step ? '✓' : s.icon}
                </div>
                <div className={`text-[11px] hidden sm:block ${i <= step ? 'text-primary font-medium' : 'text-text-hint'}`}>
                  {s.label}
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full ${i < step ? 'bg-primary' : 'bg-gray-border'}`} />
                )}
              </div>
            ))}
          </div>
          {/* Bar */}
          <div className="w-full bg-gray-bg rounded-full h-1">
            <div className="bg-primary h-1 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-[520px]">
          <div className="bg-white border border-gray-border rounded-[10px] p-6 sm:p-8">

            {/* Step 0: Greeting + Professional data (merged) */}
            {step === 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center text-[16px] font-semibold text-primary shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold leading-tight">Hola, {firstName}.</div>
                    <div className="text-xs text-text-muted mt-0.5">Configurá tu perfil en 3 pasos cortos.</div>
                  </div>
                </div>

                <div className="text-sm font-medium text-text mb-4">Datos profesionales</div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <FormField label="Especialidad *" value={data.specialty} placeholder="Ej: Cardióloga, Psicóloga, Nutricionista…" onChange={(v) => update('specialty', v)} />
                  <FormField label="Matrícula *" value={data.license} placeholder="Ej: 12.847" onChange={(v) => update('license', v)} />
                </div>
                <div className="mb-4">
                  <FormField label="Teléfono del consultorio" value={data.phone} placeholder="+54 9 11 5555-0001" onChange={(v) => update('phone', v)} />
                </div>
                <div>
                  <label className="text-[11px] text-text-hint uppercase tracking-wide mb-1 block">Presentación profesional</label>
                  <textarea
                    value={data.bio}
                    onChange={(e) => update('bio', e.target.value)}
                    rows={3}
                    placeholder="Contá brevemente tu especialización y enfoque..."
                    className="w-full px-3 py-2.5 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid focus:ring-1 focus:ring-primary-mid resize-none"
                  />
                  <div className="text-[10px] text-text-hint mt-1">Se muestra a pacientes nuevos en tu link público.</div>
                </div>
              </div>
            )}

            {/* Step 1: Consultorios (multi-location) */}
            {step === 1 && (
              <div>
                <div className="text-lg font-semibold mb-1">Consultorios y horarios</div>
                <div className="text-sm text-text-muted mb-5">
                  Agregá todos los lugares donde atendés. Cada uno tiene sus propios días y horarios.
                </div>

                <div className="flex flex-col gap-4">
                  {data.locations.map((loc, i) => (
                    <div key={i} className="bg-gray-bg border border-gray-border rounded-[12px] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          value={loc.name}
                          onChange={(e) => updateLocation(i, { name: e.target.value })}
                          placeholder={`Consultorio ${i + 1}`}
                          className="flex-1 px-3 py-2 rounded-md border border-gray-border bg-white text-sm font-medium focus:outline-none focus:border-primary-mid"
                        />
                        {i === 0 && (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-primary-light text-primary font-semibold uppercase tracking-wider">
                            Principal
                          </span>
                        )}
                        {data.locations.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLocation(i)}
                            className="w-8 h-8 rounded-full hover:bg-coral-light text-text-hint hover:text-coral grid place-items-center cursor-pointer"
                            title="Eliminar consultorio"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <FormField
                          label="Dirección *"
                          value={loc.address}
                          placeholder="Av. Santa Fe 2340"
                          onChange={(v) => updateLocation(i, { address: v })}
                        />
                        <FormField
                          label="Ciudad *"
                          value={loc.city}
                          placeholder="CABA"
                          onChange={(v) => updateLocation(i, { city: v })}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="text-[11px] text-text-hint uppercase tracking-wide mb-1.5 block">Días de atención *</label>
                        <div className="flex flex-wrap gap-1">
                          {allDays.map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleLocationDay(i, day)}
                              className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-colors ${
                                loc.workDays.includes(day)
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white text-text-hint border-gray-border hover:bg-gray-bg'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-text-hint uppercase tracking-wide mb-1 block">Desde</label>
                          <input
                            type="time"
                            value={loc.workFrom}
                            onChange={(e) => updateLocation(i, { workFrom: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-text-hint uppercase tracking-wide mb-1 block">Hasta</label>
                          <input
                            type="time"
                            value={loc.workTo}
                            onChange={(e) => updateLocation(i, { workTo: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addLocation}
                    className="w-full py-2.5 rounded-[12px] border-2 border-dashed border-gray-border text-text-muted text-sm cursor-pointer hover:border-primary-mid hover:text-primary transition-colors"
                  >
                    + Agregar otro consultorio
                  </button>
                </div>

                <div className="mt-5">
                  <FormField
                    label="Duración de sesión (min)"
                    value={data.sessionDuration}
                    placeholder="50"
                    onChange={(v) => update('sessionDuration', v)}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Billing */}
            {step === 2 && (
              <div>
                <div className="text-lg font-semibold mb-1">Facturación</div>
                <div className="text-sm text-text-muted mb-6">Datos de cobro para pacientes particulares</div>

                <div className="mb-4">
                  <label className="text-[11px] text-text-hint uppercase tracking-wide mb-1 block">Valor sesión particular</label>
                  <div className="flex items-center">
                    <span className="text-sm text-text-muted mr-2">$</span>
                    <input
                      type="text"
                      value={data.priceParticular}
                      onChange={(e) => update('priceParticular', e.target.value)}
                      placeholder="15000"
                      className="w-full px-3 py-2.5 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid focus:ring-1 focus:ring-primary-mid"
                    />
                  </div>
                </div>
                <div>
                  <FormField label="Alias de pago (CBU/Alias)" value={data.bankAlias} placeholder="dra.perez.psi" onChange={(v) => update('bankAlias', v)} />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-xs text-coral mt-4 bg-coral-light rounded-md px-3 py-2">{error}</div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              {step > 0 ? (
                <button
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-md text-sm cursor-pointer border border-gray-border bg-white text-text-muted hover:bg-gray-bg transition-colors"
                >
                  Anterior
                </button>
              ) : <div />}
              <button
                onClick={handleNext}
                disabled={saving}
                className="px-6 py-2.5 rounded-md text-sm font-medium cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : step === steps.length - 1 ? 'Completar perfil' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-[11px] text-text-hint uppercase tracking-wide mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid focus:ring-1 focus:ring-primary-mid"
      />
    </div>
  )
}

/**
 * Final post-save screen of the onboarding flow. Reveals the doctor's
 * public booking link so they see immediate value, with explicit Copy and
 * Share buttons, plus a hint about where to find the link later (Mi
 * perfil → Link para agendar turnos) so they don't think it's a one-shot.
 */
function BookingLinkReveal({
  firstName,
  bookingCode,
  onContinue,
}: {
  firstName: string
  bookingCode: string
  onContinue: () => void
}) {
  const publicUrl = `${getPublicBaseUrl()}/p/${bookingCode}`
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Greeting falls back to a generic "¡Bienvenida a Tecito!" if firstName is
  // missing. Same for the share text (drops the self-introduction).
  const safeFirstName = (firstName ?? '').trim()
  const greeting = safeFirstName
    ? `¡Bienvenida a Tecito, ${safeFirstName}!`
    : '¡Bienvenida a Tecito!'
  const shareIntro = safeFirstName ? `Hola! Soy ${safeFirstName}. ` : 'Hola! '
  const shareText = encodeURIComponent(
    `${shareIntro}Si querés sacar un turno conmigo, podés hacerlo desde acá: ${publicUrl}`,
  )

  return (
    <div className="min-h-screen bg-gray-bg flex flex-col">
      {/* Header — same shell as the wizard so the transition feels native */}
      <div className="bg-white border-b border-gray-border px-6 py-4 shrink-0">
        <div className="max-w-[600px] mx-auto flex items-center justify-between">
          <Logo variant="full" size={20} />
          <div className="text-xs text-text-hint">¡Listo!</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-10">
        <div className="max-w-[560px] mx-auto">
          {/* Celebration */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎉</div>
            <h1
              className="text-[32px] font-normal tracking-[-0.025em] text-text leading-[1.15] mb-2"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {greeting}
            </h1>
            <p className="text-sm text-text-muted leading-[1.6] max-w-[440px] mx-auto">
              Tu perfil está listo. Te dejamos abajo el link que podés compartir con tus pacientes para que saquen turno solos, en cualquier momento.
            </p>
          </div>

          {/* Booking link card */}
          <div className="bg-white border border-gray-border rounded-[14px] p-5 mb-5">
            <div className="text-[10px] text-text-hint uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>🔗</span>
              <span>Tu link para agendar turnos</span>
            </div>
            <div className="bg-gray-bg rounded-[10px] px-3.5 py-3 mb-3 flex items-center gap-2">
              <div className="text-xs font-mono text-text truncate flex-1">{publicUrl}</div>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors shrink-0"
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs cursor-pointer border border-gray-border bg-white text-text hover:bg-gray-bg transition-colors"
              >
                💬 Compartir por WhatsApp
              </a>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs cursor-pointer border border-gray-border bg-white text-text-muted hover:bg-gray-bg transition-colors"
              >
                👀 Ver mi página pública
              </a>
            </div>
          </div>

          {/* Where to find it later */}
          <div className="bg-teal-light rounded-[10px] px-4 py-3 mb-8 flex items-start gap-2.5">
            <div className="text-base mt-[1px]">💡</div>
            <div className="text-xs text-teal leading-[1.55]">
              Vas a encontrar este link siempre desde tu cuenta en{' '}
              <strong className="text-teal">Mi link</strong>, en el menú lateral. Desde ahí podés copiarlo, compartirlo por WhatsApp o email cuando quieras.
            </div>
          </div>

          {/* Continue */}
          <div className="flex justify-center">
            <button
              onClick={onContinue}
              className="px-8 py-3 rounded-md text-sm font-medium cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors"
            >
              Ir al panel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
