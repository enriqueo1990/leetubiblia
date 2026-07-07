import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { HeartIcon, CheckIcon } from '../components/icons.jsx'
import BackLink from '../components/BackLink.jsx'
import Avatars from '../components/Avatars.jsx'
import PrayerSheet from './PrayerSheet.jsx'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtDate } from '../i18n/dates.js'
import { getPrayerDetail, addIntercession, removeIntercession, getMyGroups } from '../lib/db.js'
import { SkeletonDetail } from '../components/Skeleton.jsx'

// Detalle de un pedido compartido con "Estoy orando por esto" (Fase 2, F2-A).
// Lo abren los miembros desde "De mis grupos"; el autor lo ve sin el botón pero
// con el conteo de quiénes oran (así "se entera" sin push, modelo pull).

export default function PrayerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t, locale } = usePreferences()
  const fmtD = (iso) => fmtDate(iso, locale, { day: 'numeric', month: 'short' })
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [groups, setGroups] = useState([])

  const load = useCallback(async () => {
    setError(null)
    try {
      setData(await getPrayerDetail(Number(id), user?.id))
    } catch {
      setError(t('prayerDetail.loadError'))
    }
  }, [id, user, t])

  useEffect(() => {
    load()
  }, [load])

  // Carga grupos solo si el usuario es autor (necesario para abrir PrayerSheet en edición).
  useEffect(() => {
    if (user) getMyGroups(user.id).then(setGroups).catch(() => {})
  }, [user])

  async function toggle() {
    if (busy || !data || data.status !== 'active') return
    setBusy(true)
    const next = !data.i_intercede
    const meName = profile?.display_name || t('common.you')
    // Optimista: reflejamos el cambio antes de la red.
    setData((d) => ({
      ...d,
      i_intercede: next,
      intercessor_count: d.intercessor_count + (next ? 1 : -1),
      intercessors: next
        ? [...d.intercessors, { user_id: user.id, display_name: meName }]
        : d.intercessors.filter((x) => x.user_id !== user.id),
    }))
    try {
      if (next) await addIntercession(data.id, user.id)
      else await removeIntercession(data.id, user.id)
    } catch {
      await load() // revertir al estado real del servidor
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="pt-2">
        <BackLink to="/oracion" label={t('nav.oracion')} />
        <p className="mt-8 text-[15px] text-ink-soft">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 text-[15px] font-semibold"
          style={{ color: 'var(--accent-ink)' }}
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }
  if (!data) return <SkeletonDetail />

  const { intercessors, intercessor_count: count, i_intercede } = data
  const isAuthor = data.user_id === user?.id

  let countLabel
  if (i_intercede) {
    countLabel = t('prayerDetail.prayingYouIncluded', { count })
  } else if (count > 0) {
    countLabel = t('prayerDetail.prayingForThis', { count })
  } else {
    countLabel = isAuthor ? t('prayerDetail.noneYet') : t('prayerDetail.beFirst')
  }

  async function handleSheetSaved() {
    setEditing(false)
    try {
      await load()
    } catch {
      navigate('/oracion')
    }
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <BackLink to="/oracion" label={t('nav.oracion')} />
        {isAuthor && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[15px] font-medium"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('common.edit')}
          </button>
        )}
      </div>

      {data.group?.name && (
        <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-accent-ink">
          {data.group.name}
        </p>
      )}
      <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-ink">
        {data.title}
      </h1>
      <p className="mt-2 text-[13px] text-ink-soft">
        {data.author_name} · {fmtD(data.created_at)}
      </p>

      {data.description && (
        <p className="mt-5 whitespace-pre-line text-[16px] leading-relaxed text-ink">
          {data.description}
        </p>
      )}

      {/* Intercesión */}
      <div className="card mt-7 p-[18px]">
        {count > 0 && (
          <div className="mb-3.5">
            <Avatars people={intercessors} count={count} />
          </div>
        )}
        <p className="mb-3.5 text-[13px] text-ink-soft">{countLabel}</p>

        {!isAuthor && data.status !== 'active' && (
          <p className="text-center text-[13px] text-ink-soft">
            {t('prayerDetail.answered')}
          </p>
        )}

        {!isAuthor &&
          data.status === 'active' &&
          (i_intercede ? (
            <>
              <button
                type="button"
                onClick={toggle}
                disabled={busy}
                className="btn btn-primary flex items-center justify-center gap-2"
              >
                <CheckIcon size={19} strokeWidth={2.2} /> {t('prayerDetail.youArePraying')}
              </button>
              <p className="mt-2.5 text-center text-[13px] text-ink-soft">
                {t('prayerDetail.authorWillKnow', { author: data.author_name })}
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className="btn btn-secondary flex items-center justify-center gap-2"
              style={{ border: '1px solid var(--accent-ink)', color: 'var(--accent-ink)' }}
            >
              <HeartIcon size={19} /> {t('prayerDetail.iAmPraying')}
            </button>
          ))}
      </div>

      {editing && (
        <PrayerSheet
          mode="edit"
          prayer={data}
          groups={groups}
          onClose={() => setEditing(false)}
          onSaved={handleSheetSaved}
        />
      )}
    </div>
  )
}
