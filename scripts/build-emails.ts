// Pre-renders every React Email template in /emails/ to a static HTML file
// inside api/_compiled-emails/. The serverless function then reads the HTML
// and substitutes its `{{placeholder}}` tokens with real data at runtime.
//
// Why precompile instead of importing the .tsx at runtime: Vercel's
// serverless bundler doesn't reliably resolve .tsx files in /api/
// subdirectories, and bundling @react-email/render + react into every
// function blows past the 1 MB hobby-tier limit. Compiling once at build
// time means the deployed function only ships:
//   - The static HTML strings (≈10 KB each, gzip).
//   - One tiny `.replace()` per template.
//
// Run via `npm run build` or directly with `tsx scripts/build-emails.ts`.

import { render } from '@react-email/render'
import * as React from 'react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import BookingConfirmation from '../emails/BookingConfirmation'
import CancellationNotification from '../emails/CancellationNotification'
import NewBookingNotification from '../emails/NewBookingNotification'
import Reminder24h from '../emails/Reminder24h'
import Welcome from '../emails/Welcome'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'api', '_compiled-emails')

interface Template {
  /** Filename without extension. */
  name: string
  component: React.ComponentType
}

const TEMPLATES: Template[] = [
  { name: 'booking-confirmation', component: BookingConfirmation },
  { name: 'new-booking-notification', component: NewBookingNotification },
  { name: 'cancellation-notification', component: CancellationNotification },
  { name: 'reminder-24h', component: Reminder24h },
  { name: 'welcome', component: Welcome },
]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const tpl of TEMPLATES) {
    const html = await render(React.createElement(tpl.component), { pretty: false })
    const outPath = join(OUT_DIR, `${tpl.name}.html`)
    writeFileSync(outPath, html, 'utf-8')
    const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1)
    console.log(`  ✓ ${tpl.name}.html (${sizeKB} KB)`)
  }

  console.log(`◇ Compiled ${TEMPLATES.length} email template(s) to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error('Email compilation failed:', err)
  process.exit(1)
})
