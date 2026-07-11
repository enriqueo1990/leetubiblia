import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { getPlans } from '../../lib/db.js'
import { planName } from '../../lib/planLabels.js'

// Hoja para elegir el plan común del grupo (solo el administrador la abre).
// El plan elegido arranca ese día como día 1 del grupo; cada miembro decide
// sumarse desde la tarjeta "Plan del grupo".
export default function GroupPlanSheet({ currentPlanId, saving, error, onSet, onClear, onCancel }) {
  const { t } = usePreferences()
  const [plans, setPlans] = useState(null) // null = cargando
  const [loadError, setLoadError] = useState(false)
  const [sel, setSel] = useState(currentPlanId)

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .catch(() => setLoadError(true))
  }, [])

  const canSet = sel != null && sel !== currentPlanId && !saving

  return (
    <Sheet
      title={t('groupDetail.groupPlan')}
      onCancel={onCancel}
      footer={
        <button
          type="button"
          onClick={() => onSet(sel)}
          disabled={!canSet}
          className="btn btn-primary"
          style={{ opacity: canSet ? 1 : 0.5 }}
        >
          {saving ? t('common.saving') : t('groupDetail.planPickerSet')}
        </button>
      }
    >
      <p className="text-[13px] leading-snug text-ink-soft">{t('groupDetail.planPickerHelp')}</p>

      {loadError ? (
        <p className="mt-4 text-[14px] text-ink-soft">{t('planes.loadError')}</p>
      ) : plans === null ? (
        <div className="mt-4 space-y-2 animate-pulse" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[52px] rounded-input" style={{ backgroundColor: 'var(--surface-alt)' }} />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {plans.map((p) => {
            const active = p.id === sel
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSel(p.id)}
                aria-pressed={active}
                className="flex w-full items-center justify-between gap-3 rounded-input border px-4 py-3 text-left"
                style={{
                  borderColor: active ? 'var(--accent)' : 'var(--hairline)',
                  backgroundColor: active ? 'var(--accent-tint)' : 'transparent',
                }}
              >
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                  {planName(t, p)}
                </span>
                <span className="shrink-0 text-[13px] text-ink-soft">
                  {p.duration_days === 365
                    ? t('planes.durationYear')
                    : t('planes.durationDays', { days: p.duration_days })}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>
          {t('groupDetail.planError')}
        </p>
      )}

      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 w-full py-2 text-center text-[14px]"
          style={{ color: 'var(--danger)' }}
        >
          {t('groupDetail.clearPlan')}
        </button>
      )}
    </Sheet>
  )
}
