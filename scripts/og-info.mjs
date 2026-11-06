// Genera public/og-info.png: la imagen Open Graph propia de la landing /info. Es el
// titular de la página (H1 de Info.jsx) en Newsreader sobre papel claro con la luz
// de mañana y la cinta marcapáginas, en Cielo. Ver scripts/og-lib.mjs.
//
// Regenerar tras tocar el titular o el diseño:  node scripts/og-info.mjs
import { fileURLToPath } from 'node:url'
import { renderOg } from './og-lib.mjs'

await renderOg({
  eyebrow: 'Compañero de lectura',
  title: 'Tu Biblia de papel,\n*cada mañana*.',
  sub: 'Te dice qué toca leer hoy y se hace a un lado.',
  url: 'leetubiblia.com',
  out: fileURLToPath(new URL('../public/og-info.png', import.meta.url)),
})
