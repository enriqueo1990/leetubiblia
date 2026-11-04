// Oraciones de un texto, para "Elegir una frase" en el lector (puro). Corta
// después de . ; : ? ! (con comillas o paréntesis de cierre pegados) seguido de
// espacio, y en cada cambio de párrafo. El punto y coma y los dos puntos cortan
// a propósito: en las confesiones una oración puede ocupar un párrafo entero, y
// una cláusula es una frase compartible. No corta en abreviaturas frecuentes
// ("p. ej.", "cf.", "vs.") ni entre un número y su punto ("1. ").
//
// Devuelve [{ text, para }] donde `para` es el índice de párrafo.
const NO_BREAK = /(?:\b(?:p|ej|cf|vs|etc|Sr|Sra|Dr|cap|art|vv?|cfr)\.|^\d+\.)$/i

export function splitSentences(text) {
  const out = []
  String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((para, pi) => {
      const parts = para.split(/(?<=[.;:?!][»”")\]]*)\s+/)
      let cur = ''
      for (const part of parts) {
        cur = cur ? `${cur} ${part}` : part
        if (!NO_BREAK.test(cur.trim())) {
          out.push({ text: cur.trim(), para: pi })
          cur = ''
        }
      }
      if (cur) out.push({ text: cur.trim(), para: pi })
    })
  return out
}

// Texto de un rango de oraciones [start, end] (inclusive), uniendo con espacio.
export function joinSentences(sentences, start, end) {
  return sentences
    .slice(Math.min(start, end), Math.max(start, end) + 1)
    .map((s) => s.text)
    .join(' ')
}
