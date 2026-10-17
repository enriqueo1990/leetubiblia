import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { subscribeToPush } from '../lib/push.js'
import { dismissReminderOffer } from '../lib/reminderOffer.js'
import { BellIcon } from './icons.jsx'

// Oferta del recordatorio diario en Hoy, justo después de marcar una lectura.
// Antes se pedía en el onboarding, antes de leer nada y con una hora fija (07:00);
// acá llega en el momento de más ganas y con la hora en que la persona de verdad
// lee, precargada. Se descarta por usuario; Ajustes sigue teniendo el switch.

// La hora actual, redondeada a los 5 minutos: "mañana a esta hora".
function nowRounded() {
  const d = new Date()
  const total = Math.round((d.getHours() * 60 + d.getMinutes()) / 5) * 5
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function ReminderOffer({ onStart, onClose }) {
  const { user, updateProfile } = useAuth()
  const { t } = usePreferences()
  const [time, setTime] = useState(nowRounded)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  // Tras activarlo, la confirmación queda a la vista un momento y la tarjeta se va.
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => onClose?.(), 2600)
    return () => clearTimeout(id)
  }, [done, onClose])

  function dismiss() {
    dismissReminderOffer(user?.id)
    onClose?.()
  }

  function reasonMessage(reason) {
    if (reason === 'denied') return t('ajustes.push.denied')
    if (reason === 'unsupported') return t('ajustes.push.unsupported')
    if (reason === 'no-key') return t('ajustes.push.noKey')
    return t('ajustes.push.generic')
  }

  async function activate() {
    if (!user || busy) return
    onStart?.()
    setBusy(true)
    setError(null)
    const res = await subscribeToPush(user.id)
    if (!res.ok) {
      setError(reasonMessage(res.reason))
      setBusy(false)
      return
    }
    const { error: saveError } = await updateProfile({
      reminder_enabled: true,
      reminder_time: `${time}:00`,
    })
    setBusy(false)
    if (saveError) {
      setError(t('ajustes.push.generic'))
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <section className="card mt-6 p-4" role="status">
        <p className="text-[15px] font-medium text-ink">
          <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✦</span>{' '}
          {t('reminderOffer.done', { time })}
        </p>
      </section>
    )
  }

  return (
    <section className="card mt-6 p-4" aria-labelledby="reminder-offer-title">
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
          aria-hidden="true"
        >
          <BellIcon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="reminder-offer-title" className="text-[17px] font-semibold text-ink">
            {t('reminderOffer.title')}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-ink-soft">{t('reminderOffer.text')}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <label htmlFor="reminder-offer-time" className="text-[16px] text-ink">
          {t('ajustes.hora')}
        </label>
        <input
          id="reminder-offer-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value || time)}
          className="min-h-11 rounded-input px-3 text-[16px] outline-none"
          style={{
            backgroundColor: 'var(--surface-alt)',
            border: '1px solid var(--control-border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {error && (
        <p className="mt-3 text-[13px] leading-snug" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn btn-secondary mt-4"
        onClick={activate}
        disabled={busy}
        // Secundario: la barra de acción de Hoy ya tiene el botón principal.
        style={{ opacity: busy ? 0.6 : 1, color: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
      >
        {busy ? t('reminderOffer.activating') : t('reminderOffer.cta')}
      </button>
      <button
        type="button"
        className="mt-1 min-h-11 w-full text-center text-[15px] font-medium text-ink-soft"
        onClick={dismiss}
      >
        {t('hoy.install.dismiss')}
      </button>
    </section>
  )
}
