// Tecito landing page. Static marketing site recreated from the design
// handoff in design_handoff_tecito_landing/. Single-file by design — the
// content is heavily section-based but largely linear, so splitting into
// many tiny components hurts readability more than it helps. Subcomponents
// inline at the bottom for the truly repeated bits (FAQ accordion).
//
// Routing: rendered by App.tsx when there's no session and pathname is
// not /login, /register, /p/*. CTAs navigate via window.location to the
// existing /login + /register flows.

import { useEffect, useState } from 'react'

interface Props {
  onGoToLogin: () => void
  onGoToRegister: () => void
}

export default function LandingView({ onGoToLogin, onGoToRegister }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Smooth-scroll to in-page sections; CTAs to auth flows go through callbacks
  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-bg text-text" style={{ fontFamily: 'var(--font-sans)' }}>
      <Nav scrolled={scrolled} onScrollTo={scrollTo} onGoToLogin={onGoToLogin} onGoToRegister={onGoToRegister} />
      <Hero onGoToRegister={onGoToRegister} onScrollTo={scrollTo} />
      <Trust />
      <HowItWorks />
      <Features />
      <PatientMockup />
      <Testimonials />
      <Pricing onGoToRegister={onGoToRegister} />
      <Faq />
      <FinalCta onGoToRegister={onGoToRegister} />
      <Footer onScrollTo={scrollTo} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   NAV
   ────────────────────────────────────────────────────────────────── */
function Nav({
  scrolled,
  onScrollTo,
  onGoToLogin,
  onGoToRegister,
}: {
  scrolled: boolean
  onScrollTo: (id: string) => void
  onGoToLogin: () => void
  onGoToRegister: () => void
}) {
  return (
    <nav
      className="sticky top-0 z-50 transition-colors"
      style={{
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        background: 'rgba(245, 242, 236, 0.78)',
        borderBottom: scrolled ? '1px solid var(--color-gray-border)' : '1px solid transparent',
      }}
    >
      <div className="flex items-center justify-between max-w-[1280px] mx-auto px-8 py-[18px]">
        <a
          href="/"
          className="inline-flex items-center gap-2.5 leading-none"
          style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontStyle: 'italic', letterSpacing: '-0.4px', color: 'var(--color-primary)' }}
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <LogoMark />
          Tecito
        </a>
        <div
          className="hidden md:flex gap-7 items-center text-text-muted"
          style={{ fontSize: 14 }}
        >
          <button onClick={() => onScrollTo('funciona')} className="hover:text-text cursor-pointer transition-colors">Cómo funciona</button>
          <button onClick={() => onScrollTo('features')} className="hover:text-text cursor-pointer transition-colors">Funcionalidades</button>
          <button onClick={() => onScrollTo('paciente')} className="hover:text-text cursor-pointer transition-colors">Para pacientes</button>
          <button onClick={() => onScrollTo('precios')} className="hover:text-text cursor-pointer transition-colors">Precios</button>
          <button onClick={() => onScrollTo('faq')} className="hover:text-text cursor-pointer transition-colors">FAQ</button>
        </div>
        <div className="flex gap-2 sm:gap-2.5 items-center">
          <button onClick={onGoToLogin}><BtnGhost>Iniciar sesión</BtnGhost></button>
          {/* "Probar gratis" lives in the hero CTA + further down the
              page on mobile, so the header doesn't need to compete for
              space with it. Keep it from sm+ where the header has room
              for both. */}
          <button onClick={onGoToRegister} className="hidden sm:inline-flex"><BtnPrimary withArrow>Probar gratis</BtnPrimary></button>
        </div>
      </div>
    </nav>
  )
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <circle cx="32" cy="32" r="32" fill="#3B4A38" />
      <text x="20" y="48" fontFamily="Newsreader, Georgia, serif" fontSize="34" fontStyle="italic" fontWeight="500" fill="#FFFFFF">t</text>
      <circle cx="42" cy="42" r="2.6" fill="#FFFFFF" />
    </svg>
  )
}

/* ──────────────────────────────────────────────────────────────────
   BUTTONS
   ────────────────────────────────────────────────────────────────── */
function BtnPrimary({ children, withArrow = false }: { children: React.ReactNode; withArrow?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-[10px] text-[13px] sm:text-sm font-medium border border-transparent whitespace-nowrap transition-all hover:-translate-y-px"
      style={{ background: 'var(--color-primary)', color: 'var(--color-surface)' }}
    >
      {children}
      {withArrow && <span className="hidden sm:inline transition-transform">→</span>}
    </span>
  )
}

