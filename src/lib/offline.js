import { markRead, unmarkRead } from './db.js'

// Capa offline para la lectura (documento maestro Tarea 8): el marcado se encola
// y se sincroniza al recuperar conexión; el contenido de Hoy se cachea para
// renderizar sin red. Todo en localStorage, por usuario.

const queueKey = (userId) => `ltb.queue.${userId}`
const snapKey = (userId) => `ltb.reading.${userId}`

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

// ---- Cola de marcado/desmarcado ----
function readQueue(userId) {
  try {
    return JSON.parse(localStorage.getItem(queueKey(userId)) || '[]')
  } catch {
    return []
  }
}
function writeQueue(userId, ops) {
  localStorage.setItem(queueKey(userId), JSON.stringify(ops))
}

// Encola una operación. Si ya hay una opuesta para el mismo día, se cancelan
// (marcar y luego desmarcar offline = nada que sincronizar).
export function enqueue(userId, op) {
  const ops = readQueue(userId)
  const opposite = op.type === 'mark' ? 'unmark' : 'mark'
  const idx = ops.findIndex(
    (o) => o.planId === op.planId && o.dayNumber === op.dayNumber && o.type === opposite
  )
  if (idx >= 0) ops.splice(idx, 1)
  else if (!ops.some((o) => o.planId === op.planId && o.dayNumber === op.dayNumber && o.type === op.type))
    ops.push(op)
  writeQueue(userId, ops)
}

export function hasPending(userId) {
  return readQueue(userId).length > 0
}

// Reproduce la cola contra Supabase. Se detiene ante el primer fallo de red para
// reintentar luego. Devuelve true si quedó vacía.
export async function flushQueue(userId) {
  if (!isOnline()) return false
  let ops = readQueue(userId)
  while (ops.length) {
    const op = ops[0]
    try {
      if (op.type === 'mark') await markRead(userId, op.planId, op.dayNumber)
      else await unmarkRead(userId, op.planId, op.dayNumber)
    } catch {
      return false // sin red o error transitorio: reintentar después
    }
    ops = ops.slice(1)
    writeQueue(userId, ops)
  }
  return true
}

// ---- Snapshot del estado de lectura (para Hoy offline) ----
export function cacheReading(userId, snapshot) {
  try {
    localStorage.setItem(snapKey(userId), JSON.stringify(snapshot))
  } catch {
    /* cuota llena: no es crítico */
  }
}

export function getCachedReading(userId) {
  try {
    return JSON.parse(localStorage.getItem(snapKey(userId)) || 'null')
  } catch {
    return null
  }
}
