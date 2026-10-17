import { isPushSupported } from './push.js'
import { isIOSBrowser } from './platform.js'

// Estado de la oferta del recordatorio en Hoy (ver components/ReminderOffer.jsx).

const dismissKey = (uid) => `ltb.reminderOffer.dismissed.${uid}`

export function wasReminderOfferDismissed(uid) {
  if (!uid) return true
  try {
    return localStorage.getItem(dismissKey(uid)) === '1'
  } catch {
    return false
  }
}

// ¿Tiene sentido ofrecerlo en este dispositivo? En el navegador del iPhone el
// push no existe (ahí se ofrece instalar la app, ver la tarjeta de Hoy).
export function canOfferReminder(profile) {
  return Boolean(profile) && !profile.reminder_enabled && isPushSupported() && !isIOSBrowser()
}

export function dismissReminderOffer(uid) {
  if (!uid) return
  try {
    localStorage.setItem(dismissKey(uid), '1')
  } catch {
    /* queda descartada en esta sesión */
  }
}
