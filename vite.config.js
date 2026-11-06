import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, build as viteBuild } from 'vite'
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
    route: '/info',
    screen: 'Info',
    title: 'Lee Tu Biblia — el hábito de abrir tu Biblia, sostenido',
    description:
      'Plan, racha, diario y oraciones —solo o con tu grupo— para acompañar tu Biblia de papel. Una herramienta para discipular, no otro lector de Escritura.',
    url: 'https://leetubiblia.com/info',
    image: 'https://leetubiblia.com/og-info.png',
    alt: 'Lee Tu Biblia — compañero de lectura bíblica',
  },
  {
    file: 'lideres/index.html',
    route: '/lideres',
    screen: 'Lideres',
    title: 'Lee Tu Biblia — Para líderes de grupos de discipulado',
    description:
      'Cómo usar la app con tu grupo pequeño: armalo en 3 pasos, lean el mismo plan, vean quién leyó y oren unos por otros. Gratis y sin publicidad.',
    url: 'https://leetubiblia.com/lideres',
    image: 'https://leetubiblia.com/og-lideres.png',
    alt: 'Lee Tu Biblia — para líderes de grupos de discipulado',
  },
  {
    file: 'ayuda/index.html',
    route: '/ayuda',
    screen: 'Ayuda',
    title: 'Lee Tu Biblia — Guía completa de la app',
    description:
      'El manual completo, pestaña por pestaña: tu lectura y los 13 planes, la oración, los grupos de discipulado y los materiales. Acompaña tu Biblia de papel, no la reemplaza.',
    url: 'https://leetubiblia.com/ayuda',
    image: 'https://leetubiblia.com/og-guia.png',
    alt: 'Lee Tu Biblia — guía completa de la app',
  },
  {
    file: 'privacidad/index.html',
    route: '/privacidad',
    screen: 'Privacidad',
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

// PRERENDER REAL de las landings. Además de cambiar el bloque SEO, cada página se
// emite con su contenido DENTRO de <div id="root"> (HTML estático del componente
// React) y SIN el splash de arranque (que es de la app privada y trae el
// versículo): los rastreadores que no ejecutan JS —incluidos los bots de IA que
// robots.txt invita— ven el h1, los textos y los enlaces internos, y el visitante
// en frío ve la página en el primer pintado en vez del splash. Al cargar, main.jsx
// la HIDRATA (data-prerendered) sin reemplazarla.
//
// Cómo (react-dom/server, sin navegador): se compila src/prerender.jsx con
// `build.ssr` de Vite a un directorio temporal, se importa y se llama una vez por
// ruta. Se eligió sobre puppeteer-core porque no necesita Chrome en la máquina de
// build (Cloudflare Pages no lo trae), no tiene servidor ni puertos ni esperas, y
// da el mismo HTML siempre. Las landings no tocan Supabase ni localStorage al
// renderizar (lo que depende del navegador se resuelve post-hidratación; ver
// src/screens/landingHydration.js), así que no hace falta ejecutar el cliente.
//
// Orden: el closeBundle va `pre` y `sequential` para que los HTML finales existan
// ANTES de que vite-plugin-pwa calcule el precache (su revision hash sale de ellos).
const SPLASH_DIV_START = '<div id="ltb-splash">'
const ROOT_DIV = '<div id="root"></div>'
const SPLASH_CSS_START = '      #ltb-splash {'

function landingHtmlPlugin() {
  let resolved
  let clientBundle = null
  return {
    name: 'ltb-landing-html',
    apply: 'build',
    configResolved(config) {
      resolved = config
    },
    generateBundle(_options, bundle) {
      clientBundle = bundle
    },
    closeBundle: {
      sequential: true,
      order: 'pre',
      async handler() {
        const root = resolved.root
        const outDir = resolve(root, resolved.build.outDir)
        const html = readFileSync(resolve(outDir, 'index.html'), 'utf8')

        // Plantilla sin splash: se le quita el div y las reglas CSS del splash (se
        // conservan las del fondo de html/body, que evitan el fogonazo blanco).
        const splashAt = html.indexOf(SPLASH_DIV_START)
        const rootAt = html.indexOf(ROOT_DIV)
        const cssAt = html.indexOf(SPLASH_CSS_START)
        const cssEnd = html.indexOf('</style>', cssAt)
        if (splashAt === -1 || rootAt === -1 || rootAt < splashAt || cssAt === -1 || cssEnd === -1) {
          throw new Error(
            '[ltb-landing-html] No encuentro el splash (#ltb-splash) / #root / sus estilos en dist/index.html: ¿cambió index.html?'
          )
        }
        const template = html.slice(0, cssAt) + html.slice(cssEnd, splashAt) + html.slice(rootAt)

        // Reemplazamos SOLO el bloque entre los marcadores SEO:start/SEO:end (el
        // JSON-LD y el resto del <head> se conservan). Si faltan, fallamos ruidoso.
        const open = '<!-- SEO:start'
        const close = '<!-- SEO:end -->'
        const openAt = template.indexOf(open)
        const startBody = template.indexOf('-->', openAt)
        const closeAt = template.indexOf(close)
        if (openAt === -1 || startBody === -1 || closeAt === -1) {
          throw new Error(
            '[ltb-landing-html] No encuentro los marcadores SEO:start/SEO:end en dist/index.html.'
          )
        }
        const head = template.slice(0, startBody + 3)
        const tail = template.slice(closeAt + close.length)

        const render = await loadPrerender(root)

        // Chunks que el entry ya precarga: no se repiten.
        const alreadyLoaded = new Set(
          [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1].slice(1))
        )

        for (const page of LANDING_PAGES) {
          const markup = await render(page.route)
          if (!/<h1[\s>]/.test(markup) || markup.includes('ltb-splash')) {
            throw new Error(`[ltb-landing-html] El prerender de ${page.route} no trae un <h1> o trae el splash.`)
          }
          assertAssetsExist(markup, outDir, page.route)

          const seo = `\n    ${seoBlock(page)}\n    ${preloadLinks(page.screen, clientBundle, alreadyLoaded)}\n    ${close}`
          const pageHtml = (head + seo + tail).replace(
            ROOT_DIV,
            () => `<div id="root" data-prerendered>${markup}</div>`
          )
          const outFile = resolve(outDir, page.file)
          mkdirSync(dirname(outFile), { recursive: true })
          writeFileSync(outFile, pageHtml)
        }
      },
    },
  }
}

