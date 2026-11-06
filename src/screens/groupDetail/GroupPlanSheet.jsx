import { useCallback, useEffect, useState } from 'react'
import Sheet from '../../components/Sheet.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { getPlans } from '../../lib/db.js'
import PlanCard from '../../components/PlanCard.jsx'
import RetryError from '../../components/RetryError.jsx'
import InlineError from '../../components/InlineError.jsx'

// Hoja para elegir el plan común del grupo (solo el administrador la abre).
// El plan elegido arranca ese día como día 1 del grupo; cada miembro decide
// sumarse desde la tarjeta "Plan del grupo".
export default function GroupPlanSheet({ currentPlanId, saving, error, onSet, onClear, onCancel }) {
  const { t } = usePreferences()
  const [plans, setPlans] = useState(null) // null = cargando
  const [loadError, setLoadError] = useState(false)
  const [sel, setSel] = useState(currentPlanId)

  const loadPlans = useCallback(() => {
    setLoadError(false)
    setPlans(null)
    getPlans()
      .then(setPlans)
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

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
        >
          {saving ? t('common.saving') : t('groupDetail.planPickerSet')}
        </button>
      }
    >
      <p className="text-[0.8125rem] leading-snug text-ink-soft">{t('groupDetail.planPickerHelp')}</p>
      {currentPlanId != null && (
        <p className="mt-2 text-[0.8125rem] leading-snug text-ink-soft">{t('groupDetail.planPickerChangeNote')}</p>
      )}

      {loadError ? (
        <RetryError message={t('planes.loadError')} onRetry={loadPlans} />
      ) : plans === null ? (
        <div className="mt-4 space-y-2 animate-pulse" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[88px] rounded-card" style={{ backgroundColor: 'var(--surface-alt)' }} />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} mode="select" active={p.id === sel} onSelect={() => setSel(p.id)} />
          ))}
        </div>
      )}

      {error && (
        <InlineError message={t('groupDetail.planError')} className="mt-3" />
      )}

      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 min-h-11 w-full text-center text-[0.875rem]"
          style={{ color: 'var(--danger)' }}
        >
          {t('groupDetail.clearPlan')}
        </button>
      )}
    </Sheet>
  )
}
