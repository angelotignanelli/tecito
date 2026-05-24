// Doctor-facing notification when a patient books through their public link.
//
// Shorter and more business-like than the patient confirmation — the doctor
// just needs the essentials at a glance and a button into their panel to
// confirm or reschedule.

import * as React from 'react'
import { Text } from '@react-email/components'
import { Card, COLORS, DetailRow, EmailLayout, Eyebrow, FONTS, Heading1, PrimaryButton } from './_layout'

export interface NewBookingNotificationProps {
  doctorFirstName: string
  patientName: string
  patientPhone?: string
  patientEmail?: string
  /** Human date like "lunes 25 de mayo". */
  dateLabel: string
  /** "HH:MM" 24h. */
  timeLabel: string
  durationMin: number
  locationName?: string
  coverage?: string
  /** Deep-link into the agenda for this day (or the doctor's panel home). */
  panelUrl: string
}

export function NewBookingNotification(props: NewBookingNotificationProps) {
  const {
    doctorFirstName,
    patientName,
    patientPhone,
    patientEmail,
    dateLabel,
    timeLabel,
    durationMin,
    locationName,
    coverage,
    panelUrl,
  } = props

  const whenValue = (
    <>
      {dateLabel}
      <br />
      <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textMuted }}>
        {timeLabel} hs · {durationMin} min
      </span>
    </>
  )

  const patientValue = (
    <>
      <span style={{ fontWeight: 500 }}>{patientName}</span>
      {(patientPhone || patientEmail) && (
        <>
          <br />
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textMuted }}>
            {patientPhone}
            {patientPhone && patientEmail ? ' · ' : ''}
            {patientEmail}
          </span>
        </>
      )}
    </>
  )

  return (
    <EmailLayout
      preheader={`Nuevo turno: ${patientName} — ${dateLabel} a las ${timeLabel}`}
    >
      <Eyebrow>Nuevo turno reservado</Eyebrow>

      <Heading1>
        Te reservaron <span style={{ fontStyle: 'italic', color: COLORS.primary }}>un</span> turno.
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
        Hola {doctorFirstName}, un paciente acaba de reservar desde tu link
        público. El turno ya quedó cargado en tu agenda.
      </Text>

      <Card>
        <DetailRow label="Paciente" value={patientValue} />
        <DetailRow label="Cuándo" value={whenValue} />
        {locationName && <DetailRow label="Dónde" value={locationName} />}
        {coverage && <DetailRow label="Cobertura" value={coverage} />}
      </Card>

      <PrimaryButton href={panelUrl}>Ver en mi panel →</PrimaryButton>
    </EmailLayout>
  )
}

export default NewBookingNotification
