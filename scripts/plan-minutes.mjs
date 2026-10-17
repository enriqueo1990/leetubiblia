// ============================================================================
// Estima los minutos de lectura por día de cada plan y los guarda en
// src/data/planMinutes.json ({ slug: minutos }), que el catálogo muestra como
// "≈ N min por día" para que quien empieza sepa cuánto le va a llevar.
//
// Es una estimación: un capítulo ≈ 3,6 min (la Biblia entera, ~1189 capítulos,
// se lee en voz alta en unas 70 h), un salmo ≈ 2,5 min y un rango de
// versículos ≈ 8 s por versículo. Se toma la mediana de los días, para que
// unos pocos días largos no inflen el número.
//
// Uso:  node scripts/plan-minutes.mjs   (después de tocar scripts/data o seed.mjs)
// ============================================================================

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLANS, buildDays } from './seed.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outFile = join(__dirname, '..', 'src', 'data', 'planMinutes.json')

const MIN_PER_CHAPTER = 3.6
const MIN_PER_PSALM = 2.5
const MIN_PER_VERSE = 8 / 60

function refMinutes(ref) {
  const perChapter = ref.book_usfm === 'PSA' ? MIN_PER_PSALM : MIN_PER_CHAPTER
  // "Isaías 62:1-5" → un rango de versículos dentro de un capítulo.
  const verses = ref.label.match(/(\d+):(\d+)\s*[-–]\s*(\d+)\s*$/)
  if (verses && !ref.chapter_end) {
    return (Number(verses[3]) - Number(verses[2]) + 1) * MIN_PER_VERSE
  }
  // "Mateo 1:18" → un versículo suelto.
  if (/\d+:\d+\s*$/.test(ref.label) && !ref.chapter_end) return MIN_PER_VERSE
  const chapters = ref.chapter_end ? ref.chapter_end - ref.chapter + 1 : 1
  return chapters * perChapter
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const out = {}
for (const plan of PLANS) {
  const days = buildDays(plan)
  if (!days) continue
  const perDay = days.map((d) => d.refs.reduce((sum, r) => sum + refMinutes(r), 0))
  const m = median(perDay)
  // Redondeo amable: de a 1 hasta 10 min (mínimo 2), de a 5 por encima.
  out[plan.slug] = m <= 10 ? Math.max(2, Math.round(m)) : Math.round(m / 5) * 5
}

writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n')
console.log(`✓ ${outFile}`)
console.log(out)
