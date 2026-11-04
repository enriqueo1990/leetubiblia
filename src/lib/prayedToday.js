// "Oré hoy": la fila de oración de "Tu día" necesita saber si ya oraste. No hay
// tabla para eso (la intercesión no guarda el día, y la revisión de un pedido
// propio es otra cosa), así que queda en el dispositivo, como Mi tiempo. Se
// escribe desde Orar ahora y desde Mi tiempo al decir "Amén".
import { todayLocalISO } from './dateMath.js'

export const PRAYED_EVENT = 'ltb:prayedToday'
const key = (uid) => `ltb.prayedOn.${uid}`

// Puro: decide si un registro vale para hoy.
export function prayedRecordForToday(raw, today = todayLocalISO()) {
  if (!raw || typeof raw !== 'object' || raw.date !== today) return null
  return { date: raw.date, title: typeof raw.title === 'string' ? raw.title : '' }
}

export function readPrayedToday(uid, storage = globalThis.localStorage) {
  if (!uid || !storage) return null
  try {
    return prayedRecordForToday(JSON.parse(storage.getItem(key(uid)) || 'null'))
  } catch {
    return null
  }
}

export function markPrayedToday(uid, title, storage = globalThis.localStorage) {
  if (!uid) return
  try {
    storage?.setItem(key(uid), JSON.stringify({ date: todayLocalISO(), title: title ?? '' }))
  } catch {
    /* sin almacenamiento: la fila vuelve a ofrecerse */
  }
  globalThis.dispatchEvent?.(new Event(PRAYED_EVENT))
}
