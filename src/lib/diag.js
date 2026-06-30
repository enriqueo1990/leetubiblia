import { supabase } from './supabase.js'

// Telemetría TEMPORAL de arranque (ver migración 0015 y index.html).
// Confirma en producción cuál de los tres caminos disparaba la "carga infinita
// en la 1ª apertura" de la PWA. Los eventos se encolan en localStorage —así
// sobreviven al reload del watchdog— y se vuelcan a Supabase al montar la app.
//
// ⚠️ Borrar este archivo y sus llamadas cuando se confirme la causa.

const QUEUE_KEY = 'ltb.diag.queue'

function isStandalone() {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true // iOS Safari
    )
  } catch {
    return false
  }
}

// Encola un evento (no toca la red). Seguro de llamar muy temprano en el arranque.
export function recordDiag(event, detail = {}) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    queue.push({ event, detail, ts: Date.now() })
    // Cota defensiva: nunca dejar crecer la cola sin límite.
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-20)))
  } catch {
    /* no-op: la telemetría nunca debe romper el arranque */
  }
}

// Vuelca la cola a Supabase y la limpia. Fire-and-forget: si falla la red, los
// eventos quedan en la cola para el próximo arranque (no se pierden ni bloquean).
export async function flushDiag() {
  let queue
  try {
    queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    queue = []
  }
  if (!queue.length) return

  const standalone = isStandalone()
  const ua = navigator.userAgent
  let userId = null
  try {
    const { data } = await supabase.auth.getSession()
    userId = data?.session?.user?.id ?? null
  } catch {
    /* sin sesión: se reporta como anónimo */
  }

  const rows = queue.map((e) => ({
    user_id: userId,
    event: e.event,
    detail: { ...e.detail, ts: e.ts },
    standalone,
    user_agent: ua,
  }))

  try {
    const { error } = await supabase.from('boot_diagnostics').insert(rows)
    if (error) throw error
    localStorage.removeItem(QUEUE_KEY) // enviados: limpiar
  } catch {
    /* dejamos la cola para reintentar en el próximo arranque */
  }
}
