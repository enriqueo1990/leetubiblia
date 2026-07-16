import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { getPlans, startDateForDay, todayLocalISO, markDaysRead } from '../../lib/db.js'
import ResumeFromDay from '../../components/ResumeFromDay.jsx'
import RetryError from '../../components/RetryError.jsx'

// Elegir plan de lectura en el onboarding (documento maestro §5.3 / §5.8).
// Set active_plan_id + plan_start_date = hoy (local). El cambio de plan ya con
// progreso existente, con su confirmación, se maneja en Tarea 4.

export default function ChoosePlanOnboarding() {
  const { user, updateProfile } = useAuth()
  const { t } = usePreferences()
  const planDurationLabel = (days) =>
    days === 365 ? t('planes.durationYear') : t('planes.durationDays', { days })
  const [plans, setPlans] = useState(null)
  const [selected, setSelected] = useState(null)
  const [resumeDay, setResumeDay] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState(null) // error al activar el plan
  const [loadError, setLoadError] = useState(false) // error al cargar el catálogo

  const loadPlans = useCallback(() => {
    setLoadError(false)
    setPlans(null)
    getPlans()
      .then((p) => {
        setPlans(p)
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  // Al cambiar de plan, reiniciar el "día en que voy" (la duración cambia).
  const selectedPlan = plans?.find((p) => p.id === selected) ?? null
  const recommendedIds = [21, 22, 3]
  const recommended = recommendedIds.map((id) => plans?.find((p) => p.id === id)).filter(Boolean)
  const visiblePlans = showAll || recommended.length < 3 ? plans : recommended

  function pickPlan(id) {
    setSelected(id)
    setResumeDay(null)
  }

  async function handleStart() {
    if (!selected || saving) return
    setSaving(true)
    const planStart = resumeDay ? startDateForDay(resumeDay) : todayLocalISO()
    const { error } = await updateProfile({
      active_plan_id: selected,
      plan_start_date: planStart,
    })
    if (error) {
      setSaving(false)
      setError(t('onboarding.choosePlan.activateError'))
      return
    }
    // Engancharse a mitad de plan: dar por leídos los días anteriores (1..N−1).
    if (resumeDay && resumeDay > 1 && user) {
      try {
        await markDaysRead(user.id, selected, resumeDay - 1)
      } catch {
        // No es bloqueante: el plan ya quedó activo en el día correcto.
      }
    }
    setSaving(false)
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10">
      <p className="text-[13px] font-medium text-accent-ink">{t('onboarding.choosePlan.step')}</p>
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        {t('onboarding.choosePlan.title')}
      </h1>
      <p className="mt-2 text-[16px] text-ink-soft">{t('planes.subtitle')}</p>

      <div className="mt-6 flex-1 space-y-3">
        {error && <p className="text-[15px]" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
        {loadError && (
          <RetryError message={t('planes.loadError')} onRetry={loadPlans} />
        )}
        {!loadError && plans === null && (
          <p className="text-[15px] text-ink-soft">{t('onboarding.choosePlan.loadingPlans')}</p>
        )}

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
                <span className="text-[18px] font-semibold text-ink">{p.name}</span>
                <span className="text-[13px] text-ink-soft">
                  {planDurationLabel(p.duration_days)}
                </span>
              </div>
              {p.description && (
                <p className="mt-1 text-[15px] text-ink-soft">{p.description}</p>
              )}
              {!showAll && recommendedIds.includes(p.id) && (
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

      {selectedPlan && (
        <div className="mt-3">
          <ResumeFromDay
            durationDays={selectedPlan.duration_days}
            day={resumeDay}
            onChange={setResumeDay}
          />
        </div>
      )}

      <button
        type="button"
        disabled={!selected || saving}
        className="btn btn-primary mt-4"
        style={{ opacity: !selected || saving ? 0.5 : 1 }}
        onClick={handleStart}
      >
        {saving ? t('planes.activating') : t('onboarding.choosePlan.start')}
      </button>
    </div>
  )
}
