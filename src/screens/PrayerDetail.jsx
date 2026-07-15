import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { HeartIcon, CheckIcon, PlusIcon } from '../components/icons.jsx'
import BackLink from '../components/BackLink.jsx'
import Avatars from '../components/Avatars.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import RetryError from '../components/RetryError.jsx'
import PrayerSheet from './PrayerSheet.jsx'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtDate } from '../i18n/dates.js'
import {
  getPrayerDetail,
  addIntercession,
  removeIntercession,
  getMyGroups,
  addPrayerUpdate,
  deletePrayerUpdate,
  markPrayerReviewed,
  updatePrayer,
} from '../lib/db.js'
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
  const fmtLongD = (iso) => fmtDate(iso, locale, { day: 'numeric', month: 'long' })
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [groups, setGroups] = useState([])
  // Historia del pedido: composer del autor + confirmación de borrado.
  const [adding, setAdding] = useState(false)
  const [updateBody, setUpdateBody] = useState('')
  const [savingUpdate, setSavingUpdate] = useState(false)
  const [updateError, setUpdateError] = useState(false)
  const [confirmDeleteUpdate, setConfirmDeleteUpdate] = useState(null) // update | null
  const [markingAnswered, setMarkingAnswered] = useState(false)

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
        <RetryError message={error} onRetry={load} />
      </div>
    )
  }
  if (!data) return <SkeletonDetail />

  const { intercessors, intercessor_count: count, i_intercede } = data
  const isAuthor = data.user_id === user?.id
  const updates = data.updates ?? []
  const displayAuthor = isAuthor ? t('common.you') : data.author_name

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

  // Agregar una actualización (solo el autor). Al contar cómo sigue, el pedido
  // queda acompañado: se reinicia el reloj para volver a sostenerlo más adelante.
  async function saveUpdate() {
    const body = updateBody.trim()
    if (!body || savingUpdate) return
    setSavingUpdate(true)
    setUpdateError(false)
    try {
      const row = await addPrayerUpdate(data.id, user.id, body)
      setData((d) => ({ ...d, updates: [...d.updates, row] }))
      setUpdateBody('')
      setAdding(false)
      markPrayerReviewed(data.id).catch(() => {})
    } catch {
      setUpdateError(true)
    } finally {
      setSavingUpdate(false)
    }
  }

  async function removeUpdate(u) {
    setConfirmDeleteUpdate(null)
    const prev = data.updates
    // Optimista con reversión honesta: desaparece ya; si el borrado falla, vuelve.
    setData((d) => ({ ...d, updates: d.updates.filter((x) => x.id !== u.id) }))
    try {
      await deletePrayerUpdate(u.id)
    } catch {
      setData((d) => ({ ...d, updates: prev }))
    }
  }

  async function markAnswered() {
    if (!isAuthor || data.status !== 'active' || markingAnswered) return
    setMarkingAnswered(true)
    const answeredAt = data.answered_at ?? new Date().toISOString()
    try {
      await updatePrayer(data.id, { status: 'answered', answered_at: answeredAt })
      setData((d) => ({ ...d, status: 'answered', answered_at: answeredAt }))
    } catch {
      await load().catch(() => {})
    } finally {
      setMarkingAnswered(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-116px)] flex-col pt-2">
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

      <article className="card mt-5 px-5 py-5">
        <h1 className="text-[21px] font-medium leading-[1.35] text-ink">
          {data.title}
        </h1>

        {data.description && (
          <p className="mt-2.5 whitespace-pre-line text-[16px] leading-[1.6] text-ink-soft">
            {data.description}
          </p>
        )}

        <p className="mt-4 text-[13.5px] leading-snug text-ink-soft">
          {displayAuthor} · {fmtLongD(data.created_at)}
          {data.group?.name ? ` · ${data.group.name}` : ''}
        </p>

        {data.status === 'answered' && (
          <p className="mt-2 text-[13px] font-medium text-accent-ink">
            {t('oracion.answeredOn', { date: fmtLongD(data.answered_at || data.created_at) })}
          </p>
        )}
      </article>

      {/* Interacción del pedido: quién ora + gesto de oración. */}
      <div className="px-1 pt-[18px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {count > 0 ? (
              <Avatars people={intercessors} count={count} size={26} />
            ) : (
              <HeartIcon size={17} className="shrink-0 text-accent-ink" />
            )}
            <p className="min-w-0 text-[14.5px] text-ink-soft">{countLabel}</p>
          </div>

          {!isAuthor && data.status !== 'active' ? (
            <p className="shrink-0 text-[13px] text-ink-soft">{t('prayerDetail.answered')}</p>
          ) : !isAuthor && i_intercede ? (
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              aria-pressed="true"
              className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-medium text-accent-ink"
            >
              <CheckIcon size={16} strokeWidth={2.2} /> {t('prayerDetail.youArePraying')}
            </button>
          ) : !isAuthor ? (
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              aria-pressed="false"
              className="inline-flex min-h-11 shrink-0 items-center rounded-pill border px-[15px] py-[7px] text-[14px] font-medium"
              style={{
                backgroundColor: 'var(--accent-tint)',
                borderColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
                color: 'var(--accent-ink)',
              }}
            >
              {t('prayerDetail.iAmPraying')}
            </button>
          ) : null}
        </div>

        {!isAuthor && data.status === 'active' && i_intercede && (
          <p className="mt-2 text-[13px] text-ink-soft">
            {t('prayerDetail.authorWillKnow', { author: data.author_name })}
          </p>
        )}
      </div>

      {updates.length > 0 && (
        <>
          <div className="mx-0 my-4 h-px bg-hairline" />

          <section className="px-1 pt-[14px]">
            <h2 className="text-[13px] font-medium text-ink-soft">
              {t('prayerDetail.updates')}
            </h2>

            <ul className="mt-4 space-y-[18px]">
              {updates.map((u) => (
                <li key={u.id} className="flex items-start gap-3">
                  <span
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-medium"
                    style={{
                      backgroundColor: 'var(--accent-tint)',
                      color: 'var(--accent-ink)',
                    }}
                    aria-hidden="true"
                  >
                    {displayAuthor?.[0] || '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-ink-soft">
                      {displayAuthor} · {fmtD(u.created_at)}
                    </p>
                    <p className="mt-[3px] whitespace-pre-line text-[15.5px] leading-[1.55] text-ink">{u.body}</p>
                    {isAuthor && (
                      <p className="mt-1 text-[12px] text-ink-soft">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteUpdate(u)}
                          className="font-medium"
                          style={{ color: 'var(--danger)' }}
                        >
                          {t('ajustes.eliminar')}
                        </button>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {isAuthor && data.status === 'active' && adding && (
        <div className="mt-5">
          <textarea
            autoFocus
            value={updateBody}
            onChange={(e) => setUpdateBody(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t('prayerDetail.updatePlaceholder')}
            className="w-full resize-none rounded-input px-4 py-3 text-[16px] outline-none"
            style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-primary)' }}
          />
          {updateError && (
            <p className="mt-1 text-[12px]" style={{ color: 'var(--danger)' }}>
              {t('common.saveError')}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveUpdate}
              disabled={!updateBody.trim() || savingUpdate}
              className="btn btn-primary"
              style={{ opacity: !updateBody.trim() || savingUpdate ? 0.5 : 1 }}
            >
              {savingUpdate ? t('common.saving') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setUpdateBody('')
                setUpdateError(false)
              }}
              className="btn btn-secondary"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {isAuthor && data.status === 'active' && !adding && (
        <div className="action-bar mt-auto space-y-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn btn-primary flex items-center justify-center gap-2"
          >
            <PlusIcon size={17} /> {t('prayerDetail.addUpdate')}
          </button>
          <button
            type="button"
            onClick={markAnswered}
            disabled={markingAnswered}
            className="min-h-10 w-full text-center text-[14px] font-medium text-ink-soft"
            style={{ opacity: markingAnswered ? 0.55 : 1 }}
          >
            {markingAnswered ? t('prayerDetail.markingAnswered') : t('prayerDetail.markAnswered')}
          </button>
        </div>
      )}

      {editing && (
        <PrayerSheet
          mode="edit"
          prayer={data}
          groups={groups}
          onClose={() => setEditing(false)}
          onSaved={handleSheetSaved}
          onDeleted={() => navigate('/oracion')}
        />
      )}

      {confirmDeleteUpdate && (
        <ConfirmDialog
          title={t('prayerDetail.deleteUpdateTitle')}
          message={t('prayerSheet.confirmDeleteMsg')}
          confirmLabel={t('ajustes.eliminar')}
          danger
          onConfirm={() => removeUpdate(confirmDeleteUpdate)}
          onCancel={() => setConfirmDeleteUpdate(null)}
        />
      )}
    </div>
  )
}
