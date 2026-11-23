// Post-build SEO generator.
//
// After `vite build` writes dist/, this script:
//   1. Generates apple-touch-icon.png, og-default.png, favicon.ico from SVGs (sharp).
//   2. Generates manifest.webmanifest.
//   3. Writes robots.txt (prod-gated via VITE_SITE_URL).
//   4. Queries Supabase for every profile with a booking_code.
//   5. Writes a static HTML per /p/{code} with route-specific <title>, meta
//      description, canonical, Open Graph, Twitter Card, and JSON-LD Physician.
//   6. Writes sitemap.xml containing the homepage + every booking URL.
//   7. Writes 404.html (noindex) for unknown routes.
//
// The SPA keeps hydrating on top of each of these HTML shells, so the client
// experience is unchanged — but crawlers and social previewers see full HTML.

import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PUBLIC = path.join(ROOT, 'public')

// Load .env.local for local builds (Vercel already injects env vars at build time).
;(function loadLocalEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fsSync.existsSync(envPath)) return
  try {
    const content = fsSync.readFileSync(envPath, 'utf8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const k = line.slice(0, eq).trim()
      let v = line.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!(k in process.env)) process.env[k] = v
    }
  } catch {
    // ignore
  }
})()

// Canonical site URL. Override with VITE_SITE_URL in the environment when the
// custom domain is live. Falls back to the current Vercel alias.
const SITE_URL = (process.env.VITE_SITE_URL || 'https://panel-medico-pied.vercel.app').replace(/\/$/, '')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY

const SITE_NAME = 'Tecito'
const SITE_TAGLINE = 'Turnos online y agenda para profesionales de la salud'
const SITE_DESC =
  'Tecito es la agenda online para médicos y psicólogos. Tus pacientes reservan turnos desde un link único, les llega la confirmación por mail con recordatorios automáticos y vos gestionás tu consultorio en un panel simple.'

// ───────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────

async function readOrNull(p) {
  try {
    return await fs.readFile(p, 'utf8')
  } catch {
    return null
  }
}

function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function clamp(str, max) {
  if (!str) return ''
  if (str.length <= max) return str
  return str.slice(0, max - 1).trimEnd() + '…'
}

// Replace the first occurrence of a tag by name inside <head>.
function replaceHeadTag(html, tagRegex, replacement) {
  return html.replace(tagRegex, replacement)
}

// Inject extra markup right before </head>.
function injectBeforeHead(html, markup) {
  return html.replace('</head>', `${markup}\n  </head>`)
}

// ───────────────────────────────────────────────────────────────
// 1. Raster assets from SVG (PNGs + ICO)
// ───────────────────────────────────────────────────────────────

async function generateRasterAssets() {
  const ogSvg = await fs.readFile(path.join(PUBLIC, 'og-default.svg'))
  const favSvg = await fs.readFile(path.join(PUBLIC, 'favicon.svg'))

  // OG image — 1200×630 PNG
  await sharp(ogSvg, { density: 192 })
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile(path.join(DIST, 'og-default.png'))

  // Apple touch icon — 180×180 PNG
  await sharp(favSvg, { density: 512 })
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(path.join(DIST, 'apple-touch-icon.png'))

  // PWA icons 192 / 512
  await sharp(favSvg, { density: 512 })
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(path.join(DIST, 'icon-192.png'))

  await sharp(favSvg, { density: 512 })
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(path.join(DIST, 'icon-512.png'))

  // Copy SVG og so `/og-default.svg` keeps working too
  await fs.copyFile(path.join(PUBLIC, 'og-default.svg'), path.join(DIST, 'og-default.svg'))

  console.log('  ✓ OG image, apple-touch-icon, PWA icons')
}

// ───────────────────────────────────────────────────────────────
// 2. manifest.webmanifest
// ───────────────────────────────────────────────────────────────

