// Genera public/og-lideres.png: la imagen Open Graph de /lideres, con el MISMO titular
// que el H1 de esa página (Lideres.jsx). Mismo sistema visual que og-info.png (ver
// scripts/og-lib.mjs). Si cambia el H1 de /lideres, cambiarlo acá y regenerar.
//
// Regenerar:  node scripts/og-lideres.mjs
import { fileURLToPath } from 'node:url'
import { renderOg } from './og-lib.mjs'

await renderOg({
  eyebrow: 'Para líderes de grupo',
  title: 'Cómo usar Lee Tu Biblia\n*con tu grupo*',
  sub: 'Cada uno lee en su Biblia; la app les ayuda a leer lo mismo.',
  size: 76,
  url: 'leetubiblia.com/lideres',
  out: fileURLToPath(new URL('../public/og-lideres.png', import.meta.url)),
})
