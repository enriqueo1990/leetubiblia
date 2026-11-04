// La luz de Hoy según la hora (puro): un resplandor muy suave arriba de la
// pantalla y el saludo que lo acompaña. Es el único detalle de la app que cambia
// con el reloj, y es a propósito: abrir Hoy a la mañana no se siente igual que
// a la noche, como una habitación con la luz que entra por la ventana.
//   mañana  05–12 · "Buen día"
//   tarde   12–20 · "Buenas tardes"
//   noche   20–05 · "Buenas noches"
export function dayPeriod(date = new Date()) {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 20) return 'afternoon'
  return 'night'
}

// El primer nombre para el saludo ("Enrique García" → "Enrique"); sin nombre, nada.
export function firstName(displayName) {
  const n = String(displayName ?? '').trim().split(/\s+/)[0]
  return n || null
}
