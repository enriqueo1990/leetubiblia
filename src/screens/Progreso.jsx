import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReading } from '../hooks/useReading.js'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtISODate } from '../i18n/dates.js'
import { todayLocalISO, addDaysISO } from '../lib/db.js'
import Segmented from '../components/Segmented.jsx'
import Diario from './Diario.jsx'
import { CheckIcon } from '../components/icons.jsx'

// Progreso — sub-vista de Hoy (documento maestro §5.2, README pantalla 2).
// Racha, % y CALENDARIO DE CONSTANCIA de las últimas 5 semanas: cada cuadrado se
// pinta si ESE día del calendario marcaste alguna lectura (completed_at). Misma
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
  const { profile } = useAuth()
  const { t, locale } = usePreferences()
  const reflectionsEnabled = !!profile?.reflections_enabled
  const [seg, setSeg] = useState('progreso')
  const todayISO = todayLocalISO()
  const grid = buildGrid(todayISO)
  const duration = r.plan?.duration_days ?? 0

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

      {reflectionsEnabled && (
        <Segmented className="mt-4" options={PROG_VIEWS} value={seg} onChange={setSeg} />
      )}

      {reflectionsEnabled && seg === 'camino' ? (
        <Diario />
      ) : r.loading ? (
        // Sin esto, durante la carga se veía un flash de "0 días de racha / 0%".
        <p className="mt-8 text-[15px] text-ink-soft">{t('common.loading')}</p>
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
            <p className="mt-3 text-[12px] text-ink-soft">
              {t('progreso.offline')}
            </p>
          )}

          {/* Stat cards */}
          <div className="mt-5 flex gap-3">
            <div className="card flex-1 p-4">
              <p className="stat-num text-[30px] font-bold text-accent-ink">
                {r.streak}
              </p>
              <p className="text-[13px] text-ink-soft">
                {t('progreso.streakDays', { count: r.streak })}
              </p>
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

          <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            {t('progreso.last5weeks')}
          </p>

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
                >
                  {/* El color solo no alcanza (daltonismo): un check marca "leído"
                      sin depender de distinguir el acento del gris. */}
                  {read && <CheckIcon size={11} strokeWidth={3} className="text-on-accent" aria-hidden="true" />}
                </div>
              )
            })}
          </div>
          <p className="mt-2.5 text-[12px] text-ink-soft">
            {t('progreso.heatmapHint')}
          </p>

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

          {/* Nota neutra de atraso */}
          {r.behind > 0 && (
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
              {r.reprogramarError && (
                <p className="mt-2 text-[12px]" style={{ color: 'var(--danger)' }}>
                  {t('hoy.reprogramarError')}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
