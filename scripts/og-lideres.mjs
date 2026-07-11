// Genera public/og-lideres.png: la imagen Open Graph propia de la landing
// /lideres (el recurso pastoral con capturas reales, cómo usar la app con
// un grupo de discipulado). Hermana de og-grupos.png, pero esa es la PRESENTACIÓN
// ("Guiá a tu grupo… sin chats desbordados") y esta es el RECURSO ("Acompañá a
// tu grupo en la Palabra"). Misma estética 1:1 con las landings: papel, marca del
// libro en sepia, la MISMA sans del sistema, un solo acento (design-canon).
//
// Regenerar tras tocar el diseño:  node scripts/og-lideres.mjs
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
  <text x="82" y="264" font-family="${font}" font-size="20" font-weight="600" letter-spacing="3" fill="${accent}">GUÍA PARA LÍDERES DE GRUPO</text>

  <!-- Titular (mismo de la landing; segunda parte en acento) -->
  <text x="80" y="340" font-family="${font}" font-size="60" font-weight="700" letter-spacing="-1.8" fill="${ink}">Acompañá a tu grupo</text>
  <text x="80" y="414" font-family="${font}" font-size="60" font-weight="700" letter-spacing="-1.8" fill="${accent}">en la Palabra.</text>

  <!-- Subtítulo -->
  <text x="82" y="478" font-family="${font}" font-size="24" font-weight="400" fill="${soft}">Qué podés hacer con tu grupo y cómo te ayuda a</text>
  <text x="82" y="512" font-family="${font}" font-size="24" font-weight="400" fill="${soft}">acompañar a tu gente —con capturas reales de la app.</text>

  <!-- URL -->
  <text x="82" y="572" font-family="${font}" font-size="21" font-weight="600" letter-spacing="0.3" fill="${accent}">leetubiblia.com/lideres</text>
</svg>`

const out = fileURLToPath(new URL('../public/og-lideres.png', import.meta.url))
await sharp(Buffer.from(svg)).png().toFile(out)
console.log('og-lideres.png escrito en', out)
