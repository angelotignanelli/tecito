// Patient-facing booking confirmation.
//
// Sent the moment a patient finishes the booking flow on /p/:code. Carries
// the appointment details and ships a .ics attachment so the patient can add
// it to their calendar with one tap (Gmail surfaces an "Add to calendar"
// button on .ics attachments automatically).
//
// We deliberately don't include a CTA button — the .ics + a sober cancel
// link cover the only two actions a confirmed patient might want.

import * as React from 'react'
import { Text } from '@react-email/components'
import { Card, COLORS, DetailRow, EmailLayout, Eyebrow, FONTS, GhostLink, Heading1 } from './_layout'

export interface BookingConfirmationProps {
  patientFirstName: string
  /** "Dra." or "Dr." prefix if available, otherwise empty. */
  doctorPrefix?: string
  doctorFullName: string
  /** Human date like "lunes 25 de mayo". */
  dateLabel: string
  /** "HH:MM" 24h. */
  timeLabel: string
  /** Duration in minutes. */
  durationMin: number
  /** Full address as a single string. */
  locationName?: string
  locationAddress?: string
  /** Optional name of the patient cover (Particular, OSDE, etc.). */
  coverage?: string
  /** mailto link with pre-filled subject for cancellations. */
  cancelMailto: string
}

export function BookingConfirmation(props: BookingConfirmationProps) {
  const {
    patientFirstName,
    doctorPrefix = '',
    doctorFullName,
    dateLabel,
    timeLabel,
    durationMin,
    locationName,
    locationAddress,
    coverage,
    cancelMailto,
  } = props

  const fullDoctorLabel = doctorPrefix ? `${doctorPrefix} ${doctorFullName}` : doctorFullName

  const whenValue = (
    <>
      {dateLabel}
      <br />
      <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textMuted }}>
        {timeLabel} hs · {durationMin} min
      </span>
    </>
  )

  const whereValue =
    locationName || locationAddress ? (
      <>
        {locationName && <span style={{ fontWeight: 500 }}>{locationName}</span>}
        {locationName && locationAddress && <br />}
        {locationAddress && (
          <span style={{ color: COLORS.textMuted, fontSize: 14 }}>{locationAddress}</span>
        )}
      </>
    ) : (
      <span style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>
        Consultá con tu profesional
      </span>
    )

  return (
    <EmailLayout preheader={`Tu turno con ${fullDoctorLabel} — ${dateLabel} a las ${timeLabel} hs`}>
      <Eyebrow>Tu turno está confirmado</Eyebrow>

      <Heading1>
        Te esperamos el{' '}
        <span style={{ fontStyle: 'italic', color: COLORS.primary }}>{dateLabel.toLowerCase()}</span>.
      </Heading1>

      <Text
        style={{
          fontFamily: FONTS.sans,
          fontSize: 16,
          color: COLORS.textMuted,
          margin: '12px 0 0',
          lineHeight: 1.6,
        }}
      >
        Hola {patientFirstName}, reservaste un turno con{' '}
        <span style={{ color: COLORS.text, fontWeight: 500 }}>{fullDoctorLabel}</span>.
        Te dejamos los detalles abajo y un archivo adjunto (.ics) para que lo
        agendes en tu calendario.
      </Text>

      <Card>
        <DetailRow label="Cuándo" value={whenValue} />
        <DetailRow label="Dónde" value={whereValue} />
        {coverage && <DetailRow label="Cobertura" value={coverage} />}
      </Card>

      <Text
        style={{
          fontFamily: FONTS.sans,
          fontSize: 14,
          color: COLORS.textMuted,
          margin: '0 0 16px',
          lineHeight: 1.55,
        }}
      >
        Adjuntamos un archivo <strong style={{ color: COLORS.text }}>.ics</strong>{' '}
        — tocalo desde tu celular y se agrega a Google Calendar, Apple Calendar
        o Outlook en un toque, con recordatorios programados 24 h y 2 h antes.
      </Text>

      <Text style={{ margin: '24px 0 0', lineHeight: 1.5 }}>
        <GhostLink href={cancelMailto}>¿No vas a poder venir? Cancelar este turno</GhostLink>
      </Text>
    </EmailLayout>
  )
}

export default BookingConfirmation
