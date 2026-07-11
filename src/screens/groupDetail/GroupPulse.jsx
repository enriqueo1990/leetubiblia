import { Link } from 'react-router-dom'
import { BookIcon, HeartIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'

// HOY — el pulso del grupo: quién leyó y cuántos pedidos activos hay.
export default function GroupPulse({ iShare, readCount, prayingCount, prayersCount }) {
  const { t } = usePreferences()

  return (
    <div
      className="mt-5 rounded-card p-4"
      style={{ backgroundColor: 'var(--accent-tint)', border: '1px solid var(--accent)' }}
    >
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-ink)' }}>
        {t('groupDetail.today')}
      </p>
      {iShare ? (
        <div className="mt-2.5 flex items-center gap-2.5 text-ink">
          <span style={{ color: 'var(--accent-ink)' }}>
            <BookIcon size={18} />
          </span>
          <span className="text-[15px]">
            {readCount === 0 ? (
              t('groupDetail.noneReadToday')
            ) : (
              <>
                <b>{readCount}</b> {t('groupDetail.readTodaySuffix', { count: readCount })}
              </>
            )}
          </span>
        </div>
      ) : (
        <Link to="/ajustes" className="mt-2.5 flex items-center gap-2.5" style={{ color: 'var(--accent-ink)' }}>
          <BookIcon size={18} />
          <span className="text-[14px] font-medium">{t('groupDetail.shareToSee')} →</span>
        </Link>
      )}
      <div className="mt-2 flex items-center gap-2.5 text-ink">
        <span style={{ color: 'var(--accent-ink)' }}>
          <HeartIcon size={18} />
        </span>
        <span className="text-[15px]">
          {prayingCount > 0 && (
            <>
              <b>{prayingCount}</b> {t('groupDetail.praying')} ·{' '}
            </>
          )}
          <b>{prayersCount}</b> {t('groupDetail.activePrayers', { count: prayersCount })}
        </span>
      </div>
    </div>
  )
}
