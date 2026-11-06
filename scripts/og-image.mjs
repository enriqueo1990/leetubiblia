// Genera public/og-image.png: la imagen Open Graph genérica de toda la app y de
// los enlaces /join (ver index.html). Misma plantilla que og-info.mjs, con la
// URL de la raíz. Estética 1:1 con la landing: papel, marca
// del libro en Cielo, la MISMA sans del sistema, un solo acento (design-canon).
//
// Regenerar tras tocar el diseño:  node scripts/og-image.mjs
//
// Rasteriza con sharp (ya en deps). Los hex vienen de src/styles/tokens.css.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const W = 1200,
  H = 630
const paper = '#FAF8F4' // --bg-app (claro, Cielo)
const ink = '#1F1B16' // --text-primary
const soft = '#5C564D' // --text-soft
const accent = '#436A8F' // --accent-ink de Cielo (texto de acento)
const tile = '#2B6CB0' // --accent-action de Cielo (cuadrado de la marca, como favicon.svg)
const deco = '#5B9FDF' // --accent de Cielo (trazo decorativo, opacidad baja)

const font = `-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif`

// Marca del libro (misma del onboarding/splash), trazo blanco dentro del badge.
const book = (x, y, s) => {
  const k = s / 64
  return `<g transform="translate(${x},${y}) scale(${k})">
    <g fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z"/>
      <path d="M32 20v28"/>
    </g>
  </g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${paper}"/>

  <!-- Marca de agua del libro, sangrando por la derecha, apenas perceptible -->
  <g transform="translate(780,255)">
    <g fill="none" stroke="${deco}" stroke-opacity="0.09" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" transform="scale(6)">
      <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z"/>
      <path d="M32 20v28"/>
    </g>
  </g>

  <!-- Lockup de marca, arriba a la izquierda -->
  <g transform="translate(80,74)">
    <rect x="0" y="0" width="60" height="60" rx="15" fill="${tile}"/>
    ${book(6, 6, 48)}
    <text x="78" y="40" font-family="${font}" font-size="27" font-weight="700" letter-spacing="-0.5" fill="${ink}">Lee Tu Biblia</text>
  </g>

  <!-- Eyebrow -->
  <text x="82" y="266" font-family="${font}" font-size="20" font-weight="600" letter-spacing="3.2" fill="${accent}">COMPAÑERO DE LECTURA BÍBLICA</text>

  <!-- Titular (mismo de la landing; "tu Biblia" en acento) -->
  <text x="80" y="342" font-family="${font}" font-size="62" font-weight="700" letter-spacing="-2" fill="${ink}">El hábito de abrir <tspan fill="${accent}">tu Biblia</tspan>,</text>
  <text x="80" y="418" font-family="${font}" font-size="62" font-weight="700" letter-spacing="-2" fill="${ink}">sostenido día a día.</text>

  <!-- Subtítulo -->
  <text x="82" y="482" font-family="${font}" font-size="25" font-weight="400" fill="${soft}">Plan, racha, diario y oraciones —solo o con tu grupo—</text>
  <text x="82" y="516" font-family="${font}" font-size="25" font-weight="400" fill="${soft}">para acompañar tu Biblia de papel.</text>

  <!-- URL -->
  <text x="82" y="576" font-family="${font}" font-size="21" font-weight="600" letter-spacing="0.3" fill="${accent}">leetubiblia.com</text>
</svg>`

const out = fileURLToPath(new URL('../public/og-image.png', import.meta.url))
await sharp(Buffer.from(svg)).png().toFile(out)
console.log('og-image.png escrito en', out)
