// Nombres de los 66 libros por idioma. El código book_usfm es neutro de idioma;
// el label guardado en la DB está en español ("Génesis 1", "1 Corintios 6:19-20").
// Los nombres `es` de este mapa coinciden EXACTAMENTE con el prefijo de esos
// labels, para poder aislar la parte numérica (capítulo[:versículo]) y anteponer
// el nombre traducido sin perder precisión de versículos.
export const BOOKS = {
  GEN: { es: 'Génesis', en: 'Genesis', pt: 'Gênesis' },
  EXO: { es: 'Éxodo', en: 'Exodus', pt: 'Êxodo' },
  LEV: { es: 'Levítico', en: 'Leviticus', pt: 'Levítico' },
  NUM: { es: 'Números', en: 'Numbers', pt: 'Números' },
  DEU: { es: 'Deuteronomio', en: 'Deuteronomy', pt: 'Deuteronômio' },
  JOS: { es: 'Josué', en: 'Joshua', pt: 'Josué' },
  JDG: { es: 'Jueces', en: 'Judges', pt: 'Juízes' },
  RUT: { es: 'Rut', en: 'Ruth', pt: 'Rute' },
  '1SA': { es: '1 Samuel', en: '1 Samuel', pt: '1 Samuel' },
  '2SA': { es: '2 Samuel', en: '2 Samuel', pt: '2 Samuel' },
  '1KI': { es: '1 Reyes', en: '1 Kings', pt: '1 Reis' },
  '2KI': { es: '2 Reyes', en: '2 Kings', pt: '2 Reis' },
  '1CH': { es: '1 Crónicas', en: '1 Chronicles', pt: '1 Crônicas' },
  '2CH': { es: '2 Crónicas', en: '2 Chronicles', pt: '2 Crônicas' },
  EZR: { es: 'Esdras', en: 'Ezra', pt: 'Esdras' },
  NEH: { es: 'Nehemías', en: 'Nehemiah', pt: 'Neemias' },
  EST: { es: 'Ester', en: 'Esther', pt: 'Ester' },
  JOB: { es: 'Job', en: 'Job', pt: 'Jó' },
  PSA: { es: 'Salmos', en: 'Psalms', pt: 'Salmos' },
  PRO: { es: 'Proverbios', en: 'Proverbs', pt: 'Provérbios' },
  ECC: { es: 'Eclesiastés', en: 'Ecclesiastes', pt: 'Eclesiastes' },
  SNG: { es: 'Cantares', en: 'Song of Songs', pt: 'Cânticos' },
  ISA: { es: 'Isaías', en: 'Isaiah', pt: 'Isaías' },
  JER: { es: 'Jeremías', en: 'Jeremiah', pt: 'Jeremias' },
  LAM: { es: 'Lamentaciones', en: 'Lamentations', pt: 'Lamentações' },
  EZK: { es: 'Ezequiel', en: 'Ezekiel', pt: 'Ezequiel' },
  DAN: { es: 'Daniel', en: 'Daniel', pt: 'Daniel' },
  HOS: { es: 'Oseas', en: 'Hosea', pt: 'Oseias' },
  JOL: { es: 'Joel', en: 'Joel', pt: 'Joel' },
  AMO: { es: 'Amós', en: 'Amos', pt: 'Amós' },
  OBA: { es: 'Abdías', en: 'Obadiah', pt: 'Obadias' },
  JON: { es: 'Jonás', en: 'Jonah', pt: 'Jonas' },
  MIC: { es: 'Miqueas', en: 'Micah', pt: 'Miqueias' },
  NAM: { es: 'Nahúm', en: 'Nahum', pt: 'Naum' },
  HAB: { es: 'Habacuc', en: 'Habakkuk', pt: 'Habacuque' },
  ZEP: { es: 'Sofonías', en: 'Zephaniah', pt: 'Sofonias' },
  HAG: { es: 'Hageo', en: 'Haggai', pt: 'Ageu' },
  ZEC: { es: 'Zacarías', en: 'Zechariah', pt: 'Zacarias' },
  MAL: { es: 'Malaquías', en: 'Malachi', pt: 'Malaquias' },
  MAT: { es: 'Mateo', en: 'Matthew', pt: 'Mateus' },
  MRK: { es: 'Marcos', en: 'Mark', pt: 'Marcos' },
  LUK: { es: 'Lucas', en: 'Luke', pt: 'Lucas' },
  JHN: { es: 'Juan', en: 'John', pt: 'João' },
  ACT: { es: 'Hechos', en: 'Acts', pt: 'Atos' },
  ROM: { es: 'Romanos', en: 'Romans', pt: 'Romanos' },
  '1CO': { es: '1 Corintios', en: '1 Corinthians', pt: '1 Coríntios' },
  '2CO': { es: '2 Corintios', en: '2 Corinthians', pt: '2 Coríntios' },
  GAL: { es: 'Gálatas', en: 'Galatians', pt: 'Gálatas' },
  EPH: { es: 'Efesios', en: 'Ephesians', pt: 'Efésios' },
  PHP: { es: 'Filipenses', en: 'Philippians', pt: 'Filipenses' },
  COL: { es: 'Colosenses', en: 'Colossians', pt: 'Colossenses' },
  '1TH': { es: '1 Tesalonicenses', en: '1 Thessalonians', pt: '1 Tessalonicenses' },
  '2TH': { es: '2 Tesalonicenses', en: '2 Thessalonians', pt: '2 Tessalonicenses' },
  '1TI': { es: '1 Timoteo', en: '1 Timothy', pt: '1 Timóteo' },
  '2TI': { es: '2 Timoteo', en: '2 Timothy', pt: '2 Timóteo' },
  TIT: { es: 'Tito', en: 'Titus', pt: 'Tito' },
  PHM: { es: 'Filemón', en: 'Philemon', pt: 'Filemom' },
  HEB: { es: 'Hebreos', en: 'Hebrews', pt: 'Hebreus' },
  JAS: { es: 'Santiago', en: 'James', pt: 'Tiago' },
  '1PE': { es: '1 Pedro', en: '1 Peter', pt: '1 Pedro' },
  '2PE': { es: '2 Pedro', en: '2 Peter', pt: '2 Pedro' },
  '1JN': { es: '1 Juan', en: '1 John', pt: '1 João' },
  '2JN': { es: '2 Juan', en: '2 John', pt: '2 João' },
  '3JN': { es: '3 Juan', en: '3 John', pt: '3 João' },
  JUD: { es: 'Judas', en: 'Jude', pt: 'Judas' },
  REV: { es: 'Apocalipsis', en: 'Revelation', pt: 'Apocalipse' },
}

