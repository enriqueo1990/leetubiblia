import { useEffect, useState, useCallback, useMemo } from 'react'
import { translate, SUPPORTED_LOCALES, FALLBACK_LOCALE } from '../i18n/index.js'

// Idiomas disponibles. El `label` es el nombre nativo (no se traduce) y alimenta
// el selector de Ajustes, igual que ACCENTS alimenta el de acentos.
export const LOCALES = [
  { key: 'es', label: 'Español' },
  { key: 'en', label: 'English' },
  { key: 'pt', label: 'Português' },
]

const STORAGE_KEY = 'ltb.locale'

// Primera visita sin preferencia guardada: intentamos el idioma del navegador,
// restringido a los soportados; si no, español.
function detectDefault() {
  const nav = (navigator.language || '').slice(0, 2).toLowerCase()
  return SUPPORTED_LOCALES.includes(nav) ? nav : FALLBACK_LOCALE
}

function applyLocale(locale) {
  document.documentElement.lang = locale
}

export function useLocale() {
  const [locale, setLocaleState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || detectDefault()
  )

  useEffect(() => {
    applyLocale(locale)
    localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  const setLocale = useCallback((key) => {
    if (SUPPORTED_LOCALES.includes(key)) setLocaleState(key)
  }, [])

  // `t` cambia de identidad al cambiar el idioma, para que los componentes que lo
  // usan se vuelvan a renderizar con las nuevas cadenas.
  const t = useMemo(() => (key, params) => translate(locale, key, params), [locale])

  return { locale, setLocale, locales: LOCALES, t }
}
