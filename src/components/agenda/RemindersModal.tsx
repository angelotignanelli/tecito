import { useMemo, useState } from 'react'
import type { Appointment } from '../../data/appointments'
import type { LocationRow } from '../../lib/hooks'
import { resolveLocationForDate } from '../../lib/locationResolver'
import Icon from '../Icon'
import Btn from '../Btn'

interface Props {
  open: boolean
  onClose: () => void
  appointments: Appointment[]
  dayLabel: string
  /** Appointment date in YYYY-MM-DD — used to humanize "hoy" / "mañana" */
  date: string
  doctorShortName?: string       // e.g. "Dra. Carrizo"
  locations?: LocationRow[]      // all the doctor's locations, for resolving defaults
}

/**
 * Normalize a phone number into wa.me format (digits only, with country code).
 * Argentina rules: if already starts with 54, use as-is. Otherwise prefix "549"
 * (54 country + 9 mobile).
 */
function toWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  if (digits.startsWith('54')) return digits
  // Strip leading 0 or 15 (common AR local prefixes)
  let normalized = digits
  if (normalized.startsWith('0')) normalized = normalized.slice(1)
  if (normalized.startsWith('15')) normalized = normalized.slice(2)
  return `549${normalized}`
}

function humanizeDate(dateStr: string): string {
  const todayISO = new Date().toISOString().split('T')[0]
  const tomorrowISO = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (dateStr === todayISO) return 'hoy'
  if (dateStr === tomorrowISO) return 'mañana'
  const d = new Date(dateStr + 'T12:00:00')
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  return `el ${days[d.getDay()]} ${d.getDate()}/${months[d.getMonth()]}`
}

export default function RemindersModal({ open, onClose, appointments, dayLabel, date, doctorShortName, locations }: Props) {
  const [sent, setSent] = useState<Set<string>>(new Set())

  const reminders = useMemo(() => {
    const when = humanizeDate(date)
    return appointments
      .filter((a) => a.status !== 'libre' && a.status !== 'bloqueado' && a.status !== 'cancelado')
      .filter((a) => a.patient?.phone)
      .map((a) => {
        const firstName = (a.patientName || a.patient?.name || '').split(' ')[0] || 'hola'
        const doc = doctorShortName ? ` con ${doctorShortName}` : ''

        // Resolve the effective location: explicit FK wins, otherwise day-of-week
        const resolved = resolveLocationForDate(a.locationId, a.date, locations ?? [])

        // Prefer resolver output (richer fields) but fall back to whatever was joined on the appointment
        const locName = resolved?.name ?? a.locationName ?? null
        const locAddress = resolved?.address ?? a.locationAddress ?? null
        const locCity = resolved?.city ?? a.locationCity ?? null

        let locationLine = ''
        if (locAddress) {
          const parts = [locAddress, locCity].filter(Boolean).join(', ')
          const prefix = locName ? `en *${locName}*, ` : 'en '
          locationLine = `\n\n📍 ${prefix}${parts}`
        }

        const message =
          `Hola ${firstName}! Te recuerdo que tenés turno ${when} a las ${a.time}${doc}.${locationLine}` +
          `\n\nRespondé *confirmo* para confirmar o *cancelar* si no podés.`

        const waNumber = toWhatsappNumber(a.patient!.phone)
        const url = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}` : null
        return {
          appointment: a,
          message,
          url,
        }
      })
  }, [appointments, date, doctorShortName, locations])

  if (!open) return null

  const total = reminders.length
  const sentCount = sent.size

  const handleOpenOne = (r: (typeof reminders)[number]) => {
    if (!r.url) return
    window.open(r.url, '_blank', 'noopener')
    setSent((prev) => new Set(prev).add(r.appointment.id))
  }

  const handleClose = () => {
    setSent(new Set())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-black/30"
      onClick={handleClose}
    >
      <div
        className="bg-surface sm:rounded-[16px] sm:border sm:border-gray-border sm:shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full sm:max-w-[560px] h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-border flex items-start justify-between shrink-0 gap-4">
          <div className="min-w-0">
            <h2
              className="text-[24px] leading-none tracking-[-0.02em] text-text m-0"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Recordatorios.
            </h2>
            <div className="text-[12px] text-text-muted mt-2">
              <span className="capitalize">{dayLabel}</span> · {total} {total === 1 ? 'paciente con teléfono' : 'pacientes con teléfono'}
            </div>
            <div className="text-[11px] text-text-hint mt-2 leading-[1.45]">
              Abrí cada conversación, apretá <strong className="text-text">enviar</strong> en WhatsApp y volvé a esta lista para el siguiente.
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-surface-2 grid place-items-center cursor-pointer text-text-hint shrink-0"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
          {total === 0 ? (
            <div className="text-center py-8">
              <div className="text-[13px] text-text-hint">No hay pacientes con teléfono para este día.</div>
              <div className="text-[11px] text-text-hint mt-1">Cargá el teléfono en la ficha de cada paciente para poder recordarles.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {reminders.map((r) => {
                const a = r.appointment
                const wasSent = sent.has(a.id)
                return (
                  <div
                    key={a.id}
                    className={`border rounded-[12px] p-3.5 flex items-start gap-3 transition-colors ${
                      wasSent ? 'bg-teal-light border-teal-light' : 'bg-surface border-gray-border'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full grid place-items-center text-[12px] shrink-0 ${
                        wasSent ? 'bg-teal text-surface' : 'bg-primary-light text-primary'
                      }`}
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      {wasSent ? <Icon name="check" size={14} /> : (a.patientName || '').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-medium text-text truncate">{a.patientName}</div>
                        <div className="text-[11px] text-text-hint shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                          {a.time}
                        </div>
                      </div>
                      <div className="text-[11px] text-text-hint mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        {a.patient?.phone}
                      </div>
                      <div className="text-[12px] text-text-muted mt-2 leading-[1.45] line-clamp-2">
                        {r.message}
                      </div>
                    </div>
                    <div className="shrink-0 self-center">
                      {wasSent ? (
                        <span className="text-[11px] text-teal font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
                          Abierto
                        </span>
                      ) : (
                        <Btn size="sm" variant="primary" onClick={() => handleOpenOne(r)}>
                          <Icon name="chat" size={12} /> WhatsApp
                        </Btn>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-gray-border flex items-center justify-between gap-2 shrink-0">
            <div className="text-[11px] text-text-hint" style={{ fontFamily: 'var(--font-mono)' }}>
              {sentCount} / {total} abiertos
            </div>
            <Btn onClick={handleClose}>Cerrar</Btn>
          </div>
        )}
      </div>
    </div>
  )
}
