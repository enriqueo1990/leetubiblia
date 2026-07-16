import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/auth.jsx'
import {
  getPlan,
  getPlanDay,
  getCompletionMap,
  dayNumberFor,
  firstUnreadDay,
  computeDateStreak,
  addDaysISO,
  todayLocalISO,
  markRead,
  unmarkRead,
} from '../lib/db.js'
import {
  enqueue,
  flushQueue,
  cacheReading,
  getCachedReading,
  isOnline,
  getDismissedBehind,
  setDismissedBehind,
} from '../lib/offline.js'

// Día al que se ancla la pantalla Hoy — el modelo es el SEÑALADOR, no el
// calendario (decidido con Enrique, 2026-07-08):
//  - Si vas ATRASADO → el día del calendario (regla canónica: mostrás la lectura
//    de la fecha, con su banner de reprogramar y la posibilidad de dejar huecos).
//  - Si marcaste lecturas HOY → el día MÁS ALTO marcado hoy. Ahí dejaste el
//    señalador: leer adelantado mueve tu "hoy", y volver a la pantalla te espera
//    en ese día cerrado (chip ✓, nota, "leer el siguiente") hasta mañana.
//  - Si no marcaste nada hoy (al día o adelantado de días previos) → el PRÓXIMO
//    día sin leer: cada mañana te espera tu próxima lectura.
//  - null → plan terminado (todo leído).
function computeAnchorDay(completedMap, calendarDay, duration) {
  const nextUnread = firstUnreadDay(completedMap, duration)
  if (nextUnread > duration) return null

  // El señalador manda, ANTES que el atraso: si marcaste algún día HOY, Hoy se
  // queda en el más avanzado que leíste —aunque te hayas adelantado al calendario
  // o dejado un hueco atrás—. Leer adelantado mueve tu "hoy"; volver a la pantalla
  // te espera ahí, no te devuelve al día del calendario ni te empuja al siguiente.
  if (typeof completedMap.get === 'function') {
    const today = todayLocalISO()
    let lastToday = null
    for (const [day, date] of completedMap) {
      if (date === today && day <= duration && (lastToday == null || day > lastToday)) {
        lastToday = day
      }
    }
    if (lastToday != null) return lastToday
  }

  // No leíste hoy: si venís atrasado respecto del calendario, mostrás la lectura
  // de la fecha (con banner de reprogramar y la opción de dejar huecos). Si no,
  // tu próxima lectura sin leer.
  const cap = Math.min(calendarDay, duration)
  const behind = Math.max(0, cap - firstUnreadDay(completedMap, cap))
  if (behind > 0 && calendarDay <= duration) return calendarDay
  return nextUnread
}

// Reconstruye el Map day→fecha desde el snapshot offline. Tolera el formato viejo
// (array de day_numbers sin fecha): esos días no aportan a la racha hasta recargar.
function rebuildCompletedMap(cached) {
  const map = new Map()
  if (!Array.isArray(cached)) return map
  for (const item of cached) {
    if (Array.isArray(item)) map.set(item[0], item[1])
    else map.set(item, null)
  }
  return map
}

