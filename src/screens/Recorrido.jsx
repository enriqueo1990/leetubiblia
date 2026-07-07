import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtISODate } from '../i18n/dates.js'
import BackLink from '../components/BackLink.jsx'
import { getCompletedPlans, getYearStats } from '../lib/db.js'
import { SkeletonCards } from '../components/Skeleton.jsx'
import RetryError from '../components/RetryError.jsx'

// "Tu recorrido en la Palabra" (Feature 5, parte 2): números acumulados + planes
// terminados. Se nutre de plan_completions (logros permanentes) y de los datos
// existentes (lectura, oración). No trae Escritura adentro: resume el hábito.

function Stat({ value, label, accent }) {
  return (
    <div className="card flex-1 p-4 text-center">
      <p
        className={`text-[30px] font-bold ${accent ? 'text-accent-ink' : 'text-ink'}`}
        style={{ letterSpacing: '-1px' }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[13px] leading-tight text-ink-soft">{label}</p>
    </div>
  )
}

export default function Recorrido() {
  const { user } = useAuth()
  const { t, locale } = usePreferences()
  const fmtDate = (iso) => fmtISODate(iso, locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const [stats, setStats] = useState(null) // null = cargando
  const [plans, setPlans] = useState([])
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const [s, p] = await Promise.all([getYearStats(user.id), getCompletedPlans(user.id)])
      setStats(s)
      setPlans(p)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const back = (
    <BackLink to="/progreso" label={t('nav.progreso')} />
  )

  if (error) {
    return (
      <div className="pt-2">
        {back}
        <div className="mt-6">
          <RetryError message={t('recorrido.loadError')} onRetry={load} />
        </div>
      </div>
    )
  }

  return (
    <div className="pt-2">
      {back}
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('recorrido.title')}</h1>
      <p className="mt-1 text-[15px] text-ink-soft">{t('recorrido.subtitle')}</p>

      {stats === null ? (
        <div className="mt-6">
          <SkeletonCards count={2} />
        </div>
      ) : stats.totalDaysRead === 0 && stats.plansCompleted === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-[30px]"
            style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--accent-ink)' }}
            aria-hidden="true"
          >
            ✦
          </div>
          <h2 className="mt-5 text-[20px] font-semibold text-ink">{t('recorrido.empty.title')}</h2>
          <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-ink-soft">
            {t('recorrido.empty.text')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-3">
            <Stat
              value={stats.plansCompleted}
              label={t('recorrido.plansCompleted', { count: stats.plansCompleted })}
              accent
            />
            <Stat
              value={stats.longestStreak}
              label={t('hoy.maxStreak', { count: stats.longestStreak })}
            />
          </div>
          <div className="mt-3 flex gap-3">
            <Stat
              value={stats.totalDaysRead}
              label={t('recorrido.daysInWord', { count: stats.totalDaysRead })}
            />
            <Stat
              value={stats.prayersAnswered}
              label={t('recorrido.prayersAnswered', { count: stats.prayersAnswered })}
            />
          </div>

          {plans.length > 0 ? (
            <>
              <p className="mt-8 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                {t('recorrido.plansYouFinished')}
              </p>
              <ul className="mt-3 space-y-3">
                {plans.map((c) => (
                  <li key={c.id} className="card p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">
                        {c.plan_name}
                      </p>
                      <span
                        className="shrink-0 text-[12px] font-medium"
                        style={{ color: 'var(--accent-ink)' }}
                      >
                        ✓ {fmtDate(c.completed_on)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      {t('recorrido.planStats', { read: c.days_read, total: c.total_days, streak: c.longest_streak })}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-8 text-[15px] leading-relaxed text-ink-soft">
              {t('recorrido.noPlansYet')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
