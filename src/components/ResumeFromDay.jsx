// "Engancharse" a un plan ya empezado. Si el usuario ya venía leyendo este plan
// por otro lado, en vez de arrancar desde el día 1 puede indicar en qué día va.
// Componente controlado: `day` es el número de día (>=1) o null si está apagado.
// Al guardar, el padre calcula plan_start_date = hoy − (día − 1) y da por leídos
// los días anteriores (ver startDateForDay / markDaysRead en lib/db.js).
import { usePreferences } from '../lib/preferences.jsx'
import Switch from './Switch.jsx'

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--control-border)',
  color: 'var(--text-primary)',
}

export default function ResumeFromDay({ durationDays, day, onChange }) {
  const { t } = usePreferences()
  const on = day != null

  function toggle() {
    onChange(on ? null : 1)
  }

  function onInput(e) {
    const raw = e.target.value.replace(/[^\d]/g, '')
    if (raw === '') {
      onChange(null)
      return
    }
    let n = Number(raw)
    if (durationDays) n = Math.min(n, durationDays)
    onChange(Math.max(1, n))
  }

  return (
    <div className="card p-4">
      <div className="flex w-full items-center justify-between">
        <span className="text-[15px] font-medium text-ink">
          {t('resume.alreadyReading')}
        </span>
        <Switch on={on} onChange={toggle} label={t('resume.alreadyReading')} />
      </div>

      {on && (
        <div className="mt-4">
          <label htmlFor="resume-day" className="text-[15px] text-ink-soft">{t('ajustes.section.queDia')}</label>
          <input
            id="resume-day"
            type="text"
            inputMode="numeric"
            autoFocus
            value={day ?? ''}
            onChange={onInput}
            placeholder={t('resume.placeholder')}
            className="mt-2 w-full rounded-input px-4 py-3 text-[16px] outline-none"
            style={inputStyle}
          />
          <p className="mt-2 text-[13px] text-ink-soft">
            {durationDays
              ? t('resume.startInfo', { day: day || '—', total: durationDays })
              : t('resume.startInfoNoTotal', { day: day || '—' })}
          </p>
        </div>
      )}
    </div>
  )
}
