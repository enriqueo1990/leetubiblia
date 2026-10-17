import { useCallback, useEffect, useState } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import { getPlans } from '../lib/db.js'
import { planName, planDescription } from '../lib/planLabels.js'
import { SkeletonCards } from './Skeleton.jsx'
import ResumeFromDay from './ResumeFromDay.jsx'
import RetryError from './RetryError.jsx'

// Catálogo de planes con selección: destacados + "ver todos", día de reanudación
// y CTA primario. Compartido entre la exploración SIN cuenta (bienvenida) y el
// paso 2 del onboarding ya con sesión — misma lista, mismo orden, solo cambia
// qué pasa al confirmar (onStart) y el pie que pone cada pantalla debajo.
// getPlans() lee reading_plans, que es legible sin sesión (RLS pública, 0002).
export default function PlanCatalog({
  onStart,
  startLabel,
  savingLabel,
  saving = false,
  errorMessage = null,
  initialSelected = null,
  initialResumeDay = null,
}) {
  const { t } = usePreferences()
  const planDurationLabel = (days) =>
    days === 365 ? t('planes.durationYear') : t('planes.durationDays', { days })
  const [plans, setPlans] = useState(null)
  const [selected, setSelected] = useState(initialSelected)
  const [resumeDay, setResumeDay] = useState(initialResumeDay)
  const [showAll, setShowAll] = useState(false)
  // "Ya venía leyendo" casi nunca aplica a alguien nuevo: queda detrás de un link
  // para no empujar el botón fuera de la pantalla (se abre solo si ya hay día).
  const [resumeOpen, setResumeOpen] = useState(initialResumeDay != null)
  const [loadError, setLoadError] = useState(false)

  const loadPlans = useCallback(() => {
    setLoadError(false)
    setPlans(null)
    getPlans()
      .then((p) => setPlans(p))
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  const selectedPlan = plans?.find((p) => p.id === selected) ?? null
  const recommendedIds = [21, 22, 3]
  const recommended = recommendedIds.map((id) => plans?.find((p) => p.id === id)).filter(Boolean)
  const visiblePlans = showAll || recommended.length < 3 ? plans : recommended

  function pickPlan(id) {
    setSelected(id)
    // Al cambiar de plan, reiniciar el "día en que voy" (la duración cambia).
    setResumeDay(null)
    setResumeOpen(false)
  }

  return (
    <>
      <div className="mt-6 flex-1 space-y-3">
        {errorMessage && (
          <p className="text-[15px]" role="alert" style={{ color: 'var(--danger)' }}>{errorMessage}</p>
        )}
        {loadError && <RetryError message={t('planes.loadError')} onRetry={loadPlans} />}
        {!loadError && plans === null && <SkeletonCards count={3} />}

        {visiblePlans?.map((p) => {
          const active = p.id === selected
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => pickPlan(p.id)}
              aria-pressed={active}
              className={`card w-full p-4 text-left transition-colors duration-200${active ? ' card-active' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[18px] font-semibold text-ink">{planName(t, p)}</span>
                <span className="text-[13px] text-ink-soft">
                  {planDurationLabel(p.duration_days)}
                </span>
              </div>
              {p.description && (
                <p className="mt-1 text-[15px] text-ink-soft">{planDescription(t, p)}</p>
              )}
              {/* Una sola sugerencia: si todos son "recomendados", ninguno orienta. */}
              {!showAll && p.id === recommendedIds[0] && (
                <p className="mt-2 text-[13px] font-medium text-accent-ink">
                  {t('onboarding.choosePlan.recommended')}
                </p>
              )}
            </button>
          )
        })}
        {plans && !showAll && recommended.length >= 3 && (
          <button type="button" onClick={() => setShowAll(true)} className="min-h-11 w-full text-[15px] font-medium text-accent-ink">
            {t('onboarding.choosePlan.showAll')}
          </button>
        )}
      </div>

      {selectedPlan && resumeOpen && (
        <div className="mt-3">
          <ResumeFromDay
            durationDays={selectedPlan.duration_days}
            day={resumeDay}
            onChange={setResumeDay}
          />
        </div>
      )}
      {selectedPlan && !resumeOpen && (
        <button
          type="button"
          onClick={() => {
            setResumeOpen(true)
            setResumeDay(1)
          }}
          className="mt-2 min-h-11 w-full text-[14px] text-ink-soft"
        >
          {t('resume.alreadyReadingQ')}
        </button>
      )}

      <button
        type="button"
        disabled={!selectedPlan || saving}
        className="btn btn-primary mt-4"
        style={{ opacity: !selectedPlan || saving ? 0.5 : 1 }}
        onClick={() => selectedPlan && !saving && onStart(selectedPlan, resumeDay)}
      >
        {saving ? savingLabel : selectedPlan ? startLabel : t('onboarding.choosePlan.pickFirst')}
      </button>
    </>
  )
}
