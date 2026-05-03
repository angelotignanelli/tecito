import type { ReactNode } from 'react'
import Logo from '../Logo'

/**
 * Clinical Calm auth shell — editorial sage-left panel + form-right panel.
 * Collapses to a single-column layout on narrow viewports.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
      {/* Editorial left panel */}
      <div
        className="md:w-[44%] md:min-h-screen bg-primary text-surface px-10 md:px-14 py-10 md:py-12 flex flex-col justify-between gap-10"
      >
        {/* Wordmark — inverse variant: sits on the dark sage panel */}
        <div className="flex items-baseline gap-3">
          <Logo variant="full" size={32} inverse className="text-surface" />
          <div
            className="text-[11px] opacity-55 uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            panel profesional
          </div>
        </div>

        {/* Display + quote */}
        <div>
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

        {/* Tech footer */}
        <div
          className="flex gap-6 text-[11px] opacity-50 uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span>v 2.4</span>
          <span>hipaa-compliant</span>
          <span>hecho en argentina</span>
        </div>
      </div>

      {/* Form right */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-10 overflow-y-auto">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  )
}
