import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { getGroupReadingDay, markRead, unmarkRead } from '../lib/db.js'
import { planName } from '../lib/planLabels.js'
import BackLink from '../components/BackLink.jsx'
import RetryError from '../components/RetryError.jsx'
import PassageList from '../components/PassageList.jsx'

// La lectura del día con un grupo (plan seguido como lectura adicional) — misma
// anatomía que Hoy: metadata callada arriba, los pasajes como protagonistas
// (cada uno abre su capítulo en la Biblia) y UNA acción primaria abajo. El día
// lo dicta el calendario del grupo; marcar escribe en reading_progress con el
// plan_id del grupo (el pulso "quién leyó hoy" la cuenta), sin tocar tu plan ni
// tu racha. Se llega desde la fila de "Con tus grupos" en Hoy.
export default function GroupReading() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t, locale } = usePreferences()

  const [data, setData] = useState(null) // null = cargando
  const [noPlan, setNoPlan] = useState(false) // el grupo ya no tiene plan
  const [error, setError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      const d = await getGroupReadingDay(Number(id), user?.id)
      if (!d) setNoPlan(true)
      else setData(d)
    } catch {
      setError(true)
    }
  }, [id, user])

  useEffect(() => {
    load()
  }, [load])

  // El grupo quitó (o cambió a nada) su plan: esta vista no tiene qué mostrar.
  if (noPlan) return <Navigate to={`/grupos/${id}`} replace />

  if (error) {
    return (
      <div className="pt-2">
        <BackLink to="/" label={t('nav.hoy')} />
        <RetryError message={t('groupDetail.loadError')} onRetry={load} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="pt-2" aria-hidden="true">
        <div className="h-4 w-40 rounded-pill" style={{ backgroundColor: 'var(--surface-alt)' }} />
        <div className="mt-9 animate-pulse space-y-2">
          <div className="rounded-pill" style={{ width: '60%', height: 32, backgroundColor: 'var(--surface-alt)' }} />
          <div className="rounded-pill" style={{ width: '44%', height: 32, backgroundColor: 'var(--surface-alt)' }} />
        </div>
      </div>
    )
  }

  // Optimista PERO honesto (canon): la UI cambia ya; si el guardado falla se
  // revierte y se avisa. Idempotente en el servidor, igual que en Hoy.
  async function toggle() {
    const next = !data.read
    setData((d) => ({ ...d, read: next }))
    setSaveError(false)
    try {
      if (next) await markRead(user.id, data.planId, data.day)
      else await unmarkRead(user.id, data.planId, data.day)
    } catch {
      setData((d) => ({ ...d, read: !next }))
      setSaveError(true)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col pt-2">
      <BackLink to="/" label={t('nav.hoy')} />

      {/* Header de UNA línea, como Hoy: el día (tinta suave) + el grupo y su plan
          (metadata más apagada), todo tocable hacia el detalle del grupo. */}
      <Link
        to={`/grupos/${id}`}
        className="mt-3 flex w-fit min-w-0 items-center gap-1.5 py-1 text-[13px] font-medium text-ink-soft"
      >
        {!data.finished && (
          <>
            <span className="shrink-0">
              {t('planes.dayN', { n: data.day })} {t('ajustes.ofTotal', { total: data.totalDays })}
            </span>
            <span aria-hidden="true" className="shrink-0" style={{ opacity: 0.45 }}>·</span>
          </>
        )}
        <span className="truncate" style={{ color: 'var(--placeholder)' }}>
          {data.groupName} — {planName(t, { name: data.planName, slug: data.planSlug })}
        </span>
        <span aria-hidden="true" className="shrink-0" style={{ opacity: 0.5 }}>›</span>
      </Link>

      {data.finished ? (
        <p className="mt-8 text-[15px] text-ink-soft">{t('groupDetail.planFinished')}</p>
      ) : (
        // Los pasajes son la página, como en Hoy: cada referencia abre su capítulo.
        <div className="mt-9 space-y-1">
          <PassageList refs={data.refs} locale={locale} />
        </div>
      )}

      <div className="flex-1 lg:hidden" />

      {/* Zona de acción única: marcar; ya marcado, el estado + desmarcar callado. */}
      {!data.finished && (
        <div className="action-bar">
          <div className="lg:mx-auto lg:max-w-[440px]">
            {saveError && (
              <p className="pb-1 text-[12px]" style={{ color: 'var(--danger)' }}>
                {t('materialReader.saveError')}
              </p>
            )}
            {!data.read ? (
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(12)
                  toggle()
                }}
                className="btn btn-primary"
              >
                {t('hoy.markRead')}
              </button>
            ) : (
              <>
                <p
                  className="py-2 text-center text-[15px] font-semibold"
                  style={{ color: 'var(--accent-ink)' }}
                >
                  ✓ {t('hoy.read')}
                </p>
                <button
                  type="button"
                  onClick={toggle}
                  className="block w-full py-2 text-center text-[14px] font-medium text-ink-soft"
                >
                  {t('hoy.unmark')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
