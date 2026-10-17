// Banderas de onboarding por USUARIO (no por dispositivo).
//
// Antes `ltb.onboarded_extras` era global: si alguien ya había terminado el
// onboarding en un dispositivo y después otra persona creaba su cuenta ahí (la
// tablet familiar, el pastor que muestra la app), el Gate veía "extras hechos" y la
// mandaba directo a Hoy, salteando el paso del recordatorio y sin aplicar el plan
// que había elegido. Ahora la clave lleva el id del usuario y se limpia al salir.

const LEGACY_KEY = 'ltb.onboarded_extras'
const PENDING_PLAN_KEY = 'ltb.pendingPlan'
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000

const keyFor = (uid) => `${LEGACY_KEY}.${uid}`

const defaultStore = () => (typeof localStorage === 'undefined' ? null : localStorage)

// Cuentas creadas hace más de 2 días: si el dispositivo trae la bandera VIEJA
// (global), se asume que fue de ellas y se migra a su clave. Una cuenta nueva
// nunca hereda la bandera de otra persona.
function isOldAccount(profile, now) {
  const created = profile?.created_at ? Date.parse(profile.created_at) : NaN
  return Number.isFinite(created) && now - created > TWO_DAYS
}

export function isExtrasDone(uid, profile, store = defaultStore(), now = Date.now()) {
  if (!uid) return false
  // La marca del servidor (migración 0035) viaja con la cuenta: otro dispositivo,
  // la app instalada en iPhone o volver a entrar tras cerrar sesión no repiten
  // el paso 3. La bandera local queda como respaldo mientras no exista.
  if (profile?.onboarded_at) return true
  if (!store) return false
  try {
    if (store.getItem(keyFor(uid)) === '1') return true
    if (store.getItem(LEGACY_KEY) === '1' && isOldAccount(profile, now)) {
      store.setItem(keyFor(uid), '1')
      return true
    }
  } catch {
    /* storage inaccesible: se vuelve a ofrecer el paso, sin romper nada */
  }
  return false
}

export function markExtrasDone(uid, store = defaultStore()) {
  if (!uid || !store) return
  try {
    store.setItem(keyFor(uid), '1')
  } catch {
    /* no crítico */
  }
}

// Al cerrar sesión: lo que pertenece a esa persona no debe quedar para la siguiente.
export function clearSessionFlags(uid, store = defaultStore()) {
  if (!store) return
  try {
    if (uid) store.removeItem(keyFor(uid))
    store.removeItem(PENDING_PLAN_KEY)
  } catch {
    /* no-op */
  }
}
