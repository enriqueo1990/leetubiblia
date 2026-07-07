// Genera public/og-guia.png: la imagen Open Graph propia de la landing /guia
// (el manual completo de la app). Hermana de og-info.png; misma estética 1:1 con
// las landings: papel, marca del libro en sepia, la MISMA sans del sistema, un
// solo acento (design-canon). /guia es la referencia exhaustiva; su preview lo dice.
//
// Regenerar tras tocar el diseño:  node scripts/og-guia.mjs
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
  <text x="82" y="266" font-family="${font}" font-size="20" font-weight="600" letter-spacing="3.2" fill="${accent}">GUÍA COMPLETA</text>

  <!-- Titular -->
  <text x="80" y="342" font-family="${font}" font-size="62" font-weight="700" letter-spacing="-2" fill="${ink}">Todo lo que hace</text>
  <text x="80" y="418" font-family="${font}" font-size="62" font-weight="700" letter-spacing="-2" fill="${accent}">Lee Tu Biblia.</text>

  <!-- Subtítulo -->
  <text x="82" y="482" font-family="${font}" font-size="25" font-weight="400" fill="${soft}">Función por función: tu lectura y los 8 planes, la oración,</text>
  <text x="82" y="516" font-family="${font}" font-size="25" font-weight="400" fill="${soft}">los grupos de discipulado y los materiales.</text>

  <!-- URL -->
  <text x="82" y="576" font-family="${font}" font-size="21" font-weight="600" letter-spacing="0.3" fill="${accent}">leetubiblia.com/guia</text>
</svg>`

const out = fileURLToPath(new URL('../public/og-guia.png', import.meta.url))
await sharp(Buffer.from(svg)).png().toFile(out)
console.log('og-guia.png escrito en', out)
