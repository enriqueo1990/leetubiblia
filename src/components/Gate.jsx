import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth.jsx'
import AuthFlow from '../screens/onboarding/AuthFlow.jsx'
import AskName from '../screens/onboarding/AskName.jsx'
import ChoosePlanOnboarding from '../screens/onboarding/ChoosePlanOnboarding.jsx'
import OnboardingExtras, { EXTRAS_DONE_KEY } from '../screens/onboarding/OnboardingExtras.jsx'

// Decide qué mostrar según el estado de auth + perfil (documento maestro §5.8):
//   sin sesión            → bienvenida + magic link
//   sin display_name      → ¿Cómo te llamás?
//   sin active_plan_id    → elegir plan
//   sin extras hechos      → recordatorio + agregar a inicio (una vez)
//   listo                 → la app (children)
function Splash() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-7 bg-app">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="80" height="80">
        <rect width="64" height="64" rx="14" fill="#A88B6A"/>
        <g fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z"/>
          <path d="M32 20v28"/>
        </g>
      </svg>
      <div className="flex flex-col items-center gap-1.5 px-10 text-center">
        <p className="text-[14px] italic leading-relaxed text-ink-soft">
          Santifícalos en la verdad;<br />Tu palabra es verdad.
        </p>
        <span className="text-[12px] text-placeholder">Juan 17:17 · NBLA</span>
      </div>
    </div>
  )
}

// Hay sesión pero no se pudo cargar el perfil y no hay copia en caché (típico:
// primer arranque sin conexión). Ofrece reintentar en vez de colgarse.
function LoadError({ onRetry }) {
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-app px-8 text-center">
      <p className="max-w-[280px] text-[15px] text-ink-soft">
        No pudimos cargar tu perfil. Revisá tu conexión y volvé a intentar.
      </p>
      <button
        onClick={retry}
        disabled={retrying}
        className="btn btn-secondary disabled:opacity-50"
      >
        {retrying ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  )
}

export default function Gate({ children }) {
  const { loading, session, profile, profileError, refreshProfile } = useAuth()
  // Re-render al terminar los extras sin recargar.
  const [extrasDone, setExtrasDone] = useState(
    () => localStorage.getItem(EXTRAS_DONE_KEY) === '1'
  )

  if (loading) return <Splash />
  if (!session) return <AuthFlow />

  // Hay sesión pero el perfil no cargó ni hay caché: reintento, no cuelgue.
  if (profileError) return <LoadError onRetry={refreshProfile} />

  // Sesión recién creada: el trigger crea el profile; mientras llega, splash.
  if (!profile) return <Splash />

  if (!profile.display_name) return <AskName />
  if (!profile.active_plan_id) return <ChoosePlanOnboarding />
  if (!extrasDone) return <OnboardingExtras onDone={() => setExtrasDone(true)} />

  return children
}
