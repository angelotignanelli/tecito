// Mail 01 — Patient-facing booking confirmation.
//
// Triggers: successful booking from the doctor's public link (/p/:code).
// Subject: "Tu turno con {{doctorFullName}} está confirmado"
//
// Body shape:
//   - Eyebrow "Tu turno está confirmado"
//   - Heading "Te esperamos el {{dateLabel}}." (date in italic sage)
//   - Greeting + doctor name + .ics mention
//   - Info card (Cuándo / Dónde / Cobertura)
//   - Single sober ghost link to the cancellation flow
//
// We intentionally don't include a "Ver mi turno" primary CTA — the patient
// can already see everything they need in this email; sending them to the
// doctor's public booking page would just confuse them into booking again.
// We also don't include a visual .ics attachment card, since Gmail / Apple
// Mail surface the real attachment at the bottom of the message by default,
// and a non-clickable mock card on top of that adds noise.

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

export function BookingConfirmation() {
  return (
    <EmailLayout preheader="Tu turno con {{doctorFullName}} — {{dateLabel}} a las {{timeLabel}} hs">
      <Eyebrow>Tu turno está confirmado</Eyebrow>

      <Heading>
        Te esperamos el<br />
        <Italic>{'{{dateLabelLower}}'}</Italic>.
      </Heading>

      <BodyText>
        Hola <Strong>{'{{patientFirstName}}'}</Strong>, reservaste un turno con{' '}
        <Strong>{'{{doctorFullName}}'}</Strong>. Adjuntamos un archivo{' '}
        <code
          style={{
            fontFamily: '"Geist Mono", Menlo, Consolas, monospace',
            fontSize: 13,
            background: '#ECEFE8',
            padding: '1px 6px',
            borderRadius: 4,
            color: '#3B4A38',
          }}
        >
          .ics
        </code>{' '}
        para que lo agendes en tu calendario en un toque — con recordatorios
        24 h y 2 h antes.
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

export default BookingConfirmation
