// Public cancellation flow — patient lands here when they click "No voy a
// poder ir" in the booking confirmation email.
//
// Lifecycle:
//   1) On mount → GET /api/cancel-booking?token=... fetches the appointment
//      preview. Errors (expired/malformed token, appointment not found) end
//      in the "error" state.
//   2) If the turno is already cancelled, we surface that without a confirm
//      button — there's nothing for the patient to do.
//   3) Confirm → POST /api/cancel-booking { token, reason? }; on success we
//      flip to the "done" state and show a calm "todo listo" screen.
//
// Visual language mirrors the static legal pages (about/terms/privacy/
// security): bone bg, sage primary, Newsreader italic accents, mono eyebrow.

import { useEffect, useState } from 'react'

interface Props {
  token: string
}

interface AppointmentPreview {
  id: string
  status: string
  date: string
  dateLabel: string
  time: string
  doctorFullName: string
  patientName: string
  location: string | null
  alreadyCancelled: boolean
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'preview'; apt: AppointmentPreview }
  | { kind: 'submitting' }
  | { kind: 'done'; apt: AppointmentPreview }
  | { kind: 'already-cancelled'; apt: AppointmentPreview }
  | { kind: 'error'; message: string }

export default function CancelBookingPage({ token }: Props) {
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [reason, setReason] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch(`/api/cancel-booking?token=${encodeURIComponent(token)}`)
        const json = (await resp.json()) as { appointment?: AppointmentPreview; error?: string }
        if (cancelled) return
        if (!resp.ok || !json.appointment) {
          setState({ kind: 'error', message: json.error || 'No pudimos cargar este turno.' })
          return
        }
        const apt = json.appointment
        setState({
          kind: apt.alreadyCancelled ? 'already-cancelled' : 'preview',
          apt,
        })
      } catch {
        if (cancelled) return
        setState({ kind: 'error', message: 'No pudimos conectar con Tecito. Probá de nuevo en un minuto.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleConfirm = async () => {
    if (state.kind !== 'preview') return
    const apt = state.apt
    setState({ kind: 'submitting' })
    try {
      const resp = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: reason.trim() || undefined }),
      })
      const json = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!resp.ok || !json.ok) {
        setState({ kind: 'error', message: json.error || 'No pudimos cancelar el turno.' })
        return
      }
      setState({ kind: 'done', apt })
    } catch {
      setState({ kind: 'error', message: 'No pudimos conectar con Tecito.' })
    }
  }

  return (
    <Shell>
      {state.kind === 'loading' && (
        <CenteredMessage eyebrow="Cancelar turno" title="Cargando…" />
      )}

      {state.kind === 'error' && (
        <CenteredMessage
          eyebrow="Cancelar turno"
          title={
            <>
              <em style={{ fontStyle: 'italic', color: 'var(--cancel-primary)' }}>Algo</em> no salió bien.
            </>
          }
          message={state.message}
          ctaLabel="Volver al inicio"
          ctaHref="/"
        />
      )}

      {state.kind === 'already-cancelled' && (
        <CenteredMessage
          eyebrow="Cancelar turno"
          title={
            <>
              Este turno <em style={{ fontStyle: 'italic', color: 'var(--cancel-primary)' }}>ya está</em> cancelado.
            </>
          }
          message={
            <>
              El turno con <strong>{state.apt.doctorFullName}</strong> el{' '}
              <strong>{state.apt.dateLabel}</strong> a las <strong>{state.apt.time} hs</strong>{' '}
              figura como cancelado. No hay nada más que hacer.
            </>
          }
          ctaLabel="Volver al inicio"
          ctaHref="/"
        />
      )}

      {state.kind === 'done' && (
        <CenteredMessage
          eyebrow="Turno cancelado"
          title={
            <>
              Listo, <em style={{ fontStyle: 'italic', color: 'var(--cancel-primary)' }}>ya está</em>.
            </>
          }
          message={
            <>
              Cancelamos tu turno con <strong>{state.apt.doctorFullName}</strong> del{' '}
              <strong>{state.apt.dateLabel}</strong> a las <strong>{state.apt.time} hs</strong>.{' '}
              Le avisamos al profesional. Gracias por avisarnos a tiempo.
            </>
          }
          ctaLabel="Volver al inicio"
          ctaHref="/"
        />
      )}

      {(state.kind === 'preview' || state.kind === 'submitting') && (
        <PreviewForm
          apt={(state as { kind: 'preview' | 'submitting'; apt?: AppointmentPreview }).apt ?? null}
          reason={reason}
          onReasonChange={setReason}
          onConfirm={handleConfirm}
          submitting={state.kind === 'submitting'}
        />
      )}
    </Shell>
  )
}

// ─── Layout shell ───────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#F5F2EC',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#1A1815',
        // Theme-scoped CSS variable so child components can reference the
        // sage primary without re-typing the hex.
        ['--cancel-primary' as never]: '#3B4A38',
      }}
    >
      <nav
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid #E8E2D4',
        }}
      >
        <BrandDot />
        <span
          style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 22,
            fontWeight: 500,
            color: '#3B4A38',
            letterSpacing: '-0.3px',
            lineHeight: 1,
          }}
        >
          Tecito
        </span>
      </nav>
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '56px 24px 96px' }}>{children}</main>
    </div>
  )
}

