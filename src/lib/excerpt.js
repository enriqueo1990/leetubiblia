// Recorte de un texto largo para la imagen de compartir de un devocional (puro).
// Toma el primer párrafo; si pasa de `max`, corta en el último límite de palabra y
// agrega "…". Un catecismo NO se recorta (la doctrina no se trunca): solo los
// devocionales por fecha, cuya meditación no cabe nunca en la tarjeta.
export function excerpt(text, max = 280) {
  const first = String(text ?? '').split(/\n\s*\n/)[0].trim()
  if (first.length <= max) return first
  const cut = first.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, '')
  return `${base}…`
}
