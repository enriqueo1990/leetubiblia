import { useEffect } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'

// Al cargar (o cambiar) el perfil, aplica sus preferencias guardadas al DOM.
// profiles es la fuente de verdad entre dispositivos; localStorage es solo el
// arranque local. No genera bucles: Ajustes ya deja local y perfil en el mismo
// valor, así que este efecto queda en no-op tras un cambio del usuario.
export default function ProfilePrefSync() {
  const { profile } = useAuth()
  const { accent, setAccent, themePref, setTheme } = usePreferences()

  useEffect(() => {
    if (!profile) return
    if (profile.accent_color && profile.accent_color !== accent) {
      setAccent(profile.accent_color)
    }
    if (profile.theme_pref && profile.theme_pref !== themePref) {
      setTheme(profile.theme_pref)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.accent_color, profile?.theme_pref])

  return null
}
