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
// ej. "1 Corintios 10:1-4". No hay campo estructurado para verso en los datos,
// así que se extrae del final del label anclado al número de capítulo conocido.
function parseVerseRange(ref) {
  if (!ref?.label || !ref?.chapter) return null
  const m = ref.label.match(new RegExp(`${ref.chapter}(?::(\\d+)(?:-(\\d+))?)?$`))
  if (!m || !m[1]) return null
  return { start: m[1], end: m[2] || null }
}

export function youVersionUrl(ref, locale = 'es') {
  if (!ref?.book_usfm || !ref?.chapter) return null
  const v = bibleVersion(locale)
  const verses = parseVerseRange(ref)
  const passage = verses ? `${ref.chapter}.${verses.start}${verses.end ? `-${verses.end}` : ''}` : ref.chapter
  return `https://www.bible.com/bible/${v.id}/${ref.book_usfm}.${passage}.${v.code}`
}

// Alternativa: BibleGateway abre directo al versículo exacto (search= acepta
// referencias como "Juan 3:16-18"). Útil si en el futuro se ofrece elegir
// proveedor (documento maestro §Fase 2); no está enlazada a la UI todavía.
export function bibleGatewayUrl(ref, locale = 'es') {
  if (!ref?.book_usfm || !ref?.chapter) return null
  const v = bibleVersion(locale)
  const verses = parseVerseRange(ref)
  const bookName = BOOKS[ref.book_usfm]?.es || ref.book_usfm
  const reference = verses
    ? `${bookName} ${ref.chapter}:${verses.start}${verses.end ? `-${verses.end}` : ''}`
    : `${bookName} ${ref.chapter}`
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
