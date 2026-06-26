import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReading } from '../hooks/useReading.js'
import { getPlanDay } from '../lib/db.js'
import { firstYouVersionUrl } from '../lib/bible.js'
import { SkeletonHoy } from '../components/Skeleton.jsx'

// Pantalla Hoy — la cara de la app (documento maestro §5.1, README pantalla 1).
// Se ancla en el día que dicta useReading (displayDay): si vas atrasado, el día
// del calendario (con banner de reprogramar); si vas al día o adelantado, el
// próximo sin leer. Marcar leído (idempotente), abrir en YouVersion, "seguir
// leyendo" para adelantar en sesión, y estados sin-plan / plan terminado.
function todayLabel() {
  return new Date()
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
}

export default function Hoy() {
  const r = useReading()

  // Lectura adelantada ("seguir leyendo"): sin mover el calendario, mostramos el
  // contenido de un día futuro y dejamos marcarlo. aheadDay = null → viendo hoy.
  const [aheadDay, setAheadDay] = useState(null)
  const [aheadRefs, setAheadRefs] = useState(null)
  const [aheadLoading, setAheadLoading] = useState(false)

  const planId = r.plan?.id
  const duration = r.plan?.duration_days ?? null

  // Traer las refs del día adelantado al cambiarlo.
  useEffect(() => {
    if (aheadDay == null || !planId) return
    let on = true
    setAheadLoading(true)
    getPlanDay(planId, aheadDay)
      .then((pd) => on && setAheadRefs(pd?.refs ?? []))
      .catch(() => on && setAheadRefs([]))
      .finally(() => on && setAheadLoading(false))
    return () => {
      on = false
    }
  }, [aheadDay, planId])

  // Si cambia el plan (o el día ancla, p. ej. al recargar/avanzar), salir del
  // modo "seguir leyendo".
  useEffect(() => {
    setAheadDay(null)
    setAheadRefs(null)
  }, [planId, r.displayDay])

  function readNext(target) {
    if (target != null) setAheadDay(target)
  }
  function backToToday() {
    setAheadDay(null)
    setAheadRefs(null)
  }

  if (r.loading) {
    return <SkeletonHoy />
  }

  // Estado vacío: sin plan activo (raro tras el onboarding, pero contemplado).
  if (!r.hasPlan) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div
          className="flex h-[84px] w-[84px] items-center justify-center rounded-full text-[34px]"
          style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--accent)' }}
          aria-hidden="true"
        >
          ✦
        </div>
        <h2 className="mt-6 text-[24px] font-bold text-ink">Elegí un plan para empezar</h2>
        <p className="mt-2 text-[16px] text-ink-soft">Tu lectura diaria aparece acá.</p>
        <Link to="/planes" className="btn btn-primary mt-8 inline-block px-8">
          Ver planes
        </Link>
      </div>
    )
  }

  // Qué se está mostrando: el día ancla (Hoy) o uno adelantado en sesión.
  const viewingAhead = aheadDay != null
  const dayShown = viewingAhead ? aheadDay : r.displayDay
  const refsShown = viewingAhead ? aheadRefs : r.todayRefs
  const doneShown = dayShown != null && r.completed.has(dayShown)
  // ¿El día mostrado va por delante de la fecha de hoy? (ancla adelantada o sesión)
  const aheadOfToday = dayShown != null && r.todayDay != null && dayShown > r.todayDay
  const bibleUrl = firstYouVersionUrl(refsShown)

  // Próximo día sin leer hacia adelante: "seguir leyendo" salta lo ya marcado.
  let nextDay = null
  if (duration != null && dayShown != null) {
    for (let d = dayShown + 1; d <= duration; d++) {
      if (!r.completed.has(d)) {
        nextDay = d
        break
      }
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col pt-2">
      <div className="flex items-baseline justify-between">
        {viewingAhead ? (
          <button
            type="button"
            onClick={backToToday}
            className="text-[13px] font-medium"
            style={{ color: 'var(--accent)', letterSpacing: '0.6px' }}
          >
            ‹ Volver a hoy
          </button>
        ) : (
          <p className="text-[13px] font-medium text-ink-soft" style={{ letterSpacing: '0.6px' }}>
            {todayLabel()}
          </p>
        )}
        <Link to="/progreso" className="text-[14px] font-medium" style={{ color: 'var(--accent)' }}>
          Progreso ›
        </Link>
      </div>
      {r.plan && (
        <Link
          to={`/planes/${r.plan.id}`}
          className="mt-[7px] inline-flex items-center gap-1 text-[15px] font-semibold text-accent"
        >
          {r.plan.name} · Día {dayShown}
          {aheadOfToday && <span className="text-ink-soft"> · adelantado</span>}
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ›
          </span>
        </Link>
      )}

      {/* Racha discreta: refuerzo visible al marcar leído (antes solo en Progreso) */}
      {!viewingAhead && r.streak > 0 && (
        <p className="mt-2 text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
          Racha de {r.streak} {r.streak === 1 ? 'día' : 'días'}
        </p>
      )}

      {/* Nota de ritmo: el día mostrado va por delante de la fecha de hoy */}
      {aheadOfToday && !r.planFinished && (
        <p className="mt-2 text-[12px] text-ink-soft">
          Vas {dayShown - r.todayDay} {dayShown - r.todayDay === 1 ? 'día' : 'días'} adelantado del
          calendario
        </p>
      )}

      {r.offline && (
        <p className="mt-2 text-[12px] text-ink-soft">
          {r.staleReadings
            ? 'Sin conexión · esta lectura es de la última vez con conexión. Conectate para ver la de hoy.'
            : 'Sin conexión · tu marca se guarda y se sincroniza al volver.'}
        </p>
      )}

      {/* Banner de atraso — sin culpa, con reprogramar o descartar */}
      {r.showBehind && !r.planFinished && !viewingAhead && (
        <>
          <div
            className="mt-4 flex items-center gap-3 rounded-[14px] px-4 py-3"
            style={{ backgroundColor: 'var(--surface-alt)' }}
          >
            <span className="flex-1 text-[14px] text-ink">
              Te atrasaste {r.behind} {r.behind === 1 ? 'día' : 'días'}
            </span>
            <button
              type="button"
              onClick={r.reprogramar}
              disabled={r.reprogramando}
              className="text-[14px] font-semibold"
              style={{ color: 'var(--accent)', opacity: r.reprogramando ? 0.5 : 1 }}
            >
              {r.reprogramando ? 'Reprogramando…' : 'Reprogramar'}
            </button>
            <button
              type="button"
              onClick={r.dismissBehind}
              aria-label="Descartar aviso"
              className="-m-2 flex h-9 w-9 items-center justify-center text-[18px] leading-none text-ink-soft"
              style={{ opacity: 0.6 }}
            >
              ✕
            </button>
          </div>
          {r.reprogramarError && (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--danger)' }}>
              No se pudo reprogramar. Revisá tu conexión e intentá de nuevo.
            </p>
          )}
        </>
      )}

      {r.planFinished ? (
        <div className="mt-12">
          <p className="text-[14px] font-medium text-ink-soft">Plan completado</p>
          <p className="mt-3 text-display text-ink">Terminaste el plan 🎉</p>
          <p className="mt-3 text-[16px] text-ink-soft">
            Podés elegir uno nuevo cuando quieras desde Planes.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-[42px] text-[14px] font-medium text-ink-soft">
            {aheadOfToday ? `Lectura del día ${dayShown}` : 'Lectura de hoy'}
          </p>
          <div className="mt-[18px] space-y-1">
            {viewingAhead && aheadLoading ? (
              <div className="animate-pulse space-y-2" aria-hidden="true">
                <div className="rounded-pill" style={{ width: '60%', height: 32, backgroundColor: 'var(--surface-alt)' }} />
                <div className="rounded-pill" style={{ width: '44%', height: 32, backgroundColor: 'var(--surface-alt)' }} />
              </div>
            ) : (
              refsShown?.map((ref, i) => (
                <p key={i} className="text-display text-ink">
                  {ref.label}
                </p>
              ))
            )}
          </div>
        </>
      )}

      <div className="flex-1" />

      {!r.planFinished && (
        <div
          className="sticky z-10 space-y-3 bg-app pb-2 pt-3 lg:static lg:bg-transparent lg:pb-0 lg:pt-0"
          style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
        >
          <div className="space-y-3 lg:flex lg:max-w-[440px] lg:space-x-3 lg:space-y-0">
            <button
              type="button"
              onClick={() => dayShown != null && r.toggleDay(dayShown)}
              className={`btn lg:flex-1 ${doneShown ? 'btn-done' : 'btn-primary'}`}
            >
              {doneShown ? (aheadOfToday ? '✓ Leído' : '✓ Leído hoy') : 'Marcar como leído'}
            </button>
            <a
              href={bibleUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={bibleUrl ? undefined : 'true'}
              tabIndex={bibleUrl ? undefined : -1}
              className="btn btn-secondary block lg:flex-1"
              style={{ pointerEvents: bibleUrl ? 'auto' : 'none', opacity: bibleUrl ? 1 : 0.5 }}
            >
              Abrir en mi app de Biblia ↗
            </a>
          </div>

          {/* Seguir leyendo: tras marcar el día mostrado, o ya en modo adelantado.
              Salta al próximo día sin leer, sin re-pisar lo ya marcado. */}
          {nextDay != null && (viewingAhead || doneShown) && (
            <button
              type="button"
              onClick={() => readNext(nextDay)}
              className="block w-full py-1 text-center text-[15px] font-semibold lg:max-w-[440px]"
              style={{ color: 'var(--accent)' }}
            >
              Leer el día siguiente →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
