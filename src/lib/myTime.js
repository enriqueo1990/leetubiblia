// "Mi tiempo": un recorrido guiado y OPCIONAL para el tiempo diario (prepararse,
// leer en tu Biblia, una línea, orar). Viene apagado: quien no lo activa usa Hoy
// como siempre. Se activa en Ajustes › Tu manera de leer, o desde la invitación
// que Hoy muestra una sola vez.
//
// La preferencia es de la CUENTA, no del aparato: vive en los datos del usuario
// de Supabase (user_metadata.my_time), así que te sigue a cualquier teléfono o
// computadora sin tocar el esquema de la base. El aparato guarda una copia para
// arrancar sin red; gana la más reciente (updatedAt).

export const MY_TIME_DEFAULTS = { enabled: false, note: true, prayer: true, inviteDismissed: false, updatedAt: 0 }
export const MY_TIME_META_KEY = 'my_time'

const prefsKey = (uid) => `ltb.myTime.${uid}`
const legacyInviteKey = (uid) => `ltb.myTime.inviteDismissed.${uid}`
export const MY_TIME_EVENT = 'ltb:myTime'

// Puro: normaliza lo que venga (aparato o cuenta) a la forma completa.
export function normalizeMyTime(raw) {
  if (!raw || typeof raw !== 'object') return null
  const out = { ...MY_TIME_DEFAULTS }
  for (const k of ['enabled', 'note', 'prayer', 'inviteDismissed']) if (typeof raw[k] === 'boolean') out[k] = raw[k]
  out.updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0
  return out
}

// Puro: entre las copias que haya (aparato, sesión, servidor), la más reciente.
// A igual fecha gana la que viene antes en la lista (la de la cuenta va primero).
export function pickMyTime(...candidates) {
  let best = null
  for (const c of candidates.map(normalizeMyTime)) {
    if (c && (!best || c.updatedAt > best.updatedAt)) best = c
  }
  return best ?? { ...MY_TIME_DEFAULTS }
}

// La copia del aparato. Una elección hecha antes de que esto viviera en la
// cuenta (sin updatedAt) se respeta y se sube la primera vez.
export function readLocalMyTime(uid, storage = globalThis.localStorage) {
  if (!uid || !storage) return null
  try {
    const raw = JSON.parse(storage.getItem(prefsKey(uid)) || 'null')
    const legacyInvite = storage.getItem(legacyInviteKey(uid)) === '1'
    if (!raw && !legacyInvite) return null
    return normalizeMyTime({ ...(raw ?? {}), ...(legacyInvite ? { inviteDismissed: true } : {}) })
  } catch {
    return null
  }
}

export function writeLocalMyTime(uid, prefs, storage = globalThis.localStorage) {
  if (!uid) return
  try {
    storage?.setItem(prefsKey(uid), JSON.stringify(normalizeMyTime(prefs)))
  } catch {
    /* sin almacenamiento: vale la de la cuenta */
  }
  globalThis.dispatchEvent?.(new Event(MY_TIME_EVENT))
}

// Los pasos del recorrido según lo que la persona eligió. La nota respeta
// también el diario de la app (si lo apagó en Ajustes, no se le pide).
export function myTimeSteps({ note, prayer, reflectionsEnabled }) {
  return ['prepare', 'read', ...(note && reflectionsEnabled ? ['note'] : []), ...(prayer ? ['pray'] : []), 'done']
}

// La invitación: a quien ya leyó algún día (no el primero), con la lectura de
// hoy pendiente, si no lo tiene activo y no la descartó.
export function shouldInviteMyTime({ enabled, dismissed, completedCount, doneToday }) {
  return !enabled && !dismissed && !doneToday && completedCount >= 2
}
