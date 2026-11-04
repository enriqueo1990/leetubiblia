// "Mi tiempo": un recorrido guiado y OPCIONAL para el tiempo diario (prepararse,
// leer en tu Biblia, una línea, orar). Viene apagado: quien no lo activa usa Hoy
// como siempre. Se activa en Ajustes › Tu manera de leer, o desde la invitación
// que Hoy muestra una sola vez.
//
// La preferencia vive en el dispositivo (como el tema al arrancar): no hace
// falta tocar la base para probarlo. Si se adopta, pasa al perfil.

export const MY_TIME_DEFAULTS = { enabled: false, note: true, prayer: true }

const prefsKey = (uid) => `ltb.myTime.${uid}`
const inviteKey = (uid) => `ltb.myTime.inviteDismissed.${uid}`
export const MY_TIME_EVENT = 'ltb:myTime'

export function readMyTime(uid) {
  if (!uid) return { ...MY_TIME_DEFAULTS }
  try {
    const raw = JSON.parse(localStorage.getItem(prefsKey(uid)) || 'null')
    return { ...MY_TIME_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
  } catch {
    return { ...MY_TIME_DEFAULTS }
  }
}

export function saveMyTime(uid, prefs) {
  if (!uid) return
  try {
    localStorage.setItem(prefsKey(uid), JSON.stringify({ ...MY_TIME_DEFAULTS, ...prefs }))
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
  window.dispatchEvent(new Event(MY_TIME_EVENT))
}

export function wasMyTimeInviteDismissed(uid) {
  if (!uid) return true
  try {
    return localStorage.getItem(inviteKey(uid)) === '1'
  } catch {
    return false
  }
}

export function dismissMyTimeInvite(uid) {
  if (!uid) return
  try {
    localStorage.setItem(inviteKey(uid), '1')
  } catch {
    /* queda descartada en esta sesión */
  }
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
