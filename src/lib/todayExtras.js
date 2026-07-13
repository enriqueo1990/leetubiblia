import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth.jsx'
import { usePreferences } from './preferences.jsx'
import { getFollowedGroupReadings } from './db.js'
import { activeMaterials, getMaterial, loadMaterialContent } from './materials.js'

export function useTodayExtras() {
  const { user, profile } = useAuth()
  const { t } = usePreferences()
  const [groupReadings, setGroupReadings] = useState(null)
  const materials = activeMaterials(profile)
  const [contents, setContents] = useState({})
  const [materialsReady, setMaterialsReady] = useState(materials.length === 0)

  useEffect(() => {
    if (!user) return
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

  const visibleGroups = useMemo(
    () =>
      (groupReadings ?? []).filter(
        (r) =>
          !(
            r.planId === profile?.active_plan_id &&
            r.planStartDate === profile?.plan_start_date
          )
      ),
    [groupReadings, profile?.active_plan_id, profile?.plan_start_date]
  )

  const materialRows = materials
    .map((m) => {
      const content = contents[m.slug]
      if (!content) return null
      const done = m.position > content.total
      const entry = done ? null : content.entries[m.position - 1]
      return {
        slug: m.slug,
        label: getMaterial(m.slug)?.shortName ?? content.name,
        meta: done
          ? t('materialsToday.completed')
          : t('materialsToday.questionOf', { n: entry?.number ?? m.position, total: content.total }),
        done,
      }
    })
    .filter(Boolean)

  const rows = [
    ...visibleGroups.map((r) => ({ type: 'group', key: `group-${r.groupId}`, item: r })),
    ...materialRows.map((m) => ({ type: 'material', key: `material-${m.slug}`, item: m })),
  ]

  return {
    loading: groupReadings === null || !materialsReady,
    profile,
    rows,
  }
}
