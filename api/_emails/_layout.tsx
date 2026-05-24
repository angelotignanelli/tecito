// Shared visual shell for every Tecito transactional email.
//
// We can't load Google Fonts in mail clients reliably (Outlook strips them,
// Gmail caches them for ~30min, etc), so we ship the brand families with
// system fallbacks: Newsreader → Georgia, Inter → system sans, Geist Mono
// → ui-monospace. The shape of the layout (bone bg, white card container,
// sand borders, footer with mono copyright) mirrors the React app's static
// pages (about/terms/privacy/security) so the email feels like a
// continuation of the website.

import * as React from 'react'
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'

export const COLORS = {
  primary: '#3B4A38',
  bg: '#F5F2EC',
  surface: '#FFFFFF',
  surface2: '#FAF7F1',
  border: '#E8E2D4',
  text: '#1A1815',
  textMuted: '#55504A',
  textHint: '#8A847C',
} as const

export const FONTS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const

export function EmailLayout({
  preheader,
  children,
}: {
  preheader: string
  children: React.ReactNode
}) {
  return (
    <Html lang="es-AR">
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preheader}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: COLORS.bg,
          fontFamily: FONTS.sans,
          color: COLORS.text,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: '0 auto',
            padding: '40px 24px 56px',
          }}
        >
          {/* Header: Tecito wordmark. We deliberately use only typography so
              the header renders reliably even when the mail client blocks
              images by default (Outlook, Gmail's Promotions tab). */}
          <Section style={{ paddingBottom: 24 }}>
            <Text
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 24,
                color: COLORS.primary,
                letterSpacing: '-0.4px',
                lineHeight: 1,
                margin: 0,
              }}
            >
              Tecito
            </Text>
          </Section>

          {children}

          {/* Footer */}
          <Hr style={{ borderColor: COLORS.border, margin: '40px 0 20px' }} />
          <Section>
            <Text
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: COLORS.textHint,
                margin: '0 0 6px',
                letterSpacing: '0.02em',
              }}
            >
              © 2026 Tecito · Buenos Aires
            </Text>
            <Text
              style={{
                fontFamily: FONTS.sans,
                fontSize: 12,
                color: COLORS.textHint,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Recibiste este mail porque reservaste un turno con un profesional
              que usa Tecito. ¿Dudas?{' '}
              <a
                href="mailto:hola@tecito.com.ar"
                style={{ color: COLORS.primary, textDecoration: 'none' }}
              >
                hola@tecito.com.ar
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/** Mono uppercase eyebrow — same role as in the website. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.mono,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: COLORS.textHint,
        margin: '0 0 14px',
      }}
    >
      {children}
    </Text>
  )
}

/** Serif H1 with optional `<em>` rendered as italic primary. */
export function Heading1({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.serif,
        fontSize: 30,
        lineHeight: 1.15,
        letterSpacing: '-0.6px',
        color: COLORS.text,
        margin: '0 0 8px',
        fontWeight: 400,
      }}
    >
      {children}
    </Text>
  )
}

/** Card surface used to highlight booking details. */
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: '22px 22px',
        margin: '28px 0 24px',
      }}
    >
      {children}
    </Section>
  )
}

/** A label + value row inside a Card. */
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <table cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ marginBottom: 14 }}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'top', width: 90 }}>
            <Text
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: COLORS.textHint,
                margin: 0,
                paddingTop: 4,
              }}
            >
              {label}
            </Text>
          </td>
          <td style={{ verticalAlign: 'top' }}>
            <Text
              style={{
                fontFamily: FONTS.sans,
                fontSize: 15,
                color: COLORS.text,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {value}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Solid sage CTA. */
export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-block',
        backgroundColor: COLORS.primary,
        color: COLORS.surface,
        padding: '12px 22px',
        borderRadius: 10,
        fontFamily: FONTS.sans,
        fontSize: 14,
        fontWeight: 500,
        textDecoration: 'none',
        letterSpacing: '-0.1px',
      }}
    >
      {children}
    </a>
  )
}

/** Subtle text link, used for secondary actions like "cancelar este turno". */
export function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        color: COLORS.textMuted,
        fontFamily: FONTS.sans,
        fontSize: 13,
        textDecoration: 'underline',
        textUnderlineOffset: 2,
      }}
    >
      {children}
    </a>
  )
}
