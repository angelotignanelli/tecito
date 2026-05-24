// Doctor-facing notification when a patient books through their public link.
//
// Shorter than the patient confirmation — the doctor just needs the
// essentials and a button into their panel to confirm/reschedule.

import * as React from 'react'
import { Text } from '@react-email/components'
import { Card, COLORS, DetailRow, EmailLayout, Eyebrow, FONTS, Heading1, PrimaryButton } from './_layout'

export function NewBookingNotification() {
  return (
    <EmailLayout preheader="Nuevo turno: {{patientName}} — {{dateLabel}} a las {{timeLabel}}">
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
        Hola {'{{doctorFirstName}}'}, un paciente acaba de reservar desde tu link
        público. El turno ya quedó cargado en tu agenda.
      </Text>

      <Card>
        <DetailRow
          label="Paciente"
          value={
            <>
              <span style={{ fontWeight: 500 }}>{'{{patientName}}'}</span>
              <br />
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textMuted }}>
                {'{{patientContact}}'}
              </span>
            </>
          }
        />
        <DetailRow
          label="Cuándo"
          value={
            <>
              {'{{dateLabel}}'}
              <br />
              <span style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textMuted }}>
                {'{{timeLabel}}'} hs · {'{{durationMin}}'} min
              </span>
            </>
          }
        />
        <DetailRow label="Dónde" value={'{{locationName}}'} />
        <DetailRow label="Cobertura" value={'{{coverage}}'} />
      </Card>

      <PrimaryButton href="{{panelUrl}}">Ver en mi panel →</PrimaryButton>
    </EmailLayout>
  )
}

export default NewBookingNotification
