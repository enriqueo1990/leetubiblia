import { useState } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { subscribeToPush } from '../../lib/push.js'

// Último paso del onboarding (documento maestro §5.8): ofrecer recordatorio y, en
// iOS, guiar a "Agregar a pantalla de inicio". La programación real de la
// notificación es Tarea 7; acá solo se registra la intención (reminder_enabled).
// Se muestra una sola vez (flag en localStorage), luego aterriza en Hoy.
const DONE_KEY = 'ltb.onboarded_extras'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export default function OnboardingExtras({ onDone }) {
  const { updateProfile, user } = useAuth()
  const { t } = usePreferences()
  const [reminder, setReminder] = useState(false)
  const [busy, setBusy] = useState(false)
  const showAddToHome = isIOS() && !isStandalone()

  async function finish() {
    setBusy(true)
    if (reminder && user) {
      // Suscribe al push y solo registra el recordatorio si quedó realmente
      // habilitado. Si falla (permiso denegado o iOS sin instalar) no lo dejamos
      // como "activo" mintiendo: el usuario lo puede activar luego en Ajustes.
      const res = await subscribeToPush(user.id)
      if (res.ok) {
        await updateProfile({ reminder_enabled: true, reminder_time: '07:00' })
      }
    }
    localStorage.setItem(DONE_KEY, '1')
    setBusy(false)
    onDone?.()
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10">
      <div className="flex-1">
        <h1 className="text-[24px] font-bold tracking-tight text-ink">{t('onboarding.extras.title')}</h1>
        <p className="mt-2 text-[16px] text-ink-soft">
          {t('onboarding.extras.subtitle')}
        </p>

        {/* Recordatorio */}
        <div className="card mt-6 flex items-center justify-between p-4">
          <div className="pr-4">
            <p className="text-[16px] font-medium text-ink">{t('ajustes.section.recordatorio')}</p>
            <p className="text-[13px] text-ink-soft">
              {t('onboarding.extras.reminderDesc')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reminder}
            onClick={() => setReminder((v) => !v)}
            className="relative h-[29px] w-[48px] rounded-[15px] transition-colors duration-300"
            style={{ backgroundColor: reminder ? 'var(--accent)' : 'var(--surface-alt)' }}
          >
            <span
              className="absolute top-[2.5px] h-[24px] w-[24px] rounded-full bg-white transition-all duration-300"
              style={{ left: reminder ? 21 : 3 }}
            />
          </button>
        </div>

        {/* Agregar a inicio (solo iOS no instalado) */}
        {showAddToHome && (
          <div className="card mt-4 p-4">
            <p className="text-[16px] font-medium text-ink">{t('onboarding.extras.addToHomeTitle')}</p>
            <p className="mt-1 text-[15px] text-ink-soft">
              {t('onboarding.extras.addToHomeDesc')}
            </p>
            <ol className="mt-3 space-y-2">
              {[t('onboarding.extras.step1'), t('onboarding.extras.step2')].map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold text-on-accent"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[15px] text-ink">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary mt-6"
        disabled={busy}
        onClick={finish}
      >
        {busy ? t('onboarding.extras.finishing') : t('onboarding.extras.gotIt')}
      </button>
    </div>
  )
}

OnboardingExtras.DONE_KEY = DONE_KEY
export { DONE_KEY as EXTRAS_DONE_KEY }
