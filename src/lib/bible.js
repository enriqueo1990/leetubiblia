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

export function youVersionUrl(ref, locale = 'es') {
  if (!ref?.book_usfm || !ref?.chapter) return null
  const v = bibleVersion(locale)
  return `https://www.bible.com/bible/${v.id}/${ref.book_usfm}.${ref.chapter}.${v.code}`
}

// Si hay varias referencias en el día, se abre la PRIMERA (documento maestro §5.1).
export function firstYouVersionUrl(refs, locale = 'es') {
  if (!Array.isArray(refs) || refs.length === 0) return null
  return youVersionUrl(refs[0], locale)
}
