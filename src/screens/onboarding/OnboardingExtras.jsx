import { useEffect, useRef } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { markExtrasDone } from '../../lib/sessionFlags.js'
import { recordFunnel } from '../../lib/diag.js'
import { isIOSBrowser } from '../../lib/platform.js'
import { ShareIcon } from '../../components/icons.jsx'

// Cierre del onboarding (documento maestro §5.8). Se marca una sola vez por
// cuenta (profiles.onboarded_at, con respaldo local en lib/sessionFlags.js) y
// después aterriza en Hoy.
//
// El recordatorio ya no se pide acá: se ofrece en Hoy después de la primera
// lectura marcada (components/ReminderOffer.jsx), con la hora real de lectura.
// Por eso este paso solo tiene pantalla en el navegador del iPhone, para
// explicar cómo instalar la app (sin ella no hay recordatorio ni lectura sin
// conexión). En cualquier otro caso se completa solo, sin mostrar nada.

export default function OnboardingExtras({ onDone }) {
  const { updateProfile, user, profile } = useAuth()
  const { t } = usePreferences()
  const showAddToHome = isIOSBrowser()
  const finished = useRef(false)

  function finish() {
    if (finished.current) return
    finished.current = true
    markExtrasDone(user?.id)
    recordFunnel('ob_extras_done', { ios_browser: showAddToHome })
    // Marca de la cuenta: no bloquea; si falla queda la bandera local.
    updateProfile({ onboarded_at: new Date().toISOString() }).catch(() => {})
    onDone?.()
  }

  useEffect(() => {
    if (!showAddToHome) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!showAddToHome) return null

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10">
      <div className="flex-1">
        <h1 className="text-[24px] font-bold tracking-tight text-ink">{t('onboarding.extras.title')}</h1>
        <p className="mt-2 text-[16px] text-ink-soft">{t('onboarding.extras.subtitleIOS')}</p>

        <div className="card mt-6 p-4">
          <p className="text-[16px] font-medium text-ink">{t('onboarding.extras.addToHomeTitle')}</p>
          <p className="mt-1 text-[15px] text-ink-soft">{t('onboarding.extras.addToHomeDescIOS')}</p>
          <ol className="mt-3 space-y-2">
            {[t('onboarding.extras.step1'), t('onboarding.extras.step2')].map((step, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-on-accent"
                  style={{ backgroundColor: 'var(--accent-action)' }}
                >
                  {i + 1}
                </span>
                <span className="text-[15px] text-ink">{step}</span>
                {i === 0 && (
                  <span className="ml-auto text-accent-ink">
                    <ShareIcon size={20} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <button type="button" className="btn btn-primary mt-6" onClick={finish}>
        {profile?.active_plan_id ? t('onboarding.extras.gotIt') : t('onboarding.extras.continue')}
      </button>
    </div>
  )
}
