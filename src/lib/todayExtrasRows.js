// Armado puro de las filas de "También hoy" (sin React ni JSX, para poder
// probarlo con node:test). Recibe lo ya cargado y devuelve la lista final.
import { getMaterial } from './materials.js'

export function buildExtraRows({ groupReadings, materials, contents, profile, t }) {
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
      // Un material terminado no es "una lectura para hoy": sigue en Ajustes ›
      // Materiales como "Completado · repasar", pero deja de ocupar el día.
      if (m.position > content.total) return null
      const entry = content.entries[m.position - 1]
      return {
        slug: m.slug,
        label: getMaterial(m.slug)?.shortName ?? content.name,
        meta: t('materialsToday.questionOf', { n: entry?.number ?? m.position, total: content.total }),
        question: entry?.question ?? null,
      }
    })
    .filter(Boolean)

  const groupItems = visibleGroups.map((r) => ({
    type: 'group',
    key: `group-${r.groupId}`,
    item: r,
    pending: !r.read,
  }))
  const materialItems = materialRows.map((m) => ({
    type: 'material',
    key: `material-${m.slug}`,
    item: m,
    pending: true,
  }))

  // Pendientes primero; dentro de cada bloque, grupos antes que materiales
  // (el sort es estable, así que se conserva el orden de llegada).
  const all = [...groupItems, ...materialItems]
  return [...all.filter((r) => r.pending), ...all.filter((r) => !r.pending)]
}
