import { supabase } from './supabase.js'

// Web Push para el recordatorio diario (función 7). El navegador se suscribe al
// PushManager con la VAPID public key; la subscription se guarda en Supabase y la
// Edge Function `send-reminders` la usa para enviar la notificación a la hora local
// del usuario. En iOS solo funciona con la PWA instalada en la pantalla de inicio.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function isPushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// Zona horaria IANA del dispositivo (ej. "America/Argentina/Buenos_Aires").
export function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// Crea/recupera la subscription de este dispositivo y la persiste junto con la
// timezone del usuario (que el server necesita para saber cuándo es "su" hora).
async function persistSubscription(userId) {
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error
  const tz = getTimezone()
  if (tz) await supabase.from('profiles').update({ timezone: tz }).eq('id', userId)
}

// Activa el push para este dispositivo (pide permiso). Devuelve { ok, reason }.
// reason: 'unsupported' | 'no-key' | 'denied' | 'error'.
export async function subscribeToPush(userId) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-key' }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'denied' }
    await persistSubscription(userId)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

// Re-suscribe en silencio si el permiso YA fue concedido (no vuelve a pedirlo).
// Para quien activó el recordatorio en el onboarding y luego abre la PWA instalada.
export async function ensureSubscribed(userId) {
  if (!userId || !isPushSupported() || !VAPID_PUBLIC_KEY) return
  if (Notification.permission !== 'granted') return
  try {
    await persistSubscription(userId)
  } catch {
    /* best-effort: si falla, el próximo toggle en Ajustes lo reintenta */
  }
}

// Desactiva el push de este dispositivo (borra la subscription local y su fila).
export async function unsubscribeFromPush(userId) {
  if (!isPushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const { endpoint } = sub
      await sub.unsubscribe()
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
    }
  } catch {
    /* best-effort */
  }
}
