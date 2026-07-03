import { supabase } from './supabase.js'

// Telemetría de arranque (ver migración 0015/0021 e index.html). Ahora PERMANENTE
// (dejó de ser temporal): captura tanto eventos de salud de boot ('boot_reload',
// 'profile_retry', 'getsession_slow') como 'app_open' (una vez por día por
// dispositivo) para contar aperturas en el panel /admin. Los eventos se encolan
// en localStorage —así sobreviven al reload del watchdog— y se vuelcan a Supabase
// al montar la app, sellados con standalone + user_agent en flushDiag().

const QUEUE_KEY = 'ltb.diag.queue'
const OPEN_KEY = 'ltb.diag.openDay' // dedupe diario de 'app_open'

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

// Registra una apertura de la app, como mucho una vez por día natural por
// dispositivo. Alimenta "aperturas" e "instalada vs navegador" en /admin.
export function recordAppOpen() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(OPEN_KEY) === today) return
    localStorage.setItem(OPEN_KEY, today)
  } catch {
    /* sin localStorage: registramos igual (puede duplicar, no es grave) */
  }
  recordDiag('app_open', {})
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
