import { createContext, useContext } from 'react'
import { useTheme } from '../hooks/useTheme.js'
import { useAccent } from '../hooks/useAccent.js'
import { useLocale } from '../hooks/useLocale.js'

// Contexto de preferencias (tema + acento + idioma). Aplica al DOM vía los hooks
// (localStorage para arranque instantáneo y uso sin sesión). Se sincroniza con
// profiles: ProfilePrefSync empuja el valor del perfil al cargar, y Ajustes
// persiste los cambios en profiles.accent_color / theme_pref / locale.
const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const theme = useTheme()
  const accent = useAccent()
  const locale = useLocale()
  return (
    <PreferencesContext.Provider value={{ ...theme, ...accent, ...locale }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences debe usarse dentro de <PreferencesProvider>')
  return ctx
}