function BrandDot() {
  return (
    <span
      style={{
        position: 'relative',
        width: 28,
        height: 28,
        borderRadius: 999,
        background: '#3B4A38',
        color: 'white',
        display: 'inline-block',
        textAlign: 'center',
        lineHeight: '28px',
        fontFamily: 'Newsreader, Georgia, serif',
        fontStyle: 'italic',
        fontSize: 16,
      }}
    >
      t
      <span
        style={{
          position: 'absolute',
          width: 3,
          height: 3,
          borderRadius: 999,
          background: 'white',
          right: 7,
          top: 12,
        }}
      />
    </span>
  )
}

// ─── Centered single-message screens (loading / error / done) ───────────────

function CenteredMessage({
  eyebrow,
  title,
  message,
  ctaLabel,
  ctaHref,
}: {
  eyebrow: string
  title: React.ReactNode
  message?: React.ReactNode
  ctaLabel?: string
  ctaHref?: string
}) {
  return (
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <H1>{title}</H1>
      {message && (
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 16,
            color: '#55504A',
            lineHeight: 1.6,
            margin: '24px 0 0',
          }}
        >
          {message}
        </p>
      )}
      {ctaLabel && ctaHref && (
        <p style={{ margin: '32px 0 0' }}>
          <a
            href={ctaHref}
            style={{
              display: 'inline-block',
              background: '#3B4A38',
              color: 'white',
              padding: '12px 22px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {ctaLabel}
          </a>
        </p>
      )}
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: '"Geist Mono", ui-monospace, Menlo, monospace',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: '#8A847C',
        display: 'block',
        marginBottom: 14,
      }}
    >
      {children}
    </span>
  )
}

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: 'Newsreader, Georgia, serif',
        fontSize: 'clamp(34px, 5.4vw, 48px)',
        fontWeight: 500,
        letterSpacing: '-1.1px',
        lineHeight: 1.08,
        color: '#1A1815',
        margin: 0,
      }}
    >
      {children}
    </h1>
  )
}

// ─── Preview + confirm form ─────────────────────────────────────────────────

function PreviewForm({
  apt,
  reason,
  onReasonChange,
  onConfirm,
  submitting,
}: {
  apt: AppointmentPreview | null
  reason: string
  onReasonChange: (v: string) => void
  onConfirm: () => void
  submitting: boolean
}) {
  // `submitting` keeps the previous apt visible while we POST; if for any
  // reason `apt` is null in this branch, fall back gracefully.
  if (!apt) return null

  return (
    <div>
      <Eyebrow>Cancelar turno</Eyebrow>
      <H1>
        ¿Querés cancelar <em style={{ fontStyle: 'italic', color: '#3B4A38' }}>tu turno</em>?
      </H1>

      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 16,
          color: '#55504A',
          lineHeight: 1.6,
          margin: '24px 0 0',
        }}
      >
        Hola <strong>{apt.patientName.split(' ')[0]}</strong>. Estás a punto de cancelar
        este turno. Le vamos a avisar a <strong>{apt.doctorFullName}</strong> apenas
        confirmes.
      </p>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E2D4',
          borderRadius: 14,
          padding: 22,
          margin: '28px 0 24px',
        }}
      >
        <Row label="Profesional" value={apt.doctorFullName} />
        <Row label="Cuándo" value={`${apt.dateLabel} · ${apt.time} hs`} />
        {apt.location && <Row label="Dónde" value={apt.location} />}
      </div>

      <label
        htmlFor="reason"
        style={{
          fontFamily: '"Geist Mono", ui-monospace, monospace',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: '#8A847C',
          display: 'block',
          marginBottom: 8,
        }}
      >
        Motivo <span style={{ textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 4 }}>(opcional)</span>
      </label>
      <textarea
        id="reason"
        rows={3}
        placeholder="Si querés, contale al profesional por qué no podés. Le ayuda a entender y reagendar."
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        disabled={submitting}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 14,
          borderRadius: 12,
          border: '1px solid #E8E2D4',
          background: '#FFFFFF',
          fontFamily: 'Inter, sans-serif',
          fontSize: 15,
          color: '#1A1815',
          lineHeight: 1.5,
          resize: 'vertical',
          outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          style={{
            background: '#A24A32',
            color: 'white',
            padding: '14px 22px',
            borderRadius: 10,
            border: 'none',
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Cancelando…' : 'Sí, cancelar este turno'}
        </button>
        <a
          href="/"
          style={{
            background: 'transparent',
            color: '#3B4A38',
            padding: '13px 22px',
            borderRadius: 10,
            border: '1px solid #C3CBBE',
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Mejor no
        </a>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <table cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ marginBottom: 12 }}>
      <tbody>
        <tr>
          <td style={{ width: 90, verticalAlign: 'top' }}>
            <span
              style={{
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: '#8A847C',
                paddingTop: 2,
                display: 'inline-block',
              }}
            >
              {label}
            </span>
          </td>
          <td style={{ verticalAlign: 'top' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: '#1A1815' }}>
              {value}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
