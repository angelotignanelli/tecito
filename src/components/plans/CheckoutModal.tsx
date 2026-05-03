// Modal that hosts MercadoPago's Card Payment Brick. The Brick is MP's own
// card form component — the user types card data inside Medibot, the SDK
// tokenizes it client-side (card data never touches our server), and we pass
// the resulting token to /api/mp-create-subscription which POSTs /preapproval
// to MP with our user_id as external_reference.
//
// This replaces the old redirect-to-mercadopago.com.ar flow, which couldn't
// carry external_reference and forced us into reconciliation heuristics.

import { useEffect, useRef, useState } from 'react'
import { PLANS, formatARS, type PlanId } from '../../lib/plans'
import { createSubscription } from '../../lib/billing'
import Icon from '../Icon'

interface Props {
  planId: Exclude<PlanId, 'free'>
  publicKey: string
  payerEmail: string
  /** True when the user has already used their trial — the backend will
   *  charge immediately instead of giving another 14 free days. Surfaced so
   *  the modal copy can be honest about what happens on Pay. */
  isReactivation?: boolean
  onSuccess: () => void
  onClose: () => void
}

export default function CheckoutModal({
  planId,
  publicKey,
  payerEmail,
  isReactivation,
  onSuccess,
  onClose,
}: Props) {
  const plan = PLANS[planId]
  const containerId = 'mp-card-payment-brick'
  const brickRef = useRef<{ unmount: () => void } | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!window.MercadoPago) {
        setError('No pudimos cargar MercadoPago. Revisá tu conexión y recargá.')
        setStatus('error')
        return
      }
      try {
        const mp = new window.MercadoPago(publicKey, { locale: 'es-AR' })
        const bricks = mp.bricks()
        const brick = await bricks.create('cardPayment', containerId, {
          initialization: {
            amount: plan.price,
            payer: { email: payerEmail },
          },
          customization: {
            paymentMethods: { maxInstallments: 1 },
            visual: {
              style: {
                theme: 'default',
                customVariables: {
                  // Match the Clinical Calm palette.
                  formBackgroundColor: '#FFFFFF',
                  baseColor: '#3B4A38',
                  baseColorFirstVariant: '#3B4A38',
                  baseColorSecondVariant: '#2F3C2D',
                  errorColor: '#C06464',
                  successColor: '#5A8A7A',
                  borderRadiusSmall: '8px',
                  borderRadiusMedium: '10px',
                  borderRadiusLarge: '12px',
                  fontSizeExtraSmall: '11px',
                  fontSizeSmall: '12px',
                  fontSizeMedium: '14px',
                  fontSizeLarge: '16px',
                  fontWeightNormal: '400',
                  fontWeightSemiBold: '500',
                },
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setStatus('ready')
            },
            onSubmit: async (formData) => {
              // MP's Card Payment Brick passes the tokenized card data
              // directly as the first argument — not wrapped in { formData }.
              if (cancelled) return
              setStatus('submitting')
              setError(null)
              try {
                await createSubscription({
                  planId,
                  cardToken: formData.token,
                  payerEmail: formData.payer?.email || payerEmail,
                })
                if (!cancelled) onSuccess()
              } catch (err) {
                if (!cancelled) {
                  setError(err instanceof Error ? err.message : String(err))
                  setStatus('error')
                }
                // Rethrow so the Brick re-enables its submit button — the user
                // can retry (e.g. with a different card) without closing.
                throw err
              }
            },
            onError: (err) => {
              console.error('MP Brick error', err)
              if (!cancelled) {
                setError('Hubo un problema con los datos de la tarjeta. Revisalos e intentá de nuevo.')
                setStatus('error')
              }
            },
          },
        })
        if (cancelled) {
          brick.unmount()
          return
        }
        brickRef.current = brick
      } catch (err) {
        console.error('MP Brick init failed', err)
        if (!cancelled) {
          setError('No pudimos inicializar el formulario de pago.')
          setStatus('error')
        }
      }
    })()

    return () => {
      cancelled = true
      brickRef.current?.unmount()
      brickRef.current = null
    }
  }, [publicKey, payerEmail, planId, plan.price])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-6 md:py-12"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[440px] mx-4 bg-surface rounded-[18px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className="text-[10px] text-text-hint uppercase tracking-[0.15em]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Suscribirte a
              </div>
              <div
                className="text-[22px] italic text-primary tracking-[-0.015em] mt-1"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Tecito {plan.name}
              </div>
              <div className="text-[12px] text-text-muted mt-1">
                {isReactivation
                  ? `${formatARS(plan.price)} / mes · cobro hoy · cancelás cuando quieras`
                  : `${formatARS(plan.price)} / mes · 14 días gratis · cancelás cuando quieras`}
              </div>
              {isReactivation && (
                <div className="text-[11px] text-text-hint mt-2 leading-[1.55]">
                  Ya usaste tu prueba gratis. Al confirmar te cobramos {formatARS(plan.price)} ahora
                  y se renueva todos los meses.
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-surface-2 grid place-items-center cursor-pointer text-text-hint shrink-0"
              aria-label="Cerrar"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        {/* Brick container.
            The MP Card Payment Brick reserves vertical space for an
            installments selector even when maxInstallments=1 hides it,
            leaving a ~150px gap below the Pagar button. We collapse any
            empty divs the brick injects with the [&_div:empty]:hidden
            arbitrary variant, and trim our own padding so the trust
            footer sits flush against the form. */}
        <div className="px-6 pt-5 pb-2 [&_div:empty]:hidden">
          {status === 'loading' && (
            <div className="text-center text-[13px] text-text-muted py-10">
              Cargando formulario de pago…
            </div>
          )}
          <div id={containerId} />
          {status === 'submitting' && (
            <div className="text-center text-[13px] text-primary bg-primary-light rounded-[8px] py-2.5 mt-3">
              Creando tu suscripción…
            </div>
          )}
          {error && (
            <div className="text-[12px] text-coral bg-coral-light rounded-[8px] px-3 py-2 mt-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer — trust signals */}
        <div className="px-6 pb-5 pt-1 flex items-center gap-2 text-[11px] text-text-hint">
          <Icon name="lock" size={12} />
          <span>Procesado por MercadoPago. No guardamos los datos de tu tarjeta.</span>
        </div>
      </div>
    </div>
  )
}
