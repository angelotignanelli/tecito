import { useState, useRef, useEffect } from 'react'
import type { Organization } from '../../lib/hooks'
import { PLANS, type PlanId } from '../../lib/plans'
import Icon from '../Icon'
import Logo from '../Logo'

export type View = 'agenda' | 'pacientes' | 'bloqueos' | 'estadisticas' | 'config' | 'perfil' | 'organizacion'

const navItems: { icon: string; label: string; view: View }[] = [
  { icon: 'calendar', label: 'Agenda', view: 'agenda' },
  { icon: 'users',    label: 'Pacientes', view: 'pacientes' },
  { icon: 'block',    label: 'Bloqueos', view: 'bloqueos' },
  { icon: 'chart',    label: 'Estadísticas', view: 'estadisticas' },
]

interface Props {
  activeView: View
  onNavigate: (view: View) => void
  agendaBadge?: number
  onLogout?: () => void
  doctorName?: string
  doctorSub?: string
  organizations: Organization[]
  currentOrg: Organization | null
  isOrgAdmin: boolean
  onSwitchOrg: (org: Organization | null) => void
  onCreateOrg: () => void
  currentPlan?: PlanId
  planStatus?: string | null
  planValidUntil?: string | null
  onOpenPlans?: () => void
  /** Opens the "Mi link de turnos" modal — surfaced as a top-level
   * sidebar item so the share affordance lives one click away from
   * everywhere in the app, not buried in Mi perfil. */
  onOpenMyLink?: () => void
}

export default function Sidebar({ activeView, onNavigate, agendaBadge, onLogout, doctorName, doctorSub, organizations, currentOrg, isOrgAdmin, onSwitchOrg, onCreateOrg, currentPlan, planStatus, planValidUntil, onOpenPlans, onOpenMyLink }: Props) {
  const showStatsLock = currentPlan ? !PLANS[currentPlan].limits.stats : false
  const [orgOpen, setOrgOpen] = useState(false)
  const orgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isOrg = !!currentOrg
  const displayName = isOrg ? currentOrg.name : (doctorName || 'Tecito')
  const displaySub = isOrg ? (isOrgAdmin ? 'Admin' : 'Miembro') : (doctorSub || 'Personal')
  const initials = isOrg
    ? currentOrg.name[0].toUpperCase()
    : doctorName ? doctorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'MB'
  const hasLogo = isOrg && currentOrg.logo_url

  const bottomTabView: View = isOrg ? 'organizacion' : 'perfil'
  const bottomTabLabel = isOrg ? 'Organización' : 'Mi perfil'
  const bottomTabIcon = isOrg ? 'building' : 'user'

  return (
    <aside className="hidden lg:flex w-[220px] bg-surface border-r border-gray-border flex-col shrink-0 h-screen">
      {/* Profile/Org switcher */}
      <div className="px-3.5 py-3.5 border-b border-gray-border relative" ref={orgRef}>
        <div
          onClick={() => setOrgOpen(!orgOpen)}
          className="flex items-center gap-2.5 px-1.5 py-1 rounded-lg cursor-pointer hover:bg-surface-2 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-surface grid place-items-center text-[13px] font-serif shrink-0 overflow-hidden"
            style={{ fontFamily: 'var(--font-serif)' }}>
            {hasLogo ? (
              <img src={currentOrg.logo_url!} alt="" className="w-full h-full object-cover" />
            ) : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-text truncate">{displayName}</div>
            <div className="text-[10px] text-text-hint truncate">{displaySub}</div>
          </div>
          <Icon name="chevD" size={14} style={{ color: 'var(--color-text-hint)' }} />
        </div>

        {orgOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-surface border border-gray-border rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.08)] z-50 py-1 overflow-hidden">
            <button
              onClick={() => { onSwitchOrg(null); setOrgOpen(false) }}
              className={`w-full px-3 py-2 text-[12px] text-left cursor-pointer hover:bg-surface-2 transition-colors flex items-center gap-2 ${
                !currentOrg ? 'bg-primary-light text-primary font-medium' : 'text-text'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-surface-2 grid place-items-center text-[9px] font-serif text-text-hint"
                style={{ fontFamily: 'var(--font-serif)' }}>P</span>
              Personal
            </button>

            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => { onSwitchOrg(org); setOrgOpen(false) }}
                className={`w-full px-3 py-2 text-[12px] text-left cursor-pointer hover:bg-surface-2 transition-colors flex items-center gap-2 ${
                  currentOrg?.id === org.id ? 'bg-primary-light text-primary font-medium' : 'text-text'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-primary-light grid place-items-center text-[9px] font-serif text-primary"
                  style={{ fontFamily: 'var(--font-serif)' }}>
                  {org.name[0].toUpperCase()}
                </span>
                <span className="truncate">{org.name}</span>
              </button>
            ))}

            <div className="border-t border-gray-border my-1" />
            <button
              onClick={() => { onCreateOrg(); setOrgOpen(false) }}
              className="w-full px-3 py-2 text-[12px] text-left cursor-pointer hover:bg-surface-2 transition-colors text-primary font-medium"
            >
              + Crear organización
            </button>
          </div>
        )}
      </div>

      {/* Primary nav */}
      <nav className="p-3 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeView === item.view
          return (
            <div
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-[13px] mb-0.5 transition-colors ${
                isActive
                  ? 'bg-primary-light text-primary font-medium'
                  : 'text-text-muted hover:bg-surface-2'
              }`}
            >
              <Icon name={item.icon} size={16} />
              <span className="flex-1">{item.label}</span>
              {item.view === 'agenda' && agendaBadge != null && agendaBadge > 0 && (
                <span className="bg-primary text-surface text-[10px] font-semibold px-[7px] py-px rounded-full">
                  {agendaBadge}
                </span>
              )}
              {item.view === 'estadisticas' && showStatsLock && (
                <span className="bg-primary text-surface text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded-full">
                  Pro
                </span>
              )}
            </div>
          )
        })}

        {/* "Mi link" — opens a modal, not a view. We render it inline
            with the nav so it feels native, but click handler differs. */}
        {onOpenMyLink && (
          <div
            onClick={onOpenMyLink}
            className="flex items-center gap-2.5 px-2.5 py-2 mt-1 rounded-lg cursor-pointer text-[13px] text-text-muted hover:bg-surface-2 transition-colors"
          >
            <Icon name="link" size={16} />
            <span className="flex-1">Mi link</span>
          </div>
        )}
      </nav>

      {/* Bottom nav */}
      <div className="p-3 border-t border-gray-border">
        <div
          onClick={() => onNavigate(bottomTabView)}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-[13px] mb-0.5 transition-colors ${
            activeView === bottomTabView
              ? 'bg-primary-light text-primary font-medium'
              : 'text-text-muted hover:bg-surface-2'
          }`}
        >
          <Icon name={bottomTabIcon} size={16} />
          <span className="flex-1">{bottomTabLabel}</span>
        </div>
        {onLogout && (
          <div
            onClick={onLogout}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-[13px] text-text-muted hover:bg-surface-2 transition-colors"
          >
            <Icon name="logout" size={16} />
            <span>Cerrar sesión</span>
          </div>
        )}
      </div>

      {/* Brand + plan status.
          The plan pill lives at the bottom so it's always visible but doesn't
          compete with primary navigation. Click anywhere on the row to open
          /planes — makes upgrade / resubscribe one tap away from every screen. */}
      <button
        type="button"
        onClick={onOpenPlans}
        disabled={!onOpenPlans}
        className="w-full text-left px-[18px] py-[14px] border-t border-gray-border bg-transparent border-l-0 border-r-0 border-b-0 enabled:hover:bg-surface-2 enabled:cursor-pointer transition-colors disabled:cursor-default"
      >
        {currentOrg?.logo_url ? (
          <img src={currentOrg.logo_url} alt={currentOrg.name} className="h-6 max-w-[120px] object-contain" />
        ) : (
          <Logo variant="full" size={22} />
        )}
        <div className="mt-[3px] flex items-center gap-1.5 flex-wrap">
          <PlanPill plan={currentPlan} status={planStatus} />
          <PlanHint plan={currentPlan} status={planStatus} validUntil={planValidUntil} />
        </div>
      </button>
    </aside>
  )
}

