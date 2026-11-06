// Genera public/og-guia.png: la imagen Open Graph de /ayuda (guía completa). Usa la plantilla de
// scripts/og-lib.mjs («Marcapáginas · Luz de mañana») con una captura real del teléfono (cuenta demo).
//
// Regenerar tras tocar el titular, el diseño o las capturas:  node scripts/og-guia.mjs
import { fileURLToPath } from 'node:url'
import { renderOg } from './og-lib.mjs'

await renderOg({
  eyebrow: 'Guía completa',
  title: 'Todo lo que hace\n*la app*',
  sub: 'Función por función: tu lectura, la oración, los grupos y los materiales.',
  url: 'leetubiblia.com/ayuda',
  shot: fileURLToPath(new URL('../src/assets/shots/progreso-claro-780.webp', import.meta.url)),
  out: fileURLToPath(new URL('../public/og-guia.png', import.meta.url)),
})
