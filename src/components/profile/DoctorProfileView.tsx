import { useEffect, useRef, useState } from 'react'
import { useProfile, type ProfileRow } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { getPlan, type PlanId } from '../../lib/plans'
import { getPublicBaseUrl } from '../../lib/publicUrl'
import PageHeader from '../PageHeader'
import Btn from '../Btn'
import Icon from '../Icon'
import LocationsManager from './LocationsManager'

interface DoctorData {
  firstName: string
  lastName: string
  specialty: string
  license: string
  phone: string
  email: string
  address: string
  city: string
  sessionDuration: string
  priceParticular: string
  bankAlias: string
  bio: string
  workDays: string[]
  workFrom: string
  workTo: string
}

function profileToData(p: ProfileRow): DoctorData {
  return {
    firstName: p.first_name || '',
    lastName: p.last_name || '',
    specialty: p.specialty || '',
    license: p.license || '',
    phone: p.phone || '',
    email: p.email || '',
    address: p.address || '',
    city: p.city || '',
    sessionDuration: String(p.session_duration || 50),
    priceParticular: String(p.price_particular || ''),
    bankAlias: p.bank_alias || '',
    bio: p.bio || '',
    workDays: p.work_days || [],
    workFrom: p.work_from?.slice(0, 5) || '09:00',
    workTo: p.work_to?.slice(0, 5) || '18:00',
  }
}

const allDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface Props {
  onLogout?: () => void
  onOpenPlans?: () => void
}

