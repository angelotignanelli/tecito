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
//   - Visual attachment card for the .ics
//   - Dual CTAs: "Ver mi turno" + "No voy a poder ir"

import * as React from 'react'
import {
  AttachmentCard,
  BigHour,
  BodyText,
  CtaRow,
  Eyebrow,
  Heading,
  InfoCard,
  InfoRow,
  InlineLink,
  Italic,
  PrimaryCta,
  SecondaryCta,
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
        <Strong>{'{{doctorFullName}}'}</Strong>. Te dejamos todo lo que necesitás
        abajo — y un archivo{' '}
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
        para que lo agendes en un toque.
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

      <AttachmentCard
        filename={'{{icsFilename}}'}
        meta="Recordatorios 24 h y 2 h antes"
      />

      <CtaRow>
        <PrimaryCta href={'{{viewUrl}}'}>Ver mi turno</PrimaryCta>
        <SecondaryCta href={'{{cancelMailto}}'}>No voy a poder ir</SecondaryCta>
      </CtaRow>

      {/* The footer message is injected via {{footerMessage}} in _layout. The
          serverless function passes a context-specific string for each template. */}
      <span style={{ display: 'none' }}>
        <InlineLink href="mailto:hola@tecito.com.ar">hola@tecito.com.ar</InlineLink>
      </span>
    </EmailLayout>
  )
}

export default BookingConfirmation
