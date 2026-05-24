// Mail 03 — Doctor-facing cancellation notice.
//
// Triggers: the patient cancelled their appointment (cancellation flow,
// not the legacy mailto). The endpoint that sends this is currently called
// from a hand-rolled flow; once we have the public token-based cancellation
// page wired this will be triggered automatically.
//
// Subject: "{{patientName}} canceló su turno del {{dateLabel}}"
//
// Body shape:
//   - Eyebrow + accents in coral (NOT alarm red — softer ink).
//   - Heading with "no va a poder" in italic coral.
//   - Info card with the time/date struck through (the appointment that
//     is no longer happening), patient contact, cancellation context, and
//     an optional reason quoted in serif italic.
//   - Dual CTAs: "Ver mi agenda" + "Escribirle a {{patientFirstName}}"
//
// `{{cancellationReason}}` is optional — if empty the entire "Motivo" row is
// rendered without content (the serverless function will replace with an
// empty string). We keep the row template-level so the schema is constant.

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
  COLORS,
  FONTS,
} from './_layout'

export function CancellationNotification() {
  return (
    <EmailLayout preheader="{{patientName}} canceló su turno del {{dateLabel}}">
      <Eyebrow tone="coral">Turno cancelado</Eyebrow>

      <Heading>
        Un paciente <Italic tone="coral">no va a poder</Italic><br />
        venir.
      </Heading>

      <BodyText>
        Hola <Strong>{'{{doctorFirstName}}'}</Strong>,{' '}
        <Strong>{'{{patientName}}'}</Strong> acaba de cancelar su turno del{' '}
        {'{{dateLabelWeekday}}'}. El horario quedó liberado en tu agenda y se va
        a ofrecer a otros pacientes desde tu link.
      </BodyText>

      <InfoCard>
        <InfoRow
          isFirst
          label="Turno"
          strikethrough
          value={
            <>
              {'{{dateLabel}}'}
              <BigHour
                hour={'{{timeLabel}}'}
                duration={'{{durationMin}} min'}
                strikethrough
              />
            </>
          }
        />
        <InfoRow
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
          label="Cancelado"
          value={
            <>
              {'{{cancelledAtRelative}}'}
              <Sub>{'{{cancelledAtAdvance}}'}</Sub>
            </>
          }
        />
        <InfoRow
          label="Motivo"
          value={
            <div
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                color: COLORS.textMuted,
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              {/* Renders as the empty string when the patient didn't supply
                  a reason — the field collapses visually rather than being
                  conditionally absent, keeping the layout stable. */}
              “{'{{cancellationReason}}'}”
            </div>
          }
        />
      </InfoCard>

      <CtaRow>
        <PrimaryCta href={'{{agendaUrl}}'}>Ver mi agenda</PrimaryCta>
        <SecondaryCta href={'{{messagePatientUrl}}'}>
          Escribirle a {'{{patientFirstName}}'}
        </SecondaryCta>
      </CtaRow>
    </EmailLayout>
  )
}

export default CancellationNotification
