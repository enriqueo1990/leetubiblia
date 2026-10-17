import { supabase } from './supabase.js'

// Telemetría de arranque (ver migración 0015/0021 e index.html). Ahora PERMANENTE
// (dejó de ser temporal): captura tanto eventos de salud de boot ('boot_reload',
// 'profile_retry', 'getsession_slow') como 'app_open' (una vez por día por
// dispositivo) para contar aperturas en el panel /admin. Los eventos se encolan
// en localStorage —así sobreviven al reload del watchdog— y se vuelcan a Supabase
// al montar la app, sellados con standalone + user_agent en flushDiag().
//
// Desde la migración 0035 también lleva el embudo de onboarding (eventos 'ob_*',
// ver recordFunnel): un paso por dispositivo, para ver en /admin dónde se cae la
// gente antes de su primera lectura.

const QUEUE_KEY = 'ltb.diag.queue'
const OPEN_KEY = 'ltb.diag.openDay' // dedupe diario de 'app_open'
const DEVICE_KEY = 'ltb.diag.device' // id anónimo del dispositivo (une pasos sin cuenta y con cuenta)
const FUNNEL_SEEN_KEY = 'ltb.diag.funnel' // pasos del embudo ya registrados en este dispositivo

// Los eventos que el servidor acepta desde siempre. Se envían en un lote aparte de
// los del embudo: si la migración 0035 todavía no está aplicada, el servidor
// rechaza los 'ob_*' y eso no debe trabar las aperturas.
const CORE_EVENTS = new Set(['app_open', 'boot_reload', 'profile_retry', 'getsession_slow'])

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

function readQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    return Array.isArray(queue) ? queue : []
  } catch {
    return []
  }
}

// Identidad de cada entrada en la cola (las viejas no traían id).
const entryKey = (e) => e.id || `${e.event}|${e.ts}`

// Encola un evento (no toca la red). Seguro de llamar muy temprano en el arranque.
export function recordDiag(event, detail = {}) {
  try {
    const queue = readQueue()
    const ts = Date.now()
    queue.push({ id: `${ts}-${Math.random().toString(36).slice(2, 8)}`, event, detail, ts })
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

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

// Paso del embudo de onboarding. Se registra UNA vez por dispositivo (volver
// atrás o recargar no infla el conteo) y se envía enseguida: quien abandona en
// el correo no vuelve a abrir la app, y sin envío inmediato ese paso se perdería.
// Eventos válidos: los de la migración 0035 (ob_welcome … ob_first_mark).
export function recordFunnel(event, detail = {}) {
  try {
    const seen = JSON.parse(localStorage.getItem(FUNNEL_SEEN_KEY) || '[]')
    if (Array.isArray(seen) && seen.includes(event)) return
    localStorage.setItem(FUNNEL_SEEN_KEY, JSON.stringify([...(Array.isArray(seen) ? seen : []), event]))
  } catch {
    /* sin localStorage: registramos igual */
  }
  recordDiag(event, { ...detail, device: deviceId() })
  scheduleFlush()
}

// Envío diferido y agrupado: varios pasos seguidos salen en una sola request.
// También se vacía la cola al ir a segundo plano (p. ej. al abrir el correo).
let flushTimer = null
let hideListener = false
function scheduleFlush() {
  if (typeof window === 'undefined') return
  if (!hideListener) {
    hideListener = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushDiag()
    })
  }
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => flushDiag(), 1500)
}

// Vuelca la cola a Supabase y la limpia. Fire-and-forget: si falla la red, los
// eventos quedan en la cola para el próximo arranque (no se pierden ni bloquean).
let flushing = null
export function flushDiag() {
  if (!flushing) flushing = doFlush().finally(() => (flushing = null))
  return flushing
}

async function doFlush() {
  const queue = readQueue()
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

  const toRow = (e) => ({
    user_id: userId,
    event: e.event,
    detail: { ...e.detail, ts: e.ts },
    standalone,
    user_agent: ua,
  })

  const batches = [
    queue.filter((e) => CORE_EVENTS.has(e.event)),
    queue.filter((e) => !CORE_EVENTS.has(e.event)),
  ].filter((b) => b.length)

  const sent = new Set()
  for (const batch of batches) {
    try {
      const { error } = await supabase.from('boot_diagnostics').insert(batch.map(toRow))
      if (error) throw error
      batch.forEach((e) => sent.add(entryKey(e)))
    } catch {
      /* este lote queda en la cola para reintentar en el próximo arranque */
    }
  }
  if (!sent.size) return

  // Releer: lo que se encoló durante el envío no se pierde.
  try {
    const rest = readQueue().filter((e) => !sent.has(entryKey(e)))
    if (rest.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(rest))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    /* no-op */
  }
}