// Reconstruye el label de una referencia en el idioma pedido. En español devuelve
// el label original (ya es la fuente). En otros idiomas, sustituye solo el nombre
// del libro y conserva la parte numérica ("6:19-20") del label español.
export function bookLabel(ref, locale) {
  if (!ref) return ''
  const original = ref.label || ''
  if (locale === 'es' || locale == null) return original
  const entry = BOOKS[ref.book_usfm]
  if (!entry) return original // USFM desconocido: no romper nada.
  const targetName = entry[locale] || entry.es

  let numeric = ''
  if (entry.es && original.startsWith(entry.es)) {
    numeric = original.slice(entry.es.length).trim()
  } else if (ref.chapter != null) {
    numeric = String(ref.chapter)
    if (ref.chapter_end && ref.chapter_end !== ref.chapter) {
      numeric += `-${ref.chapter_end}`
    }
  }
  return numeric ? `${targetName} ${numeric}` : targetName
}

// Partes del label — { name, numeric } — para tipografía diferenciada: en Hoy
// los capítulos van en acento para señalar que el pasaje es tocable.
export function bookLabelParts(ref, locale) {
  const full = bookLabel(ref, locale)
  if (!full) return { name: '', numeric: '' }
  const entry = ref ? BOOKS[ref.book_usfm] : null
  const candidates = entry ? [entry[locale] || entry.es, entry.es] : []
  for (const n of candidates) {
    if (n && full.startsWith(n)) {
      return { name: n, numeric: full.slice(n.length).trim() }
    }
  }
  return { name: full, numeric: '' }
}
