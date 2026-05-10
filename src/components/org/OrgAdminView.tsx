import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrgMembers, useOrgInvites, type Organization, type OrgMember } from '../../lib/hooks'
import { hexToLightBg } from '../../lib/theme'
import { getPublicBaseUrl } from '../../lib/publicUrl'

interface Props {
  org: Organization
  userId: string
  onOrgUpdated: (org: Organization) => void
}

export default function OrgAdminView({ org, userId, onOrgUpdated }: Props) {
  const { members, loading: membersLoading, remove: removeMember } = useOrgMembers(org.id)
  const { invites, loading: invitesLoading, create: createInvite, remove: removeInvite } = useOrgInvites(org.id)
  const [tab, setTab] = useState<'members' | 'invites' | 'marca'>('members')
  const [copied, setCopied] = useState<string | null>(null)

  const handleGenerateLink = async () => {
    await createInvite(userId, undefined, 7)
  }

  const handleCopy = (code: string) => {
    const url = `${getPublicBaseUrl()}?invite=${code}`
    navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-bg lg:flex-1 lg:flex lg:flex-col lg:h-full lg:overflow-hidden">
      <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-28 lg:pb-10 lg:overflow-y-auto lg:flex-1 lg:scrollbar-hide">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-[36px] sm:text-[44px] font-normal text-text leading-[1.05] tracking-[-0.03em] m-0" style={{ fontFamily: 'var(--font-serif)' }}>
              {org.name}<span className="text-primary">.</span>
            </h1>
            <p className="text-[13px] text-text-muted mt-2">Administrar organización · {members.length} {members.length === 1 ? 'miembro' : 'miembros'}.</p>
          </div>
        </div>

        {/* Tabs — serif italic underline */}
        <div className="flex gap-6 border-b border-gray-border mb-6">
          {(['members', 'invites', 'marca'] as const).map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2.5 pt-1 text-[15px] cursor-pointer transition-colors -mb-px border-b-2 ${
                  active
                    ? 'border-primary text-text italic'
                    : 'border-transparent text-text-hint hover:text-text'
                }`}
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {t === 'members' ? `Miembros (${members.length})` : t === 'invites' ? 'Invitaciones' : 'Marca'}
              </button>
            )
          })}
        </div>

        {tab === 'members' && (
          <div>
            {membersLoading ? (
              <div className="text-sm text-text-hint">Cargando...</div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <MemberCard key={member.id} member={member} isCurrentUser={member.user_id === userId} onRemove={() => removeMember(member.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'invites' && (
          <div>
            <button onClick={handleGenerateLink} className="mb-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors">
              + Generar link de invitacion
            </button>

            {invitesLoading ? (
              <div className="text-sm text-text-hint">Cargando...</div>
            ) : invites.length === 0 ? (
              <div className="bg-white border border-gray-border rounded-[16px] p-6 text-center">
                <div className="text-2xl mb-2">🔗</div>
                <div className="text-sm text-text-muted">No hay invitaciones activas</div>
                <div className="text-xs text-text-hint mt-1">Genera un link para invitar medicos</div>
              </div>
            ) : (
              <div className="space-y-2">
                {invites.map((invite) => {
                  const url = `${getPublicBaseUrl()}?invite=${invite.invite_code}`
                  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date()
                  const isExhausted = invite.max_uses !== null && invite.use_count >= invite.max_uses
                  return (
                    <div key={invite.id} className="bg-white border border-gray-border rounded-[16px] px-4 py-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-mono text-xs text-primary bg-primary-light px-2 py-1 rounded">{invite.invite_code}</div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${isExpired ? 'text-coral bg-coral-light' : isExhausted ? 'text-amber bg-amber-light' : 'text-teal bg-teal-light'}`}>
                          {isExpired ? 'Expirado' : isExhausted ? 'Agotado' : 'Activo'}
                        </span>
                      </div>
                      <div className="text-xs text-text-muted mb-2 truncate">{url}</div>
                      <div className="flex items-center gap-2 text-[11px] text-text-hint mb-2">
                        <span>Usos: {invite.use_count}{invite.max_uses ? `/${invite.max_uses}` : ''}</span>
                        {invite.expires_at && <span>· Expira: {new Date(invite.expires_at).toLocaleDateString('es-AR')}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleCopy(invite.invite_code)} className="text-[11px] px-3 py-1 rounded-md border border-primary-mid bg-primary-light text-primary cursor-pointer">
                          {copied === invite.invite_code ? 'Copiado!' : 'Copiar link'}
                        </button>
                        <button onClick={() => removeInvite(invite.id)} className="text-[11px] px-3 py-1 rounded-md border border-gray-border bg-white text-text-muted cursor-pointer hover:bg-gray-bg">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'marca' && (
          <BrandingTab org={org} onOrgUpdated={onOrgUpdated} />
        )}
      </div>
    </div>
  )
}

