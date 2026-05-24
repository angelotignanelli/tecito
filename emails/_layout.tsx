// Shared visual system for every Tecito transactional email.
//
// Implements the hi-fi design tokens from design_handoff_emails_tecito:
//  - Paper cream background (#F5F2EC), forest green primary (#3B4A38).
//  - Newsreader serif headings with italic accent words, Inter body,
//    Geist Mono for eyebrows + monetary/time-like values.
//  - Brand lockup: a 32px green disc with an italic "t" and a tea-dot,
//    next to the "Tecito" wordmark in Newsreader italic.
//  - Info card on white surface with thin sand dividers between rows.
//  - Dual CTAs (primary sage + secondary ghost with #C3CBBE border).
//  - Founder-style signed footer with the small brand mark.
//
// Compiled to HTML at build time by scripts/build-emails.ts. The serverless
// function then substitutes `{{placeholder}}` tokens at runtime. Anything you
// can do in JSX is fair game here — the compile step is the only escape from
// Vercel's serverless TSX-resolution issues we hit earlier.

import * as React from 'react'
import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'

export const COLORS = {
  primary: '#3B4A38',
  primaryLight: '#ECEFE8',
  coral: '#A24A32',
  bg: '#F5F2EC',
  surface: '#FFFFFF',
  surfaceMuted: '#FAF7F1',
  line: '#E8E2D4',
  lineCard: '#F0EBDF',
  ghostBorder: '#C3CBBE',
  text: '#1A1815',
  textMuted: '#55504A',
  textHint: '#8A847C',
} as const

export const FONTS = {
  serif: '"Newsreader", Georgia, "Times New Roman", serif',
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  mono: '"Geist Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const

/** Root shell used by every template. */
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
        {/* Keep the cream palette even when the recipient is in dark mode —
            inverting it makes the sage CTA and coral accents lose contrast. */}
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&family=Inter:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
        />
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
            padding: '48px 32px 56px',
          }}
        >
          <BrandLockup />
          {children}
          <FounderFooter />
        </Container>
      </Body>
    </Html>
  )
}

/** Logo + wordmark on top of each email.
 *
 *  We render the disc as a CSS-only badge (no <img>) so it survives image
 *  blocking. The italic "t" + tea-dot is recreated inline. */
function BrandLockup() {
  return (
    <Section style={{ paddingBottom: 36 }}>
      <table cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', paddingRight: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: COLORS.primary,
                  color: COLORS.surface,
                  display: 'inline-block',
                  textAlign: 'center',
                  lineHeight: '32px',
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 18,
                  position: 'relative',
                }}
              >
                t
                <span
                  style={{
                    position: 'absolute',
                    width: 3.5,
                    height: 3.5,
                    borderRadius: 999,
                    background: COLORS.surface,
                    right: 8,
                    top: 13,
                  }}
                />
              </div>
            </td>
            <td style={{ verticalAlign: 'middle' }}>
              <span
                style={{
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 22,
                  fontWeight: 500,
                  color: COLORS.primary,
                  letterSpacing: '-0.3px',
                  lineHeight: 1,
                }}
              >
                Tecito
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

/** Footer: divider, small brand mark + closing message + reply links. */
function FounderFooter() {
  return (
    <>
      <div
        style={{
          height: 1,
          background: COLORS.line,
          margin: '40px 0 24px',
        }}
      />
      <table cellPadding={0} cellSpacing={0} border={0} style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', paddingRight: 8 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: COLORS.primary,
                  color: COLORS.surface,
                  display: 'inline-block',
                  textAlign: 'center',
                  lineHeight: '16px',
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 10,
                  position: 'relative',
                }}
              >
                t
                <span
                  style={{
                    position: 'absolute',
                    width: 2,
                    height: 2,
                    borderRadius: 999,
                    background: COLORS.surface,
                    right: 3.5,
                    top: 7,
                  }}
                />
              </div>
            </td>
            <td style={{ verticalAlign: 'middle' }}>
              <span
                style={{
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: COLORS.text,
                  letterSpacing: '-0.2px',
                  lineHeight: 1,
                }}
              >
                Tecito
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <Text
        style={{
          fontFamily: FONTS.sans,
          fontSize: 12,
          color: COLORS.textHint,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        {'{{footerMessage}}'}
      </Text>
    </>
  )
}

// ─── Type system primitives ──────────────────────────────────────────────────

/** Mono uppercase context label above the heading. Pass `tone="coral"` for
 *  the cancellation template. */
