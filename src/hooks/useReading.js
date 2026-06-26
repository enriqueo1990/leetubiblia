import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/auth.jsx'
import {
  getPlan,
  getPlanDay,
  getCompletedDays,
  dayNumberFor,
  firstUnreadDay,
  computeStreak,
  addDaysISO,
  todayLocalISO,
} from '../lib/db.js'
import {
  enqueue,
  flushQueue,
  cacheReading,
  getCachedReading,
  isOnline,
} from '../lib/offline.js'

// Estado de lectura del plan activo del usuario. Centraliza la regla canónica de
// day_number y las acciones (marcar/desmarcar, reprogramar). Soporta offline:
// cachea el contenido de Hoy y encola el marcado para sincronizar al reconectar.
export function useReading() {
  const { user, profile, updateProfile } = useAuth()
  const planId = profile?.active_plan_id ?? null
  const planStart = profile?.plan_start_date ?? null

  const [plan, setPlan] = useState(null)
  const [todayRefs, setTodayRefs] = useState(null)
  const [completed, setCompleted] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(!isOnline())

  const todayDay = planStart ? dayNumberFor(planStart) : null

  const persistSnapshot = useCallback(
    (planRow, refs, completedSet) => {
      if (!user) return
      cacheReading(user.id, {
        plan: planRow,
        todayRefs: refs,
        completed: [...completedSet],
        planStart,
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

      const [planRow, completedSet] = await Promise.all([
        getPlan(planId),
        getCompletedDays(user.id, planId),
      ])
      const day = dayNumberFor(planStart)
      let refs = []
      if (day >= 1 && day <= planRow.duration_days) {
        const pd = await getPlanDay(planId, day)
        refs = pd?.refs ?? []
      }
      setPlan(planRow)
      setCompleted(completedSet)
      setTodayRefs(refs)
      setOffline(false)
      persistSnapshot(planRow, refs, completedSet)
    } catch {
      // Sin red: hidratar desde el caché si lo hay.
      const cached = getCachedReading(user.id)
      if (cached && cached.planStart === planStart) {
        setPlan(cached.plan)
        setTodayRefs(cached.todayRefs)
        setCompleted(new Set(cached.completed))
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
      const shouldComplete = value ?? !completed.has(dayNumber)

      const next = new Set(completed)
      if (shouldComplete) next.add(dayNumber)
      else next.delete(dayNumber)
      setCompleted(next)
      persistSnapshot(plan, todayRefs, next)

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
    [user, planId, completed, plan, todayRefs, persistSnapshot]
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
  const streak = todayDay != null ? computeStreak(completed, todayDay) : 0
  const firstUnread = todayDay != null ? firstUnreadDay(completed, todayDay) : null
  const behind = todayDay != null && firstUnread != null ? todayDay - firstUnread : 0
  const todayDone = todayDay != null && completed.has(todayDay)
  const planFinished = todayDay != null && duration != null && todayDay > duration

  return {
    loading,
    offline,
    hasPlan: !!planId,
    plan,
    todayDay,
    todayRefs,
    todayDone,
    completed,
    completedCount,
    percent,
    streak,
    behind,
    firstUnread,
    planFinished,
    toggleDay,
    reprogramar,
    reload: load,
  }
}
