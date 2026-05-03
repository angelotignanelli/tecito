// Tecito brand mark + optional wordmark, reused across the app
// (sidebar, auth screens, onboarding, public booking pages, etc.).
//
// Three rendering modes:
//   - 'mark'      → just the green circle with the italic "t·"
//   - 'wordmark'  → just the italic "Tecito" text in serif
//   - 'full'      → mark + wordmark side by side (default)
//
// The mark and wordmark colors track --color-primary by default so
// org theming stays consistent. Pass `inverse` for use on dark
// backgrounds (the mark gets a transparent fill with white "t").

interface Props {
  variant?: 'mark' | 'wordmark' | 'full'
  /** Pixel size of the mark (and proportional font for the wordmark). */
  size?: number
  /** Use light-on-dark variant. */
  inverse?: boolean
  className?: string
}

export default function Logo({ variant = 'full', size = 28, inverse = false, className }: Props) {
  const fill = inverse ? 'transparent' : 'var(--color-primary)'
  const stroke = inverse ? 'currentColor' : 'transparent'
  const fg = inverse ? 'currentColor' : 'var(--color-surface)'
  // Wordmark scales with mark size — feels balanced at ~0.78x
  const wordmarkSize = Math.round(size * 0.78)

  return (
    <span
      className={`inline-flex items-center gap-2.5 leading-none ${className ?? ''}`}
      style={{ fontFamily: 'var(--font-serif)' }}
    >
      {variant !== 'wordmark' && (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="flex-shrink-0"
        >
          <circle cx="32" cy="32" r="32" fill={fill} stroke={stroke} strokeWidth={inverse ? 2 : 0} />
          <text
            x="20"
            y="48"
            fontFamily="Newsreader, Georgia, serif"
            fontSize="34"
            fontStyle="italic"
            fontWeight="500"
            fill={fg}
          >
            t
          </text>
          <circle cx="42" cy="42" r="2.6" fill={fg} />
        </svg>
      )}
      {variant !== 'mark' && (
        <span
          className="italic"
          style={{
            fontSize: wordmarkSize,
            // inverse: inherit parent color so callers can place us on
            // dark backgrounds (eg. the auth shell's sage panel)
            color: inverse ? 'currentColor' : 'var(--color-primary)',
            letterSpacing: '-0.4px',
            fontWeight: 500,
          }}
        >
          Tecito
        </span>
      )}
    </span>
  )
}