// Estado de lectura del plan activo del usuario. Centraliza la regla canónica de
// day_number y las acciones (marcar/desmarcar, reprogramar). Soporta offline:
// cachea el contenido de Hoy y encola el marcado para sincronizar al reconectar.
export function useReading() {
  const { user, profile, updateProfile } = useAuth()
  const planId = profile?.active_plan_id ?? null
  const planStart = profile?.plan_start_date ?? null

  const [plan, setPlan] = useState(null)
  const [todayRefs, setTodayRefs] = useState(null)
  // Map day_number → fecha local en que se marcó. Sus claves son los "días leídos"
  // (se usa como un Set vía .has/.size) y sus valores alimentan la racha real.
  const [completedMap, setCompletedMap] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(!isOnline())
  // Nivel de atraso en el que el usuario descartó el banner (0 = no descartado).
  const [dismissedBehind, setDismissedBehindState] = useState(0)
  // Día ancla de Hoy. Se FIJA al cargar (no salta a mitad de sesión al marcar);
  // se recalcula al recargar / reprogramar. Ver computeAnchorDay.
  const [anchorDay, setAnchorDay] = useState(null)
  // Feedback de reprogramar (requiere conexión): busy y último fallo.
  const [reprogramando, setReprogramando] = useState(false)
  const [reprogramarError, setReprogramarError] = useState(false)
  // Racha guardada en el snapshot, para no mostrar 0 offline si el snapshot viejo
  // no trae las fechas con que se calcula la racha. null = recalcular en vivo.
  const [offlineStreak, setOfflineStreak] = useState(null)
  // Fecha local en que se cacheó el snapshot. Si offline cambió el día, la lectura
  // mostrada es de la última sync (no se pueden traer las refs del día nuevo).
  const [snapshotDate, setSnapshotDate] = useState(null)
  // Último fallo real al guardar lectura. Los fallos de red se encolan; los de
  // Supabase/RLS se revierten para no mostrar un "leído" que nunca persistirá.
  const [readWriteError, setReadWriteError] = useState(false)

  const todayDay = planStart ? dayNumberFor(planStart) : null

  // Set de días leídos (identidad estable mientras no cambie el progreso). El
  // resto del hook y las pantallas lo usan con .has/.size, igual que antes.
  const completed = useMemo(() => new Set(completedMap.keys()), [completedMap])

  // Fechas locales (YYYY-MM-DD) con al menos una lectura marcada. Es la MISMA base
  // que la racha (computeDateStreak): el calendario de constancia de Progreso pinta
  // estas fechas, así la grilla y el número de racha coinciden siempre. Se descartan
  // los null (snapshot viejo sin fecha), que no aportan a la racha ni se pueden pintar.
  const readDates = useMemo(
    () => new Set([...completedMap.values()].filter(Boolean)),
    [completedMap]
  )

  // Cargar el descarte persistido al cambiar de usuario.
  useEffect(() => {
    setDismissedBehindState(user ? getDismissedBehind(user.id) : 0)
  }, [user])

  const persistSnapshot = useCallback(
    (planRow, refs, map, anchor) => {
      if (!user) return
      cacheReading(user.id, {
        plan: planRow,
        todayRefs: refs,
        completed: [...map], // entradas [day_number, fechaISO] para la racha offline
        planStart,
        anchorDay: anchor,
        // Guardamos la racha calculada: fallback si al hidratar el snapshot le
        // faltaran las fechas (formato viejo) y no se pudiera recalcular.
        streak: computeDateStreak(new Set(map.values()), todayLocalISO()),
        // Fecha del cacheo: para detectar offline que el día cambió.
        snapshotDate: todayLocalISO(),
      })
    },
    [user, planStart]
  )

  const load = useCallback(async () => {
    if (!user || !planId || !planStart) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Sincronizar pendientes antes de leer, para no pisar lo encolado.
      await flushQueue(user.id)

      const [planRow, map] = await Promise.all([
        getPlan(planId),
        getCompletionMap(user.id, planId),
      ])
      const calDay = dayNumberFor(planStart)
      const anchor = computeAnchorDay(map, calDay, planRow.duration_days)
      let refs = []
      if (anchor != null && anchor >= 1 && anchor <= planRow.duration_days) {
        const pd = await getPlanDay(planId, anchor)
        refs = pd?.refs ?? []
      }
      setPlan(planRow)
      setCompletedMap(map)
      setAnchorDay(anchor)
      setTodayRefs(refs)
      setOffline(false)
      setOfflineStreak(null) // online: la racha se recalcula en vivo desde el map
      setSnapshotDate(null)
      persistSnapshot(planRow, refs, map, anchor)
    } catch {
      // Sin red: hidratar desde el caché si lo hay.
      const cached = getCachedReading(user.id)
      if (cached && cached.planStart === planStart) {
        setPlan(cached.plan)
        setTodayRefs(cached.todayRefs)
        setCompletedMap(rebuildCompletedMap(cached.completed))
        setAnchorDay(cached.anchorDay ?? null)
        setOfflineStreak(typeof cached.streak === 'number' ? cached.streak : null)
        setSnapshotDate(cached.snapshotDate ?? null)
      }
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [user, planId, planStart, persistSnapshot])

  useEffect(() => {
    load()
  }, [load])

  // Reintentar al recuperar conexión.
  useEffect(() => {
    function onOnline() {
      if (user) flushQueue(user.id).then(() => load())
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [user, load])

  // Marca/desmarca un día. Optimista; si la red falla, encola para después.
  const toggleDay = useCallback(
    async (dayNumber, value) => {
      if (!user || !planId) return
      const shouldComplete = value ?? !completedMap.has(dayNumber)
      const completedOn = todayLocalISO()
      setReadWriteError(false)

      // Optimista: la fecha de marcado es hoy (local) → cuenta para la racha real.
      const next = new Map(completedMap)
      if (shouldComplete) next.set(dayNumber, completedOn)
      else next.delete(dayNumber)
      setCompletedMap(next)
      persistSnapshot(plan, todayRefs, next, anchorDay)

      try {
        if (shouldComplete) await markRead(user.id, planId, dayNumber, completedOn)
        else await unmarkRead(user.id, planId, dayNumber)
      } catch (error) {
        if (error?.isNetworkError) {
          enqueue(user.id, {
            type: shouldComplete ? 'mark' : 'unmark',
            planId,
            dayNumber,
            completedOn,
          })
          setOffline(true)
          return
        }

        // Error real del servidor/permisos: revertir el optimismo y avisar.
        setCompletedMap(completedMap)
        persistSnapshot(plan, todayRefs, completedMap, anchorDay)
        setReadWriteError(true)
      }
    },
    [user, planId, completedMap, plan, todayRefs, anchorDay, persistSnapshot]
  )

  // Reprogramar (documento maestro §5.1): mover plan_start_date al primer día no
  // leído. Correr y seguir, sin reinsertar saltados. Requiere conexión. Captura el
  // error de updateProfile (que no lanza) y lo expone, en vez de fallar en silencio
  // dejando al usuario atascado en el atraso.
  const reprogramar = useCallback(async () => {
    if (!planStart || todayDay == null) return
    setReprogramarError(false)
    if (!isOnline()) {
      setReprogramarError(true)
      return
    }
    setReprogramando(true)
    const fu = firstUnreadDay(completed, todayDay)
    const newStart = addDaysISO(todayLocalISO(), -(fu - 1))
    const { error } = await updateProfile({ plan_start_date: newStart })
    setReprogramando(false)
    if (error) setReprogramarError(true)
    // En éxito, el cambio de plan_start_date dispara load() y el atraso baja a 0.
  }, [planStart, todayDay, completed, updateProfile])

  const duration = plan?.duration_days ?? null
  const completedCount = completed.size
  const percent = duration ? Math.round((completedCount / duration) * 100) : 0
  // Racha por días reales: fechas distintas (locales) en que se marcó algo. Si el
  // snapshot offline no trae fechas (formato viejo), el recálculo daría 0 aunque
  // hayas leído: en ese caso usamos la racha guardada en el snapshot.
  const streakLive = computeDateStreak(readDates, todayLocalISO())
  const hasDates = [...completedMap.values()].some((v) => v != null)
  const streak = !hasDates && offlineStreak != null ? offlineStreak : streakLive

  // Atraso respecto del calendario: huecos antes de hoy (sin contar hoy pendiente).
  const behindCap = todayDay != null && duration != null ? Math.min(todayDay, duration) : null
  const firstUnread = behindCap != null ? firstUnreadDay(completed, behindCap) : null
  const behind = behindCap != null && firstUnread != null ? Math.max(0, behindCap - firstUnread) : 0

  // Próximo día sin leer en todo el plan (duration+1 si está todo leído).
  const nextUnread = duration != null ? firstUnreadDay(completed, duration) : null
  const planFinished = duration != null && nextUnread != null && nextUnread > duration

  // Día que muestra Hoy (ancla fijada al cargar). Hoy.jsx calcula si está marcado.
  const displayDay = anchorDay

  // Offline y el día cambió desde el último cacheo: la lectura mostrada es vieja.
  const staleReadings = offline && snapshotDate != null && snapshotDate !== todayLocalISO()

  // Al ponerse al día, olvidar el descarte (el próximo atraso arranca de cero).
  useEffect(() => {
    if (user && behind === 0 && dismissedBehind !== 0) {
      setDismissedBehindState(0)
      setDismissedBehind(user.id, 0)
    }
  }, [user, behind, dismissedBehind])

  // El banner se muestra solo si el atraso supera el nivel ya descartado — y
  // nunca cuando tu señalador ya pasó el día del calendario: si estás leyendo
  // adelantado, "te atrasaste" es una contradicción (y Reprogramar correría el
  // plan pisando tu avance). El hueco atrás sigue visible en el calendario de
  // Progreso; acá no.
  const anchoredAhead = displayDay != null && todayDay != null && displayDay > todayDay
  const showBehind = behind > 0 && behind > dismissedBehind && !anchoredAhead

  // Descartar el banner al nivel de atraso actual ("seguir igual" por ahora).
  const dismissBehind = useCallback(() => {
    if (!user) return
    setDismissedBehindState(behind)
    setDismissedBehind(user.id, behind)
  }, [user, behind])

  return {
    loading,
    offline,
    hasPlan: !!planId,
    plan,
    todayDay,
    displayDay,
    staleReadings,
    todayRefs,
    completed,
    readDates,
    completedCount,
    percent,
    streak,
    behind,
    showBehind,
    dismissBehind,
    firstUnread,
    planFinished,
    toggleDay,
    reprogramar,
    reprogramando,
    reprogramarError,
    readWriteError,
    reload: load,
  }
}
