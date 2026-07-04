// Genera public/og-grupos.png: la imagen Open Graph propia de /grupos-pequenos.
// Misma familia visual que og-info.mjs (papel, marca del libro en sepia, misma
// sans, un solo acento, marca de agua sangrando) pero le habla al LÍDER de grupo
// de discipulado — no "célula". La marca de agua es el ícono de personas/grupo
// (no el libro) para diferenciar de un vistazo este OG del general.
//
// Regenerar tras tocar el diseño:  node scripts/og-grupos.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const W = 1200,
  H = 630
const paper = '#F8F7F4' // --bg-app (claro)
const ink = '#1C1C1E' // --text-primary
const soft = '#56565C' // --text-soft
const accent = '#A88B6A' // --accent-light (sepia)

const font = `-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif`

// Marca del libro dentro del badge (misma del onboarding/splash).
const book = (x, y, s) => {
  const k = s / 64
  return `<g transform="translate(${x},${y}) scale(${k})">
    <g fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z"/>
      <path d="M32 20v28"/>
    </g>
  </g>`
}

// Ícono de "personas" (dos figuras), trazo redondo, para la marca de agua.
const people = `
  <path d="M13 26a9 9 0 0 1 18 0" />
  <circle cx="22" cy="11" r="6.5" />
  <path d="M31 26a9 9 0 0 1 16 0" />
  <circle cx="39" cy="12" r="5.5" />
`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${paper}"/>

  <!-- Marca de agua de personas/grupo, sangrando por la derecha, apenas perceptible -->
  <g transform="translate(795,250)">
    <g fill="none" stroke="${accent}" stroke-opacity="0.09" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="scale(7)">
      ${people}
    </g>
  </g>

  <!-- Lockup de marca, arriba a la izquierda -->
  <g transform="translate(80,74)">
    <rect x="0" y="0" width="60" height="60" rx="15" fill="${accent}"/>
    ${book(6, 6, 48)}
    <text x="78" y="40" font-family="${font}" font-size="27" font-weight="700" letter-spacing="-0.5" fill="${ink}">Lee Tu Biblia</text>
  </g>

  <!-- Eyebrow -->
  <text x="82" y="262" font-family="${font}" font-size="20" font-weight="600" letter-spacing="3" fill="${accent}">PARA LÍDERES DE GRUPOS DE DISCIPULADO</text>

  <!-- Titular (mismo de la landing; segunda parte en acento) -->
  <text x="80" y="338" font-family="${font}" font-size="58" font-weight="700" letter-spacing="-1.8" fill="${ink}">Guiá a tu grupo en la Palabra,</text>
  <text x="80" y="410" font-family="${font}" font-size="58" font-weight="700" letter-spacing="-1.8" fill="${accent}">sin chats desbordados.</text>

  <!-- Subtítulo -->
  <text x="82" y="474" font-family="${font}" font-size="24" font-weight="400" fill="${soft}">Lean al mismo ritmo, anímense a leer y oren juntos</text>
  <text x="82" y="508" font-family="${font}" font-size="24" font-weight="400" fill="${soft}">—cada quien en su Biblia de papel.</text>

  <!-- URL -->
  <text x="82" y="570" font-family="${font}" font-size="21" font-weight="600" letter-spacing="0.3" fill="${accent}">leetubiblia.com/grupos-pequenos</text>
</svg>`

const out = fileURLToPath(new URL('../public/og-grupos.png', import.meta.url))
await sharp(Buffer.from(svg)).png().toFile(out)
console.log('og-grupos.png escrito en', out)
