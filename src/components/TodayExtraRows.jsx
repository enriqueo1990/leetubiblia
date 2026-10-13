import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { bookLabel } from '../i18n/books.js'
import { BookIcon, ChevronRight, PeopleIcon } from './icons.jsx'

// Hasta 2 referencias en la línea; el resto se resume como "+N".
function refsLine(refs, locale) {
  if (!refs?.length) return null
  const labels = refs.slice(0, 2).map((ref) => bookLabel(ref, locale))
  const extra = refs.length - labels.length
  return labels.join(' · ') + (extra > 0 ? ` +${extra}` : '')
}

// Filas de "También hoy": dos líneas. Arriba, ícono del tipo + nombre; abajo, QUÉ
// leer (pasajes del grupo o pregunta del material). A la derecha, el avance. El
// ícono distingue grupo de material sin depender solo del texto de la meta.
export default function TodayExtraRows({ rows, rowClassName = 'px-4 py-3', from }) {
  const { t, locale } = usePreferences()
  const origin = from ?? { to: '/', label: t('nav.hoy') }

  return rows.map((row) => {
    const isGroup = row.type === 'group'
    const r = row.item
    const to = isGroup ? `/grupos/${r.groupId}/lectura` : `/materiales/${r.slug}`
    const name = isGroup ? r.groupName : r.label
    const detail = isGroup ? refsLine(r.refs, locale) : r.question
    const meta = isGroup
      ? `${t('planes.dayN', { n: r.day })} ${t('ajustes.ofTotal', { total: r.totalDays })}`
      : r.meta
    const Icon = isGroup ? PeopleIcon : BookIcon
    const done = !row.pending

    return (
      <Link
        key={row.key}
        to={to}
        state={{ from: origin }}
        className={`flex min-h-11 w-full items-center justify-between gap-3 text-left ${rowClassName}`}
      >
        <span className="min-w-0 flex-1" style={done ? { opacity: 0.6 } : undefined}>
          <span className="flex items-center gap-2">
            <span className="shrink-0 text-ink-soft">
              <Icon size={16} />
            </span>
            <span className="sr-only">
              {isGroup ? t('hoy.extrasTypeGroup') : t('hoy.extrasTypeMaterial')}:{' '}
            </span>
            <span className="block min-w-0 truncate text-[16px] text-ink">{name}</span>
          </span>
          {detail && (
            <span className="mt-0.5 block truncate pl-6 text-[13px] text-ink-soft">{detail}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[13px] tabular-nums text-ink-soft">
            {done && (
              <>
                <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
                <span className="sr-only">{t('hoy.extrasReadDone')}. </span>
              </>
            )}
            {meta}
          </span>
          <span className="text-ink-soft" style={{ opacity: 0.5 }}>
            <ChevronRight size={18} />
          </span>
        </span>
      </Link>
    )
  })
}
