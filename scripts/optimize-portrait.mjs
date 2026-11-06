// Retrato de «Quién hace Lee Tu Biblia» (/info): recorta a 4:5, centrado en la cara,
// y genera AVIF y WebP a 480×600 (2× de 240×300). Uso:
//   node scripts/optimize-portrait.mjs <foto-original> [salida=src/assets/quien/enrique]
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [src, out = 'src/assets/quien/enrique'] = process.argv.slice(2)
if (!src) throw new Error('Falta la foto de origen')
mkdirSync(dirname(out), { recursive: true })
const base = sharp(src).rotate().resize(480, 600, { fit: 'cover', position: sharp.strategy.attention })
await base.clone().avif({ quality: 58 }).toFile(`${out}-480.avif`)
await base.clone().webp({ quality: 80 }).toFile(`${out}-480.webp`)
console.log('listo', out)
