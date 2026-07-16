import { Link } from 'react-router-dom'
import { CheckIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'

// Testimonios — solo cuando existe el primero; una sección vacía que dice
// "no hay nada" es ruido (el flujo para crearlos nace en la oración).
export default function GroupTestimony({ testimony, groupId }) {
  const { t } = usePreferences()
  if (!testimony) return null

  return (
    <>
      <h2 className="mt-7 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {t('groupDetail.testimonies')}
      </h2>
      <Link to={`/grupos/${groupId}/testimonios`} className="card mt-3 block p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-accent-ink"
            style={{ backgroundColor: 'var(--accent-tint)' }}
          >
            <CheckIcon size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[15px] leading-relaxed text-ink">
              &quot;{testimony.testimony || testimony.title}&quot;
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--accent-ink)' }}>
              {testimony.author_name} · {t('groupDetail.seeAll')} →
            </p>
          </div>
        </div>
      </Link>
    </>
  )
}
