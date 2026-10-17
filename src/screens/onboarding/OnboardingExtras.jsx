import { useState } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { subscribeToPush } from '../../lib/push.js'
import Switch from '../../components/Switch.jsx'
import { markExtrasDone } from '../../lib/sessionFlags.js'
import { recordFunnel } from '../../lib/diag.js'
import { isIOSBrowser } from '../../lib/platform.js'

// Último paso del onboarding (documento maestro §5.8): ofrecer recordatorio y, en
// iOS, guiar a "Agregar a pantalla de inicio". La programación real de la
// notificación es Tarea 7; acá solo se registra la intención (reminder_enabled).
// Se muestra una sola vez por cuenta (profiles.onboarded_at, con respaldo local en
// lib/sessionFlags.js), luego aterriza en Hoy.
//
// En el navegador del iPhone el push no existe: en vez de un switch que falla
// siempre, se explica que el recordatorio llega con la app instalada.

export default function OnboardingExtras({ onDone }) {
  const { updateProfile, user, profile } = useAuth()
  const { t } = usePreferences()
  const [reminder, setReminder] = useState(false)
  const [reminderTime, setReminderTime] = useState('07:00')
  const [busy, setBusy] = useState(false)
  const [reminderError, setReminderError] = useState(null)
  const showAddToHome = isIOSBrowser()

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
    markExtrasDone(user?.id)
    recordFunnel('ob_extras_done', { reminder, ios_browser: showAddToHome })
    // Marca de la cuenta: no bloquea (si la migración 0035 aún no está, falla
    // en silencio y queda la bandera local).
    updateProfile({ onboarded_at: new Date().toISOString() }).catch(() => {})
    setBusy(false)
    onDone?.()
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10">
      <div className="flex-1">
        <p className="mb-2 text-[13px] font-medium text-accent-ink">{t('onboarding.extras.step')}</p>
        <h1 className="text-[24px] font-bold tracking-tight text-ink">{t('onboarding.extras.title')}</h1>
        {/* Se ofrece una sola cosa: el recordatorio, o (en el navegador del
            iPhone) instalar la app, que es lo que lo hace posible. */}
        <p className="mt-2 text-[16px] text-ink-soft">
          {showAddToHome ? t('onboarding.extras.subtitleIOS') : t('onboarding.extras.subtitleOne')}
        </p>

        {/* Recordatorio (no en el navegador del iPhone: ahí el push no existe) */}
        {!showAddToHome && (
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
        )}
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
          <div className="card mt-6 p-4">
            <p className="text-[16px] font-medium text-ink">{t('onboarding.extras.addToHomeTitle')}</p>
            <p className="mt-1 text-[15px] text-ink-soft">
              {t('onboarding.extras.addToHomeDescIOS')}
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

