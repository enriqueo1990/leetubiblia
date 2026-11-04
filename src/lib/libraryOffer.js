// Cómo se descubre la Biblioteca desde Hoy (antes había que tocar el nombre del
// plan, entrar a Lecturas y bajar). Tres puertas:
//  - la tarjeta con portadas, para quien no tiene ningún material ("Ahora no"
//    la duerme unas semanas, no para siempre);
//  - la fila fija "Biblioteca" al pie de "También hoy", para quien ya tiene;
//  - una sugerencia con nombre propio al tercer día seguido de lectura, una
//    sola vez, en el momento de más ganas.
import { MATERIALS, isMaterialActive } from './materials.js'

// Orden de sugerencia: de lo más breve y accesible a lo más extenso.
export const SUGGESTED_ORDER = [
  'westminster-menor',
  'spurgeon-matutinas',
  'credos',
  'heidelberg',
  'spurgeon',
  'keach',
  'belga',
  'bautista-1689',
  'dort',
  'spurgeon-ninos',
]

// Los primeros `n` materiales que la persona todavía no tiene en su estante.
export function suggestedMaterials(profile, n = 4) {
  const known = new Set(MATERIALS.map((m) => m.slug))
  return SUGGESTED_ORDER.filter((slug) => known.has(slug) && !isMaterialActive(profile, slug)).slice(0, n)
}

// Al tercer día seguido, si todavía no tiene ningún material y no se lo
// ofrecimos antes.
export const MOMENT_STREAK = 3
export function shouldOfferLibraryMoment({ streak, activeCount, seen }) {
  return !seen && activeCount === 0 && streak >= MOMENT_STREAK
}

const SNOOZE_DAYS = 21
const cardKey = (uid) => `ltb.libraryCard.snoozedUntil.${uid}`
const momentKey = (uid) => `ltb.libraryMoment.seen.${uid}`

export function isLibraryCardSnoozed(uid, now = Date.now()) {
  if (!uid) return true
  try {
    return Number(localStorage.getItem(cardKey(uid)) || 0) > now
  } catch {
    return false
  }
}

export function snoozeLibraryCard(uid, now = Date.now()) {
  if (!uid) return
  try {
    localStorage.setItem(cardKey(uid), String(now + SNOOZE_DAYS * 24 * 60 * 60 * 1000))
  } catch {
    /* queda dormida en esta sesión */
  }
}

export function wasLibraryMomentSeen(uid) {
  if (!uid) return true
  try {
    return localStorage.getItem(momentKey(uid)) === '1'
  } catch {
    return false
  }
}

export function markLibraryMomentSeen(uid) {
  if (!uid) return
  try {
    localStorage.setItem(momentKey(uid), '1')
  } catch {
    /* queda vista en esta sesión */
  }
}
