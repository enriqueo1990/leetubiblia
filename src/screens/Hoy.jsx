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
import { youVersionUrl } from '../lib/bible.js'
import { usePreferences } from '../lib/preferences.jsx'
import { bookLabel } from '../i18n/books.js'
import { fmtISODate } from '../i18n/dates.js'
import { planName } from '../lib/planLabels.js'
import { shareCompletion } from '../lib/shareImage.js'
import { SkeletonHoy } from '../components/Skeleton.jsx'
import { CheckIcon, ShareIcon, SlidersIcon } from '../components/icons.jsx'
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
  const { t, locale } = usePreferences()
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

  // Momento de marcar: true solo en la sesión justo después de marcar el día
  // mostrado (dispara el check dibujado, el respiro del botón y la línea cálida).
  // breathDone: tras ~2s de respiro, la zona de acción cede el paso a la
  // siguiente oferta (nota / seguir). chipMenuOpen: menú del chip "✓ Leído".
  const [justMarked, setJustMarked] = useState(false)
  const [breathDone, setBreathDone] = useState(false)
  const [chipMenuOpen, setChipMenuOpen] = useState(false)

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

  // El momento de marcar pertenece a un día: al cambiar de día o de plan se apaga.
  const shownDayForMoment = aheadDay != null ? aheadDay : r.displayDay
  useEffect(() => {
    setJustMarked(false)
    setChipMenuOpen(false)
  }, [planId, shownDayForMoment])

  // Respiro tras marcar: el botón confirma en su lugar (~2.4s) y recién después
  // la zona de acción ofrece lo siguiente.
  useEffect(() => {
    if (!justMarked) {
      setBreathDone(false)
      return
    }
    const id = setTimeout(() => setBreathDone(true), 2400)
    return () => clearTimeout(id)
  }, [justMarked])

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

  // Datos del logro (ajustados al plan real, no a 365 fijo).
  const maxStreak = longestStreak(r.readDates)
  const startedOn = profile?.plan_start_date ?? null
  const completedOn = [...r.readDates].sort().at(-1) ?? todayLocalISO()
  const fmtShort = (iso) =>
    fmtISODate(iso, locale, { day: 'numeric', month: 'short', year: 'numeric' })
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
        planName: planName(t, r.plan),
        daysRead: r.completedCount,
        longestStreak: maxStreak,
        startedOn,
        completedOn,
        t,
        locale,
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
        title={t('hoy.empty.title')}
        text={t('hoy.empty.text')}
      >
        <Link to="/planes" className="btn btn-primary inline-block px-8">
          {t('hoy.empty.cta')}
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
    <div className="flex min-h-[calc(100dvh-120px)] flex-col pt-2 lg:min-h-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Sin "volver": el modelo es el señalador — leer adelantado mueve tu
              "hoy", y el ancla (useReading) te espera donde dejaste el marcador. */}
          {/* Header de UNA línea: el día (tuyo, en tinta suave) + el plan
              (metadata, más apagado), todo tocable hacia el plan. El estado
              "✓ Leído" vive acá como chip, con menú (ver nota / desmarcar). */}
          <div className="flex min-w-0 items-center gap-2">
            {r.plan && (
              <Link
                to={`/planes/${r.plan.id}`}
                state={{ from: { to: '/', label: t('nav.hoy') } }}
                className="flex min-w-0 items-center gap-1.5 py-1 text-[13px] font-medium text-ink-soft"
              >
                {!r.planFinished && dayShown != null && (
                  <>
                    <span className="shrink-0">{t('hoy.dayN', { day: dayShown })}</span>
                    <span aria-hidden="true" className="shrink-0" style={{ opacity: 0.45 }}>·</span>
                  </>
                )}
                <span className="truncate" style={{ color: 'var(--placeholder)' }}>
                  {planName(t, r.plan)}
                </span>
                <span aria-hidden="true" className="shrink-0" style={{ opacity: 0.5 }}>›</span>
              </Link>
            )}
            {!r.planFinished && doneShown && (breathDone || !justMarked) && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setChipMenuOpen((v) => !v)}
                  aria-expanded={chipMenuOpen}
                  aria-haspopup="menu"
                  className="moment-in flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-semibold"
                  style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
                >
                  ✓ {t('hoy.read')}
                  <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.65 }}>▾</span>
                </button>
                {chipMenuOpen && (
                  <>
                    {/* Cerrar al tocar afuera */}
                    <button
                      type="button"
                      aria-hidden="true"
                      tabIndex={-1}
                      className="fixed inset-0 z-20 cursor-default"
                      onClick={() => setChipMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-30 mt-2 w-max divide-y divide-hairline overflow-hidden rounded-input"
                      style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-overlay)' }}
                    >
                      {reflectionsEnabled && note && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setChipMenuOpen(false)
                            setReflectOpen(true)
                          }}
                          className="block w-full px-4 py-3 text-left text-[15px] text-ink"
                        >
                          {noteEditable ? t('hoy.editNote') : t('hoy.viewNote')}
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setChipMenuOpen(false)
                          setJustMarked(false)
                          if (dayShown != null) r.toggleDay(dayShown)
                        }}
                        className="block w-full px-4 py-3 text-left text-[15px]"
                        style={{ color: 'var(--danger)' }}
                      >
                        {t('hoy.unmark')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Puerta a Ajustes: solo el ícono — la convención alcanza. */}
        <Link
          to="/ajustes"
          aria-label={t('nav.ajustes')}
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-ink-soft transition-colors hover:text-accent-ink"
        >
          <SlidersIcon size={18} />
        </Link>
      </div>

      {r.offline && (
        <p className="mt-2 text-[12px] text-ink-soft">
          {r.staleReadings ? t('hoy.offline.stale') : t('hoy.offline.fresh')}
        </p>
      )}

      {/* Aviso de atraso — sin culpa y sin caja: una línea en el tono del resto
          del texto, con la acción en acento y el descarte apenas presente. */}
      {r.showBehind && !r.planFinished && !viewingAhead && (
        <>
          <div className="mt-4 flex items-center">
            <p className="text-[14px] text-ink-soft">
              {t('hoy.behind', { count: r.behind })}
            </p>
            <button
              type="button"
              onClick={r.reprogramar}
              disabled={r.reprogramando}
              className="ml-3 py-2 text-[14px] font-semibold"
              style={{ color: 'var(--accent-ink)', opacity: r.reprogramando ? 0.5 : 1 }}
            >
              {r.reprogramando ? t('hoy.reprogramando') : t('hoy.reprogramar')}
            </button>
            <button
              type="button"
              onClick={r.dismissBehind}
              aria-label={t('hoy.dismissBehind')}
              className="ml-auto flex h-9 w-9 items-center justify-center text-[15px] leading-none text-ink-soft"
              style={{ opacity: 0.5 }}
            >
              ✕
            </button>
          </div>
          {r.reprogramarError && (
            <p className="mt-1 text-[12px]" style={{ color: 'var(--danger)' }}>
              {t('hoy.reprogramarError')}
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
                style={{ backgroundColor: 'var(--surface)', color: 'var(--accent-ink)' }}
              >
                <CheckIcon size={32} strokeWidth={2.4} />
              </div>
              <p
                className="mt-4 text-[12px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--accent-ink)' }}
              >
                {t('hoy.planCompleted')}
              </p>
              <p className="mt-1.5 text-[15px] text-ink-soft">{t('hoy.finishedReading')}</p>
              <h2 className="mt-1 text-[26px] font-bold leading-tight text-ink">{planName(t, r.plan)}</h2>
            </div>
            {/* Stats ajustados al plan real */}
            <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline">
              <div className="py-5 text-center">
                <p className="stat-num text-[30px] font-bold text-ink">{r.completedCount}</p>
                <p className="text-[13px] text-ink-soft">
                  {t('hoy.daysRead', { count: r.completedCount })}
                </p>
              </div>
              <div className="py-5 text-center">
                <p className="stat-num text-[30px] font-bold text-ink">{maxStreak}</p>
                <p className="text-[13px] text-ink-soft">
                  {t('hoy.maxStreak', { count: maxStreak })}
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
              <ShareIcon size={18} /> {sharing ? t('hoy.generatingImage') : t('hoy.shareAchievement')}
            </button>
            <button type="button" onClick={() => setConfirmRenew(true)} className="btn btn-secondary">
              {t('hoy.readPlanAgain')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/planes')}
              className="w-full py-2 text-center text-[15px] font-medium"
              style={{ color: 'var(--accent-ink)' }}
            >
              {t('hoy.chooseAnotherPlan')}
            </button>
          </div>
          {shareNote === 'downloaded' && (
            <p className="mt-3 text-center text-[13px] text-ink-soft">
              {t('hoy.imageDownloaded')}
            </p>
          )}
          {shareNote === 'error' && (
            <p className="mt-3 text-center text-[13px]" style={{ color: 'var(--danger)' }}>
              {t('hoy.imageError')}
            </p>
          )}
        </div>
      ) : (
        // El día ya vive en el header ("Día N · plan"): la lectura arranca sin
        // preámbulo. La Palabra es la página.
        <div className="mt-9 space-y-1">
          {viewingAhead && aheadLoading ? (
            <div className="animate-pulse space-y-2" aria-hidden="true">
              <div className="rounded-pill" style={{ width: '60%', height: 32, backgroundColor: 'var(--surface-alt)' }} />
              <div className="rounded-pill" style={{ width: '44%', height: 32, backgroundColor: 'var(--surface-alt)' }} />
            </div>
          ) : (
            // El pasaje mismo es la puerta a la Biblia: cada referencia abre su
            // capítulo (tinta plena, sin color — el toque lo confirma la opacidad
            // al presionar). Con ≥4 pasajes la display baja un talle (.text-display-sm).
            refsShown?.map((ref, i) => {
              const url = youVersionUrl(ref, locale)
              const displayClass = refsShown.length >= 4 ? 'text-display-sm' : 'text-display'
              const label = bookLabel(ref, locale)
              return url ? (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block w-fit ${displayClass} text-ink transition-opacity active:opacity-50`}
                >
                  {label}
                </a>
              ) : (
                <p key={i} className={`${displayClass} text-ink`}>
                  {label}
                </p>
              )
            })
          )}
        </div>
      )}

      {/* Materiales opcionales (catecismo, etc.) bajo la lectura. Vacío si el
          usuario no activó ninguno → Hoy queda idéntico. Solo en lectura normal. */}
      {!r.planFinished && <MaterialsToday />}

      <div className="flex-1 lg:hidden" />

      {/* Zona de acción única: siempre en el mismo lugar, bajando de intensidad
          a medida que el día se completa. (1) Marcar → (2) el momento: ✓ dibujado
          con la línea cálida ARRIBA (el botón nunca se mueve) → (3) la nota, si
          el Diario está activado y aún no hay → (4) un link quieto para seguir.
          El estado "leído" vive en el chip del header, no acá. */}
      {!r.planFinished && (() => {
        const breathing = doneShown && justMarked && !breathDone
        // Estado "cerrado" (marcado, pasado el respiro). La NOTA nunca se esconde:
        // si el diario está activo, siempre hay una vía en la barra —"Anotá…"
        // cuando no hay, "Editar/Ver tu nota" cuando ya existe—. "Leer el día
        // siguiente" acompaña como secundaria. Antes, al existir una nota la barra
        // saltaba solo a "leer siguiente" y anotar parecía imposible.
        const settled = doneShown && !breathing
        const invite = reflectionsEnabled && !note && noteEditable // sin nota: invitar
        const noteAccess = reflectionsEnabled && !!note // hay nota: editar/ver
        const settledHasAction = invite || noteAccess || nextDay != null
        if (!(!doneShown || breathing || (settled && settledHasAction))) return null

        const nextLink = (
          <button
            type="button"
            onClick={() => readNext(nextDay)}
            className="block w-full py-2 text-center text-[15px] font-semibold"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('hoy.readNextDay')} →
          </button>
        )
        const noteLink = (
          <button
            type="button"
            onClick={() => setReflectOpen(true)}
            className="block w-full py-2 text-center text-[15px] font-medium text-ink-soft"
          >
            {noteEditable ? t('hoy.editNote') : t('hoy.viewNote')}
          </button>
        )

        return (
          <div className="action-bar">
            <div className="lg:mx-auto lg:max-w-[440px]">
              {!doneShown ? (
                <button
                  type="button"
                  onClick={() => {
                    if (dayShown == null) return
                    setJustMarked(true)
                    navigator.vibrate?.(12)
                    r.toggleDay(dayShown)
                  }}
                  className="btn btn-primary"
                >
                  {t('hoy.markRead')}
                </button>
              ) : breathing ? (
                <>
                  <p className="moment-in pb-2.5 text-center text-[13px] font-medium text-ink-soft">
                    <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✦</span>{' '}
                    {!viewingAhead && r.streak >= 2
                      ? t('hoy.streakDays', { count: r.streak })
                      : t('hoy.markedNote')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setJustMarked(false)
                      if (dayShown != null) r.toggleDay(dayShown)
                    }}
                    className="btn btn-done btn-just-marked"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12l5 5L20 7" pathLength="1" className="check-drawn" />
                      </svg>
                      {aheadOfToday ? t('hoy.read') : t('hoy.readToday')}
                    </span>
                  </button>
                </>
              ) : invite ? (
                // Sin nota: la invitación a anotar es la acción primaria; seguir
                // leyendo queda como enlace secundario.
                <div className={justMarked ? 'moment-in' : undefined}>
                  <button
                    type="button"
                    onClick={() => setReflectOpen(true)}
                    className="btn btn-primary"
                  >
                    {t('hoy.writeNote')}
                  </button>
                  {nextDay != null && <div className="mt-1">{nextLink}</div>}
                </div>
              ) : (
                // Ya hay nota (o diario apagado): seguir es lo primario, con la
                // nota siempre a un toque de distancia como secundaria.
                <div className={justMarked ? 'moment-in' : undefined}>
                  {nextDay != null ? nextLink : noteAccess ? noteLink : null}
                  {nextDay != null && noteAccess && noteLink}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {reflectOpen && shownDay != null && (
        <ReflectionSheet
          planName={r.plan ? planName(t, r.plan) : t('common.plan')}
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
          title={t('hoy.renewTitle', { name: r.plan ? planName(t, r.plan) : t('common.plan') })}
          message={t('hoy.renewMessage')}
          confirmLabel={t('hoy.renewConfirm')}
          busy={renewing}
          onConfirm={handleRenew}
          onCancel={() => setConfirmRenew(false)}
        />
      )}
    </div>
  )
}
