import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BRAND_SERIF } from '../lib/brandFont.js'
import { PlusIcon, LockIcon, PeopleIcon, HeartIcon } from '../components/icons.jsx'
import Segmented from '../components/Segmented.jsx'
import RetryError from '../components/RetryError.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import PrayerSheet from './PrayerSheet.jsx'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtDate } from '../i18n/dates.js'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'
import { getMyPrayers, getGroupPrayers, getMyGroups, getPrayersToReview, markPrayerReviewed } from '../lib/db.js'
import SectionLabel from '../components/SectionLabel.jsx'

// Oración (documento maestro §5.4, README pantalla 4).

function PrayerItem({ p, subtitle, onClick, dimmed }) {
  const { t } = usePreferences()
  const count = p.intercessor_count ?? 0
  return (
    <li>
      <button type="button" onClick={onClick} className="card flex w-full items-center justify-between p-4 text-left">
        <div className="min-w-0 pr-3">
          <p className={`line-clamp-2 text-[16px] font-semibold leading-snug ${dimmed ? 'text-ink-soft' : 'text-ink'}`}>
            {p.title}
          </p>
          <p className="text-[13px] text-ink-soft">{subtitle}</p>
          {p.visibility === 'shared' && count > 0 && (
            <p className="mt-0.5 text-[12px] font-medium" style={{ color: 'var(--accent-ink)' }}>
              {t('oracion.praying', { count })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-ink-soft">
          {p.visibility === 'private' ? (
            <LockIcon size={15} aria-hidden="false" aria-label={t('oracion.visibilityPrivate')} />
          ) : (
            <PeopleIcon size={16} aria-hidden="false" aria-label={t('oracion.visibilityShared')} />
          )}
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
  const online = useOnlineStatus()
  const fmtD = (iso) => fmtDate(iso, locale, { day: 'numeric', month: 'short' })
  const SEGMENTS = [
    { key: 'mine', label: t('oracion.tab.mine') },
    { key: 'groups', label: t('oracion.tab.groups') },
  ]
  const [searchParams, setSearchParams] = useSearchParams()
  const [seg, setSeg] = useState(searchParams.get('tab') === 'grupos' ? 'groups' : 'mine')
  // La pestaña vive también en la URL: al volver de un pedido (miga o atrás) o al
  // recargar, la lista aparece en la misma pestaña en la que estabas.
  function changeSeg(key) {
    setSeg(key)
    setSearchParams(key === 'groups' ? { tab: 'grupos' } : {}, { replace: true })
  }
  const backHere = seg === 'groups' ? '/oracion?tab=grupos' : '/oracion'
  const [mine, setMine] = useState(null)
  const [toReview, setToReview] = useState([])
  const [groupPrayers, setGroupPrayers] = useState(null)
  const [groups, setGroups] = useState([])
  const [sheet, setSheet] = useState(null) // { mode, prayer? } | null
  const [error, setError] = useState(false)
  const [reviewAction, setReviewAction] = useState({ busyId: null, errorId: null })

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

  async function sigueIgual(p) {
    if (!online || reviewAction.busyId != null) return
    setReviewAction({ busyId: p.id, errorId: null })
    // Optimista: saco el pedido de la lista de revisión al instante.
    setToReview((prev) => prev.filter((x) => x.id !== p.id))
    try {
      await markPrayerReviewed(p.id)
      setReviewAction({ busyId: null, errorId: null })
    } catch {
      setToReview((prev) => [...prev, p]) // revertir si falla
      setReviewAction({ busyId: null, errorId: p.id })
    }
  }

  // Todos los pedidos propios abren el mismo detalle (privados y compartidos):
  // un solo modelo mental. Editar vive en el detalle.
  const openPrayer = (p, extra = {}) =>
    navigate(`/oracion/${p.id}`, {
      state: { from: { to: backHere, label: t('nav.oracion') }, ...extra },
    })

  // "Míos": activos primero, luego respondidos atenuados. Los que ya están en
  // "Para volver a orar" no se repiten abajo.
  const reviewIds = new Set(toReview.map((p) => p.id))
  const allActive = mine?.filter((p) => p.status === 'active') ?? []
  const myActive = allActive.filter((p) => !reviewIds.has(p.id))
  const myAnswered = mine?.filter((p) => p.status === 'answered') ?? []

  // "De mis grupos": agrupados por nombre de grupo.
  const byGroup = {}
  for (const p of groupPrayers ?? []) {
    const name = p.group?.name ?? t('common.grupo')
    ;(byGroup[name] ??= []).push(p)
  }

  // Pedidos activos para recorrer en "Orar ahora" (míos + de mis grupos).
  const activeToPray = allActive.length + (groupPrayers?.length ?? 0)

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">{t('oracion.title')}</h1>
        <button
          type="button"
          aria-label={t('oracion.new')}
          onClick={() => setSheet({ mode: 'create' })}
          disabled={!online}
          className="flex h-[44px] items-center justify-center gap-1 rounded-full px-3 lg:px-4"
          style={{ color: 'var(--accent-ink)', minWidth: 44, opacity: online ? 1 : 0.45 }}
        >
          <PlusIcon size={20} />
          <span className="hidden text-[15px] font-semibold lg:inline">{t('oracion.new')}</span>
        </button>
      </div>

      {/* Orar ahora: el flujo principal de esta pantalla, y la única acción fuerte.
          Una tarjeta calma en el tinte del acento (no un botón más entre botones),
          con el título en la serif de la marca: para que Oración no se vuelva un
          inbox. */}
      {activeToPray > 0 && (
        <Link
          to="/orar"
          className="card mt-5 flex items-center justify-between gap-4 p-5 transition-transform active:scale-[0.99]"
          style={{ backgroundColor: 'var(--accent-tint)', boxShadow: 'none' }}
        >
          <span className="min-w-0">
            <span className="block text-[24px] font-medium leading-tight text-ink" style={{ fontFamily: BRAND_SERIF }}>
              {t('orar.cta')}
            </span>
            <span className="mt-1 block text-[14px] text-ink-soft">{t('orar.ctaOneByOne', { count: activeToPray })}</span>
          </span>
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-on-accent"
            style={{ backgroundColor: 'var(--accent-action)' }}
          >
            <HeartIcon size={22} />
          </span>
        </Link>
      )}

      <Segmented label={t('oracion.title')} className="mt-5" options={SEGMENTS} value={seg} onChange={changeSeg} />

      {error && <RetryError message={t('oracion.loadError')} onRetry={load} />}

      {/* Míos */}
      {seg === 'mine' && (
        <div className="mt-4">
          {/* Pedidos propios que conviene volver a sostener o actualizar. */}
          {toReview.length > 0 && (
            <div className="mb-6">
              <SectionLabel>{t('oracion.toReview')}</SectionLabel>
              <div className="card divide-y divide-hairline">
                {toReview.map((p) => {
                  const dias = daysSince(p.last_reviewed_at ?? p.created_at)
                  return (
                    <div key={p.id} className="p-4">
                      <p className="line-clamp-2 text-[15px] font-semibold text-ink">{p.title}</p>
                      <p className="mt-0.5 text-[13px] text-ink-soft">
                        {t('oracion.activeFor', { count: dias })}
                      </p>
                      {/* Acciones como texto dentro de su tarjeta: la acción fuerte de la
                          pantalla es "Orar ahora"; acá no compiten botones rellenos. */}
                      <div className="mt-1 flex gap-5">
                        <button
                          type="button"
                          onClick={() => sigueIgual(p)}
                          disabled={!online || reviewAction.busyId === p.id}
                          className="-ml-1 flex min-h-11 items-center px-1 text-[15px] font-semibold disabled:opacity-50"
                          style={{ color: 'var(--accent-ink)' }}
                        >
                          {reviewAction.busyId === p.id ? '…' : t('oracion.stillSame')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPrayer(p, { openUpdate: p.status === 'active' })}
                          className="flex min-h-11 items-center px-1 text-[15px] font-medium text-ink-soft"
                        >
                          {t('oracion.review')}
                        </button>
                      </div>
                      {reviewAction.errorId === p.id && (
                        <p className="mt-2 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>
                          {t('oracion.reviewSaveError')}{' '}
                          <button
                            type="button"
                            onClick={() => sigueIgual(p)}
                            className="inline-flex min-h-11 items-center px-1 font-semibold underline underline-offset-2"
                          >
                            {t('common.retry')}
                          </button>
                        </p>
                      )}
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
                onClick={() => openPrayer(p)}
              />
            ))}
          </ul>
          {myAnswered.length > 0 && (
            <>
              <SectionLabel className="mt-6">{t('oracion.answeredSection')}</SectionLabel>
              <ul className="space-y-3">
                {myAnswered.map((p) => (
                  <PrayerItem
                    key={p.id}
                    p={p}
                    dimmed
                    subtitle={t('oracion.answeredOn', { date: fmtD(p.answered_at || p.created_at) })}
                    onClick={() => openPrayer(p)}
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
                <SectionLabel>{name}</SectionLabel>
                <ul className="space-y-3">
                  {[...active, ...answered].map((p) => (
                    <PrayerItem
                      key={p.id}
                      p={p}
                      dimmed={p.status === 'answered'}
                      subtitle={`${p.author_name ?? t('common.someone')} · ${fmtD(p.created_at)}`}
                      onClick={() => navigate(`/oracion/${p.id}`, { state: { from: { to: backHere, label: t('nav.oracion') } } })}
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
