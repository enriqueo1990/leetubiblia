import { createContext, useContext } from 'react'
import { useTheme } from '../hooks/useTheme.js'
import { useAccent } from '../hooks/useAccent.js'

// Contexto de preferencias visuales (tema + acento). Aplica al DOM vía los hooks
// (localStorage para arranque instantáneo y uso sin sesión). En Tarea 7 se
// sincroniza con profiles: ProfilePrefSync empuja el valor del perfil al cargar,
// y Ajustes persiste los cambios en profiles.accent_color / theme_pref.
const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const theme = useTheme()
  const accent = useAccent()
  return (
    <PreferencesContext.Provider value={{ ...theme, ...accent }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences debe usarse dentro de <PreferencesProvider>')
  return ctx
}
