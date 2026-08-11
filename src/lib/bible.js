import { BOOKS } from '../i18n/books.js'

// Universal link de YouVersion al capítulo exacto. La versión depende del idioma
// de la app (documento maestro §5.1). Abre la app de YouVersion si está instalada,
// la web si no. El book_usfm es neutro de idioma; solo cambian id y código.
//   es → NBLA (103) · en → ESV (59) · pt → ARA, Almeida Revista e Atualizada (1608)
// NOTA: confirmar los ids ESV/ARA en bible.com antes de publicar.
const VERSIONS = {
  es: { id: 103, code: 'NBLA' },
  en: { id: 59, code: 'ESV' },
  pt: { id: 1608, code: 'ARA' },
}

// Versión de Biblia (id + código) para un idioma. Fallback a español.
export function bibleVersion(locale) {
  return VERSIONS[locale] || VERSIONS.es
}

// El label (siempre en español, ver i18n/books.js) trae el versículo como texto,
// ej. "1 Corintios 10:1-4" o, cruzando capítulo, "Hebreos 4:14-5:6" (ref.chapter
// = capítulo inicial, ref.chapter_end = capítulo final — campo real en los refs
// de planes de lectura, ver plan_days.refs). Se ancla con esos números en vez de
// adivinar todo por regex, porque el label es texto libre.
function parseVerseRange(ref) {
  if (!ref?.label || !ref?.chapter) return null
  const chapterEnd = ref.chapter_end || ref.chapter
  if (chapterEnd === ref.chapter) {
    const m = ref.label.match(new RegExp(`${ref.chapter}(?::(\\d+)(?:-(\\d+))?)?$`))
    if (!m || !m[1]) return null
    return { chapterStart: ref.chapter, verseStart: m[1], chapterEnd: ref.chapter, verseEnd: m[2] || null }
  }
  // Rango que cruza de capítulo: solo tiene versículos si el label los trae en
  // ambas puntas ("4:14-5:6"); si es un rango de capítulos enteros ("40-41") no
  // hay verso que extraer y se cae al link de capítulo completo (comportamiento
  // ya correcto, sin cambios acá).
  const m = ref.label.match(new RegExp(`${ref.chapter}:(\\d+)-${chapterEnd}:(\\d+)$`))
  if (!m) return null
  return { chapterStart: ref.chapter, verseStart: m[1], chapterEnd, verseEnd: m[2] }
}

export function youVersionUrl(ref, locale = 'es') {
  if (!ref?.book_usfm || !ref?.chapter) return null
  const v = bibleVersion(locale)
  const verses = parseVerseRange(ref)
  let passage = ref.chapter
  if (verses) {
    // YouVersion no soporta rangos que cruzan de capítulo en la URL (probado:
    // HEB.4.14-5.6.ESV da 404). Cruzando, se ancla solo al versículo inicial —
    // mejor que perder la referencia exacta del todo.
    passage = verses.chapterEnd === verses.chapterStart
      ? `${verses.chapterStart}.${verses.verseStart}${verses.verseEnd ? `-${verses.verseEnd}` : ''}`
      : `${verses.chapterStart}.${verses.verseStart}`
  }
  return `https://www.bible.com/bible/${v.id}/${ref.book_usfm}.${passage}.${v.code}`
}

// Alternativa: BibleGateway abre directo al versículo exacto (search= acepta
// referencias como "Juan 3:16-18", y también rangos que cruzan capítulo como
// "Hebreos 4:14-5:6" — a diferencia de YouVersion, sí los soporta). Elegible en
// Ajustes → Proveedor de Biblia (ver passageUrl más abajo).
export function bibleGatewayUrl(ref, locale = 'es') {
  if (!ref?.book_usfm || !ref?.chapter) return null
  const v = bibleVersion(locale)
  const verses = parseVerseRange(ref)
  const bookName = BOOKS[ref.book_usfm]?.es || ref.book_usfm
  let reference = `${bookName} ${ref.chapter}`
  if (verses) {
    reference = verses.chapterEnd === verses.chapterStart
      ? `${bookName} ${verses.chapterStart}:${verses.verseStart}${verses.verseEnd ? `-${verses.verseEnd}` : ''}`
      : `${bookName} ${verses.chapterStart}:${verses.verseStart}-${verses.chapterEnd}:${verses.verseEnd}`
  }
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=${v.code}`
}

// Si hay varias referencias en el día, se abre la PRIMERA (documento maestro §5.1).
export function firstYouVersionUrl(refs, locale = 'es') {
  if (!Array.isArray(refs) || refs.length === 0) return null
  return youVersionUrl(refs[0], locale)
}

// Despacha al proveedor elegido en Ajustes (ver src/hooks/useBibleProvider.js).
export function passageUrl(ref, locale = 'es', provider = 'youversion') {
  return provider === 'biblegateway' ? bibleGatewayUrl(ref, locale) : youVersionUrl(ref, locale)
}
