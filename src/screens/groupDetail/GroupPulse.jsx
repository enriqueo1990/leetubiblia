import { BookIcon, HeartIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import SectionLabel from '../../components/SectionLabel.jsx'

// HOY — el pulso del grupo: quién leyó y cuántos pedidos activos hay.
export default function GroupPulse({ iShare, onAskShare, iRead = false, readCount, prayingCount, prayersCount }) {
  const { t } = usePreferences()

  return (
    <div
      className="mt-5 rounded-card p-4"
      style={{ backgroundColor: 'var(--accent-tint)', border: '1px solid var(--accent)' }}
    >
      <SectionLabel inside accent className="mb-0">
        {t('groupDetail.today')}
      </SectionLabel>
      {iShare ? (
        <div className="mt-2.5 flex items-center gap-2.5 text-ink">
          <span style={{ color: 'var(--accent-ink)' }}>
            <BookIcon size={18} />
          </span>
          <span className="text-[15px]">
            {readCount === 0 ? (
              iRead ? t('groupDetail.onlyYouReadToday') : t('groupDetail.noneReadToday')
            ) : iRead ? (
              t('groupDetail.youAndOthersRead', { count: readCount })
            ) : (
              <>
                <b>{readCount}</b> {t('groupDetail.readTodaySuffix', { count: readCount })}
              </>
            )}
          </span>
        </div>
      ) : (
        // Sin compartir no se ve la lectura del grupo (es recíproca): abre la hoja
        // para activarlo acá mismo, sin ir a Ajustes.
        <button
          type="button"
          onClick={onAskShare}
          className="mt-1.5 flex min-h-11 items-center gap-2.5 text-left"
          style={{ color: 'var(--accent-ink)' }}
        >
          <BookIcon size={18} />
          <span className="text-[14px] font-medium">{t('groupDetail.shareToSee')} ›</span>
        </button>
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
