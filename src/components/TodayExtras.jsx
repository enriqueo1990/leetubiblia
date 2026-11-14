import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { useTodayExtras } from '../lib/todayExtras.js'
import TodayExtraRows from './TodayExtraRows.jsx'
import { SkeletonRows } from './Skeleton.jsx'
import RetryError from './RetryError.jsx'
import { RowChevron } from './icons.jsx'
import BookCover from './BookCover.jsx'
import { MATERIALS, activeMaterials } from '../lib/materials.js'
import { isLibraryCardSnoozed, snoozeLibraryCard, suggestedMaterials } from '../lib/libraryOffer.js'
import SectionLabel from './SectionLabel.jsx'

// La pista se descarta por usuario. La clave vieja (por dispositivo) se sigue
// leyendo para no volver a mostrarla a quien ya la cerró.
// Todas las lecturas agregadas se ven siempre en Hoy (sin "N más hoy"): esconder
// algunas obligaba a un toque extra para llegar a lo que uno eligió leer.

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
        <SectionLabel inside>{t('hoy.alsoToday')}</SectionLabel>
        <SkeletonRows count={expected} cover libraryRow />
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
        <SectionLabel inside className="mb-0">{t('hoy.alsoToday')}</SectionLabel>
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
        <SectionLabel inside>{t('library.cardLabel')}</SectionLabel>
        <div className="card p-4">
          <Link to="/materiales" state={{ from }} className="block" aria-label={t('library.cardCta')}>
            <div className="grid grid-cols-4 gap-2.5" aria-hidden="true">
              {suggested.map((slug) => (
                <BookCover key={slug} slug={slug} size="sm" />
              ))}
            </div>
            <p className="mt-3.5 text-[1rem] font-semibold leading-snug text-ink">{t('library.cardTitle')}</p>
            <p className="mt-1 text-[0.875rem] leading-snug text-ink-soft">{t('library.cardText')}</p>
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <Link
              to="/materiales"
              state={{ from }}
              className="-ml-1 flex min-h-11 items-center px-1 text-[0.9375rem] font-semibold"
              style={{ color: 'var(--accent-ink)' }}
            >
              {t('library.cardCta')} ›
            </Link>
            <button type="button" onClick={snoozeCard} className="flex min-h-11 items-center px-1 text-[0.875rem] font-medium text-ink-soft">
              {t('library.notNow')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const doorCovers = activeMaterials(profile)
    .map((m) => m.slug)
    .slice(0, 3)

  return (
    <div className="mt-8">
      <SectionLabel inside>{t('hoy.alsoToday')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <TodayExtraRows rows={rows} />
        {/* La puerta fija a la Biblioteca: siempre a un toque, también para quien
            solo tiene lecturas de grupo. Con las tapas de TUS libros (los que ya
            habilitaste), no de los que faltan: acá no se ofrece nada. */}
        <Link to="/materiales" state={{ from }} className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left">
          {doorCovers.length > 0 && (
            <span className="flex shrink-0" aria-hidden="true">
              {doorCovers.map((slug, i) => (
                <BookCover key={slug} slug={slug} size="thumb" className="w-[20px]" style={{ marginLeft: i ? -6 : 0 }} />
              ))}
            </span>
          )}
          <span className="min-w-0 flex-1 text-[1rem] text-ink">{t('library.title')}</span>
          <RowChevron />
        </Link>
      </div>
      {errorBlock}
    </div>
  )
}
