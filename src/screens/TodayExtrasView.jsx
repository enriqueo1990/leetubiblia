import { Link } from 'react-router-dom'
import BackLink from '../components/BackLink.jsx'
import EmptyState from '../components/EmptyState.jsx'
import TodayExtraRows from '../components/TodayExtraRows.jsx'
import { SkeletonRows } from '../components/Skeleton.jsx'
import RetryError from '../components/RetryError.jsx'
import { BookIcon } from '../components/icons.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { useTodayExtras } from '../lib/todayExtras.js'

export default function TodayExtrasView() {
  const { t } = usePreferences()
  const { loading, rows, error, retry } = useTodayExtras()
  // Las filas y el vacío vuelven acá (no a Hoy): la miga cuenta el camino real.
  const from = { to: '/hoy/lecturas', label: t('hoy.alsoToday') }

  return (
    <div className="pt-2">
      <BackLink to="/" label={t('nav.hoy')} />
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('hoy.alsoToday')}</h1>

      <div className="mt-6">
        {loading && <SkeletonRows count={3} twoLine />}
        {!loading && rows.length === 0 && error && (
          <RetryError message={t('hoy.extrasLoadError')} onRetry={retry} />
        )}
        {!loading && rows.length === 0 && !error && (
          <EmptyState icon={<BookIcon size={32} />} text={t('hoy.extrasEmpty')}>
            <Link to="/materiales" state={{ from }} className="btn btn-secondary inline-block px-8">
              {t('materialsToday.hintCta')}
            </Link>
          </EmptyState>
        )}
        {!loading && rows.length > 0 && (
          <div className="card divide-y divide-hairline">
            <TodayExtraRows rows={rows} rowClassName="px-4 py-3" from={from} />
          </div>
        )}
        {!loading && rows.length > 0 && error && (
          <RetryError message={t('hoy.extrasLoadError')} onRetry={retry} />
        )}
      </div>
    </div>
  )
}
