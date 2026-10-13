import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { useTodayExtras } from '../lib/todayExtras.js'
import TodayExtraRows from './TodayExtraRows.jsx'
import { SkeletonRows } from './Skeleton.jsx'
import RetryError from './RetryError.jsx'
import { ChevronRight } from './icons.jsx'

// La pista se descarta por usuario. La clave vieja (por dispositivo) se sigue
// leyendo para no volver a mostrarla a quien ya la cerró.
const LEGACY_HINT_KEY = 'ltb.materialsHint.dismissed'
const hintKey = (userId) => `${LEGACY_HINT_KEY}.${userId}`
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
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return (
        localStorage.getItem(LEGACY_HINT_KEY) === '1' ||
        (!!user && localStorage.getItem(hintKey(user.id)) === '1')
      )
    } catch {
      return true
    }
  })

  function dismissHint() {
    setHintDismissed(true)
    try {
      if (user) localStorage.setItem(hintKey(user.id), '1')
    } catch {
      /* queda descartado en esta sesión */
    }
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

  if (rows.length === 0) {
    if (!profile || hintDismissed) return null
    return (
      <div className="mt-8 flex items-center">
        <Link
          to="/materiales"
          state={{ from: { to: '/', label: t('nav.hoy') } }}
          className="min-w-0 py-2 text-[13px] text-ink-soft"
        >
          {t('materialsToday.hint')}{' '}
          <span className="font-semibold" style={{ color: 'var(--accent-ink)' }}>
            {t('materialsToday.hintCta')} ›
          </span>
        </Link>
        <button
          type="button"
          onClick={dismissHint}
          aria-label={t('materialsToday.hintDismiss')}
          className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center text-[15px] leading-none text-ink-soft"
          style={{ opacity: 0.5 }}
        >
          ✕
        </button>
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
        {overflow && (
          <Link
            to="/hoy/lecturas"
            state={{ from: { to: '/', label: t('nav.hoy') } }}
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-[15px] font-medium" style={{ color: 'var(--accent-ink)' }}>
              {t('hoy.extrasSeeAll', { count: rows.length })}
            </span>
            <span className="text-ink-soft" style={{ opacity: 0.5 }}>
              <ChevronRight size={18} />
            </span>
          </Link>
        )}
      </div>
      {errorBlock}
    </div>
  )
}
