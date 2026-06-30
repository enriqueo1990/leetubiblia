import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReading } from '../hooks/useReading.js'
import { useAuth } from '../lib/auth.jsx'
import { todayLocalISO, addDaysISO } from '../lib/db.js'
import Segmented from '../components/Segmented.jsx'
import Diario from './Diario.jsx'

const PROG_VIEWS = [
  { key: 'progreso', label: 'Progreso' },
  { key: 'camino', label: 'Mi camino' },
]

// Progreso — sub-vista de Hoy (documento maestro §5.2, README pantalla 2).
// Racha, % y CALENDARIO DE CONSTANCIA de las últimas 5 semanas: cada cuadrado se
// pinta si ESE día del calendario marcaste alguna lectura (completed_at). Misma
// base que la racha, así la grilla y el número coinciden siempre (antes la grilla
// pintaba "el día del plan agendado para esa fecha", que divergía de la racha).
// Solo lectura: para corregir el día se usa Ajustes › "¿en qué día vas?" o Hoy.
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// "2026-06-26" → "26 de junio" para etiquetas accesibles del heatmap.
function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

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
  const reflectionsEnabled = !!profile?.reflections_enabled
  const [seg, setSeg] = useState('progreso')
  const todayISO = todayLocalISO()
  const grid = buildGrid(todayISO)
  const duration = r.plan?.duration_days ?? 0

  return (
    <div className="pt-2">
      <Link to="/" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
        ‹ Hoy
      </Link>
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">Progreso</h1>

      {reflectionsEnabled && (
        <Segmented className="mt-4" options={PROG_VIEWS} value={seg} onChange={setSeg} />
      )}

      {reflectionsEnabled && seg === 'camino' ? (
        <Diario />
      ) : r.loading ? (
        // Sin esto, durante la carga se veía un flash de "0 días de racha / 0%".
        <p className="mt-8 text-[15px] text-ink-soft">Cargando…</p>
      ) : !r.hasPlan ? (
        <p className="mt-8 text-[15px] text-ink-soft">
          Elegí un plan en{' '}
          <Link to="/planes" className="font-medium" style={{ color: 'var(--accent)' }}>
            Planes
          </Link>{' '}
          para ver tu progreso.
        </p>
      ) : (
        <>
          {r.offline && (
            <p className="mt-3 text-[12px] text-ink-soft">
              Sin conexión · puede estar desactualizado.
            </p>
          )}

          {/* Stat cards */}
          <div className="mt-5 flex gap-3">
            <div className="card flex-1 p-4">
              <p className="text-[30px] font-bold text-accent" style={{ letterSpacing: '-1px' }}>
                {r.streak}
              </p>
              <p className="text-[13px] text-ink-soft">
                {r.streak === 1 ? 'día de racha' : 'días de racha'}
              </p>
            </div>
            <div className="card flex-1 p-4">
              <p className="text-[30px] font-bold text-ink" style={{ letterSpacing: '-1px' }}>
                {r.percent}%
              </p>
              <p className="text-[13px] text-ink-soft">
                {r.completedCount} de {duration} días
              </p>
            </div>
          </div>

          <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            Últimas 5 semanas
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
              const state = isFuture ? 'día futuro' : read ? 'leíste' : 'sin lectura'

              return (
                <div
                  key={iso}
                  role="img"
                  aria-label={`${longDate(iso)} · ${state}`}
                  className="rounded-pill"
                  style={{
                    aspectRatio: '1',
                    backgroundColor: read ? 'var(--accent)' : 'var(--hairline)',
                    opacity: isFuture ? 0.4 : 1,
                  }}
                />
              )
            })}
          </div>
          <p className="mt-2.5 text-[12px] text-ink-soft">
            Cada cuadrado pintado es un día que marcaste tu lectura.
          </p>

          {/* Acceso al recorrido (logros + números acumulados) */}
          <Link to="/recorrido" className="card mt-6 flex items-center justify-between px-4 py-3.5">
            <span>
              <span className="block text-[15px] font-semibold text-ink">Tu recorrido</span>
              <span className="block text-[13px] text-ink-soft">Tus logros y números en la Palabra</span>
            </span>
            <span aria-hidden="true" className="text-[18px]" style={{ color: 'var(--accent)' }}>
              ›
            </span>
          </Link>

          {/* Nota neutra de atraso */}
          {r.behind > 0 && (
            <>
              <p className="mt-6 text-[15px] text-ink-soft">
                Te atrasaste {r.behind} {r.behind === 1 ? 'día' : 'días'}. Sin apuro —{' '}
                <button
                  type="button"
                  onClick={r.reprogramar}
                  disabled={r.reprogramando}
                  className="font-medium"
                  style={{ color: 'var(--accent)', opacity: r.reprogramando ? 0.5 : 1 }}
                >
                  {r.reprogramando ? 'reprogramando…' : 'podés reprogramar'}
                </button>{' '}
                y seguir.
              </p>
              {r.reprogramarError && (
                <p className="mt-2 text-[12px]" style={{ color: 'var(--danger)' }}>
                  No se pudo reprogramar. Revisá tu conexión e intentá de nuevo.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
