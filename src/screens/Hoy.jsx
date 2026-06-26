import { Link } from 'react-router-dom'
import { useReading } from '../hooks/useReading.js'
import { firstYouVersionUrl } from '../lib/bible.js'

// Pantalla Hoy — la cara de la app (documento maestro §5.1, README pantalla 1).
// day_number canónico, marcar leído (idempotente), abrir en YouVersion, estados
// sin-plan / atrasado (sin culpa, con reprogramar) / plan terminado.
function todayLabel() {
  return new Date()
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
}

export default function Hoy() {
  const r = useReading()

  if (r.loading) {
    return <p className="pt-10 text-[15px] text-ink-soft">Cargando…</p>
  }

  // Estado vacío: sin plan activo (raro tras el onboarding, pero contemplado).
  if (!r.hasPlan) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div
          className="flex h-[84px] w-[84px] items-center justify-center rounded-full text-[34px]"
          style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--accent)' }}
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

  const bibleUrl = firstYouVersionUrl(r.todayRefs)

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col pt-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-ink-soft" style={{ letterSpacing: '0.6px' }}>
          {todayLabel()}
        </p>
        <Link to="/progreso" className="text-[14px] font-medium" style={{ color: 'var(--accent)' }}>
          Progreso ›
        </Link>
      </div>
      {r.plan && (
        <Link
          to={`/planes/${r.plan.id}`}
          className="mt-[7px] inline-flex items-center gap-1 text-[15px] font-semibold text-accent"
        >
          {r.plan.name} · Día {r.todayDay}
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ›
          </span>
        </Link>
      )}

      {r.offline && (
        <p className="mt-2 text-[12px] text-ink-soft">
          Sin conexión · tu marca se guarda y se sincroniza al volver.
        </p>
      )}

      {/* Banner de atraso — sin culpa, con reprogramar */}
      {r.behind > 0 && !r.planFinished && (
        <div
          className="mt-4 flex items-center justify-between rounded-[14px] px-4 py-3"
          style={{ backgroundColor: 'var(--surface-alt)' }}
        >
          <span className="text-[14px] text-ink">
            Te atrasaste {r.behind} {r.behind === 1 ? 'día' : 'días'}
          </span>
          <button
            type="button"
            onClick={r.reprogramar}
            className="text-[14px] font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            Reprogramar
          </button>
        </div>
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
          <p className="mt-[42px] text-[14px] font-medium text-ink-soft">Lectura de hoy</p>
          <div className="mt-[18px] space-y-1">
            {r.todayRefs?.map((ref, i) => (
              <p key={i} className="text-display text-ink">
                {ref.label}
              </p>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      {!r.planFinished && (
        <div className="space-y-3 lg:flex lg:max-w-[440px] lg:space-x-3 lg:space-y-0">
          <button
            type="button"
            onClick={() => r.toggleDay(r.todayDay)}
            className={`btn lg:flex-1 ${r.todayDone ? 'btn-done' : 'btn-primary'}`}
          >
            {r.todayDone ? '✓ Leído hoy' : 'Marcar como leído'}
          </button>
          <a
            href={bibleUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary block lg:flex-1"
            style={{ pointerEvents: bibleUrl ? 'auto' : 'none', opacity: bibleUrl ? 1 : 0.5 }}
          >
            Abrir en mi app de Biblia ↗
          </a>
        </div>
      )}
    </div>
  )
}
