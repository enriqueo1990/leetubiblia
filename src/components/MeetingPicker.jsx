import { MinusIcon, PlusIcon } from './icons.jsx'
import Segmented from './Segmented.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { MEET_MAX, MEETING_PRESETS as PRESETS, meetingChoice, meetingPhrase } from '../lib/meeting.js'

// Cada cuánto se junta un grupo (al crearlo y, después, desde su detalle).
// value: { every: 1–12, unit: 'week' | 'month' } o null («lo definimos después»).
// Lista de opciones comunes + «Otra frecuencia», que abre «Cada [− N +]
// [semanas | meses]» para cualquier combinación.

// showLabel=false cuando el título de la hoja ya hace la pregunta.
export default function MeetingPicker({ value, onChange, custom, setCustom, className = '', showLabel = true }) {
  const { t } = usePreferences()
  const choice = meetingChoice(value, custom)

  function pick(key) {
    if (key === 'none') {
      setCustom(false)
      onChange(null)
    } else if (key === 'custom') {
      setCustom(true)
      onChange(value ?? { every: 2, unit: 'month' })
    } else {
      const p = PRESETS.find((x) => x.key === key)
      setCustom(false)
      onChange({ every: p.every, unit: p.unit })
    }
  }

  const rows = [
    ...PRESETS.map((p) => ({ key: p.key, label: capitalize(meetingPhrase(t, p)) })),
    { key: 'custom', label: t('meeting.custom') },
    { key: 'none', label: t('meeting.none') },
  ]

  const every = value?.every ?? 2
  const unit = value?.unit ?? 'month'
  const setEvery = (n) => onChange({ every: Math.min(MEET_MAX, Math.max(1, n)), unit })

  return (
    <div className={className}>
      {showLabel && (
        <p className="mb-2 block text-[0.875rem] font-medium text-ink" aria-hidden="true">
          {t('meeting.label')}
        </p>
      )}
      <div className="card divide-y divide-hairline" role="radiogroup" aria-label={t('meeting.label')}>
        {rows.map((r) => (
          <div key={r.key}>
            <button
              type="button"
              role="radio"
              aria-checked={choice === r.key}
              onClick={() => pick(r.key)}
              className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className={`text-[1rem] ${r.key === 'none' ? 'text-ink-soft' : 'text-ink'}`}>{r.label}</span>
              {choice === r.key && <span style={{ color: 'var(--accent-ink)' }}>✓</span>}
            </button>

            {r.key === 'custom' && choice === 'custom' && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-[1rem] text-ink">{t('meeting.customEvery')}</span>
                  <div className="flex items-center rounded-input" style={{ backgroundColor: 'var(--segment-track)' }}>
                    <button
                      type="button"
                      aria-label={t('meeting.less')}
                      disabled={every <= 1}
                      onClick={() => setEvery(every - 1)}
                      className="flex h-11 w-11 items-center justify-center text-ink disabled:opacity-30"
                    >
                      <MinusIcon size={18} />
                    </button>
                    <span className="min-w-[2ch] text-center text-[1.125rem] font-semibold tabular-nums text-ink" aria-live="polite">
                      {every}
                    </span>
                    <button
                      type="button"
                      aria-label={t('meeting.more')}
                      disabled={every >= MEET_MAX}
                      onClick={() => setEvery(every + 1)}
                      className="flex h-11 w-11 items-center justify-center text-ink disabled:opacity-30"
                    >
                      <PlusIcon size={18} />
                    </button>
                  </div>
                </div>
                <Segmented
                  className="mt-3"
                  label={t('meeting.unitLabel')}
                  value={unit}
                  onChange={(u) => onChange({ every, unit: u })}
                  options={[
                    { key: 'week', label: t('meeting.unit.week', { count: every }) },
                    { key: 'month', label: t('meeting.unit.month', { count: every }) },
                  ]}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
