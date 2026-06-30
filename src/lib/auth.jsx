import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'
import { recordDiag } from './diag.js'

// Contexto de autenticación. Expone la sesión, el perfil del usuario y las
// acciones de auth (magic link, sign out). El onboarding decide qué pantalla
// mostrar según session + profile (ver src/components/Gate.jsx).
const AuthContext = createContext(null)

// Caché del perfil en localStorage, por usuario. Permite abrir la PWA sin conexión
// (o ante un fallo transitorio de red/RLS) sin colgarse esperando al servidor.
const profileCacheKey = (uid) => `ltb.profile.${uid}`

function readCachedProfile(uid) {
  try {
    return JSON.parse(localStorage.getItem(profileCacheKey(uid)) || 'null')
  } catch {
    return null
  }
}
function writeCachedProfile(uid, p) {
  try {
    if (p) localStorage.setItem(profileCacheKey(uid), JSON.stringify(p))
  } catch {
    /* cuota llena: no es crítico */
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // true cuando hay sesión pero no pudimos cargar el perfil y tampoco hay caché:
  // el Gate ofrece reintentar en vez de quedarse en "Cargando…" para siempre.
  const [profileError, setProfileError] = useState(false)

  // Trae (o refresca) la fila de profiles del usuario logueado. Nunca lanza:
  // ante fallo de red/RLS cae a la caché local y, si no hay, marca profileError.
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setProfileError(false)
      return
    }
    try {
      // Timeout de 5 s: en primera apertura PWA el SW puede demorar requests de
      // red mientras precachea. Sin timeout el promise cuelga indefinidamente y la
      // app queda en "Cargando…" aunque el backstop de 6 s ya bajó loading a false.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      let queryResult
      try {
        queryResult = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .abortSignal(controller.signal)
          .maybeSingle()
      } finally {
        clearTimeout(timeoutId)
      }
      const { data, error } = queryResult
      if (error) throw error
      setProfile(data ?? null)
      setProfileError(false)
      if (data) writeCachedProfile(userId, data)
    } catch (e) {
      // Sin conexión, timeout o error transitorio: usar la última copia conocida.
      const cached = readCachedProfile(userId)
      if (cached) {
        setProfile(cached)
        setProfileError(false)
      } else {
        setProfileError(true)
      }
      console.error('[auth] error cargando profile:', e?.message || e)
    }
  }, [])

  useEffect(() => {
    let active = true
    let settled = false
    const finishLoading = () => {
      if (active && !settled) {
        settled = true
        setLoading(false)
      }
    }
    // Backstop: si getSession se cuelga (red), no quedarse en "Cargando…".
    // Telemetría temporal: marcamos si el backstop tuvo que disparar (getSession
    // no resolvió en 6 s → sospechoso del lock de navigator.locks en iOS PWA).
    const timer = setTimeout(() => {
      recordDiag('getsession_slow', { resolved: false, waitedMs: 6000 })
      finishLoading()
    }, 6000)

    // Sesión inicial (incluye la que llega por el magic link vía detectSessionInUrl).
    const getSessionStart = Date.now()
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        // Si tardó más de 3 s en resolver, dejamos rastro (degradado, no colgado).
        const elapsed = Date.now() - getSessionStart
        if (elapsed > 3000) recordDiag('getsession_slow', { resolved: true, elapsedMs: elapsed })
        if (!active) return
        let sess = data.session

        // En localhost: auto-login con cuenta de prueba si no hay sesión activa.
        // Requiere VITE_DEV_EMAIL y VITE_DEV_PASSWORD en .env.local.
        if (
          import.meta.env.DEV &&
          !sess &&
          import.meta.env.VITE_DEV_EMAIL &&
          import.meta.env.VITE_DEV_PASSWORD
        ) {
          const { data: d } = await supabase.auth.signInWithPassword({
            email: import.meta.env.VITE_DEV_EMAIL,
            password: import.meta.env.VITE_DEV_PASSWORD,
          })
          sess = d?.session ?? null
        }

        setSession(sess)
        await loadProfile(sess?.user?.id)
      })
      .catch((e) => console.error('[auth] getSession falló:', e?.message || e))
      .finally(() => {
        clearTimeout(timer)
        finishLoading()
      })

    // Cambios de sesión (login por link, logout, refresh de token).
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!active) return
      setSession(sess)
      await loadProfile(sess?.user?.id)
    })

    return () => {
      active = false
      clearTimeout(timer)
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Hay sesión pero el perfil aún no existe (no es error de red: la fila todavía
  // no fue creada por el trigger de alta, típico en la 1ª apertura tras registrarse).
  // Reintentamos en vez de dejar al Gate en el splash para siempre (ver Gate.jsx).
  useEffect(() => {
    if (!session?.user?.id || profile || profileError) return
    let n = 0
    // Telemetría temporal: este camino solía colgar el Gate en el splash.
    recordDiag('profile_retry', { reason: 'session sin profile al montar' })
    const t = setInterval(() => {
      n += 1
      loadProfile(session.user.id)
      if (n >= 5) clearInterval(t) // ~10 s de reintentos; luego paramos
    }, 2000)
    return () => clearInterval(t)
  }, [session, profile, profileError, loadProfile])

  // Envía un código de 6 dígitos al email (sin contraseña). Se usa OTP por código
  // en vez de magic link porque el link abre el navegador y no la PWA instalada,
  // dejando la sesión fuera de la app. El código se ingresa dentro de la PWA.
  // createIfMissing=false (modo "ingresar"): si el correo no tiene cuenta, NO la
  // crea en silencio (un typo no genera una cuenta fantasma); Supabase devuelve error.
  const signInWithEmail = useCallback(async (email, { createIfMissing = true } = {}) => {
    return supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: createIfMissing },
    })
  }, [])

  // Verifica el código de 6 dígitos e inicia sesión. onAuthStateChange hace el resto.
  const verifyEmailCode = useCallback(async (email, token) => {
    return supabase.auth.verifyOtp({ email, token, type: 'email' })
  }, [])

  const signOut = useCallback(async () => {
    const uid = session?.user?.id
    await supabase.auth.signOut()
    if (uid) {
      try {
        localStorage.removeItem(profileCacheKey(uid))
      } catch {
        /* no-op */
      }
    }
    setProfile(null)
    setProfileError(false)
  }, [session])

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
      if (!error) {
        setProfile(data)
        writeCachedProfile(session.user.id, data)
      }
      return { data, error }
    },
    [session]
  )

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileError,
    signInWithEmail,
    verifyEmailCode,
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