// ────────────────────────────────────────────────────────────────
// Plan status chip. Kept in this file so the sidebar stays self-contained —
// this is the only place it renders. Visual language mirrors the status
// banner on /planes (teal = healthy, amber = wind-down, coral = failed).
// ────────────────────────────────────────────────────────────────

function PlanPill({ plan, status }: { plan?: PlanId; status?: string | null }) {
  const label = plan ? PLANS[plan].name : 'Free'
  // Paid + healthy = teal badge (signals active subscription).
  // Paid + wind-down (cancelled/past_due/expired) = amber/coral so the user
  // notices they need to act.
  // Free = neutral chip.
  const tone =
    plan === 'free' || !plan
      ? 'bg-surface-2 text-text-muted'
      : status === 'past_due'
        ? 'bg-coral-light text-coral'
        : status === 'cancelled' || status === 'expired'
          ? 'bg-amber-light text-amber'
          : 'bg-teal-light text-teal'

  return (
    <span
      className={`px-[7px] py-[1px] rounded-full text-[9px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap ${tone}`}
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {label}
    </span>
  )
}

function PlanHint({
  plan,
  status,
  validUntil,
}: {
  plan?: PlanId
  status?: string | null
  validUntil?: string | null
}) {
  if (plan === 'free' || !plan) {
    return <span className="text-[10px] text-text-hint">Actualizar →</span>
  }
  if (status === 'cancelled' && validUntil) {
    const when = new Date(validUntil).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    return <span className="text-[10px] text-text-hint">Hasta {when}</span>
  }
  if (status === 'past_due') {
    return <span className="text-[10px] text-coral">Revisar pago</span>
  }
  if (status === 'trialing' && validUntil) {
    const when = new Date(validUntil).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    return <span className="text-[10px] text-text-hint">Prueba · {when}</span>
  }
  if (status === 'expired') {
    return <span className="text-[10px] text-text-hint">Vencido</span>
  }
  // active, healthy — just show "Panel profesional" so the layout doesn't
  // look empty; the teal pill already tells the story.
  return <span className="text-[10px] text-text-hint">Panel profesional</span>
}