export function Eyebrow({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'coral' }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.mono,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: tone === 'coral' ? COLORS.coral : COLORS.textHint,
        margin: '0 0 18px',
      }}
    >
      {children}
    </Text>
  )
}

/** Newsreader H1, 36px peso 500. */
export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.serif,
        fontSize: 36,
        fontWeight: 500,
        lineHeight: 1.1,
        letterSpacing: '-1.2px',
        color: COLORS.text,
        margin: 0,
      }}
    >
      {children}
    </Text>
  )
}

/** Italic accent word inside Heading. Pass `tone="coral"` to use the
 *  cancellation accent color; defaults to sage. */
export function Italic({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'coral' }) {
  return (
    <span
      style={{
        fontStyle: 'italic',
        color: tone === 'coral' ? COLORS.coral : COLORS.primary,
        fontWeight: 400,
      }}
    >
      {children}
    </span>
  )
}

/** Body paragraph. `<Strong>` children get ink-strong + weight 500. */
export function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.sans,
        fontSize: 15,
        color: COLORS.textMuted,
        margin: '28px 0 0',
        lineHeight: 1.6,
      }}
    >
      {children}
    </Text>
  )
}

export function Strong({ children }: { children: React.ReactNode }) {
  return (
    <strong style={{ color: COLORS.text, fontWeight: 500 }}>{children}</strong>
  )
}

// ─── Info card ───────────────────────────────────────────────────────────────

export function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: '32px 28px',
        margin: '32px 0',
        // Subtle ground shadow rather than a hairline border — feels softer.
        boxShadow: '0 1px 0 rgba(26,24,21,0.04)',
      }}
    >
      {children}
    </Section>
  )
}

/** A single label + value row inside InfoCard. The first row drops top
 *  padding; subsequent rows are separated by a thin sand divider. */
export function InfoRow({
  label,
  value,
  isFirst = false,
  strikethrough = false,
}: {
  label: string
  value: React.ReactNode
  isFirst?: boolean
  strikethrough?: boolean
}) {
  const valueStyle: React.CSSProperties = {
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 1.5,
  }
  if (strikethrough) {
    valueStyle.textDecoration = 'line-through'
    valueStyle.textDecorationColor = 'rgba(162,74,50,0.4)'
    // Outlook compat — line-through still works without textDecorationStyle.
  }

  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      border={0}
      width="100%"
      style={{
        borderTop: isFirst ? 'none' : `1px solid ${COLORS.lineCard}`,
        marginTop: isFirst ? 0 : 0,
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              verticalAlign: 'top',
              width: 96,
              paddingTop: isFirst ? 0 : 14,
              paddingBottom: 14,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: COLORS.textHint,
                paddingTop: 4,
                display: 'inline-block',
              }}
            >
              {label}
            </span>
          </td>
          <td
            style={{
              verticalAlign: 'top',
              paddingTop: isFirst ? 0 : 14,
              paddingBottom: 14,
              paddingLeft: 18,
            }}
          >
            <div style={valueStyle}>{value}</div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Hour + duration value pair used in "Cuándo". The hour is rendered in
 *  Geist Mono 22px so it pops as the most-scannable bit of info. */
export function BigHour({
  hour,
  duration,
  strikethrough = false,
}: {
  hour: string
  duration: string
  strikethrough?: boolean
}) {
  const lineStyle: React.CSSProperties = {
    marginTop: 8,
    textDecoration: strikethrough ? 'line-through' : 'none',
    textDecorationColor: strikethrough ? 'rgba(162,74,50,0.4)' : undefined,
  }
  return (
    <div style={lineStyle}>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.5px',
          color: COLORS.text,
        }}
      >
        {hour} hs
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 13,
          color: COLORS.textHint,
          marginLeft: 8,
        }}
      >
        · {duration}
      </span>
    </div>
  )
}

/** Small sub-label rendered below a primary value (e.g. address under
 *  location name, contact details under patient name). */
export function Sub({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: COLORS.textHint,
        fontSize: 13,
        marginTop: 4,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

/** Inline link in the brand sage color, with !important to override Gmail's
 *  auto-blue for tel:/mailto: detection. */
export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        color: `${COLORS.primary}`,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(59,74,56,0.3)',
        textUnderlineOffset: '3px',
      }}
    >
      {children}
    </a>
  )
}

// ─── Attachment card (visual reinforcement of .ics in body) ──────────────────

