import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth.jsx'
import { usePreferences } from './preferences.jsx'
import { getFollowedGroupReadings } from './db.js'
import { activeMaterials, loadMaterialContent } from './materials.js'
import { buildExtraRows } from './todayExtrasRows.js'

export function useTodayExtras() {
  const { user, profile } = useAuth()
  const { t } = usePreferences()
  const [groupReadings, setGroupReadings] = useState(null)
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
    getFollowedGroupReadings(user.id)
      .then((list) => on && setGroupReadings(list))
      .catch(() => on && setGroupReadings([]))
    return () => {
      on = false
    }
  }, [user])

  const activeKey = materials.map((m) => m.slug).join(',')
  useEffect(() => {
    let on = true
    setMaterialsReady(materials.length === 0)
    if (materials.length === 0) {
      setContents({})
      return () => {
        on = false
      }
    }
    Promise.all(materials.map((m) => loadMaterialContent(m.slug))).then((loaded) => {
      if (!on) return
      const next = {}
      loaded.forEach((c) => {
        if (c) next[c.slug] = c
      })
      setContents(next)
      setMaterialsReady(true)
    })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  const rows = useMemo(
    () => buildExtraRows({ groupReadings, materials, contents, profile, t }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupReadings, contents, profile, t]
  )

  return {
    loading: groupReadings === null || !materialsReady,
    profile,
    rows,
    pendingCount: rows.filter((r) => r.pending).length,
  }
}
