import { Link } from 'react-router-dom'
import { useReading } from '../hooks/useReading.js'
import { dayNumberFor, todayLocalISO, addDaysISO } from '../lib/db.js'

// Progreso — sub-vista de Hoy (documento maestro §5.2, README pantalla 2).
// Racha, % y heatmap de las últimas 5 semanas. INTERACTIVO: tocar un día pasado
// lo marca/desmarca (único lugar para registrar atrasos ya leídos). Los días
// futuros no son tocables.
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
  const todayISO = todayLocalISO()
  const grid = buildGrid(todayISO)
  const duration = r.plan?.duration_days ?? 0

  // Recalculamos plan_start_date a partir del día de hoy (misma regla canónica).
  const planStart = r.todayDay != null ? addDaysISO(todayISO, -(r.todayDay - 1)) : null

  return (
    <div className="pt-2">
      <Link to="/" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
        ‹ Hoy
      </Link>
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">Progreso</h1>

      {r.loading ? (
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

          {/* Heatmap interactivo */}
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {grid.map((iso) => {
              const dayNum = planStart ? dayNumberFor(planStart, iso) : null
              const inRange = dayNum != null && dayNum >= 1 && dayNum <= duration
              const isFuture = iso > todayISO
              const read = inRange && r.completed.has(dayNum)
              const tappable = inRange && !isFuture

              let bg = 'var(--hairline)'
              if (read) bg = 'var(--accent)'
              let opacity = 1
              if (!inRange) opacity = 0.25
              else if (isFuture) opacity = 0.4

              let state
              if (!inRange) state = 'fuera del plan'
              else if (isFuture) state = 'día futuro'
              else if (read) state = 'leído'
              else state = 'sin leer'

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!tappable}
                  onClick={() => tappable && r.toggleDay(dayNum, !read)}
                  aria-label={`${longDate(iso)} · ${state}`}
                  aria-pressed={tappable ? read : undefined}
                  className="rounded-pill transition-colors duration-200"
                  style={{
                    aspectRatio: '1',
                    backgroundColor: bg,
                    opacity,
                    cursor: tappable ? 'pointer' : 'default',
                  }}
                />
              )
            })}
          </div>

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
