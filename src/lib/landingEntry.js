// Cómo se llega a la app desde las páginas públicas (/info, /lideres, /ayuda,
// /privacidad). Los botones «Empezar gratis» / «Entrar» apuntan a `/?from=<página>`:
//   - `from` se suma al embudo (ob_welcome) para saber qué página convierte;
//   - quien viene de /info, /lideres o /ayuda ya decidió empezar: se salta la
//     bienvenida genérica y se va al siguiente paso útil (ver initialAuthStep);
//   - `intent=lider` (o venir de /lideres) guarda que la persona quiere crear un
//     grupo: al terminar el alta, la app la lleva a Grupos con la hoja de crear
//     abierta en lugar de dejarla en Hoy.
// Todo acá es lógica pura (sin window ni React) para poder probarla.

export const LANDING_FROMS = ['info', 'lideres', 'ayuda', 'privacidad']
// Desde estas se salta la bienvenida (privacidad es un documento: ahí la gente
// viene a leer, no a decidir, y ve la bienvenida normal).
const SKIP_WELCOME_FROM = ['info', 'lideres', 'ayuda']

export function parseLandingEntry(search) {
  let params
  try {
    params = new URLSearchParams(search || '')
  } catch {
    params = new URLSearchParams('')
  }
  const rawFrom = params.get('from')
  const from = LANDING_FROMS.includes(rawFrom) ? rawFrom : null
  const leader = params.get('intent') === 'lider' || from === 'lideres'
  return {
    from,
    leader,
    // «Entrar» (ya tengo cuenta): `login=1` lleva directo al formulario de ingreso.
    login: params.get('login') === '1',
  }
}

// Primer paso de AuthFlow. Los pasos son los de siempre: 'welcome' | 'install' |
// 'explore' | 'form' | 'code'.
//  - Un código pendiente (se recargó mientras buscaba el correo) vuelve a 'code'.
//  - Invitación a un grupo (/join?code): bienvenida, que ya muestra el grupo.
//  - Sesión vencida: bienvenida («Ingresá» es el botón grande).
//  - Desde una landing: mismo orden que startOnboarding —iPhone en el navegador
//    instala primero; el resto explora los planes— o, con `login=1`, el ingreso.
export function initialAuthStep({ restored, inviteCode, sessionExpired, entry, iosBrowser }) {
  if (restored) return 'code'
  if (inviteCode || sessionExpired) return 'welcome'
  if (!entry?.from || !SKIP_WELCOME_FROM.includes(entry.from)) return 'welcome'
  if (entry.login) return 'form'
  return iosBrowser ? 'install' : 'explore'
}

// Modo del formulario cuando se llegó a él saltando la bienvenida con «Entrar».
export const initialMode = (step, entry) => (step === 'form' && entry?.login ? 'login' : 'signup')

// ── Intención de líder ───────────────────────────────────────────────────────
const LEADER_KEY = 'ltb.leaderIntent'
const LEADER_TTL = 3 * 24 * 60 * 60 * 1000 // si no terminó el alta en 3 días, ya no cuenta

export function saveLeaderIntent(store, now = Date.now()) {
  try {
    store.setItem(LEADER_KEY, String(now))
    return true
  } catch {
    return false
  }
}

export function hasLeaderIntent(store, now = Date.now()) {
  try {
    const at = Number(store.getItem(LEADER_KEY))
    return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at <= LEADER_TTL
  } catch {
    return false
  }
}

export function clearLeaderIntent(store) {
  try {
    store.removeItem(LEADER_KEY)
  } catch {
    /* no-op */
  }
}
