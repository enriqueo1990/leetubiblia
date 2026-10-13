import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth.jsx'
import { usePreferences } from './preferences.jsx'
import { getFollowedGroupReadings } from './db.js'
import { activeMaterials, loadMaterialContent } from './materials.js'
import { buildExtraRows } from './todayExtrasRows.js'

export function useTodayExtras() {
  const { user, profile } = useAuth()
  const { t, locale } = usePreferences()
  const [groupReadings, setGroupReadings] = useState(null)
  // Si falla una carga NO se disfraza de "no hay lecturas": se expone `error` y un
  // `retry` para que la vista pueda avisar y reintentar.
  const [attempt, setAttempt] = useState(0)
  const [groupsFailed, setGroupsFailed] = useState(false)
  const [materialsFailed, setMaterialsFailed] = useState(false)
  const materials = activeMaterials(profile)
  const [contents, setContents] = useState({})
  const [materialsReady, setMaterialsReady] = useState(materials.length === 0)

  useEffect(() => {
    // Sin cuenta no hay grupos: resolver vacío para no quedar cargando para siempre.
    if (!user) {
      setGroupReadings([])
      return
    }
    let on = true
    setGroupReadings(null)
    setGroupsFailed(false)
    getFollowedGroupReadings(user.id)
      .then((list) => on && setGroupReadings(list))
      .catch(() => {
        if (!on) return
        setGroupReadings([])
        setGroupsFailed(true)
      })
    return () => {
      on = false
    }
  }, [user, attempt])

  const activeKey = materials.map((m) => m.slug).join(',')
  useEffect(() => {
    let on = true
    setMaterialsReady(materials.length === 0)
    setMaterialsFailed(false)
    if (materials.length === 0) {
      setContents({})
      return () => {
        on = false
      }
    }
    // Un material que no carga (chunk viejo tras un deploy, sin red) no cuelga a
    // los demás ni deja la sección cargando para siempre.
    Promise.all(
      materials.map((m) => loadMaterialContent(m.slug).catch(() => undefined))
    ).then((loaded) => {
      if (!on) return
      const next = {}
      loaded.forEach((c) => {
        if (c) next[c.slug] = c
      })
      setContents(next)
      setMaterialsFailed(loaded.some((c) => c === undefined))
      setMaterialsReady(true)
    })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, attempt])

  const rows = useMemo(
    () => buildExtraRows({ groupReadings, materials, contents, profile, t, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupReadings, contents, profile, t, locale]
  )

  return {
    loading: groupReadings === null || !materialsReady,
    profile,
    rows,
    pendingCount: rows.filter((r) => r.pending).length,
    error: groupsFailed || materialsFailed,
    retry: () => setAttempt((n) => n + 1),
  }
}
