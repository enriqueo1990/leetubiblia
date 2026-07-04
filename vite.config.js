import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Meta social propia de la landing pública /info (ver src/screens/Info.jsx). El
// sitio es un SPA con las meta OG estáticas en index.html; los scrapers (WhatsApp,
// Facebook…) NO ejecutan JS, así que un preview distinto para /info exige un HTML
// estático propio. Este plugin clona el index.html ya construido —conservando los
// assets hasheados, de modo que /info.html bootea la MISMA app— y sólo reemplaza
// el bloque SEO/social (desde <title> hasta el último meta de Twitter). En
// _redirects, /info se sirve desde /info.html antes del fallback SPA.
const INFO_META = {
  title: 'Lee Tu Biblia — el hábito de abrir tu Biblia, sostenido',
  description:
    'Plan, racha, diario y oraciones —solo o con tu grupo— para acompañar tu Biblia de papel. Una herramienta para discipular, no otro lector de Escritura.',
  url: 'https://leetubiblia.com/info',
  image: 'https://leetubiblia.com/og-info.png',
  alt: 'Lee Tu Biblia — compañero de lectura bíblica',
}

function infoHtmlPlugin() {
  return {
    name: 'ltb-info-html',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist')
      const indexPath = resolve(outDir, 'index.html')
      const html = readFileSync(indexPath, 'utf8')

      // Anclas del bloque a reemplazar. Si el index cambia y dejan de existir,
      // fallamos ruidosamente en vez de emitir un /info.html con meta erróneas.
      const start = html.indexOf('<title>')
      const endMarker =
        '<meta name="twitter:image" content="https://leetubiblia.com/og-image.png" />'
      const endAt = html.indexOf(endMarker)
      if (start === -1 || endAt === -1) {
        throw new Error(
          '[ltb-info-html] No encuentro el bloque SEO/social en dist/index.html — revisa las anclas.'
        )
      }
      const end = endAt + endMarker.length

      const { title, description, url, image, alt } = INFO_META
      const block = `<title>${title}</title>
    <meta name="description" content="${description}" />

    <!-- Open Graph (WhatsApp, Facebook, LinkedIn…) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Lee Tu Biblia" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${alt}" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />`

      const infoHtml = html.slice(0, start) + block + html.slice(end)
      writeFileSync(resolve(outDir, 'info.html'), infoHtml)
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
    infoHtmlPlugin(),
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
