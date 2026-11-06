// Medición de las páginas públicas (/info, /lideres, /biblioteca, /ayuda, /privacidad):
//   landing_view  → se abrió la página (una vez por dispositivo y página)
//   landing_cta   → se tocó «Empezar gratis» / «Entrar» (con la ubicación del botón)
// Eventos de la migración 0039, en la misma tabla que el embudo (boot_diagnostics).
//
// Sin datos personales: solo la página (`from`), la ubicación del botón (`where`) y
// el identificador anónimo del navegador que ya usa el embudo (ltb.diag.device).
// Sin cookies ni analítica de terceros.
//
// Cómo viaja: un POST directo a la API REST de Supabase con la clave pública, y NO
// por lib/diag.js ni por supabase-js. Las landings no cargan el cliente de Supabase
// (≈53 KB gz) y esto no debe cambiarlo; el POST pesa unos bytes, es fire-and-forget
// y nunca bloquea el render (se llama desde efectos, tras hidratar).
//
// Si la base todavía no conoce los eventos (migración sin aplicar) la API contesta
// 4xx: se anota en el dispositivo y no se vuelve a intentar durante OFF_MS, así que
// no hay reintentos ni ruido (el aviso de red del navegador se ve a lo sumo una vez).
// Nada de esto lanza nunca: cualquier fallo se ignora.

import { deviceId } from './diag.js'

export const LANDING_PAGES = ['info', 'lideres', 'biblioteca', 'ayuda', 'privacidad']

const SEEN_KEY = 'ltb.diag.landings' // páginas cuya apertura ya se registró en este dispositivo
const OFF_KEY = 'ltb.diag.landingOff' // hasta cuándo no insistir (el servidor rechazó los eventos)
export const OFF_MS = 6 * 60 * 60 * 1000

const isPage = (page) => LANDING_PAGES.includes(page)

// ¿Es la primera vez que este dispositivo abre `page`? Si lo es, la marca queda
// guardada. Sin localStorage (modo privado estricto) cuenta cada vez: es lo mismo
// que hace el embudo y no es grave.
export function markLandingSeen(page, store) {
  try {
    const seen = JSON.parse(store.getItem(SEEN_KEY) || '[]')
    const list = Array.isArray(seen) ? seen : []
    if (list.includes(page)) return false
    store.setItem(SEEN_KEY, JSON.stringify([...list, page]))
    return true
  } catch {
    return true
  }
}

export function isSendingPaused(store, now = Date.now()) {
  try {
    return now < Number(store.getItem(OFF_KEY) || 0)
  } catch {
    return false
  }
}

function pauseSending(store, now = Date.now()) {
  try {
    store.setItem(OFF_KEY, String(now + OFF_MS))
  } catch {
    /* no-op */
  }
}

// Fila tal como la espera boot_diagnostics (mismo contrato que lib/diag.js: el id
// del dispositivo y la marca de tiempo viajan dentro de `detail`).
export function buildLandingRow(event, detail, { device, standalone, userAgent, now }) {
  return {
    user_id: null,
    event,
    detail: { ...detail, device, ts: now },
    standalone: Boolean(standalone),
    user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
  }
}

function browserDeps() {
  return {
    fetch: (...args) => globalThis.fetch(...args),
    store: window.localStorage,
    now: Date.now(),
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_ANON_KEY,
    // En desarrollo no se escribe en la base real: los eventos quedan en
    // window.__ltbLanding, para poder comprobarlos sin tocar nada.
    dev: Boolean(import.meta.env.DEV),
    device: deviceId(),
    standalone:
      window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
    userAgent: navigator.userAgent,
    sink: (row) => {
      window.__ltbLanding = [...(window.__ltbLanding || []), row]
    },
  }
}

// `deps` solo se pasa en las pruebas.
export function sendLandingEvent(event, detail, deps) {
  try {
    const d = deps || browserDeps()
    const row = buildLandingRow(event, detail, d)
    if (d.dev) {
      d.sink?.(row)
      return Promise.resolve(false)
    }
    if (!d.url || !d.key || isSendingPaused(d.store, d.now)) return Promise.resolve(false)

    // Con la clave "publishable" (no es un JWT) solo va `apikey`; con la anon clásica, también Bearer.
    const headers = { apikey: d.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
    if (d.key.startsWith('eyJ')) headers.Authorization = `Bearer ${d.key}`

    return Promise.resolve(
      d.fetch(`${d.url}/rest/v1/boot_diagnostics`, {
        method: 'POST',
        headers,
        body: JSON.stringify(row),
        keepalive: true, // sale aunque la persona ya esté navegando a otra página
      })
    )
      .then((res) => {
        if (res && res.status >= 400 && res.status < 500) {
          pauseSending(d.store, d.now)
          return false
        }
        return Boolean(res?.ok)
      })
      .catch(() => false)
  } catch {
    return Promise.resolve(false)
  }
}

// Apertura de una landing. Se llama desde un efecto (tras hidratar). No cuenta a
// quien ya usa la app instalada ni a quien llegó desde adentro de la app (Ajustes ›
// Guía): no son visitas de una landing sino de gente que ya la tiene.
export function recordLandingView(page, { fromApp = false } = {}, deps) {
  try {
    if (!isPage(page) || fromApp) return Promise.resolve(false)
    const d = deps || browserDeps()
    if (d.standalone) return Promise.resolve(false)
    if (!markLandingSeen(page, d.store)) return Promise.resolve(false)
    return sendLandingEvent('landing_view', { from: page }, d)
  } catch {
    return Promise.resolve(false)
  }
}

// Toque en un botón de entrada. `where`: header, menu, hero, cierre, pie, … (texto
// corto y fijo, nunca algo que escriba la persona).
export function recordLandingCta(page, where, deps) {
  try {
    if (!isPage(page)) return Promise.resolve(false)
    return sendLandingEvent('landing_cta', { from: page, where: String(where || '').slice(0, 32) }, deps)
  } catch {
    return Promise.resolve(false)
  }
}
