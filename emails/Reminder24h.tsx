// Mail 05 — Patient-facing 24h reminder.
//
// Triggers: /api/cron/send-reminders catches an appointment scheduled
// for tomorrow that hasn't been reminded yet, and fires this template.
// Subject: "Recordá: mañana tenés turno con {{doctorFullName}}"
//
// Body shape (visually parallel to BookingConfirmation but with a
// reminder-flavored eyebrow + body):
//   - Eyebrow "Recordatorio"
//   - Heading "Mañana a las {{timeLabel}} hs"
//   - Body: friendly reminder + the cancel link surfaced earlier
//   - InfoCard (Cuándo / Dónde / Cobertura)
//   - Cancel ghost link in body copy
//
// We intentionally don't re-attach the .ics here — the patient already
// has the event in their calendar from the confirmation mail, and most
// calendar apps fire their own native notifications 24h/1h before. This
// mail is the safety net for patients who didn't add the .ics.

import * as React from 'react'
import { Text } from '@react-email/components'
import {
  BigHour,
  BodyText,
  COLORS,
  Eyebrow,
  FONTS,
  Heading,
  InfoCard,
  InfoRow,
  Italic,
  Strong,
  Sub,
  EmailLayout,
} from './_layout'

export function Reminder24h() {
  return (
    <EmailLayout preheader="Mañana {{timeLabel}} hs · {{doctorFullName}} · {{locationName}}">
      <Eyebrow>Recordatorio</Eyebrow>

      <Heading>
        Mañana a las<br />
        <Italic>{'{{timeLabel}}'} hs</Italic>.
      </Heading>

      <BodyText>
        Hola <Strong>{'{{patientFirstName}}'}</Strong>, te recordamos que
        mañana tenés turno con <Strong>{'{{doctorFullName}}'}</Strong>. Si
        cargaste el archivo de calendario que te mandamos cuando reservaste,
        tu celular ya te va a avisar. Si no, dejamos los datos acá abajo.
      </BodyText>

      <InfoCard>
        <InfoRow
          isFirst
          label="Cuándo"
          value={
            <>
              {'{{dateLabel}}'}
              <BigHour hour={'{{timeLabel}}'} duration={'{{durationMin}} min'} />
            </>
          }
        />
        <InfoRow
          label="Dónde"
          value={
            <>
              {'{{locationName}}'}
              <Sub>{'{{locationAddress}}'}</Sub>
            </>
          }
        />
        <InfoRow label="Cobertura" value={'{{coverage}}'} />
      </InfoCard>

      <Text
        style={{
          fontFamily: FONTS.sans,
          fontSize: 14,
          color: COLORS.textMuted,
          margin: '32px 0 0',
          lineHeight: 1.5,
        }}
      >
        ¿No vas a poder venir?{' '}
        <a
          href="{{cancelUrl}}"
          style={{
            color: COLORS.primary,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            textDecorationColor: 'rgba(59,74,56,0.3)',
            fontWeight: 500,
          }}
        >
          Cancelar este turno
        </a>{' '}
        — le avisamos al profesional para que pueda liberar el horario.
      </Text>
    </EmailLayout>
  )
}

export default Reminder24h
