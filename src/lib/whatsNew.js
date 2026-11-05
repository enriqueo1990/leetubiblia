// "Novedades": lo que trae una versión grande, contado una sola vez a quien ya
// usaba la app. Se recuerda en la CUENTA (user_metadata), no en el aparato: si
// ya lo viste en el celular, la computadora no te lo vuelve a mostrar.
//
// Para una versión nueva con novedades: subir WHATS_NEW_VERSION, poner en
// WHATS_NEW_SINCE el día en que sale a producción (las cuentas creadas desde
// ese día ya la conocen así y no ven "novedades") y cambiar las pantallas en
// components/WhatsNew.jsx.

export const WHATS_NEW_VERSION = '2027.1'
export const WHATS_NEW_SINCE = '2026-11-06'
export const WHATS_NEW_META_KEY = 'whats_new_seen'
// Para abrirlas a pedido (Ajustes › Novedades de esta versión).
export const OPEN_WHATS_NEW_EVENT = 'ltb:openWhatsNew'

const localKey = (uid) => `ltb.whatsNewSeen.${uid}`

// Puro: ¿mostrar las novedades? Solo a cuentas de antes de la versión, que no
// las vieron (ni en la cuenta ni en este aparato).
export function shouldShowWhatsNew({ seenAccount, seenLocal, accountCreatedAt, version = WHATS_NEW_VERSION, since = WHATS_NEW_SINCE }) {
  if (seenAccount === version || seenLocal === version) return false
  const created = accountCreatedAt ? Date.parse(accountCreatedAt) : NaN
  const release = Date.parse(`${since}T00:00:00`)
  return Number.isFinite(created) && created < release
}

export function readLocalWhatsNew(uid, storage = globalThis.localStorage) {
  if (!uid || !storage) return null
  try {
    return storage.getItem(localKey(uid))
  } catch {
    return null
  }
}

export function writeLocalWhatsNew(uid, version, storage = globalThis.localStorage) {
  if (!uid) return
  try {
    storage?.setItem(localKey(uid), version)
  } catch {
    /* sin almacenamiento: queda la marca de la cuenta */
  }
}
