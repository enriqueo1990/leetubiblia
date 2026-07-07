import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { getCompletedPlans, getYearStats } from '../lib/db.js'
import { SkeletonCards } from '../components/Skeleton.jsx'
import RetryError from '../components/RetryError.jsx'

// "Tu recorrido en la Palabra" (Feature 5, parte 2): números acumulados + planes
// terminados. Se nutre de plan_completions (logros permanentes) y de los datos
// existentes (lectura, oración). No trae Escritura adentro: resume el hábito.

function fmtDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

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
    <Link to="/progreso" className="text-[15px] font-medium" style={{ color: 'var(--accent-ink)' }}>
      ‹ Progreso
    </Link>
  )

  if (error) {
    return (
      <div className="pt-2">
        {back}
        <div className="mt-6">
          <RetryError message="No se pudo cargar tu recorrido." onRetry={load} />
        </div>
      </div>
    )
  }

  return (
    <div className="pt-2">
      {back}
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">Tu recorrido</h1>
      <p className="mt-1 text-[15px] text-ink-soft">Lo que fuiste caminando en la Palabra.</p>

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
          <h2 className="mt-5 text-[20px] font-semibold text-ink">Tu recorrido empieza hoy</h2>
          <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-ink-soft">
            Cada día que marcás tu lectura suma. Acá vas a ver crecer tus números y los planes que
            vayas terminando.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-3">
            <Stat
              value={stats.plansCompleted}
              label={stats.plansCompleted === 1 ? 'plan terminado' : 'planes terminados'}
              accent
            />
            <Stat
              value={stats.longestStreak}
              label={stats.longestStreak === 1 ? 'día de racha máx.' : 'días de racha máx.'}
            />
          </div>
          <div className="mt-3 flex gap-3">
            <Stat
              value={stats.totalDaysRead}
              label={stats.totalDaysRead === 1 ? 'día en la Palabra' : 'días en la Palabra'}
            />
            <Stat
              value={stats.prayersAnswered}
              label={stats.prayersAnswered === 1 ? 'oración respondida' : 'oraciones respondidas'}
            />
          </div>

          {plans.length > 0 ? (
            <>
              <p className="mt-8 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                Planes que terminaste
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
                      {c.days_read} de {c.total_days} días · racha máx. {c.longest_streak}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-8 text-[15px] leading-relaxed text-ink-soft">
              Todavía no terminaste un plan, pero vas en camino. Cuando completes uno, tu logro va a
              quedar acá.
            </p>
          )}
        </>
      )}
    </div>
  )
}
