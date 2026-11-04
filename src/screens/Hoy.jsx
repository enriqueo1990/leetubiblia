import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useReading } from '../hooks/useReading.js'
import { useInstallPrompt } from '../hooks/useInstallPrompt.js'
import { useAuth } from '../lib/auth.jsx'
import {
  getPlanDay,
  getPrayerDeck,
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
import { usePreferences } from '../lib/preferences.jsx'
import { fmtISODate } from '../i18n/dates.js'
import { passageLine } from '../lib/passageLine.js'
import { dayPeriod, firstName } from '../lib/dayLight.js'
import { planName } from '../lib/planLabels.js'
import { shareCompletion } from '../lib/shareImage.js'
import { recordFunnel } from '../lib/diag.js'
import { SkeletonHoy, SkeletonPassages } from '../components/Skeleton.jsx'
import InlineError from '../components/InlineError.jsx'
import PassageList from '../components/PassageList.jsx'
import { BookIcon, CameraIcon, CheckIcon, GearIcon, InstallIcon, ShareIcon } from '../components/icons.jsx'
import BiblePhotoSheet from '../components/BiblePhotoSheet.jsx'
import MyTimeFlow from '../components/MyTimeFlow.jsx'
import TodayCard from '../components/TodayCard.jsx'
import { PRAYED_EVENT, readPrayedToday } from '../lib/prayedToday.js'
import { BRAND_SERIF } from '../lib/brandFont.js'
import { useMyTime } from '../hooks/useMyTime.js'
import { dismissMyTimeInvite, shouldInviteMyTime, wasMyTimeInviteDismissed } from '../lib/myTime.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { cycleOf, nextCyclePatch } from '../lib/planCycle.js'
import EmptyState from '../components/EmptyState.jsx'
import ReflectionSheet from '../components/ReflectionSheet.jsx'
import TodayExtras from '../components/TodayExtras.jsx'
import ReminderOffer from '../components/ReminderOffer.jsx'
import { canOfferReminder, wasReminderOfferDismissed } from '../lib/reminderOffer.js'
import GoalOffer from '../components/GoalOffer.jsx'
import LibraryMoment from '../components/LibraryMoment.jsx'
import { shouldOfferLibraryMoment, suggestedMaterials, wasLibraryMomentSeen } from '../lib/libraryOffer.js'
import { goalMoment, wasGoalMomentSeen } from '../lib/goalOffer.js'
import { useDonationGoal } from '../hooks/useDonationGoal.js'
import { isIOSBrowser } from '../lib/platform.js'

// Pantalla Hoy — la cara de la app (documento maestro §5.1, README pantalla 1).
// Se ancla en el día que dicta useReading (displayDay): si vas atrasado, el día
// del calendario (con banner de reprogramar); si vas al día o adelantado, el
// próximo sin leer. Marcar leído (idempotente), abrir en YouVersion, "seguir
// leyendo" para adelantar en sesión, y estados sin-plan / plan terminado.

const INSTALL_CARD_DISMISSED_KEY = 'ltb.installCardDismissed'

function wasInstallCardDismissed() {
  try {
    return localStorage.getItem(INSTALL_CARD_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

const FIRST_MARK_WINDOW = 14 * 24 * 60 * 60 * 1000
function isRecentAccount(profile) {
  const created = profile?.created_at ? Date.parse(profile.created_at) : NaN
  return Number.isFinite(created) && Date.now() - created < FIRST_MARK_WINDOW
}

export default function Hoy() {
  const r = useReading()
  const navigate = useNavigate()
  const { user, profile, updateProfile } = useAuth()
  const { t, locale, bibleProvider } = usePreferences()
  const { canInstall, promptInstall } = useInstallPrompt()
  const reflectionsEnabled = !!profile?.reflections_enabled

  // Festejo de plan terminado (Feature 5).
  const [confirmRenew, setConfirmRenew] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [renewError, setRenewError] = useState(false)
  // Confirmación de reprogramar: visible unos segundos aunque el aviso de atraso
  // ya haya desaparecido (con éxito el atraso baja a 0 en el mismo render).
  const [showReprogramado, setShowReprogramado] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState(null) // 'downloaded' | null
  const [photoOpen, setPhotoOpen] = useState(false) // "Tu Biblia, hoy"
  // "Mi tiempo" (opcional): la preferencia, el recorrido abierto y la invitación.
  const [myTime, setMyTime] = useMyTime(user?.id)
  const [myTimeOpen, setMyTimeOpen] = useState(false)
  const [myTimeInviteClosed, setMyTimeInviteClosed] = useState(() => wasMyTimeInviteDismissed(user?.id))
  const [recorded, setRecorded] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installCardDismissed, setInstallCardDismissed] = useState(wasInstallCardDismissed)
  // Oferta del recordatorio tras marcar. Sticky: al activarlo el perfil cambia
  // (reminder_enabled) y la tarjeta debe quedarse para mostrar la confirmación.
  const [reminderOfferClosed, setReminderOfferClosed] = useState(() => wasReminderOfferDismissed(user?.id))
  const [reminderOfferSticky, setReminderOfferSticky] = useState(false)
  // Meta de donación (tiendas): se pide en un momento de gratitud, una vez por momento.
  const donationGoal = useDonationGoal()
  const [goalOfferClosed, setGoalOfferClosed] = useState(false)
  const [libraryMomentClosed, setLibraryMomentClosed] = useState(false)
  const [libraryMomentSticky, setLibraryMomentSticky] = useState(false) // agregado: queda el "Listo"
  const [libraryMomentSlug, setLibraryMomentSlug] = useState(null)

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
  const chipRef = useRef(null)
  const menuRef = useRef(null)

  // Reflexión del día ("Mi camino"): hoja abierta + nota cargada del día mostrado.
  // note: undefined = aún no sabemos · null = no hay nota · objeto = hay nota.
  const [reflectOpen, setReflectOpen] = useState(false)
  const [note, setNote] = useState(undefined)
  const [seededKey, setSeededKey] = useState(null)

  // "Tu día": tras leer, los pasajes se pliegan a una línea (ya los leíste en tu
  // Biblia) y aparece lo que sigue: la nota y la oración. prayerDeck null = sin
  // cargar; prayed = "oré hoy" de este dispositivo (lib/prayedToday).
  const [passagesOpen, setPassagesOpen] = useState(false)
  const [prayerDeck, setPrayerDeck] = useState(null)
  const [prayed, setPrayed] = useState(() => readPrayedToday(user?.id))

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

  // Menú del chip "✓ Leído": al abrir, el foco va al primer ítem (teclado y lector
  // de pantalla), y Escape / flechas se manejan en el propio menú.
  useEffect(() => {
    if (chipMenuOpen) menuRef.current?.querySelector('[role="menuitem"]')?.focus()
  }, [chipMenuOpen])

  function onMenuKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setChipMenuOpen(false)
      chipRef.current?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])]
    if (!items.length) return
    const i = items.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next].focus()
  }

  // Mostrar "Listo, seguimos desde hoy" unos segundos al terminar de reprogramar.
  useEffect(() => {
    if (!r.reprogramado || r.loading) return
    setShowReprogramado(true)
    const id = setTimeout(() => setShowReprogramado(false), 4000)
    return () => clearTimeout(id)
  }, [r.reprogramado, r.loading])

  // Día mostrado (ancla o adelantado) y si está leído — base de la reflexión.
  const shownDay = aheadDay != null ? aheadDay : r.displayDay
  const shownDone = shownDay != null && r.completed.has(shownDay)

  // Clave del día con nota (null cuando no aplica: sin leer o función apagada).
  // La nota pertenece al ciclo vigente del plan (sube al renovar o cambiar de plan):
  // las de un ciclo anterior quedan en el diario y no bloquean las nuevas.
  const cycle = cycleOf(profile)
  const noteKey =
    reflectionsEnabled && user && planId && shownDay != null && shownDone
      ? `${user.id}:${planId}:${shownDay}:${cycle}`
      : null

  // Sembrar la nota desde la caché en el MISMO render en que cambia el día (patrón
  // "ajustar estado al cambiar una clave"): al volver a Hoy el botón ya nace en
  // "Editar tu nota" sin parpadear primero "Anotá…". Si la caché aún no la tiene
  // (arranque en frío), queda undefined → se muestra "Anotá…" y la revalidación de
  // abajo corrige si en realidad había nota. Así nunca se degrada el "marcar leído".
  if (seededKey !== noteKey) {
    setSeededKey(noteKey)
    setNote(noteKey ? getCachedReflection(user.id, planId, shownDay, cycle) : null)
  }

  // Ventana de edición "tipo WhatsApp": editable solo el día en que se escribió.
  const noteEditable = !note || localDateISO(note.created_at) === todayLocalISO()

  // Revalidar contra el servidor por detrás; getReflection refresca la caché y, al
  // resolver, corrige la nota mostrada si cambió. Sin red, se queda lo seedeado.
  useEffect(() => {
    if (!noteKey) return
    let on = true
    getReflection(user.id, planId, shownDay, cycle)
      .then((row) => on && setNote(row ?? null))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [noteKey, user, planId, shownDay, cycle])

  // Oración de "Tu día": el mazo se trae cuando el día mostrado ya está leído
  // (los propios primero, como en Mi tiempo). Sin red, la fila no aparece.
  useEffect(() => {
    if (!user || !shownDone || aheadDay != null || prayerDeck != null) return
    let on = true
    getPrayerDeck(user.id)
      .then((d) => on && setPrayerDeck([...d.filter((p) => p.mine), ...d.filter((p) => !p.mine)]))
      .catch(() => on && setPrayerDeck([]))
    return () => {
      on = false
    }
  }, [user, shownDone, aheadDay, prayerDeck])
  useEffect(() => {
    const sync = () => setPrayed(readPrayedToday(user?.id))
    sync()
    window.addEventListener(PRAYED_EVENT, sync)
    return () => window.removeEventListener(PRAYED_EVENT, sync)
  }, [user])
  // Al cambiar de día mostrado, los pasajes vuelven a su estado plegado.
  useEffect(() => {
    setPassagesOpen(false)
  }, [shownDay])

  function readNext(target) {
    if (target != null) setAheadDay(target)
  }

  async function handleInstall() {
    if (installing || !canInstall) return
    setInstalling(true)
    await promptInstall()
    setInstalling(false)
  }

  function dismissInstallCard() {
    setInstallCardDismissed(true)
    try {
      localStorage.setItem(INSTALL_CARD_DISMISSED_KEY, '1')
    } catch {
      // El descarte es cosmético; si storage falla podría reaparecer más adelante.
    }
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
  // Orden: primero lo que se puede deshacer (guardar el logro y mover la fecha de
  // inicio) y recién al final borrar el progreso. Todo es idempotente, así que si
  // algo falla el diálogo queda abierto con el error y se puede reintentar sin
  // haber perdido nada.
  async function handleRenew() {
    if (!user || !planId || !duration) return
    setRenewing(true)
    setRenewError(false)
    try {
      await recordPlanCompletion({
        userId: user.id,
        planId,
        daysRead: r.completedCount,
        totalDays: duration,
        longestStreak: maxStreak,
        startedOn,
      })
      const { error } = await updateProfile({
        plan_start_date: startDateForDay(1),
        ...nextCyclePatch(profile),
      })
      if (error) throw error
      await clearPlanProgress(user.id, planId)
      setConfirmRenew(false)
    } catch {
      setRenewError(true)
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

  // Estado vacío: quien entró para leer con un grupo puede llegar sin plan
  // personal. Desde acá tiene las dos puertas honestas: plan propio o grupos.
  if (!r.hasPlan) {
    return (
      <EmptyState
        icon={<BookIcon size={34} />}
        title={t('hoy.empty.title')}
        text={t('hoy.empty.text')}
      >
        <Link to="/planes" className="btn btn-primary inline-block px-8">
          {t('hoy.empty.cta')}
        </Link>
        <Link to="/grupos" className="btn btn-secondary inline-block px-8">
          {t('hoy.empty.groups')}
        </Link>
      </EmptyState>
    )
  }

  // Qué se está mostrando: el día ancla (Hoy) o uno adelantado en sesión.
  const viewingAhead = aheadDay != null
  const dayShown = viewingAhead ? aheadDay : r.displayDay
  const refsShown = viewingAhead ? aheadRefs : r.todayRefs
  const readingUnavailable = !aheadLoading && (!refsShown || refsShown.length === 0)
  const doneShown = dayShown != null && r.completed.has(dayShown)
  // Recordatorio: aparece con el día mostrado ya marcado, pasado el respiro de
  // la marca (el momento de más ganas). Tiene prioridad sobre instalar.
  const showReminderOffer =
    !reminderOfferClosed &&
    (reminderOfferSticky ||
      (canOfferReminder(profile) &&
        doneShown &&
        !r.planFinished &&
        (!justMarked || breathDone)))
  const showInstallCard =
    canInstall &&
    r.completedCount > 0 &&
    !r.planFinished &&
    !justMarked &&
    !installCardDismissed &&
    !showReminderOffer
  // En iPhone no hay aviso de instalación del navegador: se explica cómo.
  const showIOSInstallCard =
    !canInstall &&
    isIOSBrowser() &&
    r.completedCount > 0 &&
    !r.planFinished &&
    !justMarked &&
    !installCardDismissed &&
    !showReminderOffer
  // Meta de donación: la de menor prioridad. Con el plan terminado, bajo el
  // festejo; si no, tras marcar el día y pasado el respiro, como el recordatorio.
  const moment = goalMoment({ planFinished: r.planFinished, streak: r.streak })
  const showGoalOffer =
    Boolean(donationGoal) &&
    !goalOfferClosed &&
    moment != null &&
    !wasGoalMomentSeen(user?.id, moment) &&
    (r.planFinished || (doneShown && !viewingAhead && (!justMarked || breathDone))) &&
    !showReminderOffer &&
    !showInstallCard &&
    !showIOSInstallCard
  // Biblioteca: al tercer día seguido, a quien todavía no tiene ningún material,
  // una sugerencia con nombre propio (una sola vez). Va después del recordatorio,
  // la instalación y la meta: una sola sugerencia por vez.
  const librarySuggestion = suggestedMaterials(profile, 1)[0] ?? null
  const showLibraryMoment =
    !libraryMomentClosed &&
    (libraryMomentSticky ||
      (librarySuggestion != null &&
    shouldOfferLibraryMoment({
      streak: r.streak,
      activeCount: Array.isArray(profile?.active_materials) ? profile.active_materials.length : 0,
      seen: wasLibraryMomentSeen(user?.id),
    }) &&
    doneShown &&
    !viewingAhead &&
    !r.planFinished &&
    (!justMarked || breathDone) &&
    !showReminderOffer &&
    !showInstallCard &&
    !showIOSInstallCard &&
    !showGoalOffer))
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

  // Marcar el día mostrado (el botón de Hoy, y "Solo marcar como leído").
  function markShownDay() {
    if (dayShown == null) return
    setJustMarked(true)
    navigator.vibrate?.(12)
    // Embudo: la primera lectura de una cuenta nueva (no la de quien solo
    // empieza otro plan).
    if (r.completedCount === 0 && isRecentAccount(profile)) recordFunnel('ob_first_mark')
    r.toggleDay(dayShown)
  }

  // El respiro de la marca: ~2 s de ✓ dibujado antes de que la pantalla siga.
  const breathing = doneShown && justMarked && !breathDone

  // Filas de "Tu día". Cada una es una invitación: sin diario no hay nota; sin
  // pedidos no hay oración; una nota de otro día no se reescribe (solo se ve).
  const noteRow =
    !reflectionsEnabled || note === undefined
      ? null
      : note
        ? { key: 'note', done: true, serif: true, title: note.body, onClick: () => setReflectOpen(true) }
        : noteEditable
          ? { key: 'note', done: false, title: t('hoy.day.noteTodo'), sub: t('hoy.day.noteTodoSub'), onClick: () => setReflectOpen(true) }
          : null
  const prayerNext = prayerDeck?.[0] ?? null
  const prayerRow = viewingAhead
    ? null
    : prayed
      ? { key: 'pray', done: true, title: t('hoy.day.prayDone'), sub: prayed.title || undefined }
      : prayerNext
        ? { key: 'pray', done: false, title: t('hoy.day.prayTodo'), sub: prayerNext.title, onClick: () => navigate('/orar', { state: { from: '/' } }) }
        : null
  const dayRows = [{ key: 'read', done: true, title: t('hoy.day.read') }, noteRow, prayerRow].filter(Boolean)
  const dayAllDone = dayRows.every((row) => row.done)

  // La invitación a probar "Mi tiempo": una sola vez, desde el segundo día.
  const showMyTimeInvite =
    !myTimeInviteClosed &&
    !viewingAhead &&
    !readingUnavailable &&
    dayShown != null &&
    shouldInviteMyTime({
      enabled: myTime.enabled,
      dismissed: false,
      completedCount: r.completedCount,
      doneToday: doneShown,
    })

  // Saludo y luz según la hora: "Buen día, Enrique" con el resplandor de la
  // mañana; a la noche, "Buenas noches" y un ámbar tenue.
  const period = dayPeriod()
  const name = firstName(profile?.display_name)
  const greeting = name
    ? t('hoy.greetName', { greet: t(`hoy.greet.${period}`), name })
    : t(`hoy.greet.${period}`)

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-120px)] flex-col pt-2 lg:min-h-0">
      <div aria-hidden="true" className={`day-light ${period}`} />
      <p className="mb-1 text-[14px] font-medium text-ink-soft">{greeting}</p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Sin "volver": el modelo es el señalador — leer adelantado mueve tu
              "hoy", y el ancla (useReading) te espera donde dejaste el marcador. */}
          {/* Cabecera del plan, una sola unidad con la lectura: el nombre como
              título (tocable hacia Lecturas), debajo "Día N de M" con el chip
              "✓ Leído" a la derecha, y una regla fina de avance que separa el
              encabezado de los pasajes. Sin hueco ni etiqueta intermedia: los
              pasajes se leen como el día del plan. */}
          {r.plan && (
            <Link to="/lecturas" className="block min-w-0 py-1">
              <span className="flex items-center gap-1">
                <span className="line-clamp-2 text-[17px] font-semibold leading-snug text-ink">
                  {planName(t, r.plan)}
                </span>
                <span aria-hidden="true" className="shrink-0 text-ink-soft" style={{ opacity: 0.5 }}>
                  ›
                </span>
              </span>
            </Link>
          )}
        </div>
        {/* En desktop Ajustes ya está visible en el sidebar; evitar duplicarlo. */}
        <Link
          to="/ajustes"
          aria-label={t('nav.ajustes')}
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-ink-soft transition-colors hover:text-accent-ink lg:hidden"
        >
          <GearIcon size={19} />
        </Link>
      </div>

      {/* Día del plan + estado del día. Si se está leyendo adelantado, el día es
          el adelantado (el ancla te espera donde dejaste el señalador). */}
      {!r.planFinished && dayShown != null && (
        <div className="flex min-h-7 items-center justify-between gap-2">
          <p className="text-[14px] tabular-nums text-ink-soft">
            {duration != null
              ? t('hoy.dayOfTotal', { day: dayShown, total: duration })
              : t('hoy.dayN', { day: dayShown })}
          </p>
          {!r.planFinished && doneShown && (breathDone || !justMarked) && (
            <div className="relative shrink-0">
              <button
                ref={chipRef}
                type="button"
                onClick={() => setChipMenuOpen((v) => !v)}
                aria-expanded={chipMenuOpen}
                aria-haspopup="menu"
                className="moment-in flex min-h-11 items-center"
              >
                <span
                  className="flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-semibold"
                  style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
                >
                  ✓ {t('hoy.read')}
                  <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.65 }}>▾</span>
                </span>
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
                    ref={menuRef}
                    role="menu"
                    onKeyDown={onMenuKeyDown}
                    className="absolute right-0 top-full z-30 -mt-1 w-max divide-y divide-hairline overflow-hidden rounded-input"
                    style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-overlay)' }}
                  >
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
      )}

      {r.offline && (
        <p className="mt-2 text-[12px] text-ink-soft">
          {r.staleReadings ? t('hoy.offline.stale') : t('hoy.offline.fresh')}
        </p>
      )}
      {r.readWriteError && <InlineError message={t('hoy.readWriteError')} className="mt-2" />}

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
              className="ml-3 min-h-11 py-2 text-[14px] font-semibold"
              style={{ color: 'var(--accent-ink)', opacity: r.reprogramando ? 0.5 : 1 }}
            >
              {r.reprogramando ? t('hoy.reprogramando') : t('hoy.reprogramar')}
            </button>
            <button
              type="button"
              onClick={r.dismissBehind}
              aria-label={t('hoy.dismissBehind')}
              className="ml-auto flex h-11 w-11 items-center justify-center text-[15px] leading-none text-ink-soft"
              style={{ opacity: 0.5 }}
            >
              ✕
            </button>
          </div>
          {r.reprogramarError && <InlineError message={t('hoy.reprogramarError')} />}
        </>
      )}
      {showReprogramado && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--accent-ink)' }} role="status">
          ✓ {t('hoy.reprogramado')}
        </p>
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
        // Regla fina de avance (ancho completo, 2px) como frontera entre el
        // encabezado del plan y los pasajes; después, la Palabra.
        <div className="mt-3">
          {duration != null && (
            <div
              className="h-[2px] w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--hairline)' }}
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-soft"
                style={{
                  width: `${Math.max(r.percent, r.completedCount > 0 ? 1 : 0)}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>
          )}
          {/* Tras leer, los pasajes se pliegan a una línea: ya los leíste en tu
              Biblia. "Ver" los vuelve a abrir (cada referencia sigue abriendo su
              capítulo). */}
          {doneShown && !passagesOpen && refsShown?.length > 0 ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[16px] text-ink-soft" style={{ fontFamily: BRAND_SERIF }}>
                {passageLine(refsShown, locale)}
              </p>
              <button
                type="button"
                onClick={() => setPassagesOpen(true)}
                className="min-h-11 shrink-0 text-[13px] font-semibold"
                style={{ color: 'var(--accent-ink)' }}
              >
                {t('hoy.passagesShow')}
              </button>
            </div>
          ) : (
          <div className="mt-5 space-y-1">
          {viewingAhead && aheadLoading ? (
            <SkeletonPassages />
          ) : (
            // El pasaje mismo es la puerta a la Biblia: cada referencia abre su
            // capítulo (tinta plena, sin color — el toque lo confirma la opacidad
            // al presionar).
            readingUnavailable ? (
              <div className="card p-4" role="alert">
                <h2 className="text-[17px] font-semibold text-ink">{t('hoy.unavailable.title')}</h2>
                <p className="mt-1 text-[14px] text-ink-soft">{t('hoy.unavailable.text')}</p>
                <button type="button" onClick={r.reload} className="btn btn-secondary mt-4">
                  {t('common.retry')}
                </button>
              </div>
            ) : (
              refsShown && (
                <PassageList
                  refs={refsShown}
                  locale={locale}
                  provider={bibleProvider}
                  externalHint={t('hoy.externalBibleHint')}
                />
              )
            )
          )}
          </div>
          )}
          {doneShown && passagesOpen && (
            <button
              type="button"
              onClick={() => setPassagesOpen(false)}
              className="mt-1 min-h-11 text-[13px] font-semibold"
              style={{ color: 'var(--accent-ink)' }}
            >
              {t('hoy.passagesHide')}
            </button>
          )}
          {/* Primer día: cómo se usa, una sola vez (hasta la primera marca). */}
          {r.completedCount === 0 && !viewingAhead && !readingUnavailable && (
            <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">{t('hoy.firstDayHint')}</p>
          )}

          {/* "Tu día": lo que sigue después de leer, en el recorrido de la pantalla.
              Con todo hecho, un cierre arriba: el número de días y "nos vemos
              mañana". Sin pedir más. */}
          {doneShown && (
            <section className={`mt-7 ${justMarked ? 'moment-in' : ''}`} aria-labelledby="tu-dia">
              {dayAllDone && !viewingAhead && (
                <div className="mb-6 text-center">
                  <p className="text-[44px] font-medium leading-none tabular-nums" style={{ fontFamily: BRAND_SERIF, color: 'var(--accent-ink)' }}>
                    {r.completedCount}
                  </p>
                  <p className="mt-1 text-[19px] text-ink" style={{ fontFamily: BRAND_SERIF }}>
                    {t('myTime.done.days', { count: r.completedCount })}
                  </p>
                  <p className="mt-0.5 text-[14px] text-ink-soft">{t('myTime.done.bye')}</p>
                </div>
              )}
              <h2 id="tu-dia" className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                {t('hoy.day.kicker')}
              </h2>
              <TodayCard rows={dayRows} />
              {/* "Tu Biblia, hoy": secundaria y callada, una invitación. */}
              {!viewingAhead && refsShown?.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 py-2 text-center text-[15px] font-medium text-ink-soft"
                >
                  <CameraIcon size={17} /> {t('photo.cta')}
                </button>
              )}
            </section>
          )}
        </div>
      )}

      {/* Lecturas secundarias del día. Una sola sección para no competir con la
          lectura principal: si no hay grupos/materiales, no ocupa lugar. Con el
          plan terminado sigue visible: ahí son justo lo que queda por leer. */}
      <TodayExtras />

      {/* Sugerencias (recordatorio, instalar, meta, Biblioteca, Mi tiempo): una
          por vez y al final, sin cortar entre la lectura y lo tuyo. */}
      {showReminderOffer && (
        <ReminderOffer
          onStart={() => setReminderOfferSticky(true)}
          onClose={() => {
            setReminderOfferSticky(false)
            setReminderOfferClosed(true)
          }}
        />
      )}

      {showLibraryMoment && (
        <LibraryMoment
          slug={libraryMomentSlug ?? librarySuggestion}
          streak={r.streak}
          onAdded={(slug) => {
            setLibraryMomentSlug(slug)
            setLibraryMomentSticky(true)
          }}
          onClose={() => setLibraryMomentClosed(true)}
        />
      )}

      {showGoalOffer && (
        <GoalOffer
          goal={donationGoal}
          moment={moment}
          streak={r.streak}
          onClose={() => setGoalOfferClosed(true)}
        />
      )}

      {showIOSInstallCard && (
        <section className="card mt-6 p-4" aria-labelledby="install-ios-title">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
              aria-hidden="true"
            >
              <InstallIcon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="install-ios-title" className="text-[17px] font-semibold text-ink">
                {t('hoy.install.title')}
              </h2>
              <p className="mt-1 text-[14px] leading-snug text-ink-soft">{t('hoy.install.textIOS')}</p>
            </div>
          </div>
          <ol className="mt-4 space-y-2">
            {[t('onboarding.extras.step1'), t('onboarding.extras.step2')].map((label, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-on-accent"
                  style={{ backgroundColor: 'var(--accent-action)' }}
                >
                  {i + 1}
                </span>
                <span className="text-[15px] text-ink">{label}</span>
                {i === 0 && (
                  <span className="ml-auto text-accent-ink">
                    <ShareIcon size={20} />
                  </span>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="mt-2 min-h-11 w-full text-center text-[15px] font-medium text-ink-soft"
            onClick={dismissInstallCard}
          >
            {t('hoy.install.dismiss')}
          </button>
        </section>
      )}

      {showInstallCard && (
        <section className="card mt-6 p-4" aria-labelledby="install-app-title">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
              aria-hidden="true"
            >
              <InstallIcon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="install-app-title" className="text-[17px] font-semibold text-ink">
                {t('hoy.install.title')}
              </h2>
              <p className="mt-1 text-[14px] leading-snug text-ink-soft">
                {t('hoy.install.text')}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={handleInstall}
            disabled={installing}
            style={{ opacity: installing ? 0.6 : 1 }}
          >
            {installing ? t('hoy.install.opening') : t('hoy.install.cta')}
          </button>
          <button
            type="button"
            className="mt-1 min-h-11 w-full text-center text-[15px] font-medium text-ink-soft"
            onClick={dismissInstallCard}
          >
            {t('hoy.install.dismiss')}
          </button>
        </section>
      )}

      {showMyTimeInvite && (
        <section className="card moment-in mt-6 flex items-start gap-3.5 p-4" aria-labelledby="mytime-invite">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[20px]"
            style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
          >
            ✦
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="mytime-invite" className="text-[15px] font-semibold text-ink">{t('myTime.inviteTitle')}</h3>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{t('myTime.inviteText')}</p>
            <div className="mt-1 flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  dismissMyTimeInvite(user?.id)
                  setMyTimeInviteClosed(true)
                  setMyTime({ enabled: true })
                  setMyTimeOpen(true)
                }}
                className="-ml-1 flex min-h-11 items-center px-1 text-[14px] font-semibold"
                style={{ color: 'var(--accent-ink)' }}
              >
                {t('myTime.inviteTry')}
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissMyTimeInvite(user?.id)
                  setMyTimeInviteClosed(true)
                }}
                className="flex min-h-11 items-center px-1 text-[14px] font-medium text-ink-soft"
              >
                {t('myTime.inviteNo')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Adelantarse es la excepción: al final, como enlace suave. */}
      {!r.planFinished && doneShown && !breathing && nextDay != null && (
        <button
          type="button"
          onClick={() => readNext(nextDay)}
          className="mt-4 block min-h-11 w-full py-2 text-center text-[15px] font-semibold"
          style={{ color: 'var(--accent-ink)' }}
        >
          {t('hoy.readNextDay')} →
        </button>
      )}

      <div className="flex-1 lg:hidden" />

      {/* Zona de acción: solo mientras el día mostrado no está leído (marcar) y
          durante el respiro de la marca (el ✓ dibujado, con la línea cálida
          ARRIBA: el botón nunca se mueve). Después, lo que sigue vive en "Tu
          día", en el recorrido de la pantalla, no en una barra fija. */}
      {!r.planFinished && (!doneShown ? !readingUnavailable : breathing) && (
        <div className="action-bar">
          <div className="lg:mx-auto lg:max-w-[440px]">
            {!doneShown ? (
                myTime.enabled && !viewingAhead ? (
                  // Con "Mi tiempo" activo: el recorrido es lo primario, y marcar
                  // directo queda a un toque para los días con prisa.
                  <>
                    <button type="button" onClick={() => setMyTimeOpen(true)} className="btn btn-primary">
                      {t('myTime.start')}
                    </button>
                    <button
                      type="button"
                      onClick={markShownDay}
                      className="mt-1 block min-h-11 w-full text-center text-[15px] font-medium"
                      style={{ color: 'var(--accent-ink)' }}
                    >
                      {t('myTime.justMark')}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={markShownDay} className="btn btn-primary">
                    {t('hoy.markRead')}
                  </button>
                )
            ) : (
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
            )}
          </div>
        </div>
      )}

      {myTimeOpen && dayShown != null && (
        <MyTimeFlow
          refs={refsShown ?? []}
          doneToday={doneShown}
          onMarkRead={async () => {
            if (r.completedCount === 0 && isRecentAccount(profile)) recordFunnel('ob_first_mark')
            r.toggleDay(dayShown)
          }}
          note={note}
          noteEditable={noteEditable}
          onSaveNote={async (body) => {
            const row = await upsertReflection(user.id, planId, shownDay, body, cycle)
            setNote(row)
          }}
          prefs={myTime}
          reflectionsEnabled={reflectionsEnabled}
          daysRead={r.completedCount}
          onPhoto={() => {
            setMyTimeOpen(false)
            setPhotoOpen(true)
          }}
          onClose={() => setMyTimeOpen(false)}
        />
      )}

      {photoOpen && (
        <BiblePhotoSheet
          data={{
            passage: passageLine(refsShown, locale),
            day: shownDay,
            daysRead: r.completedCount,
            streak: r.streak,
            note: note?.body ?? null,
          }}
          onClose={() => setPhotoOpen(false)}
        />
      )}

      {reflectOpen && shownDay != null && (
        <ReflectionSheet
          planName={r.plan ? planName(t, r.plan) : t('common.plan')}
          dayNumber={shownDay}
          initialBody={note?.body ?? ''}
          editable={noteEditable}
          shareData={
            note
              ? {
                  spine: t('progreso.view.camino'),
                  number: fmtISODate(localDateISO(note.created_at), locale, { day: 'numeric', month: 'long' }),
                  sub: t('share.noteSub', {
                    plan: r.plan ? planName(t, r.plan) : t('common.plan'),
                    day: shownDay,
                  }),
                  quote: note.body,
                  filename: `mi-camino-${localDateISO(note.created_at)}.png`,
                }
              : null
          }
          onClose={() => setReflectOpen(false)}
          onSave={async (body) => {
            const row = await upsertReflection(user.id, planId, shownDay, body, cycle)
            setNote(row)
            setReflectOpen(false)
          }}
          onDelete={async () => {
            await deleteReflection(user.id, planId, shownDay, cycle)
            setNote(null)
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
          error={renewError ? t('common.saveError') : null}
          onConfirm={handleRenew}
          onCancel={() => {
            setConfirmRenew(false)
            setRenewError(false)
          }}
        />
      )}
    </div>
  )
}
