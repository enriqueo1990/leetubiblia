// Datos de contacto y apoyo del desarrollador, en un solo lugar (Ajustes ›
// "Quién hace la app", Privacidad › Contacto). Si cambia un link, cambia acá.

export const DEVELOPER_NAME = 'Enrique Oriolo'
export const CONTACT_EMAIL = 'enrique.o1990@gmail.com'
export const MISSION_URL =
  'https://dentonbible.org/missions/view-detail/smallgroup/oriolo-enrique-and-tamara/'

// key → clave i18n `ajustes.donar*` ya existente.
export const DONATE_LINKS = [
  { key: 'donarPaypal', url: 'https://www.paypal.com/paypalme/EnriqueOriolo' },
  { key: 'donarMPunica', url: 'https://link.mercadopago.com.ar/enriqueoriolo' },
  { key: 'donarMPmensual', url: 'https://mpago.la/1EEJDnZ' },
]

// Contexto que viaja con una sugerencia o reporte: lo mínimo para reproducir
// (versión + dispositivo), nunca datos personales.
export function feedbackContext(appVersion, locale) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const platform = /iphone|ipad|ipod/i.test(ua)
    ? 'ios'
    : /android/i.test(ua)
      ? 'android'
      : 'desktop'
  let standalone = false
  try {
    standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
  } catch {
    /* sin matchMedia: queda false */
  }
  return { app_version: appVersion, locale, platform, standalone, user_agent: ua.slice(0, 300) }
}

// mailto de respaldo cuando el envío a Supabase falla (sin red, migración no
// aplicada…). El contexto va en el cuerpo para no perder la pista.
export function feedbackMailto(subject, body, ctx) {
  const lines = [body, '', '—', `Lee Tu Biblia ${ctx.app_version} · ${ctx.platform} · ${ctx.standalone ? 'app instalada' : 'navegador'}`]
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
}
