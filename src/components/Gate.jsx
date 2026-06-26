import { useState } from 'react'
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-app">
      <span className="text-[15px] text-ink-soft">Cargando…</span>
    </div>
  )
}

export default function Gate({ children }) {
  const { loading, session, profile } = useAuth()
  // Re-render al terminar los extras sin recargar.
  const [extrasDone, setExtrasDone] = useState(
    () => localStorage.getItem(EXTRAS_DONE_KEY) === '1'
  )

  if (loading) return <Splash />
  if (!session) return <AuthFlow />

  // Sesión recién creada: el trigger crea el profile; mientras llega, splash.
  if (!profile) return <Splash />

  if (!profile.display_name) return <AskName />
  if (!profile.active_plan_id) return <ChoosePlanOnboarding />
  if (!extrasDone) return <OnboardingExtras onDone={() => setExtrasDone(true)} />

  return children
}
