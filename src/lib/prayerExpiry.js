// Vencimiento de los pedidos de oración (puro, sin Supabase). Un pedido con
// duración Día/Semana/Mes vence; "Siempre" (forever) no.
const DAYS = { day: 1, week: 7, month: 30 }

// Fecha ISO de vencimiento para una duración, contada desde `now` (ms). null si no vence.
export function expiresAtFor(durationType, now = Date.now()) {
  const days = DAYS[durationType]
  if (!days) return null
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString()
}

// Qué cambia al tocar "Seguir orando" sobre un pedido. Siempre reinicia el reloj de
// revisión; si además el pedido YA había vencido, también renueva su vencimiento:
// si no, `expires_at < ahora` lo devolvía a "Para volver a orar" en cada carga
// aunque el usuario ya hubiera seguido orando.
export function reviewedPatch(prayer, now = Date.now()) {
  const patch = { last_reviewed_at: new Date(now).toISOString() }
  if (prayer?.expires_at && new Date(prayer.expires_at).getTime() < now) {
    patch.expires_at = expiresAtFor(prayer.duration_type, now)
  }
  return patch
}
