// Formateo de fechas por idioma. Antes cada pantalla tenía su propio
// toLocaleDateString('es-ES', …) con el locale quemado; esto lo centraliza.
const INTL_LOCALE = { es: 'es-ES', en: 'en-US', pt: 'pt-BR' }

function intlLocale(locale) {
  return INTL_LOCALE[locale] || INTL_LOCALE.es
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

// "27 jun" (es) · "Jun 27" (en) · "27 de jun" (pt). Día + mes abreviado.
export function fmtDayMonth(value, locale) {
  return toDate(value).toLocaleDateString(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
  })
}

// "sáb, 27 jun" — con día de la semana abreviado.
export function fmtWeekdayDayMonth(value, locale) {
  return toDate(value).toLocaleDateString(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// "27 de junio de 2025" — fecha larga.
export function fmtLong(value, locale) {
  return toDate(value).toLocaleDateString(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Capitaliza la primera letra (varios locales devuelven el mes en minúscula).
export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// Genérico: pasa tus propias opciones de Intl y el locale de la app.
export function fmtDate(value, locale, options) {
  return toDate(value).toLocaleDateString(intlLocale(locale), options)
}

// Formatea una fecha 'YYYY-MM-DD' interpretándola en UTC (evita el desfase de
// zona horaria que correría el día). Devuelve null si el ISO es vacío.
export function fmtISODate(iso, locale, options) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intlLocale(locale), {
    ...options,
    timeZone: 'UTC',
  })
}
