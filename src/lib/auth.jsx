import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'

// Contexto de autenticación. Expone la sesión, el perfil del usuario y las
// acciones de auth (magic link, sign out). El onboarding decide qué pantalla
// mostrar según session + profile (ver src/components/Gate.jsx).
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Trae (o refresca) la fila de profiles del usuario logueado.
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('[auth] error cargando profile:', error.message)
      return
    }
    setProfile(data ?? null)
  }, [])

  useEffect(() => {
    let active = true

    // Sesión inicial (incluye la que llega por el magic link vía detectSessionInUrl).
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })

    // Cambios de sesión (login por link, logout, refresh de token).
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess)
      await loadProfile(sess?.user?.id)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Magic link: envía el enlace de acceso al email (sin contraseña).
  const signInWithEmail = useCallback(async (email) => {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  // Actualiza campos del perfil y refresca el estado local.
  const updateProfile = useCallback(
    async (patch) => {
      if (!session?.user?.id) return { error: new Error('Sin sesión') }
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select()
        .single()
      if (!error) setProfile(data)
      return { data, error }
    },
    [session]
  )

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithEmail,
    signOut,
    updateProfile,
    refreshProfile: () => loadProfile(session?.user?.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
