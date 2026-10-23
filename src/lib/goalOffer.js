// Cuándo pedir por la meta de donación en Hoy (ver components/GoalOffer.jsx).
// Solo en momentos de gratitud, nunca al entrar: al terminar un plan y al cumplir
// 7 y 30 días seguidos. Cada momento se ofrece una sola vez por usuario: tocar
// "Ahora no" o "Quiero ayudar" lo da por visto.

const seenKey = (uid) => `ltb.goalOffer.seen.${uid}`

// El momento que toca ahora, o null.
export function goalMoment({ planFinished, streak }) {
  if (planFinished) return 'plan'
  if (streak >= 30) return 'streak30'
  if (streak >= 7) return 'streak7'
  return null
}

export function wasGoalMomentSeen(uid, moment) {
  if (!uid || !moment) return true
  try {
    const seen = JSON.parse(localStorage.getItem(seenKey(uid)) || '[]')
    return Array.isArray(seen) && seen.includes(moment)
  } catch {
    return false
  }
}

export function markGoalMomentSeen(uid, moment) {
  if (!uid || !moment) return
  try {
    const seen = JSON.parse(localStorage.getItem(seenKey(uid)) || '[]')
    const list = Array.isArray(seen) ? seen : []
    if (!list.includes(moment)) localStorage.setItem(seenKey(uid), JSON.stringify([...list, moment]))
  } catch {
    /* queda descartada en esta sesión */
  }
}
