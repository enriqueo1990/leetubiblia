// Genera public/og-info.png: la imagen Open Graph propia de la landing /info.
// Es distinta del og-image.png genérico del sitio (ver index.html) — /info es la
// página pública en frío (redes, un pastor pasando el link) y su preview vende el
// concepto + el ángulo de discipulado. Estética 1:1 con la landing: papel, marca
// del libro en sepia, la MISMA sans del sistema, un solo acento (design-canon).
//
// Regenerar tras tocar el diseño:  node scripts/og-info.mjs
//
// Rasteriza con sharp (ya en deps). Los hex vienen de src/styles/tokens.css.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const W = 1200,
  H = 630
const paper = '#F8F7F4' // --bg-app (claro)
const ink = '#1C1C1E' // --text-primary
const soft = '#56565C' // --text-soft
const accent = '#A88B6A' // --accent-light (sepia)

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
    <g fill="none" stroke="${accent}" stroke-opacity="0.09" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" transform="scale(6)">
      <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z"/>
      <path d="M32 20v28"/>
    </g>
  </g>

  <!-- Lockup de marca, arriba a la izquierda -->
  <g transform="translate(80,74)">
    <rect x="0" y="0" width="60" height="60" rx="15" fill="${accent}"/>
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
  <text x="82" y="576" font-family="${font}" font-size="21" font-weight="600" letter-spacing="0.3" fill="${accent}">leetubiblia.com/info</text>
</svg>`

const out = fileURLToPath(new URL('../public/og-info.png', import.meta.url))
await sharp(Buffer.from(svg)).png().toFile(out)
console.log('og-info.png escrito en', out)
