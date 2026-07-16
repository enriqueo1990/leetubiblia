import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { useTodayExtras } from '../lib/todayExtras.js'
import TodayExtraRows from './TodayExtraRows.jsx'
import { ChevronRight } from './icons.jsx'

const HINT_KEY = 'ltb.materialsHint.dismissed'
const INLINE_LIMIT = 2

export default function TodayExtras() {
  const { t } = usePreferences()
  const { loading, profile, rows } = useTodayExtras()
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === '1'
    } catch {
      return true
    }
  })

  function dismissHint() {
    setHintDismissed(true)
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      /* queda descartado en esta sesión */
    }
  }

  if (loading) return null

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

  if (rows.length <= INLINE_LIMIT) {
    return (
      <div className="mt-8">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('hoy.alsoToday')}
        </p>
        <div className="card divide-y divide-hairline">
          <TodayExtraRows rows={rows} />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <Link
        to="/hoy/lecturas"
        state={{ from: { to: '/', label: t('nav.hoy') } }}
        className="card flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            {t('hoy.alsoToday')}
          </span>
          <span className="mt-1 block truncate text-[16px] text-ink">
            {t('hoy.extrasTotalCount', { count: rows.length })}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="hidden text-[13px] font-medium sm:inline" style={{ color: 'var(--accent-ink)' }}>
            {t('hoy.extrasOpen')}
          </span>
          <span className="text-ink-soft" style={{ opacity: 0.5 }}>
            <ChevronRight size={18} />
          </span>
        </span>
      </Link>
    </div>
  )
}
