import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { useReading } from '../hooks/useReading.js'
import { useTodayExtras } from '../lib/todayExtras.js'
import { activeMaterials } from '../lib/materials.js'
import { planName } from '../lib/planLabels.js'
import BackLink from '../components/BackLink.jsx'
import EmptyState from '../components/EmptyState.jsx'
import RetryError from '../components/RetryError.jsx'
import TodayExtraRows from '../components/TodayExtraRows.jsx'
import { SkeletonRows } from '../components/Skeleton.jsx'
import { BookIcon, ChevronRight } from '../components/icons.jsx'

// Lecturas — hub de segundo anillo colgado de Hoy. Reúne en un solo lugar todo
// lo que se LEE: el plan activo (y cambiarlo), las otras lecturas de hoy (grupos
// que seguís + materiales activos) y el catálogo de materiales. Antes Planes y
// Materiales colgaban de Ajustes, donde nadie busca "cambiar de plan": eso es
// contenido, no configuración. No es pestaña: el mapa primario sigue en 4 y Hoy
// sigue siendo la cara de la app; se llega acá tocando el plan en Hoy.

function SectionLabel({ children }) {
  return (
    <h2 className="mb-2 mt-7 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
      {children}
    </h2>
  )
}

function Row({ to, state, title, detail, accent = false }) {
  return (
    <Link
      to={to}
      state={state}
      className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
    >
      <span
        className={`min-w-0 truncate text-[16px]${accent ? ' font-medium' : ' text-ink'}`}
        style={accent ? { color: 'var(--accent-ink)' } : undefined}
      >
        {title}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {detail && <span className="text-[15px] text-ink-soft">{detail}</span>}
        <span className="text-ink-soft" style={{ opacity: 0.5 }}>
          <ChevronRight size={18} />
        </span>
      </span>
    </Link>
  )
}

export default function Lecturas() {
  const { t } = usePreferences()
  const { profile } = useAuth()
  const r = useReading()
  const extras = useTodayExtras()
  const from = { to: '/lecturas', label: t('nav.lecturas') }
  const materialsCount = activeMaterials(profile).length
  const duration = r.plan?.duration_days ?? null

  return (
    <div className="pt-2">
      <BackLink to="/" label={t('nav.hoy')} />
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('nav.lecturas')}</h1>

      {/* Orden: Tu plan → También hoy → Materiales (primero lo que se lee hoy, el
          catálogo al final). Una sola columna también en desktop: dos columnas en
          ~620px truncaban los nombres de las filas. */}
      <div>
        <div>
          {/* ── Tu plan ───────────────────────────────────────────────── */}
          <SectionLabel>{t('lecturas.section.plan')}</SectionLabel>
          {r.loading ? (
            <SkeletonRows count={2} twoLine />
          ) : r.hasPlan && r.plan ? (
            <div className="card divide-y divide-hairline">
              <Link
                to={`/planes/${r.plan.id}`}
                state={{ from }}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[18px] font-semibold text-ink">
                    {planName(t, r.plan)}
                  </span>
                  <span className="mt-0.5 block text-[13px] tabular-nums text-ink-soft">
                    {r.planFinished
                      ? `✓ ${t('hoy.planCompleted')}`
                      : duration != null && r.displayDay != null
                        ? t('lecturas.planMeta', {
                            day: r.displayDay,
                            total: duration,
                            percent: r.percent,
                          })
                        : null}
                  </span>
                </span>
                <span className="text-ink-soft" style={{ opacity: 0.5 }}>
                  <ChevronRight size={18} />
                </span>
              </Link>
              <Row to="/planes" state={{ from }} title={t('lecturas.changePlan')} accent />
            </div>
          ) : (
            <div className="card px-4 py-4">
              <p className="text-[15px] text-ink-soft">{t('lecturas.noPlan')}</p>
              <Link
                to="/planes"
                state={{ from }}
                className="btn btn-primary mt-3 inline-block px-8"
              >
                {t('lecturas.choosePlan')}
              </Link>
            </div>
          )}
        </div>

        <div>
          {/* ── También hoy ───────────────────────────────────────────── */}
          <SectionLabel>{t('hoy.alsoToday')}</SectionLabel>
          {extras.loading && <SkeletonRows count={3} twoLine />}
          {!extras.loading && extras.rows.length === 0 && extras.error && (
            <RetryError message={t('hoy.extrasLoadError')} onRetry={extras.retry} />
          )}
          {!extras.loading && extras.rows.length === 0 && !extras.error && (
            <EmptyState icon={<BookIcon size={32} />} text={t('hoy.extrasEmpty')}>
              <Link
                to="/materiales"
                state={{ from }}
                className="btn btn-secondary inline-block px-8"
              >
                {t('materialsToday.hintCta')}
              </Link>
            </EmptyState>
          )}
          {!extras.loading && extras.rows.length > 0 && (
            <div className="card divide-y divide-hairline">
              <TodayExtraRows rows={extras.rows} from={from} />
            </div>
          )}
          {!extras.loading && extras.rows.length > 0 && extras.error && (
            <RetryError message={t('hoy.extrasLoadError')} onRetry={extras.retry} />
          )}
        </div>

        <div>
          {/* ── Materiales ────────────────────────────────────────────── */}
          <SectionLabel>{t('nav.materiales')}</SectionLabel>
          <div className="card">
            <Row
              to="/materiales"
              state={{ from }}
              title={t('ajustes.materialesDeLectura')}
              detail={
                materialsCount > 0
                  ? t('ajustes.materialsActive', { count: materialsCount })
                  : t('ajustes.ninguno')
              }
            />
          </div>
          <p className="mt-2 px-1 text-[13px] text-ink-soft">{t('lecturas.materialsHelp')}</p>
        </div>
      </div>
    </div>
  )
}
