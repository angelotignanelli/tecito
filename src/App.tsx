import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { getWeekForDate, shiftWeek, getDatesBetween, type Appointment, type Patient, type DateBlock } from './data/appointments'
import { useProfile, usePatients, useAppointments, useOrgAppointments, useOrgPatients, useDateBlocks, useOrgDateBlocks, useOrganizations, useLocations, type Organization } from './lib/hooks'
import { applyOrgTheme, clearOrgTheme } from './lib/theme'
import Sidebar, { type View } from './components/layout/Sidebar'
import MobileNav from './components/layout/MobileNav'
import DayNav from './components/agenda/DayNav'
import AppointmentList from './components/agenda/AppointmentList'
import { MobileAgendaGreeting, MobileNextTurnoCard } from './components/agenda/MobileAgendaHero'
import PatientPanel from './components/patient/PatientPanel'
import PatientsView from './components/patients/PatientsView'
import PatientDetailPanel from './components/patients/PatientDetailPanel'
import BlocksView from './components/blocks/BlocksView'
import MonthCalendar from './components/agenda/MonthCalendar'
import StatsView from './components/stats/StatsView'
import DoctorProfileView from './components/profile/DoctorProfileView'
import PlansView from './components/plans/PlansView'
import PaywallModal from './components/plans/PaywallModal'
import { canAddPatient, canCreateOrg, canCustomBranding, PLANS, type PlanId } from './lib/plans'
import LoginView from './components/auth/LoginView'
import RegisterView from './components/auth/RegisterView'
import ResetPasswordView from './components/auth/ResetPasswordView'
import LandingView from './components/landing/LandingView'
import Logo from './components/Logo'
import OrgAdminView from './components/org/OrgAdminView'
import JoinOrgView from './components/org/JoinOrgView'
import CreateOrgModal from './components/org/CreateOrgModal'
import OnboardingWizard from './components/onboarding/OnboardingWizard'
import PublicBookingPage from './components/public/PublicBookingPage'
import NotFoundView from './components/public/NotFoundView'
import Icon from './components/Icon'
import Btn from './components/Btn'
import PageHeader from './components/PageHeader'
import NewAppointmentModal from './components/agenda/NewAppointmentModal'
import RemindersModal from './components/agenda/RemindersModal'
import MyLinkModal from './components/share/MyLinkModal'
import MyLinkSection from './components/share/MyLinkSection'

type AuthScreen = 'loading' | 'landing' | 'login' | 'register' | 'reset-password' | 'onboarding' | 'join-org' | 'app' | 'public-booking' | 'not-found'

/** Map an unauthenticated URL path to the screen the user should see. Used
 * both on initial mount and on browser back/forward (popstate). */
function unauthScreenForPath(path: string): AuthScreen {
  if (path === '/login') return 'login'
  if (path === '/register') return 'register'
  return 'landing'
}
type AgendaMode = 'week' | 'month'

