import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { ChevronRight } from './icons.jsx'

export default function TodayExtraRows({ rows, rowClassName = 'px-4 py-3' }) {
  const { t } = usePreferences()

  return rows.map((row) => {
    if (row.type === 'group') {
      const r = row.item
      return (
        <Link
          key={row.key}
          to={`/grupos/${r.groupId}/lectura`}
          state={{ from: { to: '/', label: t('nav.hoy') } }}
          className={`flex w-full items-center justify-between gap-3 text-left ${rowClassName}`}
        >
          <span className="block min-w-0 flex-1 truncate text-[16px] text-ink">
            {r.groupName}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-[13px] tabular-nums text-ink-soft">
              {r.read && (
                <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
              )}
              {t('planes.dayN', { n: r.day })} {t('ajustes.ofTotal', { total: r.totalDays })}
            </span>
            <span className="text-ink-soft" style={{ opacity: 0.5 }}>
              <ChevronRight size={18} />
            </span>
          </span>
        </Link>
      )
    }

    const m = row.item
    return (
      <Link
        key={row.key}
        to={`/materiales/${m.slug}`}
        state={{ from: { to: '/', label: t('nav.hoy') } }}
        className={`flex w-full items-center justify-between gap-3 text-left ${rowClassName}`}
      >
        <span className="block min-w-0 flex-1 truncate text-[16px] text-ink">
          {m.label}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[13px] tabular-nums text-ink-soft">
            {m.done && (
              <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
            )}
            {m.meta}
          </span>
          <span className="text-ink-soft" style={{ opacity: 0.5 }}>
            <ChevronRight size={18} />
          </span>
        </span>
      </Link>
    )
  })
}
