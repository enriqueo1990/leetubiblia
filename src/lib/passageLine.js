// El pasaje del día en una línea (para la foto de "Tu Biblia, hoy"), puro.
// Capítulos enteros y seguidos del mismo libro se juntan ("Salmos 116–118");
// el resto se separa con " · ". Hasta `max` tramos; lo demás como "+N".
import { bookLabel, bookLabelParts } from '../i18n/books.js'

export function passageLine(refs, locale, max = 3) {
  const runs = []
  for (const ref of refs ?? []) {
    const { name, numeric } = bookLabelParts(ref, locale)
    const whole = ref.chapter != null && numeric === String(ref.chapter)
    const last = runs[runs.length - 1]
    if (whole && last?.whole && last.book === ref.book_usfm && ref.chapter === last.end + 1) {
      last.end = ref.chapter
    } else {
      runs.push({ book: ref.book_usfm, name, whole, start: ref.chapter, end: ref.chapter, label: bookLabel(ref, locale) })
    }
  }
  const labels = runs.slice(0, max).map((r) => (r.whole && r.end > r.start ? `${r.name} ${r.start}–${r.end}` : r.label))
  const extra = runs.length - labels.length
  return labels.join(' · ') + (extra > 0 ? ` +${extra}` : '')
}
