import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReading } from '../hooks/useReading.js'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtISODate } from '../i18n/dates.js'
import { todayLocalISO, addDaysISO, countReflections, longestStreak } from '../lib/db.js'
import Segmented from '../components/Segmented.jsx'
import Diario from './Diario.jsx'
import EmptyState from '../components/EmptyState.jsx'
import InlineError from '../components/InlineError.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'

// Progreso — sub-vista de Hoy (documento maestro §5.2, README pantalla 2).
// Racha, % y CALENDARIO DE CONSTANCIA de las últimas 5 semanas: cada cuadrado se
// pinta si ESE día del calendario marcaste alguna lectura (completed_on). Misma
// base que la racha, así la grilla y el número coinciden siempre (antes la grilla
// pintaba "el día del plan agendado para esa fecha", que divergía de la racha).
// Solo lectura: para corregir el día se usa Ajustes › "¿en qué día vas?" o Hoy.

function weekdayMonFirst(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 // 0 = lunes
}

// 35 celdas: desde el lunes de hace 4 semanas hasta el domingo de esta semana.
function buildGrid(todayISO) {
  const mondayThisWeek = addDaysISO(todayISO, -weekdayMonFirst(todayISO))
  const start = addDaysISO(mondayThisWeek, -28)
  return Array.from({ length: 35 }, (_, i) => addDaysISO(start, i))
}