// <link rel="modulepreload"> del chunk de la página y de sus imports estáticos
// (landingKit…): el navegador los baja en paralelo con el entry en vez de
// descubrirlos en cascada (HTML → entry → chunk → kit).
function preloadLinks(screen, bundle, skip) {
  if (!bundle) return ''
  const page = Object.values(bundle).find(
    (chunk) => chunk.type === 'chunk' && chunk.facadeModuleId?.endsWith(`/src/screens/${screen}.jsx`)
  )
  if (!page) return ''
  const files = new Set()
  const visit = (fileName) => {
    if (files.has(fileName) || skip.has(fileName)) return
    const chunk = bundle[fileName]
    if (!chunk || chunk.type !== 'chunk') return
    files.add(fileName)
    chunk.imports.forEach(visit)
  }
  visit(page.fileName)
  return [...files].map((f) => `<link rel="modulepreload" crossorigin href="/${f}" />`).join('\n    ')
}

// Los assets que el SSR referencia (capturas PNG) deben ser los MISMOS archivos con
// hash que emitió el build del cliente; si no, la landing mostraría imágenes rotas.
function assertAssetsExist(markup, outDir, route) {
  for (const [, url] of markup.matchAll(/(?:src|href|srcSet)="(\/assets\/[^"?#]+)"/g)) {
    if (!existsSync(resolve(outDir, url.slice(1)))) {
      throw new Error(`[ltb-landing-html] ${route} referencia ${url}, que no existe en dist/.`)
    }
  }
}

// Compila src/prerender.jsx (SSR) y devuelve renderRoute(url) → HTML.
async function loadPrerender(root) {
  const ssrDir = resolve(root, 'node_modules/.ltb-prerender')
  rmSync(ssrDir, { recursive: true, force: true })
  await viteBuild({
    root,
    configFile: false,
    logLevel: 'warn',
    plugins: [react()],
    define: { 'import.meta.env.VITE_APP_BUILD': JSON.stringify(buildId()) },
    // react-router-dom@6 no declara "exports": Node no resuelve su /server como ESM,
    // así que se empaqueta junto al resto (react y react-dom quedan externos).
    ssr: { noExternal: ['react-router-dom', 'react-router', '@remix-run/router'] },
    build: {
      ssr: resolve(root, 'src/prerender.jsx'),
      outDir: ssrDir,
      emptyOutDir: true,
      copyPublicDir: false,
      minify: false,
      rollupOptions: {
        output: { format: 'es', entryFileNames: 'prerender.mjs', chunkFileNames: '[name]-[hash].mjs' },
      },
    },
  })
  const mod = await import(pathToFileURL(resolve(ssrDir, 'prerender.mjs')).href)
  return mod.renderRoute
}

// Código del build: el commit corto. Cloudflare Pages lo pasa en
// CF_PAGES_COMMIT_SHA; en local sale de git. Se muestra junto a la versión
// ("Versión 2.0.0 · 34b4e4b") para saber qué tiene cada aparato.
function buildId() {
  const sha = process.env.CF_PAGES_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// Manifest de la PWA. theme_color usa el fondo claro por defecto; el color real
// se sincroniza en runtime con el modo activo (ver src/hooks/useTheme.js).
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_BUILD': JSON.stringify(buildId()),
  },
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
        background_color: '#FAF8F4',
        theme_color: '#FAF8F4',
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
        // Precache: shell, estilos, iconos y el CAMINO CRÍTICO hasta Hoy (la pantalla
        // privada de arranque). Sin esto, tras una actualización el primer arranque
        // sin red pedía chunks con hash nuevo que no estaban en ninguna caché, el
        // `lazy()` fallaba y la app quedaba en una pantalla de error en bucle.
        // El resto (otras pantallas, materiales, capturas) se guarda al usarse, en
        // vez de descargar ~2 MB al instalar.
        //
        // La lista de chunks sale del cierre de imports estáticos de PrivateRoot +
        // Hoy (el build los nombra por prefijo, el hash cambia). Si agregás un import
        // estático nuevo a Hoy y aparece un chunk nuevo, sumalo acá.
        globPatterns: [
          '**/*.{html,css,svg}',
          'registerSW.js',
          'manifest.webmanifest',
          'icons/*.png',
          'assets/index-*.js',
          'assets/vendor-*.js',
          'assets/{PrivateRoot,Hoy,BookCover,ConfirmDialog,DonateSheet,EmptyState,InlineError,PassageList,ReflectionSheet,Segmented,ShareImageSheet,Sheet,Skeleton,TodayExtraRows,bible,books,dates,icons,materialTheme,materials,planCycle,planLabels,useInstallPrompt,useMyTime,useReading}-*.js',
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
          // Newsreader (portadas e imágenes para compartir): no entra en la
          // instalación (~460 KB); se baja la primera vez que se usa y queda
          // guardada, así compartir funciona sin red desde entonces.
          {
            urlPattern: /\/assets\/newsreader-.*\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ltb-fonts',
              expiration: { maxEntries: 8, maxAgeSeconds: 365 * 24 * 60 * 60 },
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
