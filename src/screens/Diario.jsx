import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtWeekdayDayMonth, fmtISODate, capitalize } from '../i18n/dates.js'
import {
  getReflectionJournal,
  upsertReflection,
  deleteReflection,
  localDateISO,
  todayLocalISO,
} from '../lib/db.js'
import { planName } from '../lib/planLabels.js'
import { SkeletonCards } from '../components/Skeleton.jsx'
import RetryError from '../components/RetryError.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ReflectionSheet from '../components/ReflectionSheet.jsx'
import { PencilIcon } from '../components/icons.jsx'

// "Mi camino" — diario de reflexiones del usuario (Feature 1). Se renderiza dentro
// de Progreso (segmento "Mi camino"). Las notas de hoy se editan/borran; las
// pasadas quedan selladas (solo lectura). Cross-plan, más recientes primero.
const PAGE = 30

export default function Diario() {
  const { user } = useAuth()
  const { t, locale } = usePreferences()
  // "sáb, 27 jun" — la metadata arranca cada línea en mayúscula.
  const fmtDay = (iso) => capitalize(fmtWeekdayDayMonth(iso, locale))
  const [entries, setEntries] = useState(null) // null = cargando
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [sheet, setSheet] = useState(null) // entrada en edición/lectura | null

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      const rows = await getReflectionJournal(user.id, { limit: PAGE })
      setEntries(rows)
      setHasMore(rows.length === PAGE)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function loadMore() {
    if (!user || !entries?.length) return
    try {
      const before = entries[entries.length - 1].created_at
      const rows = await getReflectionJournal(user.id, { limit: PAGE, before })
      setEntries((prev) => [...prev, ...rows])
      setHasMore(rows.length === PAGE)
    } catch {
      /* dejamos lo que ya hay cargado */
    }
  }

  const today = todayLocalISO()
  const isEditable = (e) => localDateISO(e.created_at) === today

  if (entries === null && !error) {
    return (
      <div className="mt-5">
        <SkeletonCards count={3} />
      </div>
    )
  }

  if (error) {
    return <RetryError message={t('diario.loadError')} onRetry={load} />
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="✦"
        title={t('diario.empty.title')}
        text={t('diario.empty.text')}
      />
    )
  }

  return (
    <div className="mt-5">
      <ul className="space-y-3">
        {entries.map((e) => {
          const editable = isEditable(e)
          return (
            <li key={e.id}>
              {/* La nota es el título: primero las palabras, la metadata como pie
                  en voz baja (sin plan — se ve al abrir; sin mayúsculas de sección). */}
              <button
                type="button"
                onClick={() => setSheet(e)}
                className="card w-full p-4 text-left"
              >
                <p className="text-[16px] leading-relaxed text-ink">{e.body}</p>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <p className="text-[12px] text-ink-soft">
                    {t('diario.entryMeta', { date: fmtDay(e.created_at), day: e.day_number })}
                  </p>
                  {editable && (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[12px] font-medium"
                      style={{ color: 'var(--accent-ink)' }}
                    >
                      <PencilIcon size={13} />
                      {t('common.edit')}
                    </span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="mt-3 min-h-11 w-full text-center text-[14px] font-semibold"
          style={{ color: 'var(--accent-ink)' }}
        >
          {t('common.loadMore')}
        </button>
      )}

      {sheet && (
        <ReflectionSheet
          planName={planName(t, { slug: sheet.plan_slug, name: sheet.plan_name })}
          dayNumber={sheet.day_number}
          dateLabel={fmtDay(sheet.created_at)}
          initialBody={sheet.body}
          editable={isEditable(sheet)}
          shareData={{
            meta: `${t('progreso.view.camino')} · ${fmtISODate(
              localDateISO(sheet.created_at),
              locale,
              { day: 'numeric', month: 'long', year: 'numeric' }
            ).replace(/ /g, '\u00A0')}`,
            question: sheet.body,
            answer: null,
            refs: [],
            filename: `mi-camino-${localDateISO(sheet.created_at)}.png`,
          }}
          onClose={() => setSheet(null)}
          onSave={async (body) => {
            await upsertReflection(user.id, sheet.plan_id, sheet.day_number, body)
            setSheet(null)
            await load()
          }}
          onDelete={async () => {
            await deleteReflection(user.id, sheet.plan_id, sheet.day_number)
            setSheet(null)
            await load()
          }}
        />
      )}
    </div>
  )
}
