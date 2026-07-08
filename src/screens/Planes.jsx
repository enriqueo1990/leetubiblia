import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import BackLink from '../components/BackLink.jsx'
import { getPlans } from '../lib/db.js'
import { planName, planDescription } from '../lib/planLabels.js'
import { ChevronRight } from '../components/icons.jsx'
import RetryError from '../components/RetryError.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'

// Selección / cambio de plan (documento maestro §5.3, README pantalla 3).
// Cada tarjeta abre el detalle del plan (/planes/:id), donde se ve el listado
// día-por-día y se activa. El cambio con progreso existente se confirma allí.

export default function Planes() {
  const { profile } = useAuth()
  const { t } = usePreferences()
  const durationLabel = (days) =>
    days === 365 ? t('planes.durationYear') : t('planes.durationDays', { days })
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

  return (
    <div className="pt-2">
      <BackLink to="/" label={t('nav.hoy')} />
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('nav.planes')}</h1>
      <p className="mt-2 text-[16px] text-ink-soft">{t('planes.subtitle')}</p>

      <div className="mt-5 space-y-3">
        {plans === null && !error && <SkeletonCards count={3} />}
        {error && <RetryError message={t('planes.loadError')} onRetry={load} />}
        {plans?.map((p) => {
          const active = p.id === activeId
          return (
            <Link
              key={p.id}
              to={`/planes/${p.id}`}
              className={`card flex w-full items-center gap-3 p-4 text-left transition-colors duration-200${active ? ' card-active' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[18px] font-semibold text-ink">{planName(t, p)}</span>
                  {active && (
                    <span
                      className="rounded-pill px-2 py-0.5 text-[12px] font-medium"
                      style={{ color: 'var(--accent-ink)', backgroundColor: 'var(--accent-tint)' }}
                    >
                      {t('planes.active')}
                    </span>
                  )}
                </div>
                {p.description && <p className="mt-1 text-[15px] text-ink-soft">{planDescription(t, p)}</p>}
                <p className="mt-1 text-[13px] text-ink-soft">{durationLabel(p.duration_days)}</p>
              </div>
              <span className="text-ink-soft" style={{ opacity: 0.5 }}>
                <ChevronRight size={20} />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
