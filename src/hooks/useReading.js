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

// Día al que se ancla la pantalla Hoy:
//  - Si vas ATRASADO → el día del calendario (regla canónica: mostrás la lectura
//    de la fecha, con su banner de reprogramar y la posibilidad de dejar huecos).
//  - Si vas AL DÍA o ADELANTADO → el PRÓXIMO día sin leer. Así Hoy refleja dónde
//    vas de verdad y no un día de calendario ya leído (clave para el lector que se
//    mantiene adelantado todo el año).
//  - null → plan terminado (todo leído).
function computeAnchorDay(completedSet, calendarDay, duration) {
  const nextUnread = firstUnreadDay(completedSet, duration)
  if (nextUnread > duration) return null
  const cap = Math.min(calendarDay, duration)
  const behind = Math.max(0, cap - firstUnreadDay(completedSet, cap))
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

  const todayDay = planStart ? dayNumberFor(planStart) : null

  // Set de días leídos (identidad estable mientras no cambie el progreso). El
  // resto del hook y las pantallas lo usan con .has/.size, igual que antes.
  const completed = useMemo(() => new Set(completedMap.keys()), [completedMap])

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
      persistSnapshot(planRow, refs, map, anchor)
    } catch {
      // Sin red: hidratar desde el caché si lo hay.
      const cached = getCachedReading(user.id)
      if (cached && cached.planStart === planStart) {
        setPlan(cached.plan)
        setTodayRefs(cached.todayRefs)
        setCompletedMap(rebuildCompletedMap(cached.completed))
        setAnchorDay(cached.anchorDay ?? null)
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

      // Optimista: la fecha de marcado es hoy (local) → cuenta para la racha real.
      const next = new Map(completedMap)
      if (shouldComplete) next.set(dayNumber, todayLocalISO())
      else next.delete(dayNumber)
      setCompletedMap(next)
      persistSnapshot(plan, todayRefs, next, anchorDay)

      try {
        const { markRead, unmarkRead } = await import('../lib/db.js')
        if (shouldComplete) await markRead(user.id, planId, dayNumber)
        else await unmarkRead(user.id, planId, dayNumber)
      } catch {
        // Offline / fallo: encolar y mantener el estado optimista.
        enqueue(user.id, {
          type: shouldComplete ? 'mark' : 'unmark',
          planId,
          dayNumber,
        })
        setOffline(true)
      }
    },
    [user, planId, completedMap, plan, todayRefs, anchorDay, persistSnapshot]
  )

  // Reprogramar (documento maestro §5.1): mover plan_start_date al primer día no
  // leído. Correr y seguir, sin reinsertar saltados. Requiere conexión.
  const reprogramar = useCallback(async () => {
    if (!planStart || todayDay == null) return
    const fu = firstUnreadDay(completed, todayDay)
    const newStart = addDaysISO(todayLocalISO(), -(fu - 1))
    await updateProfile({ plan_start_date: newStart })
  }, [planStart, todayDay, completed, updateProfile])

  const duration = plan?.duration_days ?? null
  const completedCount = completed.size
  const percent = duration ? Math.round((completedCount / duration) * 100) : 0
  // Racha por días reales: fechas distintas (locales) en que se marcó algo.
  const streak = computeDateStreak(new Set(completedMap.values()), todayLocalISO())

  // Atraso respecto del calendario: huecos antes de hoy (sin contar hoy pendiente).
  const behindCap = todayDay != null && duration != null ? Math.min(todayDay, duration) : null
  const firstUnread = behindCap != null ? firstUnreadDay(completed, behindCap) : null
  const behind = behindCap != null && firstUnread != null ? Math.max(0, behindCap - firstUnread) : 0

  // Próximo día sin leer en todo el plan (duration+1 si está todo leído).
  const nextUnread = duration != null ? firstUnreadDay(completed, duration) : null
  const planFinished = duration != null && nextUnread != null && nextUnread > duration

  // Día que muestra Hoy (ancla fijada al cargar). Hoy.jsx calcula si está marcado.
  const displayDay = anchorDay

  // Al ponerse al día, olvidar el descarte (el próximo atraso arranca de cero).
  useEffect(() => {
    if (user && behind === 0 && dismissedBehind !== 0) {
      setDismissedBehindState(0)
      setDismissedBehind(user.id, 0)
    }
  }, [user, behind, dismissedBehind])

  // El banner se muestra solo si el atraso supera el nivel ya descartado.
  const showBehind = behind > 0 && behind > dismissedBehind

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
    todayRefs,
    completed,
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
    reload: load,
  }
}