function BtnGhost({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-[10px] text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors hover:bg-black/[0.03]"
      style={{ background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-gray-border-2)' }}
    >
      {children}
    </span>
  )
}

/* ──────────────────────────────────────────────────────────────────
   HERO
   ────────────────────────────────────────────────────────────────── */
function Hero({ onGoToRegister, onScrollTo }: { onGoToRegister: () => void; onScrollTo: (id: string) => void }) {
  return (
    <section className="relative overflow-hidden" style={{ padding: '80px 0 100px' }}>
      <div className="max-w-[1180px] mx-auto px-8">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr] grid-cols-1">
          <div>
            <Eyebrow>Para profesionales y consultorios</Eyebrow>
            <h1
              className="mt-[18px]"
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 400,
                letterSpacing: '-1.5px',
                lineHeight: 1.02,
                fontSize: 'clamp(48px, 6.4vw, 88px)',
                margin: '18px 0 0',
              }}
            >
              Tu consultorio,
              <br />
              <span style={{ fontStyle: 'italic' }}>en piloto automático.</span>
            </h1>
            <p className="text-text-muted" style={{ fontSize: 18, margin: '24px 0 32px', maxWidth: 540, lineHeight: 1.6 }}>
              Gestioná tu agenda y la de todo tu equipo. Tus pacientes reservan turnos solos desde la web — sin
              llamados, sin idas y vueltas, sin perder horas confirmando.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={onGoToRegister}><BtnPrimary withArrow>Probar 14 días gratis</BtnPrimary></button>
              <button onClick={() => onScrollTo('funciona')}><BtnGhost>Ver cómo funciona</BtnGhost></button>
            </div>
            <div className="flex gap-6 items-center mt-7 text-text-hint" style={{ fontSize: 13 }}>
              <HeroCheck>Sin tarjeta</HeroCheck>
              <HeroCheck>Setup en 5 minutos</HeroCheck>
              <HeroCheck>Cancelás cuando quieras</HeroCheck>
            </div>
          </div>
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}

function HeroCheck({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-grid place-items-center rounded-full"
        style={{ width: 14, height: 14, background: 'var(--color-teal-light)', color: 'var(--color-teal)', fontSize: 9 }}
      >
        ✓
      </span>
      {children}
    </span>
  )
}

function HeroVisual() {
  // Two overlapping mock browser cards: doctor's panel and patient booking page.
  // Slight rotations + offsets give the "staged photo" feel.
  return (
    <div className="relative" style={{ aspectRatio: '1 / 1.05', maxHeight: 640 }}>
      {/* Doctor's panel mock (back, left/top) */}
      <div
        className="absolute bg-surface overflow-hidden"
        style={{
          inset: '0 28% 30% 0',
          zIndex: 2,
          transform: 'rotate(-1.2deg)',
          border: '1px solid var(--color-gray-border)',
          borderRadius: 18,
          boxShadow: '0 30px 80px -40px rgba(30, 25, 15, 0.25), 0 4px 12px -8px rgba(30,25,15,0.06)',
        }}
      >
        <MiniChrome url="tecito.com.ar/agenda" />
        <div className="p-[18px] pb-[22px] h-full flex flex-col">
          <div className="flex items-baseline justify-between mb-3.5">
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.5px' }}>Agenda.</div>
              <div className="text-text-hint" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>jueves 17 · 8 turnos</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3.5">
            <Stat label="Confirmados" value="6" dot="var(--color-teal)" />
            <Stat label="Pendientes" value="2" dot="var(--color-amber)" />
            <Stat label="Libres" value="3" />
          </div>
          <Appt time="10:30" name="María L. Fernández" meta="Control · OSDE" pill="Confirmado" pillBg="var(--color-teal-light)" pillFg="var(--color-teal)" bar="var(--color-teal)" selected />
          <Appt time="11:00" name="Lucas Romero" meta="Primera consulta" pill="Sin confirmar" pillBg="var(--color-amber-light)" pillFg="var(--color-amber)" bar="var(--color-amber)" />
          <Appt time="11:30" name="Sofía Castro" meta="Control · Swiss" pill="Confirmado" pillBg="var(--color-teal-light)" pillFg="var(--color-teal)" bar="var(--color-teal)" />
        </div>
      </div>

      {/* Patient booking mock (front, right/bottom) */}
      <div
        className="absolute bg-surface overflow-hidden"
        style={{
          inset: '22% 0 0 26%',
          zIndex: 3,
          transform: 'rotate(1.5deg)',
          border: '1px solid var(--color-gray-border)',
          borderRadius: 18,
          boxShadow: '0 30px 80px -40px rgba(30, 25, 15, 0.25), 0 4px 12px -8px rgba(30,25,15,0.06)',
        }}
      >
        <MiniChrome url="turnos.tecito.com.ar/dra-carrizo" />
        <div className="p-[18px] h-full flex flex-col" style={{ paddingTop: 16 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.5px' }}>Reservar turno</div>
          <div className="text-text-hint mt-0.5" style={{ fontSize: 11 }}>Dra. Andrea Carrizo · Clínica</div>
          <div className="grid grid-cols-5 gap-1.5 mb-3 mt-4">
            <MiniDay dow="Lun" num="14" />
            <MiniDay dow="Mar" num="15" />
            <MiniDay dow="Mié" num="16" />
            <MiniDay dow="Jue" num="17" active />
            <MiniDay dow="Vie" num="18" />
          </div>
          <div className="text-text-hint mb-2 uppercase" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>Horarios disponibles</div>
          <div className="grid grid-cols-3 gap-1.5">
            <Slot>09:00</Slot>
            <Slot taken>09:30</Slot>
            <Slot>10:00</Slot>
            <Slot selected>10:30</Slot>
            <Slot taken>11:00</Slot>
            <Slot>11:30</Slot>
            <Slot>15:00</Slot>
            <Slot>15:30</Slot>
            <Slot taken>16:00</Slot>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniChrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-2" style={{ borderBottom: '1px solid var(--color-gray-border)' }}>
      <span className="rounded-full" style={{ width: 9, height: 9, background: 'var(--color-gray-border-2)' }} />
      <span className="rounded-full" style={{ width: 9, height: 9, background: 'var(--color-gray-border-2)' }} />
      <span className="rounded-full" style={{ width: 9, height: 9, background: 'var(--color-gray-border-2)' }} />
      <div
        className="flex-1 px-2 py-[3px] bg-surface text-text-hint truncate"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 5, border: '1px solid var(--color-gray-border)' }}
      >
        {url}
      </div>
    </div>
  )
}

