import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Meta social propia de cada landing pública (ver src/screens/Info.jsx y
// GruposDiscipulado.jsx). El sitio es un SPA con las meta OG estáticas en index.html;
// los scrapers (WhatsApp, Facebook…) NO ejecutan JS, así que un preview distinto
// por ruta exige un HTML estático propio. El plugin clona el index.html ya
// construido —conservando los assets hasheados (absolutos), de modo que cada
// página bootea la MISMA app— y sólo reemplaza el bloque SEO/social entre los
// marcadores SEO:start/SEO:end.
//
// IMPORTANTE: cada landing se emite como ÍNDICE DE CARPETA (info/index.html), no
// como info.html. Netlify sirve /info desde info/index.html directamente, sin
// redirección. Un archivo plano /info.html entraría en bucle con las "Pretty
// URLs" de Netlify (que redirigen /info.html → /info mientras un rewrite manda
// /info → /info.html). Por eso NO hay regla de reescritura en _redirects: basta
// el índice de carpeta + el fallback SPA. Para sumar una landing: entrada acá +
// su og-*.png (scripts/og-*.mjs). No toca _redirects.
const LANDING_PAGES = [
  {
    file: 'info/index.html',
    title: 'Lee Tu Biblia — el hábito de abrir tu Biblia, sostenido',
    description:
      'Plan, racha, diario y oraciones —solo o con tu grupo— para acompañar tu Biblia de papel. Una herramienta para discipular, no otro lector de Escritura.',
    url: 'https://leetubiblia.com/info',
    image: 'https://leetubiblia.com/og-info.png',
    alt: 'Lee Tu Biblia — compañero de lectura bíblica',
  },
  {
    file: 'grupos-de-discipulado/index.html',
    title: 'Lee Tu Biblia — Para líderes de grupos de discipulado',
    description:
      'Guiá a tu grupo en la Palabra sin chats desbordados: lean al mismo ritmo, anímense a leer y oren juntos por sus pedidos y testimonios.',
    url: 'https://leetubiblia.com/grupos-de-discipulado',
    image: 'https://leetubiblia.com/og-grupos.png',
    alt: 'Lee Tu Biblia — para líderes de grupos de discipulado',
  },
  {
    file: 'guia/index.html',
    title: 'Lee Tu Biblia — Guía completa de la app',
    description:
      'El manual completo, pestaña por pestaña: tu lectura y los 8 planes, la oración, los grupos de discipulado y los materiales. Acompaña tu Biblia de papel, no la reemplaza.',
    url: 'https://leetubiblia.com/guia',
    image: 'https://leetubiblia.com/og-guia.png',
    alt: 'Lee Tu Biblia — guía completa de la app',
  },
  {
    file: 'guia-lideres/index.html',
    title: 'Lee Tu Biblia — Guía para líderes de grupo',
    description:
      'Qué podés hacer con tu grupo de discipulado y cómo te ayuda a acompañar a tu gente, con capturas reales: un plan común, la lectura en el Hoy de cada uno, el pulso del grupo y la oración compartida.',
    url: 'https://leetubiblia.com/guia-lideres',
    image: 'https://leetubiblia.com/og-lideres.png',
    alt: 'Lee Tu Biblia — guía para líderes de grupo',
  },
]

// Genera el bloque SEO/social por página (mismo orden de tags que index.html).
function seoBlock({ title, description, url, image, alt }) {
  return `<title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />

    <!-- Open Graph (WhatsApp, Facebook, LinkedIn…) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Lee Tu Biblia" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${alt}" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="${alt}" />`
}

function landingHtmlPlugin() {
  return {
    name: 'ltb-landing-html',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist')
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8')

      // Reemplazamos SOLO el bloque entre los marcadores SEO:start/SEO:end (el
      // JSON-LD y el resto del <head> se conservan). Si faltan, fallamos ruidoso.
      const open = '<!-- SEO:start'
      const close = '<!-- SEO:end -->'
      const openAt = html.indexOf(open)
      const startBody = html.indexOf('-->', openAt)
      const closeAt = html.indexOf(close)
      if (openAt === -1 || startBody === -1 || closeAt === -1) {
        throw new Error(
          '[ltb-landing-html] No encuentro los marcadores SEO:start/SEO:end en dist/index.html.'
        )
      }
      const start = startBody + 3
      const end = closeAt + close.length

      for (const page of LANDING_PAGES) {
        const block = `\n    ${seoBlock(page)}\n    <!-- SEO:end -->`
        const outFile = resolve(outDir, page.file)
        mkdirSync(dirname(outFile), { recursive: true })
        writeFileSync(outFile, html.slice(0, start) + block + html.slice(end))
      }
    },
  }
}

// Manifest de la PWA. theme_color usa el fondo claro por defecto; el color real
// se sincroniza en runtime con el modo activo (ver src/hooks/useTheme.js).
export default defineConfig({
  // El dev server honra el PORT asignado por el entorno (p. ej. el harness de
  // preview, que puede reasignar el puerto si 5173 está ocupado). En prod no
  // aplica: el build no usa esta sección.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  plugins: [
    react(),
    landingHtmlPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Lee Tu Biblia',
        short_name: 'Lee Tu Biblia',
        description: 'Lectura bíblica y oración, simple y privada.',
        lang: 'es',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#FBFBFA',
        theme_color: '#FBFBFA',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Inyecta los handlers de Web Push en el SW generado (ver public/sw-push.js).
        importScripts: ['sw-push.js'],
      },
    }),
  ],
})
