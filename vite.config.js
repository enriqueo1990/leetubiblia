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
// Arquitectura hub-y-radios: /info es la puerta; /lideres, /ayuda y /privacidad
// son hermanas planas conectadas por el footer global. Las rutas antiguas
// (/grupos-de-discipulado, /guia-lideres, /guia) ya NO se emiten: se redirigen
// con 301 en public/_redirects. /lideres reusa la OG del recorrido de líderes;
// /ayuda reusa la OG del manual; /privacidad cae en la OG por defecto.
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
    file: 'lideres/index.html',
    title: 'Lee Tu Biblia — Para líderes de grupos de discipulado',
    description:
      'Guiá a tu grupo en la Palabra sin chats desbordados, con capturas reales: lean al mismo ritmo, anímense a leer y oren juntos por sus pedidos y testimonios.',
    url: 'https://leetubiblia.com/lideres',
    image: 'https://leetubiblia.com/og-lideres.png',
    alt: 'Lee Tu Biblia — para líderes de grupos de discipulado',
  },
  {
    file: 'ayuda/index.html',
    title: 'Lee Tu Biblia — Guía completa de la app',
    description:
      'El manual completo, pestaña por pestaña: tu lectura y los 13 planes, la oración, los grupos de discipulado y los materiales. Acompaña tu Biblia de papel, no la reemplaza.',
    url: 'https://leetubiblia.com/ayuda',
    image: 'https://leetubiblia.com/og-guia.png',
    alt: 'Lee Tu Biblia — guía completa de la app',
  },
  {
    file: 'privacidad/index.html',
    title: 'Lee Tu Biblia — Privacidad',
    description:
      'Qué guardamos y qué no, en simple: privado por defecto, sin publicidad, no vendemos tus datos, y podés borrar tu cuenta y todo lo tuyo cuando quieras.',
    url: 'https://leetubiblia.com/privacidad',
    image: 'https://leetubiblia.com/og-image.png',
    alt: 'Lee Tu Biblia',
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('react')) return 'vendor-react'
          return 'vendor'
        },
      },
    },
  },
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
        // Activar la nueva versión en cuanto se descarga y eliminar precaches
        // de versiones anteriores. Los headers de public/_headers evitan que
        // el navegador/CDN sirva un sw.js viejo y bloquee este ciclo.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Precache mínimo: shell, estilos e iconos. Las pantallas, materiales y
        // capturas se guardan al usarse, en vez de descargar ~2 MB al instalar.
        globPatterns: [
          '**/*.{html,css,svg,woff2}',
          'registerSW.js',
          'manifest.webmanifest',
          'icons/*.png',
          'assets/index-*.js',
          'assets/vendor-react-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.js$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ltb-app-code',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/assets\/.*\.(?:png|jpg|jpeg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ltb-images',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        // Inyecta los handlers de Web Push en el SW generado (ver public/sw-push.js).
        importScripts: ['sw-push.js'],
      },
    }),
  ],
})
