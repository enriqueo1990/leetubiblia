// Formato de números y fechas del panel (/admin).

const fmt = new Intl.NumberFormat('es-ES')
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 })

export function formatCount(n) {
  return Math.abs(n) >= 10000 ? compact.format(n) : fmt.format(n)
}

// 'YYYY-MM-DD' → Date local (sin el corrimiento de zona de Date.parse).
export function parseDay(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function shortDay(s, withWeekday = false) {
  return parseDay(s).toLocaleDateString('es-ES', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
  })
}

// Nombre del país en español a partir del ISO-2 ('—' u otro → 'Sin registrar').
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' })
  } catch {
    return null
  }
})()

export function countryName(code) {
  if (!/^[A-Z]{2}$/.test(code)) return 'Sin registrar'
  try {
    return regionNames?.of(code) || code
  } catch {
    return code
  }
}
