// Mail 02 — Doctor-facing notification.
//
// Triggers: a patient just booked from the doctor's public link.
// Subject: "Nuevo turno: {{patientName}} · {{dateLabel}}"
//
// Body shape:
//   - Eyebrow "Nuevo turno reservado"
//   - Heading "Te reservaron un turno." (italic accent)
//   - Greeting + patient context
//   - Info card (Paciente / Cuándo / Dónde / Cobertura)
//   - Dual CTAs: "Ver en mi panel →" + "Reagendar"

import * as React from 'react'
import {
  BigHour,
  BodyText,
  CtaRow,
  Eyebrow,
  EmailLayout,
  Heading,
  InfoCard,
  InfoRow,
  InlineLink,
  Italic,
  PrimaryCta,
  SecondaryCta,
  Strong,
  Sub,
} from './_layout'

export function NewBookingNotification() {
  return (
    <EmailLayout preheader="Nuevo turno: {{patientName}} — {{dateLabel}} a las {{timeLabel}}">
      <Eyebrow>Nuevo turno reservado</Eyebrow>

      <Heading>
        Te reservaron<br />
        <Italic>un turno</Italic>.
      </Heading>

      <BodyText>
        Hola <Strong>{'{{doctorFirstName}}'}</Strong>, un paciente acaba de
        reservar desde tu link público. Ya quedó cargado en tu agenda.
      </BodyText>

      <InfoCard>
        <InfoRow
          isFirst
          label="Paciente"
          value={
            <>
              {'{{patientName}}'}
              <Sub>
                <InlineLink href={'tel:{{patientPhoneRaw}}'}>{'{{patientPhone}}'}</InlineLink>{' '}
                · <InlineLink href={'mailto:{{patientEmail}}'}>{'{{patientEmail}}'}</InlineLink>
              </Sub>
            </>
          }
        />
        <InfoRow
          label="Cuándo"
          value={
            <>
              {'{{dateLabel}}'}
              <BigHour hour={'{{timeLabel}}'} duration={'{{durationMin}} min'} />
            </>
          }
        />
        <InfoRow label="Dónde" value={'{{locationName}}'} />
        <InfoRow label="Cobertura" value={'{{coverage}}'} />
      </InfoCard>

      <CtaRow>
        <PrimaryCta href={'{{panelUrl}}'}>Ver en mi panel →</PrimaryCta>
        <SecondaryCta href={'{{reschedulePath}}'}>Reagendar</SecondaryCta>
      </CtaRow>
    </EmailLayout>
  )
}

export default NewBookingNotification
