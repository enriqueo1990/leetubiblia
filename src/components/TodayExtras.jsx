import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { getFollowedGroupReadings } from '../lib/db.js'
import { activeMaterials, getMaterial, loadMaterialContent } from '../lib/materials.js'
import { ChevronRight } from './icons.jsx'

const HINT_KEY = 'ltb.materialsHint.dismissed'

export default function TodayExtras() {
  const { user, profile } = useAuth()
  const { t } = usePreferences()
  const [groupReadings, setGroupReadings] = useState([])
  const materials = activeMaterials(profile)
  const [contents, setContents] = useState({})
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === '1'
    } catch {
      return true
    }
  })

  useEffect(() => {
    if (!user) return
    let on = true
    getFollowedGroupReadings(user.id)
      .then((list) => on && setGroupReadings(list))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [user])

  const activeKey = materials.map((m) => m.slug).join(',')
  useEffect(() => {
    let on = true
    Promise.all(materials.map((m) => loadMaterialContent(m.slug))).then((loaded) => {
      if (!on) return
      const next = {}
      loaded.forEach((c) => {
        if (c) next[c.slug] = c
      })
      setContents(next)
    })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  const visibleGroups = useMemo(
    () =>
      groupReadings.filter(
        (r) =>
          !(
            r.planId === profile?.active_plan_id &&
            r.planStartDate === profile?.plan_start_date
          )
      ),
    [groupReadings, profile?.active_plan_id, profile?.plan_start_date]
  )

  const materialRows = materials
    .map((m) => {
      const content = contents[m.slug]
      if (!content) return null
      const done = m.position > content.total
      const entry = done ? null : content.entries[m.position - 1]
      return {
        slug: m.slug,
        label: getMaterial(m.slug)?.shortName ?? content.name,
        meta: done
          ? t('materialsToday.completed')
          : t('materialsToday.questionOf', { n: entry?.number ?? m.position, total: content.total }),
        done,
      }
    })
    .filter(Boolean)

  const hasRows = visibleGroups.length > 0 || materialRows.length > 0

  function dismissHint() {
    setHintDismissed(true)
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      /* queda descartado en esta sesión */
    }
  }

  if (!hasRows) {
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
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center text-[15px] leading-none text-ink-soft"
          style={{ opacity: 0.5 }}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
        {t('hoy.alsoToday')}
      </p>
      <div className="card divide-y divide-hairline">
        {visibleGroups.map((r) => (
          <Link
            key={`group-${r.groupId}`}
            to={`/grupos/${r.groupId}/lectura`}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
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
        ))}
        {materialRows.map((m) => (
          <Link
            key={`material-${m.slug}`}
            to={`/materiales/${m.slug}`}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
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
        ))}
      </div>
    </div>
  )
}
