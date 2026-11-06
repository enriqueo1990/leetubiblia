// Genera public/og-biblioteca.png: la imagen Open Graph propia de la landing
// /biblioteca. Es el titular de la página (H1 de Biblioteca.jsx) en Newsreader sobre
// papel claro con la luz de mañana y la cinta marcapáginas, en Cielo. Ver
// scripts/og-lib.mjs.
//
// Regenerar tras tocar el titular o el diseño:  node scripts/og-biblioteca.mjs
import { fileURLToPath } from 'node:url'
import { renderOg } from './og-lib.mjs'

await renderOg({
  eyebrow: 'Biblioteca',
  title: 'Para leer despacio,\n*además de tu Biblia*.',
  sub: 'Credos, catecismos y un devocional para cada mañana.',
  url: 'leetubiblia.com/biblioteca',
  out: fileURLToPath(new URL('../public/og-biblioteca.png', import.meta.url)),
})
