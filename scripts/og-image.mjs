// Genera public/og-image.png: la imagen Open Graph de toda la app privada y de los enlaces /join (ver index.html). Usa la plantilla de
// scripts/og-lib.mjs («Marcapáginas · Luz de mañana») con una captura real del teléfono (cuenta demo).
//
// Regenerar tras tocar el titular, el diseño o las capturas:  node scripts/og-image.mjs
import { fileURLToPath } from 'node:url'
import { renderOg } from './og-lib.mjs'

await renderOg({
  eyebrow: 'Compañero de lectura',
  title: 'Tu Biblia de papel,\n*cada mañana*.',
  sub: 'Te dice qué toca leer hoy y se hace a un lado.',
  url: 'leetubiblia.com',
  shot: fileURLToPath(new URL('../src/assets/shots/hoy-claro-780.webp', import.meta.url)),
  out: fileURLToPath(new URL('../public/og-image.png', import.meta.url)),
})
