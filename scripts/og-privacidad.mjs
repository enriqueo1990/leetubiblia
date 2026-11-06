// Genera public/og-privacidad.png: la imagen Open Graph de /privacidad. Usa la plantilla de
// scripts/og-lib.mjs («Marcapáginas · Luz de mañana»).
//
// Regenerar tras tocar el titular, el diseño o las capturas:  node scripts/og-privacidad.mjs
import { fileURLToPath } from 'node:url'
import { renderOg } from './og-lib.mjs'

await renderOg({
  eyebrow: 'Privacidad',
  title: 'Tu vida con Dios\nes *tuya*',
  sub: 'Privado por defecto, sin publicidad, y podés borrar tu cuenta cuando quieras.',
  url: 'leetubiblia.com/privacidad',
  out: fileURLToPath(new URL('../public/og-privacidad.png', import.meta.url)),
})
