// Armado puro de las filas de "También hoy" (sin React ni JSX, para poder
// probarlo con node:test). Recibe lo ya cargado y devuelve la lista final.
import {
  calendarEntryNumber,
  entryOfLabel,
  getMaterial,
  isCalendarMaterial,
  isReadToday,
} from './materials.js'

export function buildExtraRows({ groupReadings, materials, contents, profile, t, locale, now = new Date() }) {
  // El grupo que sigue exactamente tu plan personal duplicaría la lectura
  // principal de Hoy: se descarta.
  const visibleGroups = (groupReadings ?? []).filter(
    (r) =>
      !(
        r.planId === profile?.active_plan_id &&
        r.planStartDate === profile?.plan_start_date
      )
  )

  const materialRows = (materials ?? [])
    .map((m) => {
      const content = contents?.[m.slug]
      if (!content) return null
      // El nombre completo: la ficha tiene lugar (la portada ya da el corto).
      const label = getMaterial(m.slug)?.name ?? content.name
      // Por fecha: siempre hay una lectura para hoy. Si ya se marcó, la fila queda
      // como hecha ("✓ Leído") y baja al final.
      if (isCalendarMaterial(m.slug)) {
        const n = calendarEntryNumber(now)
        const done = isReadToday(profile, m.slug, now)
        return {
          slug: m.slug,
          label,
          meta: done ? t('hoy.read') : entryOfLabel(t, m.slug, n, content.total, locale),
          // Por fecha no hay "avance" (es la lectura del día): sin barra.
          shortMeta: done ? t('hoy.read') : entryOfLabel(t, m.slug, n, content.total, locale),
          progress: null,
          question: content.entries[n - 1]?.question ?? null,
          done,
        }
      }
      // Un material terminado no es "una lectura para hoy": sigue en Ajustes ›
      // Materiales como "Completado · repasar", pero deja de ocupar el día.
      if (m.position > content.total) return null
      const entry = content.entries[m.position - 1]
      const n = entry?.number ?? m.position
      return {
        slug: m.slug,
        label,
        meta: entryOfLabel(t, m.slug, n, content.total),
        // "28 de 107" y la barra: lo leído hasta acá sobre el total.
        shortMeta: t('materialsToday.itemOf', { n, total: content.total }),
        progress: Math.min(1, (m.position - 1) / content.total),
        question: entry?.question ?? null,
        done: false,
      }
    })
    .filter(Boolean)

  const groupItems = visibleGroups.map((r) => ({
    type: 'group',
    key: `group-${r.groupId}`,
    item: r,
    pending: !r.read,
    // Mismo plan que el tuyo con otra fecha de inicio: marcar el día del grupo
    // marca también el tuyo (misma clave en reading_progress).
    samePlan: r.planId === profile?.active_plan_id,
  }))
  const materialItems = materialRows.map((m) => ({
    type: 'material',
    key: `material-${m.slug}`,
    item: m,
    pending: !m.done,
  }))

  // Pendientes primero; dentro de cada bloque, grupos antes que materiales
  // (el sort es estable, así que se conserva el orden de llegada).
  const all = [...groupItems, ...materialItems]
  return [...all.filter((r) => r.pending), ...all.filter((r) => !r.pending)]
}
