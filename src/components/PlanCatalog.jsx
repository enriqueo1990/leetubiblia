import { useCallback, useEffect, useState } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import { getPlans } from '../lib/db.js'
import PlanCard from './PlanCard.jsx'
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

        {visiblePlans?.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            mode="select"
            active={p.id === selected}
            onSelect={() => pickPlan(p.id)}
            // Una sola sugerencia: si todos son "recomendados", ninguno orienta.
            recommended={!showAll && p.id === recommendedIds[0]}
          />
        ))}
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
        aria-busy={saving}
        className="btn btn-primary mt-4"
        onClick={() => selectedPlan && !saving && onStart(selectedPlan, resumeDay)}
      >
        {saving ? savingLabel : selectedPlan ? startLabel : t('onboarding.choosePlan.pickFirst')}
      </button>
    </>
  )
}