export default function Progreso() {
  const r = useReading()
  const { user, profile } = useAuth()
  const { t, locale } = usePreferences()
  const reflectionsEnabled = !!profile?.reflections_enabled
  const [seg, setSeg] = useState('progreso')
  // Si apagó el diario pero ya escribió notas, "Mi camino" sigue a mano: esconderlo
  // dejaba esas notas inalcanzables dentro de la app.
  const [hasNotes, setHasNotes] = useState(false)
  useEffect(() => {
    if (reflectionsEnabled || !user) return
    let on = true
    countReflections(user.id).then((n) => on && setHasNotes(n > 0))
    return () => {
      on = false
    }
  }, [reflectionsEnabled, user])
  const showCamino = reflectionsEnabled || hasNotes
  // Confirmación de reprogramar visible unos segundos aunque el aviso de atraso
  // desaparezca (con éxito el atraso baja a 0 en el mismo render).
  const [showReprogramado, setShowReprogramado] = useState(false)
  useEffect(() => {
    if (!r.reprogramado || r.loading) return
    setShowReprogramado(true)
    const id = setTimeout(() => setShowReprogramado(false), 4000)
    return () => clearTimeout(id)
  }, [r.reprogramado, r.loading])
  // Misma regla que Hoy: si estás leyendo adelantado, "te atrasaste" contradice.
  const anchoredAhead = r.displayDay != null && r.todayDay != null && r.displayDay > r.todayDay
  const showBehindNote = r.behind > 0 && !anchoredAhead
  const todayISO = todayLocalISO()
  const grid = buildGrid(todayISO)
  const duration = r.plan?.duration_days ?? 0
  // Para el resumen accesible del calendario (lectores de pantalla).
  const readLast35 = grid.filter((iso) => iso <= todayISO && r.readDates.has(iso)).length
  const daysLast35 = grid.filter((iso) => iso <= todayISO).length
  const bestStreak = longestStreak(r.readDates)

  const PROG_VIEWS = [
    { key: 'progreso', label: t('progreso.view.progreso') },
    { key: 'camino', label: t('progreso.view.camino') },
  ]
  const WEEKDAYS = t('progreso.weekdays').split(',')
  // "2026-06-26" → "26 de junio" para etiquetas accesibles del heatmap.
  const longDate = (iso) => fmtISODate(iso, locale, { day: 'numeric', month: 'long' })

  return (
    <div className="pt-2">
      {/* Pantalla top-level (4º ítem de la nav primaria desde 2026-07): sin miga. */}
      <h1 className="text-[26px] font-bold tracking-tight text-ink">{t('nav.progreso')}</h1>

      {!r.loading && r.hasPlan && r.displayDay != null && (
        <p className="mt-1 text-[14px] text-ink-soft">
          {t('progreso.position', { day: r.displayDay })}
          {r.todayDay != null && r.displayDay > r.todayDay && (
            <span className="ml-1">{t('progreso.positionAhead', { day: r.todayDay })}</span>
          )}
        </p>
      )}

      {showCamino && (
        <Segmented className="mt-4" options={PROG_VIEWS} value={seg} onChange={setSeg} />
      )}

      {showCamino && seg === 'camino' ? (
        <Diario />
      ) : r.loading ? (
        // Sin esto, durante la carga se veía un flash de "0 días de racha / 0%".
        <div className="mt-6" aria-hidden="true">
          <SkeletonCards count={2} />
        </div>
      ) : r.offline && !r.plan && r.hasPlan ? (
        // Sin conexión y sin snapshot: mostrar ceros sería presentar como dato lo
        // que no se sabe (justo en la racha, la métrica más sensible).
        <EmptyState text={t('progreso.offlineNoData')} />
      ) : !r.hasPlan ? (
        <p className="mt-8 text-[15px] text-ink-soft">
          {t('progreso.noPlanPre')}
          <Link
            to="/planes"
            state={{ from: { to: '/progreso', label: t('nav.progreso') } }}
            className="font-medium"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('nav.planes')}
          </Link>
          {t('progreso.noPlanPost')}
        </p>
      ) : (
        <>
          {r.offline && (
            <p className="mt-3 text-[13px] text-ink-soft">
              {t('progreso.offline')}
            </p>
          )}

          <div className="lg:grid lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:gap-8">
          <div>
          {/* Stat cards */}
          <h2 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            {t('progreso.sectionConstancy')}
          </h2>
          <div className="mt-3 flex gap-3">
            <div className="card flex-1 p-4">
              {r.streak > 0 ? (
                <>
                  <p className="stat-num text-[30px] font-bold text-accent-ink">{r.streak}</p>
                  <p className="text-[13px] text-ink-soft">
                    {t('progreso.streakDays', { count: r.streak })}
                  </p>
                </>
              ) : (
                // Sin racha viva no se abre con un "0" héroe: el atraso es un dato,
                // no un reto.
                <>
                  <p className="text-[15px] leading-snug text-ink-soft">{t('progreso.noStreakYet')}</p>
                  {bestStreak > 0 && (
                    <p className="mt-1 text-[13px] text-ink-soft">{t('progreso.bestStreak', { count: bestStreak })}</p>
                  )}
                </>
              )}
            </div>
            <div className="card flex-1 p-4">
              <p className="stat-num text-[30px] font-bold text-ink">
                {r.percent}%
              </p>
              <p className="text-[13px] text-ink-soft">
                {t('progreso.ofDays', { done: r.completedCount, total: duration })}
              </p>
            </div>
          </div>
          </div>

          <div>

          <h2 className="mt-7 text-[13px] font-semibold uppercase tracking-wide text-ink-soft lg:mt-5">
            {t('progreso.last5weeks')}
          </h2>

          {/* Header de días */}
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-center text-[12px] font-medium text-ink-soft">
                {w}
              </div>
            ))}
          </div>

          {/* Calendario de constancia (solo lectura): pinta los días reales con lectura. */}
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {grid.map((iso) => {
              const isFuture = iso > todayISO
              const read = r.readDates.has(iso)
              const state = isFuture
                ? t('progreso.state.future')
                : read
                  ? t('progreso.state.read')
                  : t('progreso.state.unread')

              return (
                <div
                  key={iso}
                  role="img"
                  aria-label={`${longDate(iso)} · ${state}`}
                  className="flex items-center justify-center rounded-pill"
                  style={{
                    aspectRatio: '1',
                    backgroundColor: read ? 'var(--accent)' : 'transparent',
                    border: read ? 'none' : `1px ${isFuture ? 'dashed' : 'solid'} var(--hairline)`,
                    opacity: isFuture ? 0.5 : 1,
                  }}
                />
              )
            })}
          </div>
          <p className="sr-only">
            {t('progreso.heatmapSummary', { read: readLast35, total: daysLast35 })}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-accent" />{t('progreso.state.read')}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-control-border" />{t('progreso.state.unread')}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-dashed border-control-border opacity-50" />{t('progreso.state.future')}</span>
          </div>

          <p className="mt-3 text-[13px] leading-snug text-ink-soft">{t('progreso.heatmapHint')}</p>

          {/* Acceso al recorrido (logros + números acumulados) */}
          <Link to="/recorrido" className="card mt-6 flex items-center justify-between px-4 py-3.5">
            <span>
              <span className="block text-[15px] font-semibold text-ink">{t('progreso.recorrido.title')}</span>
              <span className="block text-[13px] text-ink-soft">{t('progreso.recorrido.subtitle')}</span>
            </span>
            <span aria-hidden="true" className="text-[18px]" style={{ color: 'var(--accent-ink)' }}>
              ›
            </span>
          </Link>
          </div>
          </div>

          {/* Nota neutra de atraso */}
          {showBehindNote && (
            <>
              <p className="mt-6 text-[15px] text-ink-soft">
                {t('progreso.behindPre', { count: r.behind })}
                <button
                  type="button"
                  onClick={r.reprogramar}
                  disabled={r.reprogramando}
                  className="font-medium"
                  style={{ color: 'var(--accent-ink)', opacity: r.reprogramando ? 0.5 : 1 }}
                >
                  {r.reprogramando ? t('progreso.behindReprogramando') : t('progreso.behindReprogramar')}
                </button>
                {t('progreso.behindPost')}
              </p>
              {r.reprogramarError && <InlineError message={t('hoy.reprogramarError')} className="mt-2" />}
            </>
          )}
          {showReprogramado && (
            <p className="mt-3 text-[13px]" style={{ color: 'var(--accent-ink)' }} role="status">
              ✓ {t('progreso.reprogramado')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
