import Icon from '../Icon'
import type { View } from './Sidebar'

interface NavItem {
  icon: string
  label: string
  view: View
}

const items: NavItem[] = [
  { icon: 'calendar', label: 'Hoy', view: 'agenda' },
  { icon: 'users', label: 'Pacientes', view: 'pacientes' },
  { icon: 'block', label: 'Bloqueos', view: 'bloqueos' },
  { icon: 'user', label: 'Perfil', view: 'perfil' },
]

interface Props {
  activeView: View
  onNavigate: (view: View) => void
  /** Whether to surface the "Mi link" tab. On mobile, "Mi link" is a
   * full-screen section (not a modal), so tapping the tab navigates
   * to the dedicated `mi-link` view rather than opening an overlay. */
  showMyLink?: boolean
}

/**
 * Bottom tab bar shown only below the lg breakpoint. Replaces the
 * desktop sidebar on phones. Visual reference: Clinical Calm mobile
 * handoff — translucent background with backdrop-blur, primary color
 * for the active tab, and a safe-area pad at the bottom so iOS home
 * indicator doesn't overlap the labels.
 */
export default function MobileNav({ activeView, onNavigate, showMyLink }: Props) {
  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-border"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 14px)',
        paddingTop: 8,
      }}
    >
      <div className="flex justify-around">
        {items.map((item) => {
          const isActive = activeView === item.view
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer transition-colors ${
                isActive ? 'text-primary' : 'text-text-hint hover:text-text'
              }`}
            >
              <Icon name={item.icon} size={22} stroke={isActive ? 2 : 1.6} />
              <div
                className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}
              >
                {item.label}
              </div>
            </button>
          )
        })}
        {showMyLink && (
          <button
            type="button"
            onClick={() => onNavigate('mi-link')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer transition-colors ${
              activeView === 'mi-link' ? 'text-primary' : 'text-text-hint hover:text-text'
            }`}
          >
            <Icon name="link" size={22} stroke={activeView === 'mi-link' ? 2 : 1.6} />
            <div
              className={`text-[10px] mt-0.5 ${
                activeView === 'mi-link' ? 'font-semibold' : 'font-medium'
              }`}
            >
              Mi link
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
