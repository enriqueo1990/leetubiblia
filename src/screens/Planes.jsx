import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import BackLink from '../components/BackLink.jsx'
import { getPlans } from '../lib/db.js'
import { DOOR_ORDER, planDoor } from '../lib/planCatalog.js'
import PlanCard from '../components/PlanCard.jsx'
import RetryError from '../components/RetryError.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import SectionLabel from '../components/SectionLabel.jsx'

// Selección / cambio de plan (documento maestro §5.3, README pantalla 3).
// Cada tarjeta abre el detalle del plan (/planes/:id), donde se ve el listado
// día-por-día y se activa. El cambio con progreso existente se confirma allí.

export default function Planes() {
  const { profile } = useAuth()
  const { t } = usePreferences()
  const location = useLocation()
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState(false)

  function load() {
    setError(false)
    setPlans(null)
    getPlans()
      .then(setPlans)
      .catch(() => setError(true))
  }

  useEffect(() => {
    load()
  }, [])

  const activeId = profile?.active_plan_id ?? null
  const activePlan = plans?.find((p) => p.id === activeId) ?? null
  const availablePlans = plans?.filter((p) => p.id !== activeId) ?? []
  // Se agrupa por "puerta" (la situación del lector), no por duración: la duración
  // queda como metadato de cada tarjeta. Las puertas vacías no se muestran.
  const sections = DOOR_ORDER.map((door) => ({
    key: door,
    label: t(`planes.door.${door}`),
    plans: availablePlans.filter((p) => planDoor(p.slug) === door),
  }))

  function planCard(p, active = false) {
    return (
      <PlanCard
        key={p.id}
        plan={p}
        to={`/planes/${p.id}`}
        state={{ from: { to: '/planes', label: t('nav.planes'), back: location.state?.from } }}
        active={active}
      />
    )
  }

  return (
    <div className="pt-2">
      <BackLink to="/" label={t('nav.hoy')} />
      <h1 className="mt-3 text-[1.625rem] font-bold tracking-tight text-ink">{t('nav.planes')}</h1>
      <p className="mt-2 text-[1rem] text-ink-soft">{t('planes.subtitle')}</p>

      <div className="mt-5 space-y-3">
        {plans === null && !error && <SkeletonCards count={3} />}
        {error && <RetryError message={t('planes.loadError')} onRetry={load} />}
        {activePlan && (
          <section>
            <SectionLabel>{t('planes.yourPlan')}</SectionLabel>
            {planCard(activePlan, true)}
          </section>
        )}
        {sections.filter((section) => section.plans.length > 0).map((section) => (
          <section key={section.key} className="pt-3">
            <SectionLabel>{section.label}</SectionLabel>
            <div className="space-y-3">{section.plans.map((p) => planCard(p))}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