export default function DoctorProfileView({ onLogout, onOpenPlans }: Props) {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const { profile, loading, update: updateProfile } = useProfile(userId)

  const [data, setData] = useState<DoctorData | null>(null)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  // Ref to the first editable section. On mobile we scroll it into
  // view when the user enters edit mode, otherwise the pencil button
  // sits at the top of the page and the inputs that just appeared
  // are well below the fold — the click feels like a no-op.
  const editableSectionRef = useRef<HTMLDivElement | null>(null)
  const enterEditMode = () => {
    setEditing(true)
    // Wait one frame for the Fields to re-render as inputs, then
    // scroll. Smooth behavior so the transition reads as intentional.
    requestAnimationFrame(() => {
      editableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // Sync profile data when loaded
  useEffect(() => {
    if (profile && !data) {
      setData(profileToData(profile))
    }
  }, [profile, data])

  const updateField = (field: keyof DoctorData, value: string) => {
    setData((prev) => prev ? { ...prev, [field]: value } : prev)
  }

  const toggleDay = (day: string) => {
    setData((prev) => prev ? {
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day],
    } : prev)
  }

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    await updateProfile({
      first_name: data.firstName,
      last_name: data.lastName,
      specialty: data.specialty,
      license: data.license,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city: data.city,
      bio: data.bio,
      work_days: data.workDays,
      work_from: data.workFrom,
      work_to: data.workTo,
      session_duration: parseInt(data.sessionDuration) || 50,
      price_particular: parseInt(data.priceParticular) || 0,
      bank_alias: data.bankAlias,
    })
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCancelEdit = () => {
    if (profile) setData(profileToData(profile))
    setEditing(false)
  }

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-text-hint">Cargando perfil...</div>
      </div>
    )
  }

  const initials = `${(data.firstName || 'M')[0]}${(data.lastName || 'B')[0]}`

  return (
    <div className="bg-bg lg:flex-1 lg:flex lg:flex-col lg:h-full lg:overflow-hidden">
      {/* Mobile-only sticky banner while editing. Without it, the
          state change can read as a no-op on phones because the
          inputs appear below the fold and the only visible cue is a
          tiny pencil→X swap at the top. The banner makes the mode
          obvious and gives the user a one-tap path to save. */}
      {editing && (
        <div
          className="sm:hidden sticky top-0 z-30 px-4 py-3 flex items-center gap-3 bg-primary text-surface shadow-[0_2px_8px_rgba(59,74,56,0.18)]"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <Icon name="edit" size={14} />
          <span className="flex-1 text-[13px] font-medium">Editando perfil</span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold bg-surface text-primary disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}
      <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-28 lg:pb-10 lg:overflow-y-auto lg:flex-1 lg:scrollbar-hide">
        <PageHeader
          title="Mi perfil."
          subtitle="Datos profesionales y configuración de consultorio."
          right={
            <>
              {saved && <span className="text-xs text-teal font-medium mr-1">Guardado</span>}
              {/* All header actions are desktop-only. On mobile:
                  - Editar perfil → pencil icon next to the name
                  - Cancelar      → X icon in the same spot while editing
                  - Guardar       → full-width primary button at bottom
                  - Cerrar sesión → full-width secondary button at bottom */}
              {/* Wrapping each <Btn> in a span gated by `hidden sm:flex`
                  is intentional: the Btn component sets `inline-flex` in
                  its base className, which beats a `hidden` utility added
                  via the className prop (same specificity, Tailwind emits
                  `inline-flex` after `hidden` in the generated CSS). The
                  wrapper has no other Btn styling so this is purely a
                  visibility gate. */}
              {editing ? (
                <>
                  <span className="hidden sm:flex"><Btn onClick={handleCancelEdit}>Cancelar</Btn></span>
                  <span className="hidden sm:flex">
                    <Btn variant="primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'Guardando…' : 'Guardar cambios'}
                    </Btn>
                  </span>
                </>
              ) : (
                <>
                  {onLogout && (
                    <span className="hidden sm:flex"><Btn onClick={onLogout}>Cerrar sesión</Btn></span>
                  )}
                  <span className="hidden sm:flex">
                    <Btn variant="primary" onClick={enterEditMode}>Editar perfil</Btn>
                  </span>
                </>
              )}
            </>
          }
        />
        {/* Avatar + Name header */}
        <div className="flex items-center gap-4 mb-6">
          <AvatarUpload
            avatarUrl={profile?.avatar_url || null}
            initials={initials}
            userId={userId}
            onUploaded={(url) => updateProfile({ avatar_url: url } as any)}
          />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold truncate">{data.firstName} {data.lastName}</div>
            <div className="text-sm text-text-muted truncate">{data.specialty}{data.license ? ` · Mat. ${data.license}` : ''}</div>
          </div>
          {/* Mobile-only edit / cancel toggle.
              - Idle (✎ pencil)  → tap enters edit mode
              - Editing (✕ close) → tap discards changes
              Filled-circle treatment so the button reads as actionable
              UI rather than an inline decoration of the name. */}
          <button
            type="button"
            onClick={editing ? handleCancelEdit : enterEditMode}
            aria-label={editing ? 'Cancelar edición' : 'Editar perfil'}
            // Secondary-button aesthetic in a circular shell: cream
            // surface + thin border + muted text, hover lifts to
            // surface-2. Matches the visual weight of <Btn variant="secondary">
            // so it doesn't compete with the primary sage actions.
            className="sm:hidden w-10 h-10 rounded-full grid place-items-center cursor-pointer bg-surface text-text-muted border border-gray-border-2 hover:bg-surface-2 active:bg-surface-2 transition-colors shrink-0"
          >
            <Icon name={editing ? 'x' : 'edit'} size={16} />
          </button>
        </div>

        {/* Plan section */}
        {profile && (
          <PlanCard plan={(profile.plan || 'free') as PlanId} onOpenPlans={onOpenPlans} />
        )}

        <div ref={editableSectionRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4 scroll-mt-4">
          {/* Personal info */}
          <div className="bg-white border border-gray-border rounded-[10px] p-5">
            <div className="text-[13px] font-semibold mb-4">Datos personales</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" value={data.firstName} field="firstName" editing={editing} onChange={updateField} />
              <Field label="Apellido" value={data.lastName} field="lastName" editing={editing} onChange={updateField} />
              <Field label="Especialidad" value={data.specialty} field="specialty" editing={editing} onChange={updateField} />
              <Field label="Matrícula" value={data.license} field="license" editing={editing} onChange={updateField} />
              <Field label="Teléfono" value={data.phone} field="phone" editing={editing} onChange={updateField} />
              <Field label="Email" value={data.email} field="email" editing={editing} onChange={updateField} />
            </div>
          </div>

          {/* Sesión y cobro (unified) */}
          <div className="bg-white border border-gray-border rounded-[10px] p-5">
            <div className="text-[13px] font-semibold mb-4">Sesión y cobro</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duración (min)" value={data.sessionDuration} field="sessionDuration" editing={editing} onChange={updateField} />
              <Field label="Valor particular" value={data.priceParticular} field="priceParticular" editing={editing} onChange={updateField} prefix="$" />
              <div className="col-span-2">
                <Field label="Alias de pago" value={data.bankAlias} field="bankAlias" editing={editing} onChange={updateField} />
              </div>
            </div>
            <div className="text-[11px] text-text-hint mt-3 leading-[1.5]">
              La duración se aplica por defecto a turnos nuevos, podés sobreescribirla turno por turno.
            </div>
          </div>

          {/* Multi-location manager */}
          {userId && <LocationsManager userId={userId} />}

          {/* Booking link block removed — lives in the "Mi link" sidebar
              item now (with WhatsApp / email / copy actions in one modal). */}

          {/* Google Calendar / Apple Calendar sync */}
          <div className="bg-white border border-gray-border rounded-[14px] p-5 md:col-span-2">
            <div className="text-[13px] font-semibold mb-1">Sincronizar con tu calendario</div>
            <div className="text-xs text-text-muted mb-4">
              Ves tus turnos junto con el resto de tus eventos en Google Calendar, Apple Calendar u Outlook. Los cambios que hagas en Tecito se reflejan automáticamente cada pocas horas.
            </div>
            <CalendarSync bookingCode={profile?.booking_code || null} />
          </div>
        </div>

        {/* Mobile-only bottom CTAs.
            - Editing: primary "Guardar cambios" full-width. The X next
              to the name is the cancel affordance.
            - Idle: secondary "Cerrar sesión" full-width at the very
              bottom. Desktop has it in the sidebar + header cluster,
              so it doesn't need to live here on sm+. */}
        <div className="sm:hidden mt-8">
          {editing ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-3 rounded-[10px] text-[14px] font-medium bg-primary text-surface hover:bg-[#2F3C2D] disabled:opacity-60 cursor-pointer transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          ) : (
            onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full px-4 py-3 rounded-[10px] text-[14px] font-medium border border-gray-border bg-surface text-text-muted hover:bg-surface-2 cursor-pointer transition-colors"
              >
                Cerrar sesión
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function AvatarUpload({ avatarUrl, initials, userId, onUploaded }: {
  avatarUrl: string | null
  initials: string
  userId: string | null
  onUploaded: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen debe pesar menos de 2MB')
      return
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/avatar.${ext}`

    setUploading(true)
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      alert('Error al subir: ' + uploadError.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    onUploaded(url)
    setUploading(false)
  }

  return (
    <div className="relative">
      <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center text-xl font-semibold text-primary shrink-0 overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-border shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-bg transition-colors" title="Cambiar foto">
        {uploading ? (
          <span className="text-[10px]">...</span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        )}
        <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
    </div>
  )
}

function PlanCard({ plan, onOpenPlans }: { plan: PlanId; onOpenPlans?: () => void }) {
  const p = getPlan(plan)
  const isFree = plan === 'free'

  return (
    <div
      className={`rounded-[14px] p-5 mb-4 border ${
        isFree
          ? 'bg-surface border-gray-border'
          : 'bg-primary-light border-primary-mid'
      }`}
    >
      {/* On mobile the row stacks: plan info up top, CTA below as a
          full-width tap target. On sm+ the button sits to the right
          of the text as before. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div
            className={`text-[10px] uppercase tracking-[0.12em] mb-1 ${
              isFree ? 'text-text-hint' : 'text-primary'
            }`}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Tu plan actual
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span
              className={`text-[22px] italic tracking-[-0.015em] ${isFree ? 'text-text' : 'text-primary'}`}
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {p.name}
            </span>
            {p.price > 0 && (
              <span className="text-[12px] text-text-hint" style={{ fontFamily: 'var(--font-mono)' }}>
                USD {p.price}/mes
              </span>
            )}
          </div>
          <div className="text-[12px] text-text-muted mt-1 leading-[1.5]">
            {p.description}
          </div>
        </div>
        <button
          onClick={onOpenPlans}
          className="w-full sm:w-auto sm:shrink-0 px-4 py-2.5 sm:py-2 rounded-[10px] sm:rounded-[8px] text-[13px] sm:text-[12px] font-medium cursor-pointer transition-colors bg-primary text-surface hover:bg-[#2F3C2D] border border-primary"
        >
          {isFree ? 'Mejorar plan' : 'Cambiar plan'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, field, editing, onChange, prefix }: {
  label: string; value: string; field: string; editing: boolean; onChange: (field: any, value: string) => void; prefix?: string
}) {
  return (
    // min-w-0 lets the field shrink below its content's intrinsic width
    // when sitting inside a 2-col grid on a narrow viewport (e.g. an
    // email like "miemail.profesional@gmail.com" was pushing the column
    // wider than its slot, breaking the grid). The break-words on the
    // display variant handles the same case for read-only mode.
    <div className="min-w-0">
      <div className="text-[11px] text-text-hint uppercase tracking-wide mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center min-w-0">
          {prefix && <span className="text-sm text-text-muted mr-1 shrink-0">{prefix}</span>}
          <input type="text" value={value} onChange={(e) => onChange(field, e.target.value)} className="w-full min-w-0 px-3 py-2 rounded-md border border-gray-border text-sm focus:outline-none focus:border-primary-mid focus:ring-1 focus:ring-primary-mid" />
        </div>
      ) : (
        <div className="text-sm text-text break-words">{prefix}{value || '—'}</div>
      )}
    </div>
  )
}

function CalendarSync({ bookingCode }: { bookingCode: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!bookingCode) {
    return (
      <div className="text-xs text-text-hint bg-gray-bg rounded-md px-3 py-2.5">
        El código se genera automáticamente. Recargá la página si no aparece.
      </div>
    )
  }

  // Cleaner URL through Vercel proxy → transparently forwards to the Supabase edge fn.
  // Falls back to the direct Supabase URL when running locally on Vite dev server.
  // Uses the canonical public URL (tecito.com.ar) so the calendar subscription
  // doesn't get bound to whatever domain the doctor happened to use when copying.
  const origin = window.location.origin
  const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1')
  const icsUrl = isLocal
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ics-feed/${bookingCode}.ics`
    : `${getPublicBaseUrl()}/ics/${bookingCode}.ics`
  // webcal:// scheme triggers the native "subscribe" flow in macOS / iOS / Outlook
  const webcalUrl = icsUrl.replace(/^https?:\/\//, 'webcal://')
  // Google Calendar's "Add via URL" only works reliably when the URL goes through the
  // Google /calendar/r/addcalendar flow with the webcal:// variant as cid parameter.
  const googleAddUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`

  const handleCopy = () => {
    navigator.clipboard.writeText(icsUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {/* URL */}
      <div className="bg-gray-bg rounded-lg px-3 py-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-text-hint uppercase tracking-wide mb-0.5">URL del calendario</div>
          <div className="text-xs font-mono text-text truncate">{icsUrl}</div>
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-md text-xs cursor-pointer border border-primary bg-primary text-white hover:bg-[#2F3C2D] transition-colors shrink-0"
        >
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>

      {/* One-click add buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={googleAddUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md cursor-pointer border border-gray-border bg-white text-text hover:bg-surface-2 transition-colors"
        >
          Agregar a Google Calendar
        </a>
        <a
          href={webcalUrl}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md cursor-pointer border border-gray-border bg-white text-text hover:bg-surface-2 transition-colors"
        >
          Agregar a Apple Calendar
        </a>
      </div>

      <div className="mt-4 text-[11px] text-text-hint leading-[1.5]">
        Es <strong>read-only</strong>: ves tus turnos en el calendario pero no podés editarlos desde ahí. Tecito es la fuente de verdad.
      </div>
    </div>
  )
}
