import { useState } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { subscribeToPush } from '../../lib/push.js'
import Switch from '../../components/Switch.jsx'

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
  const { updateProfile, user, profile } = useAuth()
  const { t } = usePreferences()
  const [reminder, setReminder] = useState(false)
  const [reminderTime, setReminderTime] = useState('07:00')
  const [busy, setBusy] = useState(false)
  const [reminderError, setReminderError] = useState(null)
  const showAddToHome = isIOS() && !isStandalone()

  function pushReasonMessage(reason) {
    if (reason === 'denied') return t('ajustes.push.denied')
    if (reason === 'unsupported')
      return showAddToHome
        ? t('ajustes.push.unsupportedIOS')
        : t('ajustes.push.unsupported')
    if (reason === 'no-key') return t('ajustes.push.noKey')
    return t('ajustes.push.generic')
  }

  async function finish() {
    setBusy(true)
    setReminderError(null)
    if (reminder && user) {
      // Suscribe al push y solo registra el recordatorio si quedó realmente
      // habilitado. Si falla (permiso denegado o iOS sin instalar) no lo dejamos
      // como "activo" mintiendo: el usuario lo puede activar luego en Ajustes.
      const res = await subscribeToPush(user.id)
      if (!res.ok) {
        setReminder(false)
        setReminderError(pushReasonMessage(res.reason))
        setBusy(false)
        return
      }
      const { error } = await updateProfile({
        reminder_enabled: true,
        reminder_time: reminderTime,
      })
      if (error) {
        setReminder(false)
        setReminderError(t('ajustes.push.generic'))
        setBusy(false)
        return
      }
    }
    localStorage.setItem(DONE_KEY, '1')
    setBusy(false)
    onDone?.()
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10">
      <div className="flex-1">
        <p className="mb-2 text-[13px] font-medium text-accent-ink">{t('onboarding.extras.step')}</p>
        <h1 className="text-[24px] font-bold tracking-tight text-ink">{t('onboarding.extras.title')}</h1>
        {/* Fuera de iOS solo se ofrece el recordatorio: el subtítulo cuenta una
            cosa o dos según lo que de verdad se muestra. */}
        <p className="mt-2 text-[16px] text-ink-soft">
          {showAddToHome ? t('onboarding.extras.subtitle') : t('onboarding.extras.subtitleOne')}
        </p>

        {/* Recordatorio */}
        <div className="card mt-6 divide-y divide-hairline">
          <div className="flex items-center justify-between p-4">
            <div className="pr-4">
              <p className="text-[16px] font-medium text-ink">{t('ajustes.section.recordatorio')}</p>
              <p className="text-[13px] text-ink-soft">
                {t('onboarding.extras.reminderDesc')}
              </p>
            </div>
            <Switch
              on={reminder}
              onChange={() => {
                setReminderError(null)
                setReminder((v) => !v)
              }}
              label={t('ajustes.section.recordatorio')}
            />
          </div>
          {reminder && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <label htmlFor="onboarding-reminder-time" className="text-[16px] text-ink">
                {t('ajustes.hora')}
              </label>
              <input
                id="onboarding-reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="min-h-11 rounded-input px-3 text-[16px] outline-none"
                style={{
                  backgroundColor: 'var(--surface-alt)',
                  border: '1px solid var(--control-border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}
        </div>
        {reminderError && (
          <div className="mt-3 px-1" role="alert">
            <p className="text-[13px] leading-snug" style={{ color: 'var(--danger)' }}>
              {reminderError}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              {t('onboarding.extras.reminderFailureHint')}
            </p>
          </div>
        )}

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
                    style={{ backgroundColor: 'var(--accent-action)' }}
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
        {busy
          ? t('onboarding.extras.finishing')
          : profile?.active_plan_id
            ? t('onboarding.extras.gotIt')
            : t('onboarding.extras.continue')}
      </button>
    </div>
  )
}

OnboardingExtras.DONE_KEY = DONE_KEY
export { DONE_KEY as EXTRAS_DONE_KEY }
