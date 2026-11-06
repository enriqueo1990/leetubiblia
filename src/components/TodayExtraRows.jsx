import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { bookLabel } from '../i18n/books.js'
import { BRAND_SERIF } from '../lib/brandFont.js'
import { RowChevron, PeopleIcon } from './icons.jsx'
import BookCover from './BookCover.jsx'

// Hasta 2 referencias en la línea; el resto se resume como "+N".
function refsLine(refs, locale) {
  if (!refs?.length) return null
  const labels = refs.slice(0, 2).map((ref) => bookLabel(ref, locale))
  const extra = refs.length - labels.length
  return labels.join(' · ') + (extra > 0 ? ` +${extra}` : '')
}

// Filas de "También hoy".
//  - Material: una ficha con su portada (el color de su tapa en la Biblioteca),
//    el nombre entero, el avance compacto ("28 de 107"), QUÉ toca hoy completo
//    —la pregunta, en serif, como en el libro— y una barra fina de avance.
//  - Grupo: dos líneas, el ícono y el nombre arriba; abajo los pasajes; a la
//    derecha el día del plan del grupo.
export default function TodayExtraRows({ rows, rowClassName = 'px-4 py-3', from }) {
  const { t, locale } = usePreferences()
  const origin = from ?? { to: '/', label: t('nav.hoy') }

  return rows.map((row) => {
    const r = row.item
    const done = !row.pending

    if (row.type !== 'group') {
      return (
        <Link
          key={row.key}
          to={`/materiales/${r.slug}`}
          state={{ from: origin }}
          className="flex w-full items-start gap-3.5 p-3.5 text-left"
        >
          <BookCover slug={r.slug} size="xs" className="w-[50px] shrink-0" style={done ? { opacity: 0.6 } : undefined} />
          <span className="min-w-0 flex-1" style={done ? { opacity: 0.6 } : undefined}>
            <span className="sr-only">{t('hoy.extrasTypeMaterial')}: </span>
            {/* El nombre entero, hasta dos líneas: el avance va abajo, junto a la
                barra, para no robarle lugar. */}
            <span className="line-clamp-2 block text-[0.9375rem] font-semibold leading-snug text-ink">{r.label}</span>
            {r.question && (
              <span className="mt-1 line-clamp-3 block text-[0.9375rem] leading-snug text-ink" style={{ fontFamily: BRAND_SERIF }}>
                {r.question}
              </span>
            )}
            <span className="mt-2 flex items-center gap-2.5">
              {r.progress != null && (
                <span className="block h-[3px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--hairline)' }} aria-hidden="true">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(r.progress * 100, 2)}%`, backgroundColor: 'var(--accent)' }}
                  />
                </span>
              )}
              <span className="shrink-0 text-[0.75rem] tabular-nums text-ink-soft">
                {done && (
                  <>
                    <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
                    <span className="sr-only">{t('hoy.extrasReadDone')}. </span>
                  </>
                )}
                {r.shortMeta ?? r.meta}
              </span>
            </span>
          </span>
        </Link>
      )
    }

    const name = r.groupName
    const detail = refsLine(r.refs, locale)
    const meta = `${t('planes.dayN', { n: r.day })} ${t('ajustes.ofTotal', { total: r.totalDays })}`
    return (
      <Link
        key={row.key}
        to={`/grupos/${r.groupId}/lectura`}
        state={{ from: origin }}
        className={`flex min-h-11 w-full items-center justify-between gap-3 text-left ${rowClassName}`}
      >
        <span className="min-w-0 flex-1" style={done ? { opacity: 0.6 } : undefined}>
          <span className="flex items-center gap-2">
            <span className="shrink-0 text-ink-soft">
              <PeopleIcon size={16} />
            </span>
            <span className="sr-only">{t('hoy.extrasTypeGroup')}: </span>
            <span className="block min-w-0 truncate text-[1rem] text-ink">{name}</span>
          </span>
          {detail && <span className="mt-0.5 block truncate pl-6 text-[0.8125rem] text-ink-soft">{detail}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[0.8125rem] tabular-nums text-ink-soft">
            {done && (
              <>
                <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
                <span className="sr-only">{t('hoy.extrasReadDone')}. </span>
              </>
            )}
            {meta}
          </span>
          <RowChevron />
        </span>
      </Link>
    )
  })
}
