// Carrusel de compartir para las lecturas adicionales que no entran en una sola
// imagen (confesiones, artículos largos, la meditación completa de un
// devocional): arma las secciones de una entrada y las reparte en láminas.
// Puro: la medición la inyecta quien dibuja (lib/shareImage.js), así esto se
// prueba sin canvas.

const NUMBERED = /^(\d+)\.\s+/

// Marca de cambio de párrafo dentro de la secuencia de palabras.
export const PARA = '\n'

// Secciones de una entrada. Si todos los párrafos vienen numerados (1689: "1. La
// Santa Escritura…"), cada uno es una sección "capítulo.párrafo" con sus citas
// (ref.p dice a qué párrafo pertenece cada una). Si no, una sola sección con
// todos los párrafos y todas las citas al final.
export function carouselSections({ number, answer, refs = [] }, refLabel) {
  const paras = String(answer ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const numbered = paras.length > 1 && paras.every((p) => NUMBERED.test(p))
  if (!numbered) return [{ label: null, paragraphs: paras, refs: refs.map(refLabel) }]

  const sections = paras.map((p) => {
    const n = Number(p.match(NUMBERED)[1])
    return { n, label: `${number}.${n}`, paragraphs: [p.replace(NUMBERED, '')], refs: [] }
  })
  for (const r of refs) {
    const s = sections.find((x) => x.n === r.p) ?? sections[sections.length - 1]
    s.refs.push(refLabel(r))
  }
  return sections.map(({ label, paragraphs, refs: sRefs }) => ({ label, paragraphs, refs: sRefs }))
}

// Reparte las secciones en láminas, como páginas de un libro. Cada sección
// empieza lámina nueva; si no entra, se llena la lámina y sigue en la próxima,
// cortando de preferencia en un cambio de párrafo, después en un fin de oración
// o cláusula (. ; :) y si no en una coma. Las citas van en la última lámina de
// su sección y nunca quedan solas al pie de una lámina sin texto que las lleve.
//
// height(tokens, refs) → alto del bloque (texto + citas si hay).
// avail(section, part) → alto disponible en esa lámina (part 0 = la primera).
// Devuelve [{ label, part, paragraphs: [texto], refs, more }]; `more` = sigue.
export function paginate(sections, { height, avail }) {
  const pages = []
  const page = (s, part, tokens, refs, more) => ({ label: s.label, part, paragraphs: toParagraphs(tokens), refs, more })

  for (const s of sections) {
    let rest = s.paragraphs.flatMap((p, i) => [...(i ? [PARA] : []), ...p.split(/\s+/).filter(Boolean)])
    let part = 0
    while (rest.length) {
      const room = avail(s, part)
      if (height(rest, s.refs) <= room) {
        pages.push(page(s, part, rest, s.refs, false))
        break
      }
      // Cuántas palabras entran (la altura crece con k: búsqueda binaria).
      let lo = 1
      let hi = rest.length
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        if (height(rest.slice(0, mid), []) <= room) lo = mid
        else hi = mid - 1
      }
      // Si entra todo el texto pero no las citas, lo último pasa a la próxima
      // lámina con ellas.
      const k = rest.length > 1 ? cutAt(rest, Math.min(lo, rest.length - 1)) : 1
      pages.push(page(s, part, rest.slice(0, k), [], true))
      rest = trimPara(rest.slice(k))
      part++
      // Una sola palabra con citas que no entran juntas: las citas, aparte.
      if (!rest.length && s.refs.length) pages.push(page(s, part, [], s.refs, false))
    }
  }
  return pages
}

function cutAt(tokens, limit) {
  const find = (test, from) => {
    for (let j = limit; j > from; j--) if (test(j)) return j
    return 0
  }
  return (
    find((j) => tokens[j] === PARA, limit * 0.5) ||
    find((j) => /[.;:!?]["»”)]*$/.test(tokens[j - 1]), limit * 0.6) ||
    find((j) => /,$/.test(tokens[j - 1]), limit * 0.85) ||
    limit
  )
}

function trimPara(tokens) {
  let a = 0
  let b = tokens.length
  while (a < b && tokens[a] === PARA) a++
  while (b > a && tokens[b - 1] === PARA) b--
  return tokens.slice(a, b)
}

export function toParagraphs(tokens) {
  const out = []
  let cur = []
  for (const t of tokens) {
    if (t === PARA) {
      if (cur.length) out.push(cur.join(' '))
      cur = []
    } else cur.push(t)
  }
  if (cur.length) out.push(cur.join(' '))
  return out
}
