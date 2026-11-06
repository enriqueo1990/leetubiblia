// Genera public/og-biblioteca.png: la imagen Open Graph de la landing /biblioteca. Usa la plantilla de
// scripts/og-lib.mjs («Marcapáginas · Luz de mañana») con una captura real del teléfono (cuenta demo).
//
// Regenerar tras tocar el titular, el diseño o las capturas:  node scripts/og-biblioteca.mjs
import { fileURLToPath } from 'node:url'
import { renderOg } from './og-lib.mjs'

await renderOg({
  eyebrow: 'Biblioteca',
  title: 'Para leer despacio,\n*además de tu Biblia*.',
  sub: 'Credos, catecismos y un devocional para cada mañana.',
  url: 'leetubiblia.com/biblioteca',
  shot: fileURLToPath(new URL('../src/assets/shots/lector-claro-780.webp', import.meta.url)),
  out: fileURLToPath(new URL('../public/og-biblioteca.png', import.meta.url)),
})
