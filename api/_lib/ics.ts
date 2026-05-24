// Single-event iCalendar (.ics) generator — RFC 5545.
//
// We already serve a per-doctor `ics-feed` from a Supabase Edge Function for
// the "subscribe to my agenda" use case. This file is the simpler sibling: it
// produces a one-event .ics blob suitable for attaching to the booking
// confirmation email, so the patient can add the appointment to their
// calendar with one tap.
//
// Argentina is UTC-3 year-round (no DST), so we shift local wallclock times
// to UTC by adding 3 hours. Same convention used in supabase/functions/ics-feed.

export interface IcsEvent {
  /** Stable UID for this event. Use the appointment ID. */
  uid: string
  /** Local date in "YYYY-MM-DD" (Argentina time). */
  date: string
  /** Local time in "HH:MM" or "HH:MM:SS" (Argentina time). */
  time: string
  /** Duration in minutes. */
  durationMin: number
  /** Short title shown in the calendar. */
  summary: string
  /** Long-form notes shown when the event is opened. */
  description?: string
  /** Physical address shown in the calendar. */
  location?: string
  /** Organizer name + email (the doctor). */
  organizerName?: string
  organizerEmail?: string
  /** If true, schedules two VALARM blocks at 24h and 2h before. */
  withReminders?: boolean
}

/** Convert local Argentina wallclock to UTC iCal stamp (YYYYMMDDTHHMMSSZ). */
function toUtcStamp(date: string, time: string, offsetMin = 0): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.slice(0, 5).split(':').map(Number)
  // Argentina = UTC-3 → shift +3 hours to get UTC.
  const utc = new Date(Date.UTC(y, m - 1, d, hh + 3, mm + offsetMin, 0))
  return formatStamp(utc)
}

/** Now in UTC, as iCal stamp. */
function nowStamp(): string {
  return formatStamp(new Date())
}

function formatStamp(d: Date): string {
  const YYYY = d.getUTCFullYear()
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0')
  const DD = String(d.getUTCDate()).padStart(2, '0')
  const H = String(d.getUTCHours()).padStart(2, '0')
  const M = String(d.getUTCMinutes()).padStart(2, '0')
  const S = String(d.getUTCSeconds()).padStart(2, '0')
  return `${YYYY}${MM}${DD}T${H}${M}${S}Z`
}

/** Escape commas, semicolons, backslashes and newlines per RFC 5545 §3.3.11. */
function icsEscape(s: string): string {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/** Fold lines longer than 75 octets — required by strict parsers (Outlook). */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = []
  let rest = line
  out.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    out.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length > 0) out.push(' ' + rest)
  return out.join('\r\n')
}

/** Build the .ics body. Returns a string suitable for emailing as attachment. */
export function buildIcs(evt: IcsEvent): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tecito//Booking Confirmation//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${evt.uid}@tecito.com.ar`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART:${toUtcStamp(evt.date, evt.time, 0)}`,
    `DTEND:${toUtcStamp(evt.date, evt.time, evt.durationMin)}`,
    foldLine(`SUMMARY:${icsEscape(evt.summary)}`),
  ]

  if (evt.description) {
    lines.push(foldLine(`DESCRIPTION:${icsEscape(evt.description)}`))
  }
  if (evt.location) {
    lines.push(foldLine(`LOCATION:${icsEscape(evt.location)}`))
  }
  if (evt.organizerEmail) {
    const cn = evt.organizerName ? `;CN=${icsEscape(evt.organizerName)}` : ''
    lines.push(foldLine(`ORGANIZER${cn}:mailto:${evt.organizerEmail}`))
  }
  lines.push('STATUS:CONFIRMED')
  lines.push('TRANSP:OPAQUE')

  if (evt.withReminders) {
    // 24h before
    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Recordatorio: turno mañana',
      'END:VALARM',
      // 2h before
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Recordatorio: turno en 2 horas',
      'END:VALARM',
    )
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  // Per RFC 5545, lines are CRLF-separated.
  return lines.join('\r\n')
}

/** Convenience: returns the .ics as a base64 string for Resend attachments. */
export function buildIcsBase64(evt: IcsEvent): string {
  return Buffer.from(buildIcs(evt), 'utf-8').toString('base64')
}
