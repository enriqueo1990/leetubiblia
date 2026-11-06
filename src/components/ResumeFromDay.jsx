// "Engancharse" a un plan ya empezado. Si el usuario ya venía leyendo este plan
// por otro lado, en vez de arrancar desde el día 1 puede indicar en qué día va.
// Componente controlado: `day` es el número de día (>=1) o null si está apagado.
// Al guardar, el padre calcula plan_start_date = hoy − (día − 1) y da por leídos
// los días anteriores (ver startDateForDay / markDaysRead en lib/db.js).
import { useState } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import Switch from './Switch.jsx'
import { inputStyle } from './formStyles.js'

export default function ResumeFromDay({ durationDays, day, onChange }) {
  const { t } = usePreferences()
  const on = day != null
  // El texto del campo es un borrador local: vacío es válido mientras escribís
  // (borrar el «1» para poner «40» no debe apagar el interruptor). Al padre le
  // llega 1 en ese caso; solo el Switch lo pone en null.
  const [draft, setDraft] = useState(day != null ? String(day) : '')

  function toggle() {
    setDraft(on ? '' : '1')
    onChange(on ? null : 1)
  }

  function onInput(e) {
    const raw = e.target.value.replace(/[^\d]/g, '')
    if (raw === '') {
      setDraft('')
      onChange(1)
      return
    }
    let n = Number(raw)
    if (durationDays) n = Math.min(n, durationDays)
    n = Math.max(1, n)
    setDraft(String(n))
    onChange(n)
  }

  return (
    <div className="card p-4">
      <div className="flex w-full items-center justify-between">
        <span className="text-[0.9375rem] font-medium text-ink">
          {t('resume.alreadyReading')}
        </span>
        <Switch on={on} onChange={toggle} label={t('resume.alreadyReading')} />
      </div>

      {on && (
        <div className="mt-4">
          <label htmlFor="resume-day" className="text-[0.9375rem] text-ink-soft">{t('ajustes.section.queDia')}</label>
          <input
            id="resume-day"
            type="text"
            inputMode="numeric"
            autoFocus
            value={draft}
            onChange={onInput}
            placeholder={t('resume.placeholder')}
            className="mt-2 w-full rounded-input px-4 py-3 text-[1rem] outline-none"
            style={inputStyle}
          />
          <p className="mt-2 text-[0.8125rem] text-ink-soft">
            {durationDays
              ? t('resume.startInfo', { day: draft || '—', total: durationDays })
              : t('resume.startInfoNoTotal', { day: draft || '—' })}
          </p>
        </div>
      )}
    </div>
  )
}
