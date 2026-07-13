import BackLink from '../components/BackLink.jsx'
import EmptyState from '../components/EmptyState.jsx'
import TodayExtraRows from '../components/TodayExtraRows.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import { BookIcon } from '../components/icons.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { useTodayExtras } from '../lib/todayExtras.js'

export default function TodayExtrasView() {
  const { t } = usePreferences()
  const { loading, rows } = useTodayExtras()

  return (
    <div className="pt-2">
      <BackLink to="/" label={t('nav.hoy')} />
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('hoy.alsoToday')}</h1>

      <div className="mt-6">
        {loading && <SkeletonCards count={3} />}
        {!loading && rows.length === 0 && (
          <EmptyState icon={<BookIcon size={32} />} text={t('hoy.extrasEmpty')} />
        )}
        {!loading && rows.length > 0 && (
          <div className="card divide-y divide-hairline">
            <TodayExtraRows rows={rows} rowClassName="px-4 py-3" />
          </div>
        )}
      </div>
    </div>
  )
}