async function generateManifest() {
  const manifest = {
    name: 'Tecito',
    short_name: 'Tecito',
    description: SITE_DESC,
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F2EC',
    theme_color: '#3B4A38',
    lang: 'es-AR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
  await fs.writeFile(
    path.join(DIST, 'manifest.webmanifest'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  )
  console.log('  ✓ manifest.webmanifest')
}

// ───────────────────────────────────────────────────────────────
// 3. robots.txt
// ───────────────────────────────────────────────────────────────

async function generateRobots() {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Private app routes — not real URLs in the sitemap, but blocking just in case',
    'Disallow: /agenda',
    'Disallow: /pacientes',
    'Disallow: /perfil',
    'Disallow: /estadisticas',
    'Disallow: /planes',
    'Disallow: /organizacion',
    'Disallow: /ics/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n')
  await fs.writeFile(path.join(DIST, 'robots.txt'), body, 'utf8')
  console.log('  ✓ robots.txt')
}

// ───────────────────────────────────────────────────────────────
// 4. Supabase fetch
// ───────────────────────────────────────────────────────────────

async function fetchPublicDoctors() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.warn('  ⚠ Supabase env vars missing — skipping per-doctor HTML generation')
    return []
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await client
    .from('profiles')
    .select(
      'id, first_name, last_name, specialty, license, bio, address, city, price_particular, session_duration, booking_code, avatar_url',
    )
    .not('booking_code', 'is', null)
  if (error) {
    console.warn(`  ⚠ Supabase fetch error: ${error.message}`)
    return []
  }
  return data || []
}

// ───────────────────────────────────────────────────────────────
// 5. Per-route HTML rendering
// ───────────────────────────────────────────────────────────────

function renderDoctorHead({ doctor, url }) {
  const fullName = `${doctor.first_name} ${doctor.last_name}`.trim()
  const specialty = doctor.specialty ? doctor.specialty.trim() : 'Profesional de la salud'

  const title = clamp(`Reservá turno con ${fullName} · ${specialty} — Tecito`, 60)
  const bioSeed = doctor.bio
    ? ` ${doctor.bio.replace(/\s+/g, ' ').trim()}`
    : ''
  const descSeed = `Turnos online con ${fullName}, ${specialty.toLowerCase()}${doctor.city ? ` en ${doctor.city}` : ''}. Reservá desde tu celular en segundos.${bioSeed}`
  const description = clamp(descSeed, 160)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    '@id': `${url}#physician`,
    name: fullName,
    medicalSpecialty: specialty,
    description: doctor.bio || description,
    url,
    image: doctor.avatar_url || `${SITE_URL}/og-default.png`,
    identifier: doctor.license ? `MN ${doctor.license}` : undefined,
    address: doctor.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: doctor.address,
          addressLocality: doctor.city || undefined,
          addressCountry: 'AR',
        }
      : undefined,
    potentialAction: {
      '@type': 'ReserveAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: url,
        actionPlatform: ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform'],
      },
      result: { '@type': 'Reservation', name: 'Turno médico' },
    },
  }
  // Strip undefined keys so the JSON stays clean
  const cleaned = JSON.parse(JSON.stringify(jsonLd))

  const ogImage = `${SITE_URL}/og-default.png`
  const head = `
    <title>${escapeHTML(title)}</title>
    <meta name="description" content="${escapeHTML(description)}" />
    <link rel="canonical" href="${escapeHTML(url)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />

    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHTML(title)}" />
    <meta property="og:description" content="${escapeHTML(description)}" />
    <meta property="og:url" content="${escapeHTML(url)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Reservá turno con ${escapeHTML(fullName)} en Tecito" />
    <meta property="og:locale" content="es_AR" />
    <meta property="profile:first_name" content="${escapeHTML(doctor.first_name || '')}" />
    <meta property="profile:last_name" content="${escapeHTML(doctor.last_name || '')}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHTML(title)}" />
    <meta name="twitter:description" content="${escapeHTML(description)}" />
    <meta name="twitter:image" content="${ogImage}" />

    <script type="application/ld+json">${JSON.stringify(cleaned)}</script>`
  return head
}

function applyHeadReplacements(templateHtml, { title, description, canonical, extraHead, robots }) {
  let html = templateHtml

  // <title>
  if (title) {
    html = replaceHeadTag(html, /<title>[^<]*<\/title>/, `<title>${escapeHTML(title)}</title>`)
  }
  // description
  if (description) {
    html = replaceHeadTag(
      html,
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${escapeHTML(description)}" />`,
    )
  }
  // canonical
  if (canonical) {
    if (/<link rel="canonical"/.test(html)) {
      html = replaceHeadTag(
        html,
        /<link rel="canonical"[^>]*>/,
        `<link rel="canonical" href="${escapeHTML(canonical)}" />`,
      )
    } else {
      html = injectBeforeHead(html, `    <link rel="canonical" href="${escapeHTML(canonical)}" />`)
    }
  }
  if (robots) {
    html = injectBeforeHead(html, `    <meta name="robots" content="${escapeHTML(robots)}" />`)
  }
  if (extraHead) {
    html = injectBeforeHead(html, extraHead)
  }
  return html
}

