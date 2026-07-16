import { Link, useNavigate } from 'react-router-dom'
import { CheckIcon, HeartIcon, PlusIcon } from '../../components/icons.jsx'
import Avatars from '../../components/Avatars.jsx'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'

// Oración — visible para todos, con "Orar" inline. Una sola card agrupada
// (filas + hairlines) en vez de una card por pedido.
export default function GroupPrayers({ prayers, onAddPrayer, onPray }) {
  const { t } = usePreferences()
  const { user } = useAuth()
  const navigate = useNavigate()
  const interceding = (p) => p.intercessors.some((x) => x.user_id === user?.id)

  return (
    <>
      <div className="mt-7 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{t('nav.oracion')}</h2>
        <button
          type="button"
          onClick={onAddPrayer}
          aria-label={t('groupDetail.sharePrayerAria')}
          className="flex h-11 w-11 items-center justify-center rounded-full text-on-accent"
          style={{ backgroundColor: 'var(--accent-action)' }}
        >
          <PlusIcon size={18} />
        </button>
      </div>
      {prayers.length === 0 ? (
        <button type="button" onClick={onAddPrayer} className="card mt-3 flex w-full items-center gap-3 p-4 text-left">
          <span
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-accent-ink"
            style={{ backgroundColor: 'var(--accent-tint)' }}
            aria-hidden="true"
          >
            <HeartIcon size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] text-ink">{t('groupDetail.noPrayers')}</span>
            <span className="mt-0.5 block text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
              {t('groupDetail.shareFirst')} →
            </span>
          </span>
        </button>
      ) : (
        <>
          <ul className="card mt-3 divide-y divide-hairline">
            {prayers.slice(0, 4).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => navigate(`/oracion/${p.id}`)} className="block w-full p-4 text-left">
                  <p className="text-[16px] font-semibold leading-snug text-ink">{p.title}</p>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-soft">{p.description}</p>
                  )}
                </button>
                <div className="flex items-center justify-between gap-3 px-4 pb-4">
                  <div className="flex min-w-0 items-center gap-2">
                    {p.intercessors.length > 0 && (
                      <Avatars people={p.intercessors} size={22} surface="var(--surface)" />
                    )}
                    <span className="truncate text-[12px] text-ink-soft">
                      {p.author_name} ·{' '}
                      {p.intercessors.length > 0
                        ? t('groupDetail.nPraying', { count: p.intercessors.length })
                        : t('groupDetail.nobodyYet')}
                    </span>
                  </div>
                  {p.user_id === user?.id ? (
                    <span className="shrink-0 text-[12px] text-ink-soft">{t('groupDetail.yourPrayer')}</span>
                  ) : interceding(p) ? (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[13px] font-semibold"
                      style={{ color: 'var(--accent-ink)' }}
                    >
                      <CheckIcon size={15} strokeWidth={2.2} /> {t('groupDetail.prayingStatus')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPray(p)}
                      className="min-h-11 shrink-0 rounded-pill px-4 text-[13px] font-semibold"
                      style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
                    >
                      {t('groupDetail.pray')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Link to="/oracion?tab=grupos" className="mt-2 inline-flex min-h-11 items-center text-[14px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
            {t('groupDetail.seeAll')} →
          </Link>
        </>
      )}
    </>
  )
}
