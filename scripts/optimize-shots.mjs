// ============================================================================
// Optimiza las capturas reales de la app para las landings.
//
// Uso:  node scripts/optimize-shots.mjs <carpeta-de-origen> [carpeta-de-salida]
//   origen   PNG crudos (los que deja scripts/capture-demo.mjs: 1170×2532, 3×)
//            llamados <pantalla>-<claro|noche>.png
//   salida   por defecto src/assets/shots/
//
// Por cada PNG genera, a 780 px de ancho (2× de un teléfono de 390), un AVIF y un
// WebP: <pantalla>-<claro|noche>-780.avif / .webp. PhoneShot (src/screens/PhoneShot.jsx)
// usa el AVIF y deja el WebP de reserva. Los PNG crudos NO se versionan (pesan ~200 KB
// cada uno): quedan fuera del árbol de trabajo. Meta: ≤ 60 KB por AVIF; si alguno se
// pasa, el script lo avisa (y se baja AVIF_QUALITY).
// ============================================================================
import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2]
if (!SRC) {
  console.error('Uso: node scripts/optimize-shots.mjs <carpeta-de-origen> [carpeta-de-salida]')
  process.exit(1)
}
const OUT = resolve(process.argv[3] || join(root, 'src/assets/shots'))
const WIDTH = 780
const AVIF_QUALITY = 52
const WEBP_QUALITY = 80
const MAX_AVIF_KB = 60

mkdirSync(OUT, { recursive: true })
const files = readdirSync(resolve(SRC)).filter((f) => /^[a-z]+-(claro|noche)\.png$/.test(f))
if (!files.length) {
  console.error(`No hay PNG <pantalla>-<claro|noche>.png en ${SRC}`)
  process.exit(1)
}

let over = 0
for (const f of files.sort()) {
  const name = basename(f, '.png')
  const input = join(resolve(SRC), f)
  const base = sharp(input).resize({ width: WIDTH })
  const avif = join(OUT, `${name}-${WIDTH}.avif`)
  const webp = join(OUT, `${name}-${WIDTH}.webp`)
  const info = await base.clone().avif({ quality: AVIF_QUALITY, effort: 8 }).toFile(avif)
  await base.clone().webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(webp)
  const kb = Math.round(info.size / 1024)
  const wkb = Math.round(statSync(webp).size / 1024)
  if (kb > MAX_AVIF_KB) over++
  console.log(`${kb > MAX_AVIF_KB ? '!' : '✓'} ${name}: ${info.width}×${info.height}  avif ${kb} KB  webp ${wkb} KB`)
}
if (over) console.warn(`\n${over} AVIF pasan de ${MAX_AVIF_KB} KB: bajá AVIF_QUALITY.`)
