// Fechas y rachas: funciones puras (sin Supabase ni React). db.js las re-exporta.

// Fecha local (YYYY-MM-DD) — el plan_start_date corta a la medianoche LOCAL,
// no UTC (regla canónica de day_number, documento maestro §5.1).
export function todayLocalISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

// Diferencia en días entre dos fechas YYYY-MM-DD, usando componentes UTC para
// no verse afectada por horario de verano. Devuelve b − a en días.
export function dateDiffDays(aISO, bISO) {
  const [ay, am, ad] = aISO.split('-').map(Number)
  const [by, bm, bd] = bISO.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

// Suma n días a una fecha YYYY-MM-DD local y devuelve YYYY-MM-DD.
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + n * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

// Compatibilidad para timestamps antiguos. Las lecturas nuevas usan completed_on,
// que conserva el día local en que el usuario las marcó.
export function localDateISO(ts) {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// REGLA CANÓNICA (documento maestro §5.1) — única forma de calcular el día:
//   día_de_hoy = (hoy − plan_start_date) + 1, en zona horaria LOCAL.
// Lo que "Hoy" muestra lo dicta SIEMPRE el calendario, sin importar lo leído.
export function dayNumberFor(planStartISO, todayISO = todayLocalISO()) {
  return dateDiffDays(planStartISO, todayISO) + 1
}

// Inversa de dayNumberFor: si hoy debe ser el día N, el plan empezó hace N−1
// días. Sirve para "engancharse" a un plan que el usuario ya venía leyendo.
export function startDateForDay(dayNumber, todayISO = todayLocalISO()) {
  return addDaysISO(todayISO, -(dayNumber - 1))
}

// Primer día NO leído dentro de [1..hastaDía]. Si todo está leído, devuelve
// hastaDía + ... en realidad devuelve el primer hueco; si no hay, devuelve
// hastaDía (hoy aún sin leer no cuenta como atraso).
export function firstUnreadDay(completedSet, todayDay) {
  for (let d = 1; d <= todayDay; d++) {
    if (!completedSet.has(d)) return d
  }
  return todayDay + 1 // todo leído hasta hoy inclusive
}

// Racha por días REALES (documento maestro §5.2): cantidad de fechas de calendario
// consecutivas con al menos una lectura marcada, terminando hoy o ayer (si hoy aún
// no leíste, la racha sigue viva). Se basa en la fecha local guardada, no en
// day_number, así
// leer varios días de una sentada —o el backfill al engancharse a mitad de plan—
// cuenta como UN solo día de racha. dateSet = Set de fechas YYYY-MM-DD locales.
export function computeDateStreak(dateSet, todayISO = todayLocalISO()) {
  let end = todayISO
  if (!dateSet.has(end)) end = addDaysISO(todayISO, -1)
  if (!dateSet.has(end)) return 0
  let streak = 0
  for (let cur = end; dateSet.has(cur); cur = addDaysISO(cur, -1)) streak++
  return streak
}

// Racha MÁS LARGA del historial: el run más largo de fechas de calendario
// consecutivas, sin importar dónde termine (a diferencia de computeDateStreak,
// que mide la racha viva). dateSet = Set/Array de fechas YYYY-MM-DD locales.
export function longestStreak(dates) {
  const sorted = [...new Set(dates)].sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of sorted) {
    run = prev && addDaysISO(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

