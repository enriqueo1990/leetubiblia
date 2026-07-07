import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PlusIcon, LockIcon, PeopleIcon, HeartIcon } from '../components/icons.jsx'
import Segmented from '../components/Segmented.jsx'
import RetryError from '../components/RetryError.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import PrayerSheet from './PrayerSheet.jsx'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtDate } from '../i18n/dates.js'
import { getMyPrayers, getGroupPrayers, getMyGroups, getPrayersToReview, markPrayerReviewed } from '../lib/db.js'

// Oración (documento maestro §5.4, README pantalla 4).

function PrayerItem({ p, subtitle, onClick, dimmed }) {
  const { t } = usePreferences()
  const count = p.intercessor_count ?? 0
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="card flex w-full items-center justify-between p-4 text-left"
        style={{ opacity: dimmed ? 0.55 : 1 }}
      >
        <div className="min-w-0 pr-3">
          <p className="truncate text-[16px] font-semibold text-ink">{p.title}</p>
          <p className="text-[13px] text-ink-soft">{subtitle}</p>
          {p.visibility === 'shared' && count > 0 && (
            <p className="mt-0.5 text-[12px] font-medium" style={{ color: 'var(--accent-ink)' }}>
              {t('oracion.praying', { count })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-ink-soft">
          {p.visibility === 'private' ? <LockIcon size={15} /> : <PeopleIcon size={16} />}
          {/* "Activo" es el estado por defecto: solo se señala la excepción. */}
          {p.status === 'answered' && (
            <span
              className="rounded-pill px-2 py-0.5 text-[12px] font-medium"
              style={{ color: 'var(--accent-ink)', backgroundColor: 'var(--accent-tint)' }}
            >
              {t('oracion.answered')}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

export default function Oracion() {
  const { user } = useAuth()
  const { t, locale } = usePreferences()
  const navigate = useNavigate()
  const fmtD = (iso) => fmtDate(iso, locale, { day: 'numeric', month: 'short' })
  const SEGMENTS = [
    { key: 'mine', label: t('oracion.tab.mine') },
    { key: 'groups', label: t('oracion.tab.groups') },
  ]
  const [searchParams] = useSearchParams()
  const [seg, setSeg] = useState(searchParams.get('tab') === 'grupos' ? 'groups' : 'mine')
  const [mine, setMine] = useState(null)
  const [toReview, setToReview] = useState([])
  const [groupPrayers, setGroupPrayers] = useState(null)
  const [groups, setGroups] = useState([])
  const [sheet, setSheet] = useState(null) // { mode, prayer? } | null
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const [m, g, gr, rev] = await Promise.all([
        getMyPrayers(user.id),
        getGroupPrayers(user.id),
        getMyGroups(user.id),
        getPrayersToReview(user.id),
      ])
      setMine(m)
      setGroupPrayers(g)
      setGroups(gr)
      setToReview(rev)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  function closeSheet(reload) {
    setSheet(null)
    if (reload) load()
  }

  function daysSince(iso) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  }

  async function sigeIgual(p) {
    // Optimista: saco el pedido de la lista de revisión al instante.
    setToReview((prev) => prev.filter((x) => x.id !== p.id))
    try {
      await markPrayerReviewed(p.id)
    } catch {
      setToReview((prev) => [...prev, p]) // revertir si falla
    }
  }

  // "Míos": activos primero, luego respondidos atenuados.
  const myActive = mine?.filter((p) => p.status === 'active') ?? []
  const myAnswered = mine?.filter((p) => p.status === 'answered') ?? []

  // "De mis grupos": agrupados por nombre de grupo.
  const byGroup = {}
  for (const p of groupPrayers ?? []) {
    const name = p.group?.name ?? t('common.grupo')
    ;(byGroup[name] ??= []).push(p)
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">{t('oracion.title')}</h1>
        <button
          type="button"
          aria-label={t('oracion.new')}
          onClick={() => setSheet({ mode: 'create' })}
          className="flex h-[44px] items-center justify-center gap-1 rounded-full px-3 text-on-accent lg:px-4"
          style={{ backgroundColor: 'var(--accent)', minWidth: 44 }}
        >
          <PlusIcon size={20} />
          <span className="hidden text-[15px] font-semibold lg:inline">{t('oracion.new')}</span>
        </button>
      </div>

      <Segmented className="mt-5" options={SEGMENTS} value={seg} onChange={setSeg} />

      {error && <RetryError message={t('oracion.loadError')} onRetry={load} />}

      {/* Míos */}
      {seg === 'mine' && (
        <div className="mt-4">
          {/* Para revisar */}
          {toReview.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                {t('oracion.toReview')}
              </p>
              <div className="card divide-y divide-hairline">
                {toReview.map((p) => {
                  const dias = daysSince(p.last_reviewed_at ?? p.created_at)
                  return (
                    <div key={p.id} className="p-4">
                      <p className="truncate text-[15px] font-semibold text-ink">{p.title}</p>
                      <p className="mt-0.5 text-[13px] text-ink-soft">
                        {t('oracion.activeFor', { count: dias })}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => sigeIgual(p)}
                          className="btn btn-secondary flex-1 py-2 text-[14px]"
                        >
                          {t('oracion.stillSame')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSheet({ mode: 'edit', prayer: p })}
                          className="btn btn-primary flex-1 py-2 text-[14px]"
                        >
                          {t('oracion.review')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {mine === null && !error && <SkeletonCards count={3} />}
          {mine?.length === 0 && (
            <EmptyState
              icon={<HeartIcon size={32} />}
              text={t('oracion.empty.mine')}
            />
          )}
          <ul className="space-y-3">
            {myActive.map((p) => (
              <PrayerItem
                key={p.id}
                p={p}
                subtitle={fmtD(p.created_at)}
                onClick={
                  p.visibility === 'shared'
                    ? () => navigate(`/oracion/${p.id}`)
                    : () => setSheet({ mode: 'edit', prayer: p })
                }
              />
            ))}
          </ul>
          {myAnswered.length > 0 && (
            <>
              <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                {t('oracion.answeredSection')}
              </p>
              <ul className="space-y-3">
                {myAnswered.map((p) => (
                  <PrayerItem
                    key={p.id}
                    p={p}
                    dimmed
                    subtitle={t('oracion.answeredOn', { date: fmtD(p.answered_at || p.created_at) })}
                    onClick={
                      p.visibility === 'shared'
                        ? () => navigate(`/oracion/${p.id}`)
                        : () => setSheet({ mode: 'edit', prayer: p })
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* De mis grupos */}
      {seg === 'groups' && (
        <div className="mt-4">
          {groupPrayers === null && !error && <SkeletonCards count={3} />}
          {groupPrayers?.length === 0 &&
            (groups.length === 0 ? (
              <EmptyState
                icon={<PeopleIcon size={32} />}
                text={t('oracion.empty.groups')}
              >
                <Link to="/grupos" className="btn btn-primary inline-block px-8">
                  {t('oracion.goToGroups')}
                </Link>
              </EmptyState>
            ) : (
              <EmptyState text={t('oracion.empty.noShared')} />
            ))}
          {Object.entries(byGroup).map(([name, items]) => {
            const active = items.filter((p) => p.status === 'active')
            const answered = items.filter((p) => p.status === 'answered')
            return (
              <div key={name} className="mb-6">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                  {name}
                </p>
                <ul className="space-y-3">
                  {[...active, ...answered].map((p) => (
                    <PrayerItem
                      key={p.id}
                      p={p}
                      dimmed={p.status === 'answered'}
                      subtitle={`${p.author_name} · ${fmtD(p.created_at)}`}
                      onClick={() => navigate(`/oracion/${p.id}`)}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {sheet && (
        <PrayerSheet
          mode={sheet.mode}
          prayer={sheet.prayer}
          groups={groups}
          onClose={() => closeSheet(false)}
          onSaved={() => closeSheet(true)}
        />
      )}
    </div>
  )
}
