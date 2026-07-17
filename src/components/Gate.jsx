import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import LaunchReady from './LaunchReady.jsx'
import AuthFlow from '../screens/onboarding/AuthFlow.jsx'
import AskName from '../screens/onboarding/AskName.jsx'
import ChoosePlanOnboarding from '../screens/onboarding/ChoosePlanOnboarding.jsx'
import OnboardingExtras, { EXTRAS_DONE_KEY } from '../screens/onboarding/OnboardingExtras.jsx'

// Decide qué mostrar según el estado de auth + perfil (documento maestro §5.8):
//   sin sesión            → bienvenida + magic link
//   sin display_name      → ¿Cómo te llamás?
//   onboarding nuevo      → elegir plan personal o continuar hacia un grupo
//   sin extras hechos      → recordatorio + agregar a inicio (una vez)
//   listo                 → la app (children)
// Hay sesión pero no se pudo cargar el perfil y no hay copia en caché (típico:
// primer arranque sin conexión). Ofrece reintentar en vez de colgarse.
function LoadError({ onRetry }) {
  const { t } = usePreferences()
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
        {t('gate.loadError')}
      </p>
      <button
        onClick={retry}
        disabled={retrying}
        className="btn btn-secondary disabled:opacity-50"
      >
        {retrying ? t('common.retrying') : t('common.retry')}
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
  // Permite atravesar el paso 2 sin plan personal para adoptar luego el de un
  // grupo. Al completar extras, EXTRAS_DONE_KEY conserva que el onboarding ya
  // terminó; antes de eso, una recarga vuelve a ofrecer la elección.
  const [planStepDone, setPlanStepDone] = useState(false)

  if (loading) return null
  if (!session) return <LaunchReady><AuthFlow /></LaunchReady>

  // Hay sesión pero el perfil no cargó ni hay caché: reintento, no cuelgue.
  if (profileError) return <LaunchReady><LoadError onRetry={refreshProfile} /></LaunchReady>

  // Sesión recién creada: el trigger crea el profile; mientras llega, splash.
  if (!profile) return null

  if (!profile.display_name) return <LaunchReady><AskName /></LaunchReady>
  if (!profile.active_plan_id && !extrasDone && !planStepDone) {
    return (
      <LaunchReady>
        <ChoosePlanOnboarding onSkip={() => setPlanStepDone(true)} />
      </LaunchReady>
    )
  }
  if (!extrasDone) return <LaunchReady><OnboardingExtras onDone={() => setExtrasDone(true)} /></LaunchReady>

  return <LaunchReady>{children}</LaunchReady>
}