function Stat({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="bg-surface-2 px-2.5 py-2.5" style={{ border: '1px solid var(--color-gray-border)', borderRadius: 8 }}>
      <div className="text-text-hint uppercase" style={{ fontSize: 8, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
        {dot && <span className="inline-block rounded-full mr-1 align-middle" style={{ width: 5, height: 5, background: dot }} />}
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.3px', marginTop: 3 }}>{value}</div>
    </div>
  )
}

function Appt({
  time, name, meta, pill, pillBg, pillFg, bar, selected = false,
}: { time: string; name: string; meta: string; pill: string; pillBg: string; pillFg: string; bar: string; selected?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 mb-1.5"
      style={{
        background: selected ? 'var(--color-primary-light)' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-primary-mid)' : 'var(--color-gray-border)'}`,
        borderRadius: 10,
      }}
    >
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--color-primary)', minWidth: 38 }}>{time}</div>
      <div style={{ width: 2, height: 22, borderRadius: 1, background: bar }} />
      <div>
        <div className="font-medium" style={{ fontSize: 11 }}>{name}</div>
        <div className="text-text-hint mt-0.5" style={{ fontSize: 9 }}>{meta}</div>
      </div>
      <span className="ml-auto font-medium px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, background: pillBg, color: pillFg }}>{pill}</span>
    </div>
  )
}

function MiniDay({ dow, num, active = false }: { dow: string; num: string; active?: boolean }) {
  return (
    <div
      className="text-center py-2 px-1 uppercase"
      style={{
        background: active ? 'var(--color-primary)' : 'var(--color-surface-2)',
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-gray-border)'}`,
        color: active ? 'var(--color-surface)' : 'var(--color-text-hint)',
        borderRadius: 8,
        fontSize: 9,
        letterSpacing: '0.05em',
      }}
    >
      <div>{dow}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, letterSpacing: '-0.3px', marginTop: 2, color: active ? 'var(--color-surface)' : 'var(--color-text)' }}>{num}</div>
    </div>
  )
}

