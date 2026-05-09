// Clinical Calm icon set — stroke SVG 20×20, currentColor.
// Replaces the emoji placeholders flagged in the README.

const ICONS: Record<string, string> = {
  calendar: 'M3 8h14M5 4v2M15 4v2M4 6h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
  users:    'M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM14 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 17c0-2.5 2.2-4 5-4s5 1.5 5 4M13 16c0-1.5 1-3 3.5-3S20 14.5 20 16',
  block:    'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM5 5l10 10',
  chart:    'M3 17V9M8 17V5M13 17v-5M18 17v-9',
  chat:     'M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V5z',
  user:     'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3 3-5 6-5s6 2 6 5',
  building: 'M4 17V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v12M4 17h12M7 7h2M11 7h2M7 10h2M11 10h2M7 13h2M11 13h2M8 17v-3h4v3',
  search:   'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM14 14l3 3',
  chevD:    'M5 8l5 5 5-5',
  chevU:    'M15 12l-5-5-5 5',
  chevR:    'M8 5l5 5-5 5',
  chevL:    'M12 5l-5 5 5 5',
  plus:     'M10 4v12M4 10h12',
  check:    'M4 10l4 4 8-8',
  x:        'M5 5l10 10M15 5l-10 10',
  bell:     'M10 2a5 5 0 0 0-5 5v4l-2 2v1h14v-1l-2-2V7a5 5 0 0 0-5-5zM8 16a2 2 0 0 0 4 0',
  phone:    'M5 3h3l2 5-3 1.5a10 10 0 0 0 5 5l1.5-3 5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 3 5a2 2 0 0 1 2-2z',
  clock:    'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 6v4l3 2',
  send:     'M17 3L3 10l5 2 2 5 7-14z',
  doc:      'M5 3h7l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM12 3v4h4M7 11h6M7 14h4',
  sparkle:  'M10 3v4M10 13v4M3 10h4M13 10h4M6 6l2 2M12 12l2 2M14 6l-2 2M8 12l-2 2',
  cal2:     'M4 7h12v10H4zM4 7V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2M8 3v3M12 3v3',
  logout:   'M13 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2M8 10h9M14 7l3 3-3 3',
  settings: 'M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4',
  email:    'M3 5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 6l7 5 7-5',
  copy:     'M6 6V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-2M3 7a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
  edit:     'M14 3l3 3-9 9-4 1 1-4 9-9z',
  trash:    'M5 6h10M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 6v10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6',
  external: 'M13 3h4v4M17 3l-8 8M9 5H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-4',
  arrowR:   'M4 10h12M12 6l4 4-4 4',
  lock:     'M6 9V6a4 4 0 0 1 8 0v3M4 9h12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zM10 12v2',
  alert:    'M10 3l8 14H2L10 3zM10 8v4M10 14v.5',
  link:     'M9 11a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1M11 9a3 3 0 0 0-4 0l-3 3a3 3 0 0 0 4 4l1-1',
}

interface Props {
  name: keyof typeof ICONS | string
  size?: number
  stroke?: number
  className?: string
  style?: React.CSSProperties
}

export default function Icon({ name, size = 16, stroke = 1.5, className, style }: Props) {
  const d = ICONS[name as string]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d={d} />
    </svg>
  )
}
