// Capitular: separa la primera letra de un párrafo para dibujarla grande.
// La puntuación de apertura («¿», «¡», «"», «(», «—») NO es la capitular: va
// chica, pegada a la letra, como en los libros impresos. Devuelve null si el
// texto no arranca (tras esa puntuación) con una letra.
const OPENING = '¿¡«"“‘\'(\\[—–-'

export function splitDropCap(text) {
  if (!text) return null
  const m = String(text).match(new RegExp(`^([${OPENING}]*)(\\p{L})([\\s\\S]*)$`, 'u'))
  if (!m) return null
  return { punct: m[1], letter: m[2], rest: m[3] }
}

// Párrafos de una entrada (separados por línea en blanco en el JSON).
export function paragraphs(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}
