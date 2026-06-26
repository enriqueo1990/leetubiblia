// Universal link de YouVersion al capítulo exacto, versión NBLA (id 103).
// Documento maestro §5.1: bible.com/bible/103/{book_usfm}.{chapter}.NBLA
// Abre la app de YouVersion si está instalada, la web si no. (Elegir otro
// proveedor/versión = Fase 2.)
const NBLA_ID = 103

export function youVersionUrl(ref) {
  if (!ref?.book_usfm || !ref?.chapter) return null
  return `https://www.bible.com/bible/${NBLA_ID}/${ref.book_usfm}.${ref.chapter}.NBLA`
}

// Si hay varias referencias en el día, se abre la PRIMERA (documento maestro §5.1).
export function firstYouVersionUrl(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return null
  return youVersionUrl(refs[0])
}
