// Mail 04 — Welcome to Tecito (sent on doctor signup).
//
// Triggers: a new profile is created (post-signup, after the doctor lands on
// their onboarding page).
//
// Subject: "Bienvenido a Tecito · 3 pasos para arrancar"
//
// Body shape:
//   - Eyebrow "Bienvenido a Tecito"
//   - Heading "Por fin, una agenda tranquila." (italic "tranquila")
//   - Body with greeting + 5-minute promise
//   - Step card (3 numbered rows: 01 active in sage, 02-03 muted)
//   - Dual CTAs: "Entrar al panel" + "Ver guía de 2 min"
//   - Founder signoff in serif italic

import * as React from 'react'
import {
  BodyText,
  CtaRow,
  Eyebrow,
  EmailLayout,
  FounderSignoff,
  Heading,
  InfoCard,
  Italic,
  PrimaryCta,
  SecondaryCta,
  StepRow,
  Strong,
} from './_layout'

export function Welcome() {
  return (
    <EmailLayout preheader="Bienvenido a Tecito · 3 pasos para arrancar">
      <Eyebrow>Bienvenido a Tecito</Eyebrow>

      <Heading>
        Por fin, una agenda<br />
        <Italic>tranquila</Italic>.
      </Heading>

      <BodyText>
        Hola <Strong>{'{{doctorFirstName}}'}</Strong>. Tu cuenta ya está lista. En
        5 minutos vas a tener todo armado — te dejamos los tres pasos para
        arrancar.
      </BodyText>

      <InfoCard>
        <StepRow
          isFirst
          active
          number="01"
          title="Cargar tu disponibilidad"
          description="Qué días y horarios atendés. Podés tener varios consultorios."
          badge="Empezar"
        />
        <StepRow
          number="02"
          title="Compartir tu link público"
          description={'{{publicLink}} — lo mandás por WhatsApp a tus pacientes.'}
        />
        <StepRow
          isLast
          number="03"
          title="Atender"
          description="Tus pacientes reservan solos, Tecito recuerda y confirma. Vos atendés."
        />
      </InfoCard>

      <CtaRow>
        <PrimaryCta href={'{{onboardingUrl}}'}>Entrar al panel</PrimaryCta>
        <SecondaryCta href={'{{guideUrl}}'}>Ver guía de 2 min</SecondaryCta>
      </CtaRow>

      <FounderSignoff
        message="Si te trabás con algo, contestame este mail. Te respondo yo."
        name="Angelo, fundador de Tecito"
      />
    </EmailLayout>
  )
}

export default Welcome
