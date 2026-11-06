// Genera public/og-lideres.png: la imagen Open Graph de la landing /lideres. Usa la plantilla de
// scripts/og-lib.mjs («Marcapáginas · Luz de mañana») con una captura real del teléfono (cuenta demo).
//
// Regenerar tras tocar el titular, el diseño o las capturas:  node scripts/og-lideres.mjs
import { fileURLToPath } from 'node:url'
import { renderOg } from './og-lib.mjs'

await renderOg({
  eyebrow: 'Para líderes de grupo',
  title: 'Acompañá a tu grupo\n*en la Palabra*',
  sub: 'Cada uno lee en su Biblia; la app les ayuda a leer lo mismo.',
  url: 'leetubiblia.com/lideres',
  shot: fileURLToPath(new URL('../src/assets/shots/orar-claro-780.webp', import.meta.url)),
  out: fileURLToPath(new URL('../public/og-lideres.png', import.meta.url)),
})
