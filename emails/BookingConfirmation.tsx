// Patient-facing booking confirmation.
//
// Compiled to HTML at build time (see scripts/build-emails.mjs). Placeholders
// wrapped in `{{ ... }}` are substituted in by the serverless function at
// runtime. The compile step renders this template once with placeholder
// strings as props — any conditional logic happens at runtime via the
// substitution (no IF/ELSE comment blocks needed; every section is always
// present with a sensible fallback string).

import * as React from 'react'
import { Text } from '@react-email/components'
import { Card, COLORS, DetailRow, EmailLayout, Eyebrow, FONTS, GhostLink, Heading1 } from './_layout'

// Build script passes each prop as a literal `{{name}}` string so the
// compiled HTML carries those tokens verbatim. The serverless function then
// HTML-escapes each runtime value and `.replace()`s the tokens.
export function BookingConfirmation() {
  return (
    <EmailLayout preheader="Tu turno con {{doctorFullName}} — {{dateLabel}} a las {{timeLabel}} hs">
      <Eyebrow>Tu turno está confirmado</Eyebrow>

      <Heading1>
        Te esperamos el{' '}
        <span style={{ fontStyle: 'italic', color: COLORS.primary }}>{'{{dateLabelLower}}'}</span>.
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
        Hola {'{{patientFirstName}}'}, reservaste un turno con{' '}
        <span style={{ color: COLORS.text, fontWeight: 500 }}>{'{{doctorFullName}}'}</span>.
        Te dejamos los detalles abajo y un archivo adjunto (.ics) para que lo
        agendes en tu calendario.
      </Text>

      <Card>
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
        <DetailRow
          label="Dónde"
          value={
            <>
              <span style={{ fontWeight: 500 }}>{'{{locationName}}'}</span>
              <br />
              <span style={{ color: COLORS.textMuted, fontSize: 14 }}>{'{{locationAddress}}'}</span>
            </>
          }
        />
        <DetailRow label="Cobertura" value={'{{coverage}}'} />
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
        <GhostLink href="{{cancelMailto}}">¿No vas a poder venir? Cancelar este turno</GhostLink>
      </Text>
    </EmailLayout>
  )
}

export default BookingConfirmation
