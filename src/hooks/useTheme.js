import { useEffect, useState, useCallback } from 'react'

// theme_pref: 'auto' | 'light' | 'dark'. 'auto' sigue prefers-color-scheme.
// Fase 1 persiste en localStorage; en Tarea 7 se sincroniza con profiles.theme_pref.
const STORAGE_KEY = 'ltb.theme_pref'

// Colores de fondo por modo, para mantener <meta name="theme-color"> en sync.
const THEME_COLOR = { light: '#ECEAE6', dark: '#000000' }

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveMode(pref) {
  if (pref === 'auto') return systemPrefersDark() ? 'dark' : 'light'
  return pref
}

function applyTheme(pref) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  // En 'auto' no fijamos clase: los media queries de tokens.css hacen el trabajo.
  if (pref !== 'auto') root.classList.add(pref)

  const mode = resolveMode(pref)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[mode])
}

export function useTheme() {
  const [themePref, setThemePref] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'auto'
  )

  useEffect(() => {
    applyTheme(themePref)
    localStorage.setItem(STORAGE_KEY, themePref)
  }, [themePref])

  // En 'auto', reaccionar a cambios del sistema para repintar theme-color.
  useEffect(() => {
    if (themePref !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [themePref])

  const setTheme = useCallback((pref) => setThemePref(pref), [])

  return { themePref, setTheme, resolvedMode: resolveMode(themePref) }
}
