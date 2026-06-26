// ============================================================================
// Parser español → USFM. Se usa SOLO al sembrar (no en runtime).
// Convierte referencias como "1 Crónicas 29:1-30" o "Salmos 5-6" en items
// estructurados { label, book_usfm, chapter, chapter_end? } que van a plan_days.refs.
//
// Decisión: guardamos a nivel de CAPÍTULO (no versículo), porque el link a
// YouVersion del documento maestro es por capítulo (bible.com/103/JER.33.NBLA).
// El `label` preserva el texto original para mostrar en pantalla tal cual.
// ============================================================================

// Nombre español (normalizado: minúsculas, sin acentos) → código USFM.
// Incluye variantes/abreviaturas comunes.
const BOOKS = {
  // Pentateuco
  genesis: 'GEN', gen: 'GEN',
  exodo: 'EXO', ex: 'EXO',
  levitico: 'LEV', lev: 'LEV',
  numeros: 'NUM', num: 'NUM',
  deuteronomio: 'DEU', deut: 'DEU', dt: 'DEU',
  // Históricos
  josue: 'JOS', jos: 'JOS',
  jueces: 'JDG', jue: 'JDG',
  rut: 'RUT',
  '1 samuel': '1SA', '1 sam': '1SA', '1samuel': '1SA',
  '2 samuel': '2SA', '2 sam': '2SA', '2samuel': '2SA',
  '1 reyes': '1KI', '1 rey': '1KI', '1reyes': '1KI',
  '2 reyes': '2KI', '2 rey': '2KI', '2reyes': '2KI',
  '1 cronicas': '1CH', '1 cron': '1CH', '1 cro': '1CH', '1cronicas': '1CH',
  '2 cronicas': '2CH', '2 cron': '2CH', '2 cro': '2CH', '2cronicas': '2CH',
  esdras: 'EZR', esd: 'EZR',
  nehemias: 'NEH', neh: 'NEH',
  ester: 'EST', est: 'EST',
  // Poéticos / sapienciales
  job: 'JOB',
  salmos: 'PSA', salmo: 'PSA', sal: 'PSA', sl: 'PSA',
  proverbios: 'PRO', prov: 'PRO', pr: 'PRO',
  eclesiastes: 'ECC', ecl: 'ECC',
  cantares: 'SNG', cantar: 'SNG', 'cantar de los cantares': 'SNG', cnt: 'SNG',
  // Profetas mayores
  isaias: 'ISA', isa: 'ISA', is: 'ISA',
  jeremias: 'JER', jer: 'JER',
  lamentaciones: 'LAM', lam: 'LAM',
  ezequiel: 'EZK', eze: 'EZK', ez: 'EZK',
  daniel: 'DAN', dan: 'DAN',
  // Profetas menores
  oseas: 'HOS', os: 'HOS',
  joel: 'JOL', jl: 'JOL',
  amos: 'AMO', am: 'AMO',
  abdias: 'OBA', abd: 'OBA',
  jonas: 'JON', jon: 'JON',
  miqueas: 'MIC', miq: 'MIC',
  nahum: 'NAM', nah: 'NAM',
  habacuc: 'HAB', hab: 'HAB',
  sofonias: 'ZEP', sof: 'ZEP',
  hageo: 'HAG', hag: 'HAG',
  zacarias: 'ZEC', zac: 'ZEC',
  malaquias: 'MAL', mal: 'MAL',
  // Evangelios / Hechos
  mateo: 'MAT', mt: 'MAT',
  marcos: 'MRK', mr: 'MRK', mc: 'MRK',
  lucas: 'LUK', lc: 'LUK', luc: 'LUK',
  juan: 'JHN', jn: 'JHN',
  hechos: 'ACT', hch: 'ACT', hec: 'ACT',
  // Cartas paulinas
  romanos: 'ROM', rom: 'ROM', ro: 'ROM',
  '1 corintios': '1CO', '1 cor': '1CO', '1corintios': '1CO',
  '2 corintios': '2CO', '2 cor': '2CO', '2corintios': '2CO',
  galatas: 'GAL', gal: 'GAL',
  efesios: 'EPH', efe: 'EPH', ef: 'EPH',
  filipenses: 'PHP', fil: 'PHP', flp: 'PHP',
  colosenses: 'COL', col: 'COL',
  '1 tesalonicenses': '1TH', '1 tes': '1TH', '1tesalonicenses': '1TH',
  '2 tesalonicenses': '2TH', '2 tes': '2TH', '2tesalonicenses': '2TH',
  '1 timoteo': '1TI', '1 tim': '1TI', '1timoteo': '1TI',
  '2 timoteo': '2TI', '2 tim': '2TI', '2timoteo': '2TI',
  tito: 'TIT', tit: 'TIT',
  filemon: 'PHM', flm: 'PHM',
  // Cartas generales / Apocalipsis
  hebreos: 'HEB', heb: 'HEB',
  santiago: 'JAS', sant: 'JAS', stg: 'JAS',
  '1 pedro': '1PE', '1 ped': '1PE', '1pedro': '1PE',
  '2 pedro': '2PE', '2 ped': '2PE', '2pedro': '2PE',
  '1 juan': '1JN', '1 jn': '1JN', '1juan': '1JN',
  '2 juan': '2JN', '2 jn': '2JN', '2juan': '2JN',
  '3 juan': '3JN', '3 jn': '3JN', '3juan': '3JN',
  judas: 'JUD', jud: 'JUD',
  apocalipsis: 'REV', apoc: 'REV', ap: 'REV',
}

