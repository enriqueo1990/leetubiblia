import { supabase } from './supabase.js'

// Captura ligera de presencia para el panel admin (/admin). Escribe estado
// por-usuario en su propia fila de profiles (RLS own-profile), sin crecer en
// filas y sin datos sensibles:
//   country         : ISO-2, de Cloudflare /cdn-cgi/trace (sin IP ni permisos).
//   last_seen_at    : marca de arranque con sesión (activos 7/30 días).
//   platform        : ios | android | desktop (del user agent).
//   standalone_seen : true la primera vez que abre la app instalada.
//
// Todo best-effort y diferido: nunca debe romper ni frenar el arranque. En
// localhost /cdn-cgi/trace no existe, así que el país queda sin tocar.

const STAMP_KEY = 'ltb.presence.day' // escritura diaria (last_seen/country/platform)
const SEEN_KEY = 'ltb.presence.standalone' // marca única de "abrió instalada"

function isStandalone() {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true // iOS Safari
    )
  } catch {
    return false
  }
}

function detectPlatform() {
  const ua = navigator.userAgent || ''
  // iPadOS moderno se hace pasar por Mac: se delata por el touch.
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOS) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

async function fetchCountry() {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const res = await fetch('/cdn-cgi/trace', { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const text = await res.text()
    const line = text.split('\n').find((l) => l.startsWith('loc='))
    const code = line?.slice(4).trim().toUpperCase()
    return code && /^[A-Z]{2}$/.test(code) ? code : null
  } catch {
    return null
  }
}

// Registra presencia del usuario logueado. Se llama diferido tras montar la app.
export async function recordPresence() {
  let userId = null
  try {
    const { data } = await supabase.auth.getSession()
    userId = data?.session?.user?.id ?? null
  } catch {
    /* sin sesión: nada que registrar */
  }
  if (!userId) return

  const today = new Date().toISOString().slice(0, 10)
  const standalone = isStandalone()

  // Dos disparadores independientes: el diario (una vez por día natural) y el
  // de instalación (una sola vez por dispositivo, la primera vez standalone).
  let dailyDue = true
  let seenDue = standalone
  try {
    dailyDue = localStorage.getItem(STAMP_KEY) !== today
    seenDue = standalone && localStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    /* sin localStorage: escribimos igual, no es crítico */
  }
  if (!dailyDue && !seenDue) return

  const patch = {}
  if (dailyDue) {
    patch.last_seen_at = new Date().toISOString()
    patch.platform = detectPlatform()
    const country = await fetchCountry()
    if (country) patch.country = country
  }
  if (seenDue) patch.standalone_seen = true

  try {
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) throw error
    try {
      if (dailyDue) localStorage.setItem(STAMP_KEY, today)
      if (seenDue) localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* no-op */
    }
  } catch {
    /* red/RLS: reintentamos el próximo arranque */
  }
}