export default function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('loading')
  const [userFirstName, setUserFirstName] = useState('')
  const [userLastName, setUserLastName] = useState('')
  const [pendingInvite, setPendingInvite] = useState<string | null>(null)
  const [publicBookingCode, setPublicBookingCode] = useState<string | null>(null)

  useEffect(() => {
    const pathname = window.location.pathname

    // Detect public booking URL: /p/:code
    const pathMatch = pathname.match(/^\/p\/([a-f0-9]{8})\/?$/)
    if (pathMatch) {
      setPublicBookingCode(pathMatch[1])
      setAuthScreen('public-booking')
      return
    }

    // Any other /p/* shape (wrong length / invalid chars) is a public 404.
    if (/^\/p(\/|$)/.test(pathname)) {
      setAuthScreen('not-found')
      return
    }

    // Detect invite code in URL
    const params = new URLSearchParams(window.location.search)
    const inviteCode = params.get('invite')
    if (inviteCode) {
      localStorage.setItem('pending_invite', inviteCode)
      window.history.replaceState({}, '', window.location.pathname)
    }

    // SAFETY NET for password recovery:
    // When the user clicks the recovery link from their email, Supabase
    // redirects back to the site with `#access_token=...&type=recovery` in
    // the URL hash. Supabase-js then auto-fires the PASSWORD_RECOVERY auth
    // event — but if our `onAuthStateChange` listener attaches *after* that
    // event fires, we miss it and route the user to the dashboard / landing
    // instead. Parsing the hash ourselves on mount avoids that race
    // entirely. Also handles the case where the hash format changes between
    // supabase-js versions.
    const isRecovery =
      /[#&?]type=recovery(\b|&)/.test(window.location.hash) ||
      /[#&?]type=recovery(\b|&)/.test(window.location.search)
    if (isRecovery) {
      setAuthScreen('reset-password')
      return
    }

    // For unauthenticated users: /login → LoginView, /register → RegisterView,
    // anything else (including /) → marketing landing. The mapping is the
    // file-level `unauthScreenForPath` helper. We let /login and /register
    // persist in the URL during dev too, so a refresh lands you back on the
    // same screen instead of bouncing to the landing.

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadProfile(session.user.id)
      } else {
        setAuthScreen(unauthScreenForPath(pathname))
      }
    })

    // Listen for auth changes. Special case: PASSWORD_RECOVERY fires when the
    // user clicks the recovery link from their email and Supabase puts them
    // in a temporary recovery session. We MUST intercept this *before* the
    // generic `if (session)` branch — otherwise we'd auto-route them into the
    // dashboard and they'd never get the chance to set a new password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthScreen('reset-password')
        return
      }
      if (session) {
        loadProfile(session.user.id)
      } else {
        setAuthScreen(unauthScreenForPath(window.location.pathname))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Handle browser back/forward when the user is on the auth screens.
  // Without this, going landing → login → "back" leaves the user stuck on
  // login (URL changes to /, but React state stays at 'login'). Same for
  // login → register → "back". We only react when the current screen is
  // an unauthenticated one — the Dashboard has its own popstate handlers
  // for modal dismissal.
  useEffect(() => {
    if (!['landing', 'login', 'register'].includes(authScreen)) return
    const onPopState = () => {
      setAuthScreen(unauthScreenForPath(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [authScreen])

  // After any successful auth transition (login → app/onboarding, register
  // → login, etc.) we collapse the URL back to `/`. Without this the URL
  // lingers at `/login` or `/register` even after the user is fully inside
  // the dashboard, which means: (a) back button takes them to the auth
  // screen instead of the landing, and (b) if Supabase refreshes the token
  // and momentarily sees no session, our unauthScreenForPath() reads the
  // stale auth URL and pops up LoginView in the middle of their session.
  // replaceState (not pushState) — we want to overwrite the auth entry,
  // not push a new one.
  const collapseUrlToRoot = () => {
    const path = window.location.pathname
    if (path === '/login' || path === '/register') {
      window.history.replaceState({}, '', '/')
    }
  }

  const loadProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, needs_onboarding')
      .eq('id', userId)
      .single()

    if (profile) {
      setUserFirstName(profile.first_name || '')
      setUserLastName(profile.last_name || '')
      if (profile.needs_onboarding) {
        collapseUrlToRoot()
        setAuthScreen('onboarding')
      } else {
        const invite = localStorage.getItem('pending_invite')
        if (invite) {
          setPendingInvite(invite)
          collapseUrlToRoot()
          setAuthScreen('join-org')
        } else {
          collapseUrlToRoot()
          setAuthScreen('app')
        }
      }
    } else {
      collapseUrlToRoot()
      setAuthScreen('onboarding')
    }
  }

  const handleLoginSuccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) loadProfile(user.id)
  }

  const handleRegisterSuccess = () => {
    // After register, we drop into the login screen (so the user explicitly
    // logs in with the password they just set). Replace the URL too so
    // /register doesn't linger.
    window.history.replaceState({}, '', '/login')
    setAuthScreen('login')
  }

  const handleOnboardingComplete = () => {
    setAuthScreen('app')
  }

  const handleLogout = async () => {
    // After signing out we drop the user on /login (not on the marketing
    // landing). They've already converted; bouncing them back to the
    // landing page feels disorienting and adds friction if they meant to
    // re-login from another account.
    await supabase.auth.signOut()
    window.history.pushState({}, '', '/login')
    setAuthScreen('login')
    setUserFirstName('')
    setUserLastName('')
  }

  const goToLogin = () => {
    window.history.pushState({}, '', '/login')
    setAuthScreen('login')
  }

  const goToRegister = () => {
    window.history.pushState({}, '', '/register')
    setAuthScreen('register')
  }

  if (authScreen === 'public-booking' && publicBookingCode) {
    return <PublicBookingPage bookingCode={publicBookingCode} />
  }

  if (authScreen === 'not-found') {
    return <NotFoundView />
  }

  if (authScreen === 'loading') {
    return (
      <div className="min-h-screen bg-gray-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Logo variant="mark" size={48} />
          <div className="text-sm text-text-hint">Cargando…</div>
        </div>
      </div>
    )
  }

  if (authScreen === 'landing') {
    return <LandingView onGoToLogin={goToLogin} onGoToRegister={goToRegister} />
  }

  if (authScreen === 'login') {
    return <LoginView onLoginSuccess={handleLoginSuccess} onGoToRegister={goToRegister} />
  }

  if (authScreen === 'register') {
    return <RegisterView onRegisterSuccess={handleRegisterSuccess} onGoToLogin={goToLogin} />
  }

  if (authScreen === 'reset-password') {
    return (
      <ResetPasswordView
        onResetComplete={() => {
          // After saving a new password we sign out (in ResetPasswordView).
          // Send the user to /login fresh so they re-authenticate.
          window.history.replaceState({}, '', '/login')
          setAuthScreen('login')
        }}
      />
    )
  }

  if (authScreen === 'onboarding') {
    return <OnboardingWizard firstName={userFirstName} lastName={userLastName} onComplete={handleOnboardingComplete} />
  }

  if (authScreen === 'join-org' && pendingInvite) {
    return (
      <JoinOrgView
        inviteCode={pendingInvite}
        onJoined={() => {
          localStorage.removeItem('pending_invite')
          setPendingInvite(null)
          setAuthScreen('app')
        }}
        onSkip={() => {
          localStorage.removeItem('pending_invite')
          setPendingInvite(null)
          setAuthScreen('app')
        }}
      />
    )
  }

  return <Dashboard onLogout={handleLogout} />
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<View>('agenda')
  const [agendaMode, setAgendaMode] = useState<AgendaMode>('week')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [showPlans, setShowPlans] = useState(false)
  const [showMyLink, setShowMyLink] = useState(false)
  const [paywall, setPaywall] = useState<{ title: string; description: string; requiredPlan: 'pro' | 'clinic' } | null>(null)
  const [showNewAppointment, setShowNewAppointment] = useState(false)
  const [reasignarFor, setReasignarFor] = useState<Patient | null>(null)
  const [modalIntent, setModalIntent] = useState<'new' | 'reasignar' | 'schedule-for-patient'>('new')

  /** Centralized entry point for the "Nuevo turno" flow. On mobile we
   * route to the dedicated `nuevo-turno` view (full-screen section,
   * back button works). On desktop we keep the floating modal so the
   * user doesn't lose their agenda context. */
  const openNewAppointment = (config: {
    patient?: Patient | null
    intent?: 'new' | 'reasignar' | 'schedule-for-patient'
  } = {}) => {
    setReasignarFor(config.patient ?? null)
    setModalIntent(config.intent ?? 'new')
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia('(min-width: 1024px)').matches
    if (isDesktop) {
      setShowNewAppointment(true)
    } else {
      setActiveView('nuevo-turno')
    }
  }
  const closeNewAppointment = () => {
    setShowNewAppointment(false)
    setReasignarFor(null)
    setModalIntent('new')
    if (activeView === 'nuevo-turno') setActiveView('agenda')
  }
  const [remindersMode, setRemindersMode] = useState<'day' | Appointment | null>(null)

  // Load user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // Make the Plans modal back-button-aware. When the user opens Plans,
  // we push a no-op history entry so a browser back press can dismiss
  // the modal — matching what the X button does. Without this, "back"
  // pops the dashboard's previous browser entry (often the OAuth
  // redirect), kicking the user out of the app entirely.
  //
  // Same idea for the paywall modal: it interrupts a flow, and back
  // should close it cleanly instead of escaping.
  useEffect(() => {
    if (!showPlans && !paywall) return
    window.history.pushState({ tecitoModal: true }, '', window.location.href)
    const onPop = () => {
      setShowPlans(false)
      setPaywall(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [showPlans, paywall])

  // Supabase data hooks
  const { profile } = useProfile(userId)
  const { organizations, memberships, create: createOrg } = useOrganizations(userId)
  const { patients: supaPatients, patientRows: supaPatientRows, loading: patientsLoading, add: addPatient, remove: removePatient } = usePatients(userId)
  const { appointments: supaAppointments, loading: apptsLoading, updateStatus: updateApptStatus, add: addAppointment } = useAppointments(userId)
  const { appointments: orgAppointments } = useOrgAppointments(currentOrg?.id ?? null)
  const { patients: orgPatients } = useOrgPatients(currentOrg?.id ?? null)
  const { blocks: orgBlocks } = useOrgDateBlocks(currentOrg?.id ?? null)
  const { blocks: supaBlocks, loading: blocksLoading, add: addBlock, remove: removeBlock } = useDateBlocks(userId)
  const { locations } = useLocations(userId)

  // Apply org theme
  useEffect(() => {
    if (currentOrg) {
      applyOrgTheme(currentOrg.primary_color, currentOrg.accent_color)
    } else {
      clearOrgTheme()
    }
    return () => clearOrgTheme()
  }, [currentOrg])

  // Only real Supabase data — no mock fallbacks.
  const hasSupaData = supaAppointments.length > 0
  const appointments = currentOrg ? orgAppointments : supaAppointments
  const patients = currentOrg ? orgPatients : supaPatients
  const blocks = currentOrg ? orgBlocks : supaBlocks

  const weekDays = getWeekForDate(selectedDate)
  const filteredAppointments = appointments.filter((a) => a.date === selectedDate)
  const selectedAppointment = appointments.find((a) => a.id === selectedId) ?? null
  const today = new Date().toISOString().split('T')[0]
  const todayAppointments = appointments.filter((a) => a.date === today)

  const blockedDates = useMemo(() => {
    const set = new Set<string>()
    for (const block of blocks) {
      for (const date of getDatesBetween(block.from, block.to)) {
        set.add(date)
      }
    }
    return set
  }, [blocks])

  const isSelectedDateBlocked = blockedDates.has(selectedDate)
  const blockForSelectedDate = blocks.find((b) => selectedDate >= b.from && selectedDate <= b.to)

  const handleSelect = (appointment: Appointment) => {
    setSelectedId((prev) => (prev === appointment.id ? null : appointment.id))
  }

  const handleDaySelect = (date: string) => {
    setSelectedDate(date)
    setSelectedId(null)
  }

  const handleMonthDaySelect = (date: string) => {
    setSelectedDate(date)
    setSelectedId(null)
  }

  const handlePrevWeek = () => {
    setSelectedDate((prev) => shiftWeek(prev, -1))
    setSelectedId(null)
  }

  const handleNextWeek = () => {
    setSelectedDate((prev) => shiftWeek(prev, 1))
    setSelectedId(null)
  }

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 0) { setCalendarYear((y) => y - 1); return 11 }
      return prev - 1
    })
  }

  const handleNextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev === 11) { setCalendarYear((y) => y + 1); return 0 }
      return prev + 1
    })
  }

  const handleCancel = async (id: string) => {
    if (hasSupaData) {
      await updateApptStatus(id, 'cancelado')
    }
    // Also update local state for immediate feedback
    // (hook already updates via setAppointments in updateStatus)
  }

  const handleRecordar = (appointment: Appointment) => {
    setRemindersMode(appointment)
  }

  const handleRecordarTodos = () => {
    setRemindersMode('day')
  }

  const handleReasignar = (appointment: Appointment) => {
    openModalForPatientFromAppointment(appointment, 'reasignar')
  }

  const handleScheduleFromPatient = (appointment: Appointment) => {
    openModalForPatientFromAppointment(appointment, 'schedule-for-patient')
  }

  const openModalForPatientFromAppointment = (
    appointment: Appointment,
    intent: 'reasignar' | 'schedule-for-patient',
  ) => {
    const match = supaPatients.find((p) => p.name === appointment.patientName)
    const patient: Patient = match ?? {
      name: appointment.patientName ?? 'Paciente',
      phone: '',
      email: '',
      age: '',
      since: '',
      insurance: 'Particular',
      lastVisit: '',
      totalSessions: 0,
      tags: [],
      history: [],
    }
    openNewAppointment({ patient, intent })
  }

  const isOrgAdmin = currentOrg ? memberships[currentOrg.id] === 'admin' : false

  const currentPlan = (profile?.plan || 'free') as PlanId

  const handleNavigate = (view: View) => {
    // Paywall: estadísticas require Pro (hidden gem, real upsell)
    if (view === 'estadisticas' && !PLANS[currentPlan].limits.stats) {
      setPaywall({
        title: 'Estadísticas completas',
        description: 'Ocupación del mes, turnos por día, obras sociales más frecuentes y más. Disponible desde el plan Pro.',
        requiredPlan: 'pro',
      })
      return
    }
    setActiveView(view)
    setSelectedPatient(null)
  }

  const handleSwitchOrg = (org: Organization | null) => {
    setCurrentOrg(org)
    setActiveView('agenda')
  }

  const handleCreateOrgAttempt = () => {
    if (!canCreateOrg(currentPlan)) {
      setPaywall({
        title: 'Gestión multi-profesional',
        description: 'Para crear organizaciones y sumar médicos a tu consultorio necesitás el plan Clinic.',
        requiredPlan: 'clinic',
      })
      return
    }
    setShowCreateOrg(true)
  }

  const handleAddBlock = async (data: Omit<DateBlock, 'id' | 'createdAt'>) => {
    await addBlock({ from: data.from, to: data.to, reason: data.reason })
  }

  const handleRemoveBlock = async (id: string) => {
    await removeBlock(id)
  }

  const handleUnblockDate = () => {
    if (blockForSelectedDate) {
      handleRemoveBlock(blockForSelectedDate.id)
    }
  }

  const handleBlockHours = async (date: string, from: string, to: string) => {
    // Update affected appointments to bloqueado
    for (const a of appointments) {
      if (a.date === date && a.time >= from && a.time < to) {
        if (a.status !== 'libre' && a.status !== 'bloqueado') {
          await updateApptStatus(a.id, 'bloqueado', `Turno cancelado · ${a.detail}`)
        } else if (a.status === 'libre') {
          await updateApptStatus(a.id, 'bloqueado')
        }
      }
    }
    // Add blocked slot entries for times without existing appointments
    const existingTimes = new Set(appointments.filter((a) => a.date === date).map((a) => a.time))
    const [startH] = from.split(':').map(Number)
    const [endH] = to.split(':').map(Number)
    for (let h = startH; h < endH; h++) {
      const time = `${String(h).padStart(2, '0')}:00`
      if (!existingTimes.has(time)) {
        await addAppointment({
          patient_id: null,
          date,
          time,
          duration: '50 min',
          patient_name: null,
          detail: '',
          status: 'bloqueado',
        })
      }
    }
  }

  const handleToggleAgendaMode = () => {
    if (agendaMode === 'week') {
      const d = new Date(selectedDate + 'T12:00:00')
      setCalendarMonth(d.getMonth())
      setCalendarYear(d.getFullYear())
      setAgendaMode('month')
    } else {
      setAgendaMode('week')
    }
  }

  const currentDay = weekDays.find((d) => d.date === selectedDate)
  const dayLabel = currentDay ? currentDay.label.replace('Hoy ', '') : selectedDate.slice(5)
  const todayISO = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === todayISO
  const selectedDateObj = new Date(selectedDate + 'T12:00:00')
  const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const heroTitle = isToday ? 'Hoy' : weekdays[selectedDateObj.getDay()]
  const heroSubtitle = `${weekdays[selectedDateObj.getDay()]} ${selectedDateObj.getDate()} de ${months[selectedDateObj.getMonth()]}`
  const confirmadosCount = filteredAppointments.filter((a) => a.status === 'confirmado').length
  const pendientesCount = filteredAppointments.filter((a) => a.status === 'pendiente').length
  const canceladosCount = filteredAppointments.filter((a) => a.status === 'cancelado').length

  return (
    /* The h-dvh + nested-scroll architecture is desktop-only. On
       mobile we let the document scroll natively, which restores iOS
       Safari's URL-bar collapse, rubber-band momentum and pull-to-
       refresh — i.e. the platform's scroll feel the user expects.
       Each view's outer/inner wrappers follow the same lg:* pattern:
       block-flow below lg, height-constrained nested scroller from lg
       up. The Sidebar (hidden lg:flex) and MobileNav (fixed bottom)
       sit on their own layers so the document body has no obstacle. */
    <div className="lg:flex lg:h-dvh lg:overflow-hidden">
      <Sidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        agendaBadge={todayAppointments.length}
        onLogout={onLogout}
        doctorName={profile ? `${profile.first_name} ${profile.last_name}`.trim() : undefined}
        doctorSub={profile ? [profile.specialty, profile.license ? `Mat. ${profile.license}` : ''].filter(Boolean).join(' · ') : undefined}
        organizations={organizations}
        currentOrg={currentOrg}
        isOrgAdmin={isOrgAdmin}
        onSwitchOrg={handleSwitchOrg}
        onCreateOrg={handleCreateOrgAttempt}
        currentPlan={currentPlan}
        planStatus={profile?.plan_status ?? null}
        planValidUntil={profile?.plan_valid_until ?? null}
        onOpenPlans={() => setShowPlans(true)}
        onOpenMyLink={profile?.booking_code ? () => setShowMyLink(true) : undefined}
      />

      {activeView === 'agenda' && (
        <>
          <div className="bg-bg lg:flex-1 lg:flex lg:flex-col lg:h-screen lg:overflow-hidden">
            <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-28 lg:pb-10 lg:overflow-y-auto lg:flex-1 lg:scrollbar-hide">
              {/* Mobile-only greeting — replaces the desktop PageHeader
                  on small screens. The Próximo-turno card is rendered
                  separately below the DayNav so the day selector stays
                  visible above the fold. */}
              <MobileAgendaGreeting
                appointments={filteredAppointments}
                selectedDate={selectedDate}
                doctorFirstName={profile?.first_name ?? undefined}
                onRecordar={(a) => setRemindersMode(a)}
                onSelect={(a) => setSelectedId(a.id)}
              />

              <div className="hidden lg:block">
              <PageHeader
                title="Agenda."
                subtitle={<span className="capitalize">{heroSubtitle} · {filteredAppointments.length} {filteredAppointments.length === 1 ? 'turno programado' : 'turnos programados'}</span>}
                right={
                  <>
                    <div className="inline-flex items-stretch h-[34px] bg-surface border border-gray-border-2 rounded-[8px] overflow-hidden">
                      {(['week', 'month'] as const).map((mode, i) => {
                        const active = agendaMode === mode
                        return (
                          <button
                            key={mode}
                            onClick={() => {
                              if (mode === 'month' && agendaMode === 'week') handleToggleAgendaMode()
                              else if (mode === 'week' && agendaMode === 'month') handleToggleAgendaMode()
                            }}
                            className={`px-4 text-[12px] font-medium cursor-pointer transition-colors ${
                              i === 0 ? 'border-r border-gray-border-2' : ''
                            } ${
                              active
                                ? 'bg-primary text-surface'
                                : 'bg-surface text-text-muted hover:bg-surface-2'
                            }`}
                          >
                            {mode === 'week' ? 'Semana' : 'Mes'}
                          </button>
                        )
                      })}
                    </div>
                    <Btn
                      variant="primary"
                      onClick={() => openNewAppointment()}
                      style={{ height: 34 }}
                    >
                      <Icon name="plus" size={13} /> Nuevo turno
                    </Btn>
                  </>
                }
              />
              </div>

              {agendaMode === 'week' ? (
                <>
                  {/* Week nav */}
                  <div className="mb-5">
                    <DayNav
                      days={weekDays}
                      selectedDate={selectedDate}
                      blockedDates={blockedDates}
                      onSelect={handleDaySelect}
                      onPrevWeek={handlePrevWeek}
                      onNextWeek={handleNextWeek}
                      appointmentCounts={weekDays.reduce((acc, d) => {
                        acc[d.date] = appointments.filter((a) => a.date === d.date).length
                        return acc
                      }, {} as Record<string, number>)}
                    />
                  </div>

                  {/* Stat strip — 4 cols inside single card with dividers.
                      Hidden on mobile: the MobileAgendaHero already
                      surfaces total + pendientes inside its narrative
                      (e.g. "Tenés 3 turnos, 1 sin avisar"), so the strip
                      was redundant noise on phones. */}
                  <div className="hidden lg:grid bg-surface border border-gray-border rounded-[12px] overflow-hidden mb-5 grid-cols-4 divide-x divide-gray-border">
                    {[
                      { label: 'Total', value: filteredAppointments.length, dot: 'hint' as const },
                      { label: 'Confirmados', value: confirmadosCount, dot: 'teal' as const },
                      { label: 'Pendientes', value: pendientesCount, dot: 'amber' as const },
                      { label: 'Cancelados', value: canceladosCount, dot: 'coral' as const },
                    ].map((s) => (
                      <div key={s.label} className="px-5 py-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            s.dot === 'teal' ? 'bg-teal'
                              : s.dot === 'amber' ? 'bg-amber'
                                : s.dot === 'coral' ? 'bg-coral'
                                  : 'bg-text-dim'
                          }`} />
                          <span className="text-[10px] text-text-hint uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--font-mono)' }}>
                            {s.label}
                          </span>
                        </div>
                        <div className="text-[26px] leading-none tracking-[-0.02em] text-text" style={{ fontFamily: 'var(--font-serif)' }}>
                          {s.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {isSelectedDateBlocked && (
                    <div className="flex items-center gap-2 bg-coral-light border border-gray-border rounded-[12px] px-4 py-3 mb-5">
                      <Icon name="block" size={14} style={{ color: 'var(--color-coral)' }} />
                      <span className="text-[12px] text-coral font-medium flex-1">
                        Día bloqueado — {blockForSelectedDate?.reason ?? 'Bloqueado'}
                      </span>
                      <Btn size="sm" variant="danger" onClick={handleUnblockDate}>Desbloquear</Btn>
                    </div>
                  )}

                  {/* Próximo turno card — sits below the blocked-day
                      banner (if any) and the stat strip on desktop,
                      right above the turno list. On mobile this is
                      the "first hint of action" for the selected day. */}
                  <MobileNextTurnoCard
                    appointments={filteredAppointments}
                    selectedDate={selectedDate}
                    doctorFirstName={profile?.first_name ?? undefined}
                    onRecordar={(a) => setRemindersMode(a)}
                    onSelect={(a) => setSelectedId(a.id)}
                  />

                  {/* Appointment list */}
                  <AppointmentList
                    appointments={filteredAppointments}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    onCancel={handleCancel}
                    onRecordar={handleRecordar}
                    onReasignar={handleReasignar}
                    dayLabel={dayLabel}
                    locations={locations}
                  />

                  {isSelectedDateBlocked && filteredAppointments.length === 0 && (
                    <div className="text-center py-10">
                      <div className="text-sm text-text-hint">Sin turnos asignados</div>
                    </div>
                  )}
                </>
              ) : (
                <MonthCalendar
                  appointments={appointments}
                  blockedDates={blockedDates}
                  currentMonth={calendarMonth}
                  currentYear={calendarYear}
                  selectedDate={selectedDate}
                  onSelectDay={handleMonthDaySelect}
                  onPrevMonth={handlePrevMonth}
                  onNextMonth={handleNextMonth}
                />
              )}
            </div>
          </div>

          <PatientPanel
            appointment={selectedAppointment}
            dayAppointments={filteredAppointments}
            dayLabel={currentDay?.label ?? selectedDate}
            selectedDate={selectedDate}
            isBlocked={isSelectedDateBlocked}
            blockReason={blockForSelectedDate?.reason}
            onUnblock={handleUnblockDate}
            onBlockHours={handleBlockHours}
            onRecordarTodos={handleRecordarTodos}
            onScheduleAppointment={handleScheduleFromPatient}
            bookingCode={profile?.booking_code ?? null}
          />

          {/* Mobile-only FAB for "+ Nuevo turno". Sits above the
              MobileNav tab bar (which has bottom-0 z-50). */}
          <button
            type="button"
            onClick={() => openNewAppointment()}
            aria-label="Nuevo turno"
            className="lg:hidden fixed bottom-[78px] right-5 w-14 h-14 rounded-full bg-primary text-surface grid place-items-center cursor-pointer shadow-[0_8px_24px_rgba(59,74,56,0.32)] z-40 active:scale-95 transition-transform"
          >
            <Icon name="plus" size={22} stroke={2} />
          </button>
        </>
      )}

      {activeView === 'pacientes' && (
        <>
          <PatientsView
            patients={patients}
            patientRows={supaPatientRows}
            onSelectPatient={setSelectedPatient}
            selectedPatient={selectedPatient}
            patientLimit={currentOrg ? null : PLANS[currentPlan].limits.patients}
            onRemovePatient={currentOrg ? undefined : async (id) => {
              const removedName = supaPatientRows.find((r) => r.id === id)?.name
              if (removedName && selectedPatient?.name === removedName) {
                setSelectedPatient(null)
              }
              return removePatient(id)
            }}
            onAddPatient={currentOrg ? undefined : async (p) => {
              // Plan limit gate before hitting Supabase, so the user gets an
              // immediate, friendly error instead of a DB-level rejection.
              if (!canAddPatient(currentPlan, supaPatients.length)) {
                return new Error('Llegaste al límite de pacientes de tu plan. Mejorá a Pro para sumar más.')
              }
              const err = await addPatient({
                name: p.name,
                phone: p.phone || '',
                email: p.email || '',
                age: p.age || '',
                since: p.since,
                insurance: p.insurance || 'Particular',
                last_visit: '',
                total_sessions: 0,
                tags: [],
              })
              return err ? new Error(err.message) : null
            }}
            onImportPatients={currentOrg ? undefined : async (rows) => {
              const errors: string[] = []
              let imported = 0
              const limit = PLANS[currentPlan].limits.patients
              let slotsLeft = limit === null ? Infinity : Math.max(0, limit - supaPatients.length)

              for (const r of rows) {
                if (slotsLeft <= 0) {
                  errors.push(`${r.name}: excede límite del plan`)
                  continue
                }
                const err = await addPatient({
                  name: r.name,
                  phone: r.phone || '',
                  email: r.email || '',
                  age: r.age || '',
                  since: new Date().toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
                  insurance: r.insurance || 'Particular',
                  last_visit: '',
                  total_sessions: 0,
                  tags: [],
                })
                if (err) {
                  errors.push(`${r.name}: ${err.message}`)
                } else {
                  imported++
                  if (slotsLeft !== Infinity) slotsLeft--
                }
              }
              return { imported, errors }
            }}
          />
          <PatientDetailPanel
            patient={selectedPatient}
            onScheduleAppointment={(p) => openNewAppointment({ patient: p, intent: 'schedule-for-patient' })}
          />
        </>
      )}

      {activeView === 'bloqueos' && (
        <BlocksView
          blocks={blocks}
          onAdd={handleAddBlock}
          onRemove={handleRemoveBlock}
        />
      )}

      {activeView === 'estadisticas' && (
        <StatsView appointments={appointments} patients={patients} />
      )}

      {activeView === 'perfil' && (
        <DoctorProfileView onLogout={onLogout} onOpenPlans={() => setShowPlans(true)} />
      )}

      {activeView === 'organizacion' && currentOrg && userId && (
        <OrgAdminView org={currentOrg} userId={userId} onOrgUpdated={(updated) => setCurrentOrg(updated)} />
      )}

      {/* Mobile-only "Mi link" view. Desktop reaches the same content
          via the MyLinkModal triggered from the sidebar. */}
      {activeView === 'mi-link' && profile?.booking_code && (
        <MyLinkSection
          bookingCode={profile.booking_code}
          doctorFirstName={profile?.first_name ?? undefined}
        />
      )}

      {showCreateOrg && (
        <CreateOrgModal
          onClose={() => setShowCreateOrg(false)}
          onCreate={async (name, slug) => {
            const err = await createOrg(name, slug)
            return err
          }}
        />
      )}

      {showPlans && userId && (
        <div className="fixed inset-0 bg-bg z-50 overflow-auto">
          <PlansView
            currentPlan={currentPlan}
            userId={userId}
            onClose={() => setShowPlans(false)}
            onPlanChanged={() => window.location.reload()}
          />
        </div>
      )}

      {showMyLink && profile?.booking_code && (
        <MyLinkModal
          bookingCode={profile.booking_code}
          doctorFirstName={profile?.first_name}
          onClose={() => setShowMyLink(false)}
        />
      )}

      {paywall && (
        <PaywallModal
          title={paywall.title}
          description={paywall.description}
          requiredPlan={paywall.requiredPlan}
          currentPlan={currentPlan}
          onClose={() => setPaywall(null)}
          onSeeAllPlans={() => {
            setPaywall(null)
            setShowPlans(true)
          }}
        />
      )}

      {/* Shared props for the new-turno flow. We render the same
          component twice — once as a desktop modal (overlay) and once
          as a mobile section (full-screen, routed via activeView). The
          mobile section participates in the back-button history, which
          is the whole point: tapping back leaves the form like any
          other view, instead of dismissing a popup. */}
      {(() => {
        const newApptProps = {
          patients: supaPatients,
          patientRows: supaPatientRows,
          appointments,
          locations,
          defaultDate: selectedDate,
          defaultDuration: profile?.session_duration ?? 50,
          prefilledPatient: reasignarFor,
          title:
            modalIntent === 'reasignar'
              ? 'Reasignar turno'
              : modalIntent === 'schedule-for-patient'
                ? 'Agendar turno'
                : 'Nuevo turno',
          onCreateAppointment: async (input: {
            patient_id: string | null
            patient_name: string
            location_id: string | null
            date: string
            time: string
            duration: string
            detail: string
            status: 'confirmado' | 'pendiente'
          }) =>
            addAppointment({
              patient_id: input.patient_id,
              patient_name: input.patient_name,
              location_id: input.location_id,
              date: input.date,
              time: input.time,
              duration: input.duration,
              detail: input.detail,
              status: input.status,
            }),
          onCreatePatient: async (name: string, insurance: string) => {
            if (!canAddPatient(currentPlan, supaPatients.length)) {
              closeNewAppointment()
              setPaywall({
                title: 'Llegaste al límite de tu plan',
                description: `El plan Free permite hasta ${PLANS.free.limits.patients} pacientes. Para registrar más, pasate a Pro.`,
                requiredPlan: 'pro',
              })
              return null
            }
            const err = await addPatient({
              name,
              insurance,
              phone: '',
              email: '',
              age: '',
              since: new Date().toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
              last_visit: '',
              total_sessions: 0,
              tags: [],
            })
            if (err) return null
            const { data } = await supabase
              .from('patients')
              .select('id')
              .eq('doctor_id', userId ?? '')
              .eq('name', name)
              .order('id', { ascending: false })
              .limit(1)
              .single()
            return data ? { id: data.id } : null
          },
        }

        return (
          <>
            {/* Desktop: overlay modal. Mobile users never see this
                because the openNewAppointment helper routes them to
                the section view instead. */}
            <NewAppointmentModal
              {...newApptProps}
              mode="modal"
              open={showNewAppointment}
              onClose={closeNewAppointment}
            />

            {/* Mobile: full-screen section. Only mounts when activeView
                is 'nuevo-turno' so the form state resets between
                openings (same as a real route). */}
            {activeView === 'nuevo-turno' && (
              <NewAppointmentModal
                {...newApptProps}
                mode="section"
                open
                onClose={closeNewAppointment}
              />
            )}
          </>
        )
      })()}

      <RemindersModal
        open={remindersMode !== null}
        onClose={() => setRemindersMode(null)}
        appointments={remindersMode && remindersMode !== 'day' ? [remindersMode] : filteredAppointments}
        dayLabel={currentDay?.label ?? dayLabel}
        date={selectedDate}
        doctorShortName={profile ? `Dr${profile.specialty?.toLowerCase().includes('a') ? 'a' : '.'} ${profile.last_name}` : undefined}
        locations={locations}
      />

      {/* MobileNav is hidden while the user is inside the Nuevo turno
          section — it's a focused flow with its own back arrow, and
          the fixed bottom bar was covering the "Crear turno" CTA. */}
      {activeView !== 'nuevo-turno' && (
        <MobileNav
          activeView={activeView}
          onNavigate={handleNavigate}
          showMyLink={!!profile?.booking_code}
        />
      )}
    </div>
  )
}
