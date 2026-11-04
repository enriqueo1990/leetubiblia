import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { useTodayExtras } from '../lib/todayExtras.js'
import TodayExtraRows from './TodayExtraRows.jsx'
import { SkeletonRows } from './Skeleton.jsx'
import RetryError from './RetryError.jsx'
import { ChevronRight } from './icons.jsx'
import BookCover from './BookCover.jsx'
import { MATERIALS } from '../lib/materials.js'
import { isLibraryCardSnoozed, snoozeLibraryCard, suggestedMaterials } from '../lib/libraryOffer.js'

// La pista se descarta por usuario. La clave vieja (por dispositivo) se sigue
// leyendo para no volver a mostrarla a quien ya la cerró.
const INLINE_LIMIT = 4 // hasta acá se ven todas las filas
const PREVIEW_ROWS = 3 // con más, se ven estas y un "Ver todas"

// Cuántas filas se mostraron la última vez, por usuario: sirve para reservar el
// alto mientras carga y que la barra de acción de Hoy no salte al llegar los datos.
const countKey = (userId) => `ltb.extrasCount.${userId}`
function readCount(userId) {
  try {
    const n = Number(localStorage.getItem(countKey(userId)))
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export default function TodayExtras() {
  const { t } = usePreferences()
  const { user } = useAuth()
  const { loading, profile, rows, error, retry } = useTodayExtras()
  // La tarjeta de la Biblioteca (para quien no tiene materiales): "Ahora no" la
  // duerme unas semanas. Reemplaza a la pista gris de antes, que se descartaba
  // para siempre y casi nadie veía.
  const [cardSnoozed, setCardSnoozed] = useState(() => isLibraryCardSnoozed(user?.id))
  function snoozeCard() {
    snoozeLibraryCard(user?.id)
    setCardSnoozed(true)
  }

  const userId = user?.id
  useEffect(() => {
    if (loading || !userId) return
    try {
      localStorage.setItem(countKey(userId), String(rows.length))
    } catch {
      /* sin almacenamiento: solo se pierde la reserva de alto */
    }
  }, [loading, userId, rows.length])

  if (loading) {
    // Lo guardado refleja lo último que de verdad se mostró (ya sin materiales
    // completados); si no hay dato, se estima con los materiales activos.
    const saved = userId ? readCount(userId) : 0
    const expected = saved || (Array.isArray(profile?.active_materials) ? profile.active_materials.length : 0)
    if (expected === 0) return null
    return (
      <div className="mt-8" aria-hidden="true">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('hoy.alsoToday')}
        </p>
        <SkeletonRows count={Math.min(expected, INLINE_LIMIT)} twoLine />
      </div>
    )
  }

  const errorBlock = error ? (
    <RetryError message={t('hoy.extrasLoadError')} onRetry={retry} />
  ) : null

  if (rows.length === 0 && error) {
    // No ofrecer la pista de materiales a quien quizá sí tiene lecturas: avisar.
    return (
      <div className="mt-8">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('hoy.alsoToday')}
        </p>
        {errorBlock}
      </div>
    )
  }

  const from = { to: '/', label: t('nav.hoy') }
  const toAdd = suggestedMaterials(profile, MATERIALS.length) // los que no están en el estante
  const suggested = toAdd.slice(0, 4)

  // A · Sin otras lecturas: la Biblioteca se presenta con sus portadas.
  if (rows.length === 0) {
    if (!profile || cardSnoozed || suggested.length === 0) return null
    return (
      <div className="mt-8">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">{t('library.cardLabel')}</p>
        <div className="card p-4">
          <Link to="/materiales" state={{ from }} className="block" aria-label={t('library.cardCta')}>
            <div className="grid grid-cols-4 gap-2.5" aria-hidden="true">
              {suggested.map((slug) => (
                <BookCover key={slug} slug={slug} size="sm" />
              ))}
            </div>
            <p className="mt-3.5 text-[16px] font-semibold leading-snug text-ink">{t('library.cardTitle')}</p>
            <p className="mt-1 text-[14px] leading-snug text-ink-soft">{t('library.cardText')}</p>
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <Link
              to="/materiales"
              state={{ from }}
              className="-ml-1 flex min-h-11 items-center px-1 text-[15px] font-semibold"
              style={{ color: 'var(--accent-ink)' }}
            >
              {t('library.cardCta')} ›
            </Link>
            <button type="button" onClick={snoozeCard} className="flex min-h-11 items-center px-1 text-[14px] font-medium text-ink-soft">
              {t('library.notNow')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const overflow = rows.length > INLINE_LIMIT
  const shown = overflow ? rows.slice(0, PREVIEW_ROWS) : rows

  return (
    <div className="mt-8">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
        {t('hoy.alsoToday')}
      </p>
      <div className="card divide-y divide-hairline">
        <TodayExtraRows rows={shown} />
        {overflow ? (
          // Con más de las que entran: una sola fila con las portadas de las
          // que quedan y la Biblioteca; Lecturas tiene todas y el estante.
          <Link to="/lecturas" className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left">
            <span className="flex shrink-0" aria-hidden="true">
              {rows.slice(PREVIEW_ROWS, PREVIEW_ROWS + 3).map((row, i) =>
                row.type === 'group' ? null : (
                  <BookCover key={row.key} slug={row.item.slug} size="thumb" className="w-[15px]" style={{ marginLeft: i ? -5 : 0 }} />
                )
              )}
            </span>
            <span className="min-w-0 flex-1 text-[15px] text-ink">
              {t('hoy.extrasMoreToday', { count: rows.length - PREVIEW_ROWS })} · {t('library.title')}
            </span>
            <span className="text-ink-soft" style={{ opacity: 0.5 }}>
              <ChevronRight size={18} />
            </span>
          </Link>
        ) : (
          // B · La puerta fija a la Biblioteca: siempre a un toque, también para
          // quien solo tiene lecturas de grupo.
          <Link to="/materiales" state={{ from }} className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left">
            {suggested.length > 0 && (
              <span className="flex shrink-0" aria-hidden="true">
                {suggested.slice(0, 3).map((slug, i) => (
                  <BookCover key={slug} slug={slug} size="thumb" className="w-[15px]" style={{ marginLeft: i ? -5 : 0 }} />
                ))}
              </span>
            )}
            <span className="min-w-0 flex-1 text-[16px] text-ink">{t('library.title')}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-soft">
              {toAdd.length > 0 && t('library.moreToAdd', { count: toAdd.length })}
              <span style={{ opacity: 0.5 }}>
                <ChevronRight size={18} />
              </span>
            </span>
          </Link>
        )}
      </div>
      {errorBlock}
    </div>
  )
}