export function AttachmentCard({
  filename,
  meta,
  iconLabel = '.ics',
}: {
  filename: string
  meta: string
  iconLabel?: string
}) {
  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      border={0}
      width="100%"
      style={{
        background: COLORS.surface,
        borderRadius: 12,
        border: `1px solid ${COLORS.line}`,
        marginTop: 20,
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding: 14, paddingRight: 12, verticalAlign: 'middle', width: 60 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: COLORS.primaryLight,
                color: COLORS.primary,
                textAlign: 'center',
                lineHeight: '36px',
                fontSize: 13,
                fontFamily: FONTS.mono,
                fontWeight: 500,
              }}
            >
              {iconLabel}
            </div>
          </td>
          <td style={{ padding: '14px 14px 14px 0', verticalAlign: 'middle' }}>
            <div style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 500, color: COLORS.text }}>
              {filename}
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: COLORS.textHint,
                marginTop: 2,
              }}
            >
              {meta}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ─── CTAs ────────────────────────────────────────────────────────────────────

export function CtaRow({ children }: { children: React.ReactNode }) {
  return (
    <Section style={{ marginTop: 36 }}>
      <table cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>{children}</tr>
        </tbody>
      </table>
    </Section>
  )
}

export function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <td style={{ paddingRight: 10 }}>
      <a
        href={href}
        style={{
          display: 'inline-block',
          background: COLORS.primary,
          color: COLORS.surface,
          padding: '14px 22px',
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
    </td>
  )
}

export function SecondaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <td>
      <a
        href={href}
        style={{
          display: 'inline-block',
          background: 'transparent',
          color: COLORS.primary,
          padding: '13px 22px',
          borderRadius: 10,
          border: `1px solid ${COLORS.ghostBorder}`,
          fontFamily: FONTS.sans,
          fontSize: 14,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        {children}
      </a>
    </td>
  )
}

// ─── Onboarding step row (used in Welcome) ───────────────────────────────────

export function StepRow({
  number,
  title,
  description,
  active = false,
  badge,
  isFirst = false,
  isLast = false,
}: {
  number: string
  title: string
  description: string
  active?: boolean
  badge?: string
  isFirst?: boolean
  isLast?: boolean
}) {
  const numberStyle: React.CSSProperties = active
    ? {
        background: COLORS.primaryLight,
        color: COLORS.primary,
        border: 'none',
      }
    : {
        background: COLORS.surfaceMuted,
        color: COLORS.textHint,
        border: `1px solid ${COLORS.line}`,
      }
  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      border={0}
      width="100%"
      style={{
        borderTop: isFirst ? 'none' : `1px solid ${COLORS.lineCard}`,
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              verticalAlign: 'top',
              width: 44,
              paddingTop: isFirst ? 6 : 18,
              paddingBottom: isLast ? 6 : 18,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                textAlign: 'center',
                lineHeight: '26px',
                fontFamily: FONTS.mono,
                fontSize: 13,
                fontWeight: 500,
                ...numberStyle,
              }}
            >
              {number}
            </div>
          </td>
          <td
            style={{
              verticalAlign: 'top',
              paddingTop: isFirst ? 6 : 18,
              paddingBottom: isLast ? 6 : 18,
              paddingRight: badge ? 8 : 0,
            }}
          >
            <div style={{ fontFamily: FONTS.sans, fontSize: 16, fontWeight: 500, color: COLORS.text }}>
              {title}
            </div>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 13,
                color: COLORS.textHint,
                lineHeight: 1.5,
                marginTop: 4,
              }}
            >
              {description}
            </div>
          </td>
          {badge && (
            <td
              style={{
                verticalAlign: 'middle',
                paddingTop: isFirst ? 6 : 18,
                paddingBottom: isLast ? 6 : 18,
                width: 80,
                textAlign: 'right',
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: COLORS.primary,
                  background: COLORS.primaryLight,
                  padding: '4px 8px',
                  borderRadius: 6,
                  display: 'inline-block',
                }}
              >
                {badge}
              </span>
            </td>
          )}
        </tr>
      </tbody>
    </table>
  )
}

// ─── Founder sign-off (used in Welcome) ──────────────────────────────────────

export function FounderSignoff({
  message,
  name,
}: {
  message: string
  name: string
}) {
  return (
    <div style={{ marginTop: 36 }}>
      <Text
        style={{
          fontFamily: FONTS.serif,
          fontStyle: 'italic',
          fontSize: 16,
          color: COLORS.textMuted,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {message}
      </Text>
      <Text
        style={{
          fontFamily: FONTS.sans,
          fontSize: 13,
          color: COLORS.textHint,
          margin: '8px 0 0',
        }}
      >
        — {name}
      </Text>
    </div>
  )
}
