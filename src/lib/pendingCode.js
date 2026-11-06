// Paso «revisá tu correo» a medio hacer. Para leer el código hay que salir de la
// app (a Mail), y en iPhone el sistema puede recargar la PWA mientras tanto: sin
// esto la persona vuelve a la bienvenida, y pedir otro código invalida el que ya
// tenía. Se guarda al enviar el código y se descarta al verificar, al tocar «usá
// otro correo», al volver al formulario y al cerrar sesión (sessionFlags.js).
// Mismo patrón que lib/pendingPlan.js; vence a los 15 minutos.
const KEY = 'ltb.pendingCode'
export const PENDING_CODE_TTL = 15 * 60 * 1000

const defaultStore = () => (typeof localStorage === 'undefined' ? null : localStorage)

export function readPendingCode(store = defaultStore(), now = Date.now()) {
  if (!store) return null
  try {
    const p = JSON.parse(store.getItem(KEY))
    if (!p || typeof p !== 'object') return null
    if (typeof p.email !== 'string' || !p.email) return null
    if (p.mode !== 'signup' && p.mode !== 'login') return null
    if (!Number.isFinite(p.sentAt) || p.sentAt > now || now - p.sentAt > PENDING_CODE_TTL) {
      store.removeItem(KEY)
      return null
    }
    return { email: p.email, mode: p.mode, sentAt: p.sentAt }
  } catch {
    return null
  }
}

export function savePendingCode({ email, mode }, store = defaultStore(), now = Date.now()) {
  if (!store) return
  try {
    store.setItem(KEY, JSON.stringify({ email, mode, sentAt: now }))
  } catch {
    /* no crítico: sin esto solo se pierde la recuperación tras recargar */
  }
}

export function clearPendingCode(store = defaultStore()) {
  if (!store) return
  try {
    store.removeItem(KEY)
  } catch {
    /* no-op */
  }
}
