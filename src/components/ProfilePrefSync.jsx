import { useEffect } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { ensureSubscribed } from '../lib/push.js'

// Al cargar (o cambiar) el perfil, aplica sus preferencias guardadas al DOM.
// profiles es la fuente de verdad entre dispositivos; localStorage es solo el
// arranque local. No genera bucles: Ajustes ya deja local y perfil en el mismo
// valor, así que este efecto queda en no-op tras un cambio del usuario.
export default function ProfilePrefSync() {
  const { profile, user, updateProfile } = useAuth()
  const { accent, setAccent, themePref, setTheme, locale, setLocale } = usePreferences()

  useEffect(() => {
    if (!profile) return
    if (profile.accent_color && profile.accent_color !== accent) {
      setAccent(profile.accent_color)
    }
    if (profile.theme_pref && profile.theme_pref !== themePref) {
      setTheme(profile.theme_pref)
    }
    // Idioma: si el perfil ya tiene uno elegido, manda (fuente de verdad entre
    // dispositivos). Si NO (usuario nuevo, locale null), sembramos el que detectó
    // el cliente del dispositivo —navigator.language vía useLocale— en vez de
    // pisarlo con un default. Queda no-op tras el primer guardado.
    if (profile.locale) {
      if (profile.locale !== locale) setLocale(profile.locale)
    } else {
      updateProfile({ locale })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.accent_color, profile?.theme_pref, profile?.locale])

  // Si el recordatorio está activo y el permiso ya fue concedido, asegura que
  // este dispositivo tenga su subscription Web Push (re-suscribe en silencio).
  useEffect(() => {
    if (profile?.reminder_enabled && user?.id) {
      ensureSubscribed(user.id)
    }
  }, [profile?.reminder_enabled, user?.id])

  return null
}
