import type { ReactNode } from 'react'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
}

/**
 * Clinical Calm page header — serif title (with trailing period) + sans subtitle.
 * Used across every main view to keep the voice consistent.
 *
 * On mobile, when the action cluster wraps below the title (which it
 * almost always does because the title is 36px and only the smallest
 * actions fit alongside), we stretch the cluster to full width and
 * right-align the buttons inside. Without that, the wrapped buttons
 * stuck to the left edge of the row and the header read as broken.
 */
export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
      <div className="min-w-0">
        <h1
          className="text-[36px] sm:text-[44px] font-normal text-text leading-[1.05] tracking-[-0.03em] m-0"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-text-muted mt-2">
            {subtitle}
          </p>
        )}
      </div>
      {right && (
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {right}
        </div>
      )}
    </div>
  )
}
