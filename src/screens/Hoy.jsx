import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useReading } from '../hooks/useReading.js'
import { useAuth } from '../lib/auth.jsx'
import {
  getPlanDay,
  getReflection,
  getCachedReflection,
  upsertReflection,
  deleteReflection,
  localDateISO,
  todayLocalISO,
  startDateForDay,
  longestStreak,
  recordPlanCompletion,
  clearPlanProgress,
} from '../lib/db.js'
import { firstYouVersionUrl, youVersionUrl } from '../lib/bible.js'
import { shareCompletion } from '../lib/shareImage.js'
import { SkeletonHoy } from '../components/Skeleton.jsx'
import { ChartIcon, CheckIcon, ShareIcon } from '../components/icons.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ReflectionSheet from '../components/ReflectionSheet.jsx'
import MaterialsToday from '../components/MaterialsToday.jsx'

// Pantalla Hoy — la cara de la app (documento maestro §5.1, README pantalla 1).
// Se ancla en el día que dicta useReading (displayDay): si vas atrasado, el día
// del calendario (con banner de reprogramar); si vas al día o adelantado, el
// próximo sin leer. Marcar leído (idempotente), abrir en YouVersion, "seguir
// leyendo" para adelantar en sesión, y estados sin-plan / plan terminado.

export default function Hoy() {
  const r = useReading()
  const navigate = useNavigate()
  const { user, profile, updateProfile } = useAuth()
  const reflectionsEnabled = !!profile?.reflections_enabled

  // Festejo de plan terminado (Feature 5).
  const [confirmRenew, setConfirmRenew] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState(null) // 'downloaded' | null
  const [recorded, setRecorded] = useState(false)

  // Lectura adelantada ("seguir leyendo"): sin mover el calendario, mostramos el
  // contenido de un día futuro y dejamos marcarlo. aheadDay = null → viendo hoy.
  const [aheadDay, setAheadDay] = useState(null)
  const [aheadRefs, setAheadRefs] = useState(null)
  const [aheadLoading, setAheadLoading] = useState(false)

  // Reflexión del día ("Mi camino"): hoja abierta + nota cargada del día mostrado.
  // note: undefined = aún no sabemos · null = no hay nota · objeto = hay nota.
  const [reflectOpen, setReflectOpen] = useState(false)
  const [note, setNote] = useState(undefined)
  const [seededKey, setSeededKey] = useState(null)

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

  // Día mostrado (ancla o adelantado) y si está leído — base de la reflexión.
  const shownDay = aheadDay != null ? aheadDay : r.displayDay
  const shownDone = shownDay != null && r.completed.has(shownDay)

  // Clave del día con nota (null cuando no aplica: sin leer o función apagada).
  const noteKey =
    reflectionsEnabled && user && planId && shownDay != null && shownDone
      ? `${user.id}:${planId}:${shownDay}`
      : null

  // Sembrar la nota desde la caché en el MISMO render en que cambia el día (patrón
  // "ajustar estado al cambiar una clave"): al volver a Hoy el botón ya nace en
  // "Editar tu nota" sin parpadear primero "Anotá…". Si la caché aún no la tiene
  // (arranque en frío), queda undefined → se muestra "Anotá…" y la revalidación de
  // abajo corrige si en realidad había nota. Así nunca se degrada el "marcar leído".
  if (seededKey !== noteKey) {
    setSeededKey(noteKey)
    setNote(noteKey ? getCachedReflection(user.id, planId, shownDay) : null)
  }

  // Ventana de edición "tipo WhatsApp": editable solo el día en que se escribió.
  const noteEditable = !note || localDateISO(note.created_at) === todayLocalISO()

  // Revalidar contra el servidor por detrás; getReflection refresca la caché y, al
  // resolver, corrige la nota mostrada si cambió. Sin red, se queda lo seedeado.
  useEffect(() => {
    if (!noteKey) return
    let on = true
    getReflection(user.id, planId, shownDay)
      .then((row) => on && setNote(row ?? null))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [noteKey, user, planId, shownDay])

  function readNext(target) {
    if (target != null) setAheadDay(target)
  }
  function backToToday() {
    setAheadDay(null)
    setAheadRefs(null)
  }

  // Datos del logro (ajustados al plan real, no a 365 fijo).
  const maxStreak = longestStreak(r.readDates)
  const startedOn = profile?.plan_start_date ?? null
  const completedOn = [...r.readDates].sort().at(-1) ?? todayLocalISO()
  const fmtShort = (iso) => {
    if (!iso) return null
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  const dateRange = startedOn ? `${fmtShort(startedOn)} — ${fmtShort(completedOn)}` : fmtShort(completedOn)

  // Al ver el festejo, guardar el logro una vez (idempotente por día en la DB).
  useEffect(() => {
    if (!r.planFinished || !user || !planId || !duration || recorded) return
    setRecorded(true)
    recordPlanCompletion({
      userId: user.id,
      planId,
      daysRead: r.completedCount,
      totalDays: duration,
      longestStreak: maxStreak,
      startedOn,
    }).catch(() => setRecorded(false)) // si falla, reintenta al próximo render
  }, [r.planFinished, user, planId, duration, recorded, r.completedCount, maxStreak, startedOn])

  // Renovar: guardar el logro (por las dudas), borrar el progreso y arrancar hoy
  // en el día 1. El cambio de plan_start_date + progreso vacío recarga useReading.
  async function handleRenew() {
    if (!user || !planId || !duration) return
    setRenewing(true)
    try {
      await recordPlanCompletion({
        userId: user.id,
        planId,
        daysRead: r.completedCount,
        totalDays: duration,
        longestStreak: maxStreak,
        startedOn,
      })
      await clearPlanProgress(user.id, planId)
      await updateProfile({ plan_start_date: startDateForDay(1) })
      setConfirmRenew(false)
    } catch {
      // se mantiene el diálogo abierto con el botón habilitado de nuevo
    } finally {
      setRenewing(false)
    }
  }

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    setShareNote(null)
    try {
      const res = await shareCompletion({
        planName: r.plan.name,
        daysRead: r.completedCount,
        longestStreak: maxStreak,
        startedOn,
        completedOn,
      })
      if (res === 'downloaded') setShareNote('downloaded')
    } catch {
      setShareNote('error')
    } finally {
      setSharing(false)
    }
  }

  if (r.loading) {
    return <SkeletonHoy />
  }

  // Estado vacío: sin plan activo (raro tras el onboarding, pero contemplado).
  if (!r.hasPlan) {
    return (
      <EmptyState
        icon="✦"
        title="Elegí un plan para empezar"
        text="Tu lectura diaria aparece acá."
      >
        <Link to="/planes" className="btn btn-primary inline-block px-8">
          Ver planes
        </Link>
      </EmptyState>
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {viewingAhead && (
            <button
              type="button"
              onClick={backToToday}
              className="mb-[6px] block text-[13px] font-medium"
              style={{ color: 'var(--accent)' }}
            >
              ‹ Volver a hoy
            </button>
          )}
          {/* El plan es metadata, no contenido: miga de pan en tono suave; el
              protagonismo tipográfico queda para la lectura. */}
          {r.plan && (
            <Link
              to={`/planes/${r.plan.id}`}
              className="flex max-w-full items-center gap-1 py-1 text-[13px] font-medium text-ink-soft"
            >
              <span className="truncate">{r.plan.name}</span>
              <span aria-hidden="true" className="shrink-0" style={{ opacity: 0.5 }}>›</span>
            </Link>
          )}
        </div>
        {/* Única puerta a Progreso (y al diario): ícono + etiqueta, en el mismo
            gris del breadcrumb. Fijo a la derecha; el nombre del plan trunca. */}
        <Link
          to="/progreso"
          className="-mr-1 -mt-2 flex h-11 shrink-0 items-center gap-1.5 px-1 text-[13px] font-medium text-ink-soft transition-colors hover:text-accent"
        >
          <ChartIcon size={16} />
          Progreso
        </Link>
      </div>

      {r.offline && (
        <p className="mt-2 text-[12px] text-ink-soft">
          {r.staleReadings
            ? 'Sin conexión · esta lectura es de la última vez que entraste. Conectate para ver la de hoy.'
            : 'Sin conexión · tu marca se guarda y se sincroniza al volver.'}
        </p>
      )}

      {/* Aviso de atraso — sin culpa y sin caja: una línea en el tono del resto
          del texto, con la acción en acento y el descarte apenas presente. */}
      {r.showBehind && !r.planFinished && !viewingAhead && (
        <>
          <div className="mt-4 flex items-center">
            <p className="text-[14px] text-ink-soft">
              Te atrasaste {r.behind} {r.behind === 1 ? 'día' : 'días'}
            </p>
            <button
              type="button"
              onClick={r.reprogramar}
              disabled={r.reprogramando}
              className="ml-3 py-2 text-[14px] font-semibold"
              style={{ color: 'var(--accent)', opacity: r.reprogramando ? 0.5 : 1 }}
            >
              {r.reprogramando ? 'Reprogramando…' : 'Reprogramar'}
            </button>
            <button
              type="button"
              onClick={r.dismissBehind}
              aria-label="Descartar aviso"
              className="ml-auto flex h-9 w-9 items-center justify-center text-[15px] leading-none text-ink-soft"
              style={{ opacity: 0.5 }}
            >
              ✕
            </button>
          </div>
          {r.reprogramarError && (
            <p className="mt-1 text-[12px]" style={{ color: 'var(--danger)' }}>
              No se pudo reprogramar. Revisá tu conexión e intentá de nuevo.
            </p>
          )}
        </>
      )}

      {r.planFinished ? (
        <div className="mt-8">
          <div className="card overflow-hidden p-0">
            {/* Cabecera cálida tipo certificado */}
            <div
              className="px-6 pb-6 pt-8 text-center"
              style={{ backgroundColor: 'var(--accent-tint)' }}
            >
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--accent)' }}
              >
                <CheckIcon size={32} strokeWidth={2.4} />
              </div>
              <p
                className="mt-4 text-[12px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--accent)' }}
              >
                Plan completado
              </p>
              <p className="mt-1.5 text-[15px] text-ink-soft">Terminaste de leer</p>
              <h2 className="mt-1 text-[26px] font-bold leading-tight text-ink">{r.plan.name}</h2>
            </div>
            {/* Stats ajustados al plan real */}
            <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline">
              <div className="py-5 text-center">
                <p className="text-[30px] font-bold text-ink">{r.completedCount}</p>
                <p className="text-[13px] text-ink-soft">
                  {r.completedCount === 1 ? 'día leído' : 'días leídos'}
                </p>
              </div>
              <div className="py-5 text-center">
                <p className="text-[30px] font-bold text-ink">{maxStreak}</p>
                <p className="text-[13px] text-ink-soft">
                  {maxStreak === 1 ? 'día de racha máx.' : 'días de racha máx.'}
                </p>
              </div>
            </div>
            {dateRange && (
              <p className="border-t border-hairline py-3 text-center text-[13px] text-ink-soft">
                {dateRange}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="btn btn-primary flex items-center justify-center gap-2"
              style={{ opacity: sharing ? 0.6 : 1 }}
            >
              <ShareIcon size={18} /> {sharing ? 'Generando imagen…' : 'Compartir mi logro'}
            </button>
            <button type="button" onClick={() => setConfirmRenew(true)} className="btn btn-secondary">
              Volver a leer este plan
            </button>
            <button
              type="button"
              onClick={() => navigate('/planes')}
              className="w-full py-2 text-center text-[15px] font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Elegir otro plan
            </button>
          </div>
          {shareNote === 'downloaded' && (
            <p className="mt-3 text-center text-[13px] text-ink-soft">
              Imagen descargada. ¡Compartila donde quieras!
            </p>
          )}
          {shareNote === 'error' && (
            <p className="mt-3 text-center text-[13px]" style={{ color: 'var(--danger)' }}>
              No se pudo generar la imagen. Probá de nuevo.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="mt-[42px] text-[13px] font-medium text-ink-soft">
            {aheadOfToday
              ? `Lectura del día ${dayShown}`
              : `Lectura de hoy${dayShown != null ? ` · Día ${dayShown}` : ''}`}
          </p>
          <div className="mt-[18px] space-y-1">
            {viewingAhead && aheadLoading ? (
              <div className="animate-pulse space-y-2" aria-hidden="true">
                <div className="rounded-pill" style={{ width: '60%', height: 32, backgroundColor: 'var(--surface-alt)' }} />
                <div className="rounded-pill" style={{ width: '44%', height: 32, backgroundColor: 'var(--surface-alt)' }} />
              </div>
            ) : (
              // Cada referencia abre su propio pasaje (no solo la primera): el
              // texto que ya es la pantalla se vuelve funcional, sin cromo nuevo.
              refsShown?.map((ref, i) => {
                const url = youVersionUrl(ref)
                return url ? (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-fit text-display text-ink transition-opacity active:opacity-50"
                  >
                    {ref.label}
                  </a>
                ) : (
                  <p key={i} className="text-display text-ink">
                    {ref.label}
                  </p>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Materiales opcionales (catecismo, etc.) bajo la lectura. Vacío si el
          usuario no activó ninguno → Hoy queda idéntico. Solo en lectura normal. */}
      {!r.planFinished && <MaterialsToday />}

      <div className="flex-1" />

      {!r.planFinished && (
        <div
          className="sticky z-10 space-y-3 bg-app pb-2 pt-3 lg:static lg:mt-8 lg:bg-transparent lg:pb-0 lg:pt-0"
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
            {reflectionsEnabled && doneShown ? (
              // Ya leyó: abrir la Biblia ya no hace falta → ese botón invita a anotar.
              // Sin nota todavía → destacado (accent) para que la acción se note; una vez
              // escrita pasa a secundario (ya está, acceso tranquilo, sin insistir).
              <button
                type="button"
                onClick={() => setReflectOpen(true)}
                className={`btn block lg:flex-1 ${note ? 'btn-secondary' : 'btn-primary'}`}
              >
                {note
                  ? noteEditable
                    ? 'Editar tu nota'
                    : 'Ver tu nota'
                  : 'Anotá lo que te habló Dios hoy'}
              </button>
            ) : (
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
            )}
          </div>

          {/* Cierre del ciclo: la racha aparece solo al marcar el día de hoy (y
              recién desde 2 — "1 día seguido" no dice nada). El resto del tiempo
              vive en Progreso, sin insistir. */}
          {doneShown && !viewingAhead && r.streak >= 2 && (
            <Link
              to="/progreso"
              className="block py-1 text-center text-[13px] font-medium text-ink-soft lg:max-w-[440px]"
            >
              <span aria-hidden="true" style={{ color: 'var(--accent)' }}>✦</span> {r.streak} días
              seguidos
            </Link>
          )}

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

      {reflectOpen && shownDay != null && (
        <ReflectionSheet
          planName={r.plan?.name ?? 'Plan'}
          dayNumber={shownDay}
          initialBody={note?.body ?? ''}
          editable={noteEditable}
          onClose={() => setReflectOpen(false)}
          onSave={async (body) => {
            try {
              const row = await upsertReflection(user.id, planId, shownDay, body)
              setNote(row)
            } catch {
              /* el sheet cierra igual; se puede reintentar */
            }
            setReflectOpen(false)
          }}
          onDelete={async () => {
            try {
              await deleteReflection(user.id, planId, shownDay)
              setNote(null)
            } catch {
              /* noop */
            }
            setReflectOpen(false)
          }}
        />
      )}

      {confirmRenew && (
        <ConfirmDialog
          title={`¿Volver a leer ${r.plan?.name ?? 'este plan'}?`}
          message="Empezás de nuevo desde el día 1, con fecha de hoy. Tu logro queda guardado."
          confirmLabel="Empezar de nuevo"
          busy={renewing}
          onConfirm={handleRenew}
          onCancel={() => setConfirmRenew(false)}
        />
      )}
    </div>
  )
}