// Libros de un solo capítulo: cualquier número que los siga son VERSÍCULOS, no
// capítulos (ej. "Judas 17-25", "Abdías 15-21"). Se guardan siempre en el
// capítulo 1 —al que apunta el enlace— conservando el label original.
const SINGLE_CHAPTER = new Set(['OBA', 'PHM', '2JN', '3JN', 'JUD'])

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Resuelve el nombre de libro (con o sin prefijo numérico) a USFM.
// Devuelve { usfm, rest } donde rest es lo que sigue (capítulos/versículos).
function matchBook(ref) {
  const norm = normalize(ref)
  // Probar nombres más largos primero (ej. "1 corintios" antes que "1").
  const keys = Object.keys(BOOKS).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (norm === k || norm.startsWith(k + ' ')) {
      return { usfm: BOOKS[k], rest: norm.slice(k.length).trim() }
    }
  }
  return null
}

// Parsea UNA referencia simple (un libro). Ej:
//   "Jeremías 33"        -> { label, book_usfm:'JER', chapter:33 }
//   "Salmos 5-6"         -> { ..., chapter:5, chapter_end:6 }
//   "1 Corintios 13:1-13"-> { ..., chapter:13 }  (versículos se ignoran al guardar)
export function parseRef(raw) {
  const label = raw.trim()
  const m = matchBook(label)
  if (!m) throw new Error(`Libro no reconocido en referencia: "${raw}"`)

  const { usfm, rest } = m
  // Libro de un solo capítulo: el número (si lo hay) son versículos → capítulo 1.
  if (SINGLE_CHAPTER.has(usfm)) {
    return { label, book_usfm: usfm, chapter: 1 }
  }
  if (!rest) {
    // Libro entero sin capítulo (raro en planes) — capítulo 1 por defecto.
    return { label, book_usfm: usfm, chapter: 1 }
  }

  // Capturar capítulo inicial y, si hay rango de capítulos, el final.
  // Formatos: "33", "5-6", "5:1-6:10", "13:1-13"
  const chapMatch = rest.match(/^(\d+)/)
  if (!chapMatch) throw new Error(`No se pudo leer el capítulo en: "${raw}"`)
  const chapter = parseInt(chapMatch[1], 10)

  const item = { label, book_usfm: usfm, chapter }

  // Rango de capítulos: "5-6" o "5:3-7:2" → chapter_end = el segundo número de capítulo.
  // Distinguimos rango de capítulos de rango de versículos:
  //   "5-6"      → cap 5 a 6   (sin ':')
  //   "5:1-6:10" → cap 5 a 6   (el '-' lo sigue "N:")
  //   "13:1-13"  → solo cap 13 (rango de versículos)
  const rangeCap = rest.match(/^\d+\s*-\s*(\d+)(?!\s*:)/) // "5-6" sin ':' después
  const rangeCapVerse = rest.match(/:\d+\s*-\s*(\d+)\s*:/) // "5:1-6:10"
  if (rangeCap) {
    item.chapter_end = parseInt(rangeCap[1], 10)
  } else if (rangeCapVerse) {
    item.chapter_end = parseInt(rangeCapVerse[1], 10)
  }
  return item
}

// Parsea una lista de referencias de un día, separadas por ';' o ','.
// Ej: "Jeremías 33; Salmos 5-6; Mateo 7"
export function parseDay(line) {
  return line
    .split(/[;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseRef)
}

export { BOOKS }
