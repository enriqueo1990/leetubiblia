import es from './es.json'
import en from './en.json'
import pt from './pt.json'

// Catálogos planos por idioma. `es` es la fuente de verdad; `en`/`pt` son
// borradores revisables. Sin librería externa: la app ya tiene su propio patrón
// de preferencias (useTheme/useAccent) y esto lo sigue.
const CATALOGS = { es, en, pt }

export const SUPPORTED_LOCALES = ['es', 'en', 'pt']
export const FALLBACK_LOCALE = 'es'

// Interpolación de {params} y plurales ICU mínimos. Una clave con plural se
// guarda como objeto { one, other } y se elige con el param `count`.
//   translate('es', 'hoy.diasLeidos', { count: 3 }) → "3 días leídos"
export function translate(locale, key, params) {
  const catalog = CATALOGS[locale] || CATALOGS[FALLBACK_LOCALE]
  let value = catalog[key]
  // Fallback a español si la clave no existe todavía en el idioma pedido.
  if (value === undefined) value = CATALOGS[FALLBACK_LOCALE][key]
  if (value === undefined) return key // clave sin traducir: se ve, se corrige.

  if (value && typeof value === 'object') {
    const count = params?.count
    const form = count === 1 ? 'one' : 'other'
    value = value[form] ?? value.other ?? value.one ?? key
  }

  if (params) {
    value = value.replace(/\{(\w+)\}/g, (m, name) =>
      params[name] !== undefined ? String(params[name]) : m
    )
  }
  return value
}
