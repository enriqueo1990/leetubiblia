import { usePreferences } from '../lib/preferences.jsx'
import BrandMark from './BrandMark.jsx'

// Pantalla puente del arranque con sesión (Gate): entre «Entrar» y Hoy hay
// momentos en que todavía no hay perfil o se está aplicando el plan elegido, y el
// splash ya se retiró. Sin esto se ve solo el color de fondo, sin saber si la app
// sigue viva. Mientras el splash estático sigue en pantalla (arranque en frío,
// window.__ltbAppReady aún sin marcar) no pinta nada: lo tapa el splash.
export default function Preparing() {
  const { t } = usePreferences()
  if (typeof window === 'undefined' || window.__ltbAppReady !== true) return null
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col items-center justify-center px-7 text-center">
      <BrandMark size={88} />
      <p className="mt-6 text-[15px] text-ink-soft" role="status">
        {t('onboarding.extras.finishing')}
      </p>
    </div>
  )
}