// For per-doctor pages we REPLACE the homepage OG/Twitter/JSON-LD block entirely
// with the physician head. Strategy: strip all existing og:/twitter:/json-ld tags
// from the template, then inject the new ones before </head>.
function stripSocialAndStructuredData(html) {
  let h = html
  // Remove all og:* meta
  h = h.replace(/\s*<meta property="og:[^"]+"[^>]*>/g, '')
  // Remove twitter:* meta
  h = h.replace(/\s*<meta name="twitter:[^"]+"[^>]*>/g, '')
  // Remove canonical (we'll re-add)
  h = h.replace(/\s*<link rel="canonical"[^>]*>/g, '')
  // Remove existing JSON-LD
  h = h.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
  return h
}

async function writeDoctorPage(templateHtml, doctor) {
  const url = `${SITE_URL}/p/${doctor.booking_code}`
  const outDir = path.join(DIST, 'p', doctor.booking_code)
  await fs.mkdir(outDir, { recursive: true })

  const stripped = stripSocialAndStructuredData(templateHtml)
  const extraHead = renderDoctorHead({ doctor, url })

  // Replace <title> to avoid leaving the homepage one in place.
  const fullName = `${doctor.first_name} ${doctor.last_name}`.trim()
  const specialty = doctor.specialty ? doctor.specialty.trim() : 'Profesional de la salud'
  const title = clamp(`Reservá turno con ${fullName} · ${specialty} — Tecito`, 60)

  const html = applyHeadReplacements(stripped, {
    title,
    description: undefined, // description is included in extraHead already
    canonical: undefined,   // canonical is in extraHead too
    extraHead,
  }).replace(/\s*<meta name="description"[^>]*>/, '') // remove template description so extraHead wins

  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8')
}

// ───────────────────────────────────────────────────────────────
// 6. sitemap.xml
// ───────────────────────────────────────────────────────────────

function iso(d) {
  try {
    const dt = d ? new Date(d) : new Date()
    return dt.toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

async function generateSitemap(doctors) {
  const today = iso()
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: today, changefreq: 'weekly', priority: '1.0' },
    ...doctors.map((d) => ({
      loc: `${SITE_URL}/p/${d.booking_code}`,
      lastmod: today,
      changefreq: 'daily',
      priority: '0.8',
    })),
  ]
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
      )
      .join('\n') +
    `\n</urlset>\n`
  await fs.writeFile(path.join(DIST, 'sitemap.xml'), body, 'utf8')
  console.log(`  ✓ sitemap.xml (${urls.length} URLs)`)
}

// ───────────────────────────────────────────────────────────────
// 7. 404.html
// ───────────────────────────────────────────────────────────────

async function writeNotFound(templateHtml) {
  const stripped = stripSocialAndStructuredData(templateHtml)
  const html = applyHeadReplacements(stripped, {
    title: 'Página no encontrada — Tecito',
    description: 'La página que buscás no existe o fue movida. Volvé al inicio.',
    canonical: `${SITE_URL}/404`,
    robots: 'noindex,follow',
  })
  await fs.writeFile(path.join(DIST, '404.html'), html, 'utf8')
  console.log('  ✓ 404.html (noindex)')
}

// ───────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────

async function main() {
  console.log('◇ Generating SEO artifacts')
  const template = await readOrNull(path.join(DIST, 'index.html'))
  if (!template) {
    throw new Error('dist/index.html not found — run `vite build` first')
  }

  await generateRasterAssets()
  await generateManifest()
  await generateRobots()

  const doctors = await fetchPublicDoctors()
  console.log(`  ✓ Fetched ${doctors.length} doctor profile(s)`)

  for (const d of doctors) {
    await writeDoctorPage(template, d)
  }
  if (doctors.length > 0) {
    console.log(`  ✓ Wrote ${doctors.length} /p/{code}/index.html`)
  }

  await generateSitemap(doctors)
  await writeNotFound(template)
  console.log('◇ SEO generation complete')
}

main().catch((err) => {
  console.error('SEO generation failed:', err)
  process.exit(1)
})