function Slot({ children, taken = false, selected = false }: { children: React.ReactNode; taken?: boolean; selected?: boolean }) {
  return (
    <div
      className="text-center py-2"
      style={{
        background: selected ? 'var(--color-primary)' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-gray-border)'}`,
        color: selected ? 'var(--color-surface)' : taken ? 'var(--color-text-dim)' : 'var(--color-text)',
        borderRadius: 8,
        fontFamily: 'var(--font-serif)',
        fontSize: 13,
        letterSpacing: '-0.2px',
        textDecoration: taken ? 'line-through' : 'none',
        opacity: taken ? 0.5 : 1,
      }}
    >
      {children}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   TRUST BAR
   ────────────────────────────────────────────────────────────────── */
function Trust() {
  return (
    <section className="bg-surface-2" style={{ borderTop: '1px solid var(--color-gray-border)', borderBottom: '1px solid var(--color-gray-border)', padding: '32px 0' }}>
      <div className="max-w-[1180px] mx-auto px-8">
        <div className="flex items-center gap-8 flex-wrap justify-center text-text-hint" style={{ fontSize: 13 }}>
          <span className="uppercase" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em' }}>Usado por +200 profesionales en</span>
          <div className="flex gap-9 flex-wrap items-center">
            {['Cardiosalud', 'Centro Pueyrredón', 'Instituto Belgrano', 'Consultorios Pilar', 'Clínica del Sur'].map((name) => (
              <span key={name} className="italic text-text-hint" style={{ fontFamily: 'var(--font-serif)', fontSize: 17, letterSpacing: '-0.2px' }}>{name}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────
   HOW IT WORKS
   ────────────────────────────────────────────────────────────────── */
function HowItWorks() {
  return (
    <section id="funciona" style={{ padding: '96px 0', scrollMarginTop: 80 }}>
      <div className="max-w-[1180px] mx-auto px-8">
        <SectionHead eyebrow="Cómo funciona" headBefore="Tres pasos. Cero " headItalic="complicaciones." sub="Configurás una vez, y Tecito se ocupa del resto. Tus pacientes ven solo los horarios que vos habilitaste." />
        <div className="grid lg:grid-cols-3 grid-cols-1 gap-6">
          <Step num="01" tag="Crear consultorio" title="Armá tu consultorio en minutos" body="Cargá tus servicios, horarios de atención, obras sociales y profesionales. Recibís un link único para compartir.">
            <div
              className="flex items-center gap-2.5 px-4 py-3.5 bg-surface-2 text-primary"
              style={{ border: '1px dashed var(--color-gray-border-2)', borderRadius: 12, fontFamily: 'var(--font-mono)', fontSize: 13 }}
            >
              <span style={{ filter: 'grayscale(1) opacity(0.6)' }}>🔗</span>
              tu-consultorio.tecito.com.ar
            </div>
          </Step>
          <Step num="02" tag="Compartir link" title="Tus pacientes reservan solos" body="Eligen día, horario y profesional desde el navegador. Sin instalar nada, sin crear cuentas, en menos de un minuto.">
            <MiniCalendar />
          </Step>
          <Step num="03" tag="Atender" title="Vos atendés, Tecito recuerda" body="Confirmación instantánea por mail con archivo de calendario. Recordatorios y agenda siempre actualizada — sin tener que avisar a cada paciente a mano.">
            <div
              className="px-4 py-3.5 text-primary"
              style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-mid)', borderRadius: 14, fontSize: 12, lineHeight: 1.5, maxWidth: 200 }}
            >
              <div className="text-text-hint mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em' }}>JUE · 10:30</div>
              <div>Le llegó la confirmación por mail a María Fernández</div>
            </div>
          </Step>
        </div>
      </div>
    </section>
  )
}

function Step({ num, tag, title, body, children }: { num: string; tag: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div
      className="bg-surface flex flex-col"
      style={{ border: '1px solid var(--color-gray-border)', borderRadius: 18, padding: 28, minHeight: 320 }}
    >
      <div className="text-text-hint mb-7 uppercase" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em' }}>{num}  ·  {tag}</div>
      <div className="flex items-center justify-center mb-6" style={{ height: 110 }}>{children}</div>
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.5px', lineHeight: 1.18, margin: '0 0 12px' }}>{title}</h3>
      <p className="text-text-muted" style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}

function MiniCalendar() {
  const cells: ('' | 'has' | 'today')[] = [
    '', '', 'has', '', 'has', 'has', '',
    '', 'has', 'today', 'has', '', 'has', 'has',
  ]
  return (
    <div className="grid grid-cols-7 gap-1" style={{ width: 200 }}>
      {cells.map((kind, i) => (
        <div
          key={i}
          style={{
            aspectRatio: '1',
            borderRadius: 5,
            background: kind === 'today' ? 'var(--color-primary)' : kind === 'has' ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
            border: `1px solid ${kind === 'today' ? 'var(--color-primary)' : kind === 'has' ? 'var(--color-primary-mid)' : 'var(--color-gray-border)'}`,
          }}
        />
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   FEATURES
   ────────────────────────────────────────────────────────────────── */
function Features() {
  const items = [
    {
      title: 'Agenda multi-profesional',
      body: 'Cada profesional con sus horarios, sus servicios y su duración por consulta. Vista por día, semana o por médico.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>,
    },
    {
      title: 'Confirmación por mail con calendario',
      body: 'Cada paciente recibe un mail con la confirmación y un archivo .ics que carga el turno en su Google Calendar o iPhone — con recordatorios automáticos antes del turno.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16v14H4z" /><path d="M4 10h16M9 3v6M15 3v6" /></svg>,
    },
    {
      title: 'Obras sociales y particulares',
      body: 'Gestioná OSDE, Swiss, Galeno, IOMA y particular en una misma agenda. Cada paciente con su credencial y plan.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9.5 4.5-1 8-4.5 8-9.5V6l-8-3Z" /></svg>,
    },
    {
      title: 'Bloqueos y vacaciones',
      body: 'Bloqueá horarios, días enteros o semanas completas. Los pacientes solo ven los espacios que vos habilitás.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></svg>,
    },
    {
      title: 'Ficha de paciente',
      body: 'Historial de turnos, notas privadas, datos de contacto y obra social. Todo a un click desde la agenda.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="8" r="3.5" /><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17" cy="9" r="2.5" /><path d="M22 19c0-2.5-2-4.5-5-4.5" /></svg>,
    },
    {
      title: 'Estadísticas claras',
      body: 'Cuántos turnos, cuántos cancelaron, cuánto facturaste por obra social. Reportes mensuales sin Excel.',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3v18h18" /><path d="M7 14l4-5 4 3 5-7" /></svg>,
    },
  ]

  return (
    <section id="features" style={{ padding: '32px 0 96px', scrollMarginTop: 80 }}>
      <div className="max-w-[1180px] mx-auto px-8">
        <SectionHead eyebrow="Todo lo que necesitás" headBefore="Pensado para " headItalic="consultorios reales." sub="Desde un profesional independiente hasta clínicas con varios médicos, secretarías y obras sociales. Una sola herramienta." />
        <div
          className="grid lg:grid-cols-3 grid-cols-1 overflow-hidden"
          style={{ gap: 1, background: 'var(--color-gray-border)', border: '1px solid var(--color-gray-border)', borderRadius: 18 }}
        >
          {items.map((it) => (
            <div key={it.title} className="bg-surface flex flex-col gap-3" style={{ padding: '36px 32px', minHeight: 220 }}>
              <div
                className="grid place-items-center text-primary mb-1.5"
                style={{ width: 36, height: 36, background: 'var(--color-primary-light)', borderRadius: 9 }}
              >
                {it.icon}
              </div>
              <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, letterSpacing: '-0.4px', margin: 0 }}>{it.title}</h4>
              <p className="text-text-muted" style={{ fontSize: 14, margin: 0, lineHeight: 1.55 }}>{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────
   PATIENT MOCKUP
   ────────────────────────────────────────────────────────────────── */
function PatientMockup() {
  return (
    <section
      id="paciente"
      style={{
        background: 'var(--color-surface-3)',
        padding: '96px 0',
        borderTop: '1px solid var(--color-gray-border)',
        borderBottom: '1px solid var(--color-gray-border)',
        scrollMarginTop: 80,
      }}
    >
      <div className="max-w-[1180px] mx-auto px-8">
        <div className="grid items-center gap-16 lg:grid-cols-[0.9fr_1.3fr] grid-cols-1">
          <div>
            <Eyebrow>Para tus pacientes</Eyebrow>
            <h2
              className="mt-3.5"
              style={{ fontFamily: 'var(--font-serif)', fontSize: 44, fontWeight: 400, letterSpacing: '-1.2px', lineHeight: 1.12, margin: '14px 0 0' }}
            >
              Reservar turno,
              <br />
              <span style={{ fontStyle: 'italic' }}>en 30 segundos.</span>
            </h2>
            <p className="text-text-muted" style={{ fontSize: 17, margin: '18px 0 0', lineHeight: 1.6 }}>
              Tus pacientes abren tu link, eligen día y horario, completan sus datos. Sin app que descargar, sin
              contraseñas, sin formularios eternos.
            </p>
            <div className="mt-7">
              <MockupItem num="01" title="Tu link, tu marca" body="tu-consultorio.tecito.com.ar — con tu logo, tus colores, tu información profesional." first />
              <MockupItem num="02" title="Calendario en vivo" body="Solo ven los horarios reales que tenés disponibles. Si reservás un turno desde tu panel, desaparece de la web al instante." />
              <MockupItem num="03" title="Confirmación inmediata" body="Reciben un mail con la dirección, hora, archivo de calendario y un link para cancelar si no van a poder venir." />
            </div>
          </div>

          <PhoneMockup />
        </div>
      </div>
    </section>
  )
}

function MockupItem({ num, title, body, first = false }: { num: string; title: string; body: string; first?: boolean }) {
  return (
    <div
      className="flex gap-3.5"
      style={{ padding: first ? '4px 0 14px' : '14px 0', borderTop: first ? 0 : '1px solid var(--color-gray-border)' }}
    >
      <div className="text-text-hint" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, paddingTop: 2, minWidth: 36 }}>{num}</div>
      <div>
        <h5 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.3px' }}>{title}</h5>
        <p className="text-text-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  )
}

function PhoneMockup() {
  return (
    <div className="flex justify-center items-center" style={{ perspective: '1400px' }}>
      <div
        style={{
          width: 320,
          background: '#2A322A',
          borderRadius: 44,
          padding: 12,
          boxShadow: '0 60px 100px -40px rgba(30, 25, 15, 0.35), 0 20px 30px -16px rgba(30,25,15,0.18)',
          transform: 'rotateY(-6deg) rotateX(2deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          className="bg-surface relative overflow-hidden"
          style={{ borderRadius: 32, aspectRatio: '9/19.5', border: '1px solid #0a0a0a' }}
        >
          <div
            className="absolute z-10"
            style={{ top: 12, left: '50%', transform: 'translateX(-50%)', width: 100, height: 28, background: '#0a0a0a', borderRadius: 999 }}
          />
          <div className="h-full flex flex-col" style={{ padding: '56px 16px 16px' }}>
            <div className="flex items-center gap-2 mb-3.5">
              <div
                className="grid place-items-center rounded-full text-surface font-medium"
                style={{ width: 32, height: 32, background: 'var(--color-primary)', fontFamily: 'var(--font-serif)', fontSize: 12 }}
              >
                AC
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, letterSpacing: '-0.3px' }}>Dra. Andrea Carrizo</div>
                <div className="text-text-hint" style={{ fontSize: 9 }}>Cardiología · Clínica del Sur</div>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 4 }}>
              Reservá tu<br />
              <span style={{ fontStyle: 'italic' }}>turno.</span>
            </div>
            <div className="text-text-hint" style={{ fontSize: 10, marginBottom: 14 }}>Elegí día y horario disponible</div>
            <div className="grid grid-cols-4 gap-1 mb-3.5">
              <PpDay dow="Lun" num="14" />
              <PpDay dow="Mar" num="15" />
              <PpDay dow="Mié" num="16" />
              <PpDay dow="Jue" num="17" sel />
            </div>
            <div className="text-text-hint mb-1.5 uppercase" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em' }}>Horarios · jueves 17 abril</div>
            <div className="grid grid-cols-3 gap-1.5">
              <PpSlot>09:00</PpSlot>
              <PpSlot taken>09:30</PpSlot>
              <PpSlot>10:00</PpSlot>
              <PpSlot sel>10:30</PpSlot>
              <PpSlot taken>11:00</PpSlot>
              <PpSlot>11:30</PpSlot>
              <PpSlot>15:00</PpSlot>
              <PpSlot taken>15:30</PpSlot>
              <PpSlot>16:00</PpSlot>
            </div>
            <div
              className="mt-auto text-center text-surface font-medium"
              style={{ background: 'var(--color-primary)', padding: 11, borderRadius: 10, fontSize: 12 }}
            >
              Reservar 10:30 →
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PpDay({ dow, num, sel = false }: { dow: string; num: string; sel?: boolean }) {
  return (
    <div
      className="text-center py-2"
      style={{
        background: sel ? 'var(--color-primary)' : 'var(--color-surface-2)',
        border: `1px solid ${sel ? 'var(--color-primary)' : 'var(--color-gray-border)'}`,
        color: sel ? 'var(--color-surface)' : undefined,
        borderRadius: 8,
      }}
    >
      <div className="uppercase" style={{ fontSize: 8, color: sel ? 'rgba(255,255,255,0.6)' : 'var(--color-text-hint)', letterSpacing: '0.06em' }}>{dow}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, letterSpacing: '-0.3px', marginTop: 1 }}>{num}</div>
    </div>
  )
}

function PpSlot({ children, taken = false, sel = false }: { children: React.ReactNode; taken?: boolean; sel?: boolean }) {
  return (
    <div
      className="text-center"
      style={{
        padding: '7px 0',
        background: sel ? 'var(--color-primary)' : 'var(--color-surface)',
        border: `1px solid ${sel ? 'var(--color-primary)' : 'var(--color-gray-border)'}`,
        color: sel ? 'var(--color-surface)' : taken ? 'var(--color-text-dim)' : 'var(--color-text)',
        borderRadius: 7,
        fontFamily: 'var(--font-serif)',
        fontSize: 12,
        textDecoration: taken ? 'line-through' : 'none',
        opacity: taken ? 0.45 : 1,
      }}
    >
      {children}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   TESTIMONIALS
   ────────────────────────────────────────────────────────────────── */
function Testimonials() {
  const quotes = [
    {
      text: 'Antes pasaba 2 horas por día respondiendo WhatsApps de pacientes pidiendo turno. Ahora reservan solos y yo me dedico a atender.',
      initials: 'AC', name: 'Dra. Andrea Carrizo', role: 'CARDIOLOGÍA · CABA',
    },
    {
      text: 'Tengo 4 médicos en la clínica y cada uno con sus horarios y obras sociales distintas. Tecito lo organiza todo en una sola agenda.',
      initials: 'MT', name: 'Mariano Tort', role: 'DIRECTOR · CENTRO PUEYRREDÓN',
    },
    {
      text: 'Bajé los pacientes que no se presentaban casi a la mitad. La confirmación por mail con el archivo de calendario hace que no se olviden.',
      initials: 'LR', name: 'Lic. Lucía Rodríguez', role: 'PSICOLOGÍA · ROSARIO',
    },
  ]

  return (
    <section style={{ padding: '96px 0' }}>
      <div className="max-w-[1180px] mx-auto px-8">
        <SectionHead eyebrow="Quienes ya lo usan" headBefore="Profesionales que " headItalic="recuperaron horas." sub="" />
        <div className="grid lg:grid-cols-3 grid-cols-1 gap-5">
          {quotes.map((q) => (
            <div
              key={q.name}
              className="bg-surface flex flex-col gap-5"
              style={{ border: '1px solid var(--color-gray-border)', borderRadius: 18, padding: 28 }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 56, lineHeight: 0.4, color: 'var(--color-primary-mid)', height: 24 }}>"</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, lineHeight: 1.45, letterSpacing: '-0.3px', color: 'var(--color-text)', flex: 1 }}>{q.text}</div>
              <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--color-gray-border)' }}>
                <div
                  className="grid place-items-center rounded-full"
                  style={{ width: 38, height: 38, background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontFamily: 'var(--font-serif)', fontSize: 14 }}
                >
                  {q.initials}
                </div>
                <div>
                  <div className="font-medium" style={{ fontSize: 14 }}>{q.name}</div>
                  <div className="text-text-hint mt-0.5 uppercase" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{q.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────
   PRICING
   ────────────────────────────────────────────────────────────────── */
function Pricing({ onGoToRegister }: { onGoToRegister: () => void }) {
  return (
    <section id="precios" style={{ padding: '24px 0 96px', scrollMarginTop: 80 }}>
      <div className="max-w-[1180px] mx-auto px-8">
        <div className="text-center mx-auto" style={{ maxWidth: 720, marginBottom: 56 }}>
          <Eyebrow>Precios simples</Eyebrow>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 52,
              fontWeight: 400,
              letterSpacing: '-1.2px',
              lineHeight: 1.12,
              margin: '14px 0 0',
            }}
          >
            Empezá gratis. <span style={{ fontStyle: 'italic' }}>Pagá cuando crezcas.</span>
          </h2>
          <p className="text-text-muted" style={{ margin: '18px auto 0', fontSize: 17, lineHeight: 1.6, maxWidth: 580 }}>
            14 días de prueba en cualquier plan. Sin tarjeta. Cancelás cuando quieras.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 grid-cols-1 gap-4">
          <Plan
            name="Free"
            price="$0"
            period="para siempre · 1 profesional"
            desc="Para empezar."
            features={[
              'Hasta 10 pacientes',
              'Agenda web completa',
              'Link público de reservas',
              'Confirmaciones por mail con calendario',
              '1 profesional',
              'Soporte por email',
            ]}
            cta="Empezar gratis"
            onCtaClick={onGoToRegister}
          />
          <Plan
            name="Pro"
            price="$18.000"
            period="por mes · 1 profesional"
            desc="Para profesionales independientes."
            features={[
              'Todo lo de Free',
              'Pacientes ilimitados',
              'Marca propia: logo y colores',
              'Link público con tu identidad',
              'Estadísticas completas',
              'Soporte prioritario',
            ]}
            cta="Probar 14 días gratis"
            featured
            tag="Más elegido"
            onCtaClick={onGoToRegister}
          />
          <Plan
            name="Clinic"
            price="$45.000"
            period="por mes · hasta 10 profesionales"
            desc="Para consultorios y clínicas."
            features={[
              'Todo lo de Pro',
              'Hasta 10 profesionales',
              'Agenda centralizada del consultorio',
              'Panel de administración',
              'Invitar y gestionar médicos',
              'Estadísticas por profesional y globales',
              'Soporte prioritario',
            ]}
            cta="Probar 14 días gratis"
            onCtaClick={onGoToRegister}
          />
        </div>

        <div className="text-center text-text-hint mt-8" style={{ fontSize: 13 }}>Todos los precios en pesos argentinos · IVA incluido.</div>
      </div>
    </section>
  )
}

function Plan({
  name, price, period, desc, features, cta, featured = false, tag, onCtaClick,
}: {
  name: string
  price: string
  period: string
  desc: string
  features: string[]
  cta: string
  featured?: boolean
  tag?: string
  onCtaClick: () => void
}) {
  const priceParts = price.match(/^(\$)(.+)$/)
  return (
    <div
      className="flex flex-col relative"
      style={{
        background: featured ? 'var(--color-primary)' : 'var(--color-surface)',
        color: featured ? 'var(--color-surface)' : 'var(--color-text)',
        border: `1px solid ${featured ? 'var(--color-primary)' : 'var(--color-gray-border)'}`,
        borderRadius: 20,
        padding: '32px 28px',
      }}
    >
      {tag && (
        <div
          className="absolute uppercase text-surface"
          style={{
            top: 24, right: 24,
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
            background: 'var(--color-coral)', padding: '3px 8px', borderRadius: 999,
          }}
        >
          {tag}
        </div>
      )}
      <div
        className="uppercase mb-4"
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em',
          color: featured ? 'rgba(255,255,255,0.65)' : 'var(--color-text-hint)',
        }}
      >
        {name}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 56, letterSpacing: '-1.6px', lineHeight: 1, marginBottom: 8 }}>
        {priceParts ? (
          <>
            <span style={{ fontSize: 22, verticalAlign: 'top', marginRight: 4, opacity: 0.6 }}>$</span>{priceParts[2]}
          </>
        ) : (
          price
        )}
      </div>
      <div style={{ fontSize: 13, marginBottom: 24, color: featured ? 'rgba(255,255,255,0.65)' : 'var(--color-text-hint)' }}>{period}</div>
      <p style={{ fontSize: 14, margin: '0 0 24px', minHeight: 42, lineHeight: 1.5, color: featured ? 'rgba(255,255,255,0.65)' : 'var(--color-text-muted)' }}>{desc}</p>
      <ul className="flex flex-col gap-2.5 mb-7" style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', fontSize: 13, color: featured ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)' }}>
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 items-start">
            <span
              className="flex-shrink-0 grid place-items-center rounded-full"
              style={{
                width: 16, height: 16, marginTop: 2,
                background: featured ? 'rgba(255,255,255,0.12)' : 'var(--color-primary-light)',
                color: featured ? 'rgba(255,255,255,0.95)' : 'var(--color-primary)',
              }}
            >
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5" /></svg>
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onCtaClick}
        className="w-full font-medium transition-colors mt-auto cursor-pointer"
        style={{
          padding: 12,
          borderRadius: 10,
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: featured ? '1px solid var(--color-surface)' : '1px solid var(--color-gray-border-2)',
          fontSize: 14,
        }}
      >
        {cta}
      </button>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   FAQ
   ────────────────────────────────────────────────────────────────── */
function Faq() {
  const items = [
    { q: '¿Necesito instalar algo?', a: 'No. Tecito funciona desde cualquier navegador — computadora, tablet o celular. Tus pacientes tampoco descargan nada: solo abren el link que les pasás.' },
    { q: '¿Cómo se entera el paciente de su turno?', a: 'Apenas reserva, recibe un mail con la confirmación, la dirección del consultorio y un archivo de calendario (.ics) que carga el turno en su Google Calendar o iPhone con recordatorios automáticos. También le mandamos un recordatorio por mail el día anterior. Si no va a poder venir, tiene un link en el mismo mail para cancelar — y a vos te llega el aviso al instante.' },
    { q: '¿Puedo manejar varios profesionales en una misma agenda?', a: 'Sí. En el plan Consultorio podés tener hasta 5 profesionales, cada uno con sus horarios, servicios y obras sociales. Tu secretaría ve todas las agendas en una sola vista.' },
    { q: '¿Mis pacientes ven los horarios de los otros pacientes?', a: 'Nunca. Solo ven los horarios libres. Los datos de los pacientes existentes son privados y solo accesibles desde tu panel.' },
    { q: '¿Qué pasa si cancelo?', a: 'Cancelás cuando quieras desde tu panel — sin llamadas, sin esperas. Tus datos quedan disponibles para descargar durante 90 días.' },
    { q: '¿Aceptan obras sociales argentinas?', a: 'Sí. Tenés cargadas OSDE, Swiss Medical, Galeno, Medifé, IOMA, PAMI y todas las prepagas y obras sociales locales. Podés agregar las que uses con su código de plan y autorizaciones.' },
  ]
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <section id="faq" style={{ padding: '24px 0 96px', scrollMarginTop: 80 }}>
      <div className="max-w-[920px] mx-auto px-8">
        <div style={{ marginBottom: 56 }}>
          <Eyebrow>Preguntas frecuentes</Eyebrow>
          <h2
            className="mt-3.5"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 52, fontWeight: 400, letterSpacing: '-1.2px', lineHeight: 1.12, margin: '14px 0 0' }}
          >
            Lo que <span style={{ fontStyle: 'italic' }}>suelen preguntarnos.</span>
          </h2>
        </div>
        <div style={{ borderTop: '1px solid var(--color-gray-border)' }}>
          {items.map((item, i) => {
            const open = openIdx === i
            return (
              <div key={item.q} style={{ borderBottom: '1px solid var(--color-gray-border)' }}>
                <button
                  className="w-full text-left bg-transparent border-0 flex items-center justify-between gap-4 cursor-pointer"
                  style={{ padding: '22px 0', fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.4px', color: 'var(--color-text)' }}
                  onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                >
                  <span>{item.q}</span>
                  <span
                    className="flex-shrink-0 text-text-hint transition-transform"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: 22, transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
                  >
                    +
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-[max-height]"
                  style={{ maxHeight: open ? 280 : 0, transitionDuration: '280ms' }}
                >
                  <div className="text-text-muted" style={{ paddingBottom: 24, fontSize: 15, lineHeight: 1.65, maxWidth: 720 }}>
                    {item.a}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────
   FINAL CTA
   ────────────────────────────────────────────────────────────────── */
function FinalCta({ onGoToRegister }: { onGoToRegister: () => void }) {
  return (
    <section className="text-center" style={{ padding: '120px 0 100px' }}>
      <div className="max-w-[920px] mx-auto px-8">
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            letterSpacing: '-1.5px',
            lineHeight: 1.02,
            fontSize: 'clamp(48px, 6vw, 84px)',
            margin: 0,
          }}
        >
          Empezá <span style={{ fontStyle: 'italic' }}>hoy.</span>
        </h2>
        <p className="text-text-muted" style={{ margin: '24px auto 36px', maxWidth: 520, fontSize: 17, lineHeight: 1.6 }}>
          14 días gratis, sin tarjeta. Si no es lo tuyo, no perdiste nada.
          <br />
          Si sí, recuperaste tu agenda.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={onGoToRegister}><BtnPrimary withArrow>Probar 14 días gratis</BtnPrimary></button>
          <a href="mailto:hola@tecito.com.ar"><BtnGhost>Hablar con ventas</BtnGhost></a>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────
   FOOTER
   ────────────────────────────────────────────────────────────────── */
function Footer({ onScrollTo }: { onScrollTo: (id: string) => void }) {
  return (
    <footer className="bg-surface-2" style={{ borderTop: '1px solid var(--color-gray-border)', padding: '56px 0 28px' }}>
      <div className="max-w-[1180px] mx-auto px-8">
        <div className="grid lg:grid-cols-[1.4fr_1fr_1fr_1fr] grid-cols-2 mb-12" style={{ gap: 40 }}>
          <div>
            <div
              className="inline-flex items-center gap-2.5 leading-none italic"
              style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.4px', color: 'var(--color-primary)' }}
            >
              <LogoMark />
              Tecito
            </div>
            <p className="text-text-hint mt-3" style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.6 }}>
              La forma más calma de gestionar tu consultorio. Hecho en Argentina, para Argentina.
            </p>
          </div>
          <FooterCol title="Producto" items={[
            { label: 'Cómo funciona', onClick: () => onScrollTo('funciona') },
            { label: 'Funcionalidades', onClick: () => onScrollTo('features') },
            { label: 'Precios', onClick: () => onScrollTo('precios') },
            { label: 'Para pacientes', onClick: () => onScrollTo('paciente') },
          ]} />
          <FooterCol title="Empresa" items={[
            { label: 'Sobre nosotros', href: '/about.html' },
            { label: 'Contacto', href: 'mailto:hola@tecito.com.ar' },
          ]} />
          <FooterCol title="Legal" items={[
            { label: 'Términos', href: '/terms.html' },
            { label: 'Privacidad', href: '/privacy.html' },
            { label: 'Seguridad', href: '/security.html' },
          ]} />
        </div>
        <div
          className="flex justify-between gap-4 flex-wrap text-text-hint pt-6"
          style={{ borderTop: '1px solid var(--color-gray-border)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
        >
          <span>© 2026 Tecito · Buenos Aires</span>
          <span>hola@tecito.com.ar</span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, items }: { title: string; items: { label: string; href?: string; onClick?: () => void }[] }) {
  return (
    <div>
      <h6
        className="uppercase text-text-hint font-medium"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', margin: '0 0 16px' }}
      >
        {title}
      </h6>
      <ul className="flex flex-col gap-2.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((it) => (
          <li key={it.label}>
            {it.href ? (
              <a className="text-text-muted hover:text-text" style={{ fontSize: 13 }} href={it.href}>{it.label}</a>
            ) : it.onClick ? (
              <button onClick={it.onClick} className="text-text-muted hover:text-text cursor-pointer text-left" style={{ fontSize: 13, background: 'none', border: 0, padding: 0 }}>{it.label}</button>
            ) : (
              <span className="text-text-muted" style={{ fontSize: 13 }}>{it.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   SHARED PRIMITIVES
   ────────────────────────────────────────────────────────────────── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="uppercase text-text-hint"
      style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em' }}
    >
      {children}
    </span>
  )
}

function SectionHead({ eyebrow, headBefore, headItalic, sub }: { eyebrow: string; headBefore: string; headItalic: string; sub: string }) {
  return (
    <div style={{ marginBottom: 56, maxWidth: 720 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className="mt-3.5"
        style={{ fontFamily: 'var(--font-serif)', fontSize: 52, fontWeight: 400, letterSpacing: '-1.2px', lineHeight: 1.12, margin: '14px 0 0' }}
      >
        {headBefore}
        <span style={{ fontStyle: 'italic' }}>{headItalic}</span>
      </h2>
      {sub && (
        <p className="text-text-muted" style={{ fontSize: 17, margin: '26px 0 0', maxWidth: 580, lineHeight: 1.6 }}>{sub}</p>
      )}
    </div>
  )
}
