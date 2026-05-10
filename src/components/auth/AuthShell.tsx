import type { ReactNode } from 'react'
import Logo from '../Logo'

/**
 * Clinical Calm auth shell — editorial sage-left panel + form-right panel.
 *
 * Layout per breakpoint:
 *  - mobile (< md): a slim sage strip carries only the brand mark, and
 *    the form lives directly underneath so the inputs are visible
 *    without scrolling. The editorial copy / testimonial / tech footer
 *    are hidden — they're marketing context for users who are still
 *    deciding, but anyone who landed on /login already decided.
 *  - md+: classic two-column treatment with the full editorial story
 *    on the left and the form on the right.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
      {/* Sage panel — full editorial column on desktop, compact brand strip on mobile */}
      <div
        className="md:w-[44%] md:min-h-screen bg-primary text-surface px-6 md:px-14 py-4 md:py-12 flex flex-col md:justify-between gap-0 md:gap-10"
      >
        {/* Wordmark — inverse variant: sits on the dark sage panel */}
        <div className="flex items-baseline gap-3">
          <Logo variant="full" size={28} inverse className="text-surface" />
          <div
            className="hidden md:block text-[11px] opacity-55 uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            panel profesional
          </div>
        </div>

        {/* Display + quote — desktop only. On mobile the brand strip is
            intentionally minimal so the form is the first thing the
            user sees. */}
        <div className="hidden md:block">
          <div
            className="text-[32px] md:text-[40px] leading-[1.15] tracking-[-0.028em] font-normal"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            El consultorio se administra <span className="italic">solo.</span>
          </div>
          <div className="text-[14px] opacity-75 mt-7 md:mt-8 leading-[1.6] max-w-[380px]">
            Turnos por WhatsApp, historia clínica, recordatorios y estadísticas en un solo lugar.
          </div>

          <div className="mt-10 md:mt-12 pt-5 border-t border-white/15 max-w-[400px]">
            <div
              className="text-[15px] md:text-[17px] italic leading-[1.55] opacity-90"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              "Recuperé dos horas por día que antes usaba contestando WhatsApps. Los pacientes reservan solos."
            </div>
            <div
              className="text-[11px] opacity-60 mt-3.5 uppercase tracking-[0.12em]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              — Dra. Verónica Salinas · Clínica médica
            </div>
          </div>
        </div>

        {/* Tech footer — desktop only */}
        <div
          className="hidden md:flex gap-6 text-[11px] opacity-50 uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span>v 2.4</span>
          <span>hipaa-compliant</span>
          <span>hecho en argentina</span>
        </div>
      </div>

      {/* Form right */}
      <div className="flex-1 flex items-start md:items-center justify-center p-6 md:p-10 pt-8 md:pt-10 overflow-y-auto">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  )
}