// ========= BRANDING TAB =========

function BrandingTab({ org, onOrgUpdated }: { org: Organization; onOrgUpdated: (org: Organization) => void }) {
  const [primaryColor, setPrimaryColor] = useState(org.primary_color || '#3C3489')
  const [accentColor, setAccentColor] = useState(org.accent_color || '#0F6E56')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      alert('El logo debe pesar menos de 1MB')
      return
    }
    const ext = file.name.split('.').pop() || 'png'
    const path = `${org.id}/logo.${ext}`

    setUploading(true)
    const { error: uploadError } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true })
    if (uploadError) {
      alert('Error subiendo logo: ' + uploadError.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('org-logos').getPublicUrl(path)
    const logoUrl = urlData.publicUrl + '?t=' + Date.now()

    await supabase.from('organizations').update({ logo_url: logoUrl }).eq('id', org.id)
    onOrgUpdated({ ...org, logo_url: logoUrl })
    setUploading(false)
  }

  const handleRemoveLogo = async () => {
    await supabase.from('organizations').update({ logo_url: null }).eq('id', org.id)
    onOrgUpdated({ ...org, logo_url: null })
  }

  const handleSaveColors = async () => {
    setSaving(true)
    const updates: Record<string, string | null> = {
      primary_color: primaryColor !== '#3C3489' ? primaryColor : null,
      accent_color: accentColor !== '#0F6E56' ? accentColor : null,
    }
    await supabase.from('organizations').update(updates).eq('id', org.id)
    onOrgUpdated({ ...org, ...updates })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleResetColors = async () => {
    setPrimaryColor('#3C3489')
    setAccentColor('#0F6E56')
    await supabase.from('organizations').update({ primary_color: null, accent_color: null }).eq('id', org.id)
    onOrgUpdated({ ...org, primary_color: null, accent_color: null })
  }

  const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="bg-white border border-gray-border rounded-[16px] p-5">
        <div className="text-[13px] font-semibold mb-4">Logo de la organizacion</div>
        <div className="flex items-center gap-4">
          {org.logo_url ? (
            <div className="w-20 h-20 rounded-lg border border-gray-border flex items-center justify-center bg-gray-bg p-2">
              <img src={org.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg border border-dashed border-gray-border flex items-center justify-center bg-gray-bg">
              <span className="text-2xl">🖼️</span>
            </div>
          )}
          <div>
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors">
              {uploading ? 'Subiendo...' : org.logo_url ? 'Cambiar logo' : 'Subir logo'}
              <input type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" disabled={uploading} />
            </label>
            {org.logo_url && (
              <button onClick={handleRemoveLogo} className="ml-2 text-[12px] text-text-muted cursor-pointer hover:text-coral transition-colors">
                Eliminar
              </button>
            )}
            <div className="text-[10px] text-text-hint mt-1.5">PNG, JPG o SVG. Max 1MB.</div>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white border border-gray-border rounded-[16px] p-5">
        <div className="text-[13px] font-semibold mb-4">Paleta de colores</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <ColorPicker label="Color primario" value={primaryColor} onChange={setPrimaryColor} />
          <ColorPicker label="Color de acento" value={accentColor} onChange={setAccentColor} />
        </div>

        {/* Live preview */}
        <div className="mb-4">
          <div className="text-[11px] text-text-hint uppercase tracking-wide mb-2">Preview</div>
          <div className="border border-gray-border rounded-lg p-3 bg-gray-bg">
            <div className="flex gap-2 mb-2">
              <div className="rounded-md px-3 py-1.5 text-xs text-white font-medium" style={{ backgroundColor: isValidHex(primaryColor) ? primaryColor : '#3C3489' }}>
                Boton primario
              </div>
              <div className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: isValidHex(primaryColor) ? hexToLightBg(primaryColor, 0.08) : '#EEEDFE', color: isValidHex(primaryColor) ? primaryColor : '#3C3489' }}>
                Item activo
              </div>
              <div className="rounded-full px-2 py-0.5 text-[10px] text-white font-semibold" style={{ backgroundColor: isValidHex(primaryColor) ? primaryColor : '#3C3489' }}>
                8
              </div>
            </div>
            <div className="flex gap-2">
              <div className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: isValidHex(accentColor) ? hexToLightBg(accentColor, 0.08) : '#E1F5EE', color: isValidHex(accentColor) ? accentColor : '#0F6E56' }}>
                Confirmado
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isValidHex(accentColor) ? accentColor : '#0F6E56' }} />
                <span className="text-[10px] text-text-muted">Activo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveColors}
            disabled={saving || (!isValidHex(primaryColor) || !isValidHex(accentColor))}
            className="px-4 py-2 rounded-md text-[13px] cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar colores'}
          </button>
          <button onClick={handleResetColors} className="px-4 py-2 rounded-md text-[13px] cursor-pointer border border-gray-border bg-white text-text-muted hover:bg-gray-bg transition-colors">
            Restaurar default
          </button>
          {saved && <span className="text-xs text-teal font-medium">Guardado</span>}
        </div>
      </div>
    </div>
  )
}

// ========= COLOR PICKER =========

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const isValid = /^#[0-9a-fA-F]{6}$/.test(value)
  return (
    <div>
      <div className="text-[11px] text-text-hint uppercase tracking-wide mb-1.5">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValid ? value : '#3C3489'}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-md border border-gray-border cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3C3489"
          className={`flex-1 px-3 py-2 rounded-md border text-sm font-mono focus:outline-none focus:ring-1 ${
            isValid ? 'border-gray-border focus:border-primary-mid focus:ring-primary-mid' : 'border-coral focus:border-coral focus:ring-coral'
          }`}
        />
      </div>
      {!isValid && value.length > 0 && (
        <div className="text-[10px] text-coral mt-1">Formato: #RRGGBB</div>
      )}
    </div>
  )
}

// ========= MEMBER CARD =========

function MemberCard({ member, isCurrentUser, onRemove }: { member: OrgMember; isCurrentUser: boolean; onRemove: () => void }) {
  const p = member.profiles
  const name = p ? `${p.first_name} ${p.last_name}`.trim() : 'Sin nombre'
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="bg-white border border-gray-border rounded-[16px] px-4 py-3.5 flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-sm font-semibold text-primary shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-2">
          {name}
          {isCurrentUser && <span className="text-[10px] text-text-hint">(vos)</span>}
        </div>
        <div className="text-xs text-text-muted">{p?.specialty || ''}{p?.email ? ` · ${p.email}` : ''}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${member.role === 'admin' ? 'bg-primary-light text-primary' : 'bg-gray-bg text-text-hint'}`}>
          {member.role === 'admin' ? 'Admin' : 'Miembro'}
        </span>
        {!isCurrentUser && member.role !== 'admin' && (
          <button onClick={onRemove} className="text-[11px] px-2 py-1 rounded-md border border-gray-border bg-white text-text-muted cursor-pointer hover:bg-gray-bg">
            Quitar
          </button>
        )}
      </div>
    </div>
  )
}
