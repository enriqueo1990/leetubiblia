// Materiales de lectura opcionales — catálogo + lógica.
//
// El contenido de cada material es un JSON estático en src/data/materials/. Se carga
// con import() dinámico para que Hoy solo descargue lo que el usuario tiene activo
// (Vite hace code-splitting; el Service Worker precachea igual para offline).
//
// La preferencia del usuario vive en profiles.active_materials (jsonb):
//   [{ slug: 'westminster-menor', position: 12 }]
// donde position es el índice 1-based de la entrada actual. El avance es a ritmo del
// usuario (uno por día, varios de una, o pausar): no hay calendario ni atraso.

// Catálogo curado. Para sumar un material: agregá el JSON en src/data/materials/ y
// una entrada acá. `load` difiere la descarga del contenido hasta que se necesita.
export const MATERIALS = [
  {
    slug: 'westminster-menor',
    name: 'Catecismo Menor de Westminster',
    shortName: 'Catecismo Menor',
    description: '107 preguntas y respuestas sobre la fe, con pasajes para buscar en tu Biblia.',
    load: () => import('../data/materials/westminster-menor.json'),
  },
  {
    slug: 'heidelberg',
    name: 'Catecismo de Heidelberg',
    shortName: 'Heidelberg',
    description: '129 preguntas cálidas y pastorales (1563), del consuelo a la gratitud, con pasajes para tu Biblia.',
    load: () => import('../data/materials/heidelberg.json'),
  },
  {
    slug: 'spurgeon',
    name: 'Catecismo de Spurgeon',
    shortName: 'Spurgeon',
    description: '84 preguntas de la tradición reformada bautista (1855), claras y concisas, con pasajes para tu Biblia.',
    load: () => import('../data/materials/spurgeon.json'),
  },
]

export function getMaterial(slug) {
  return MATERIALS.find((m) => m.slug === slug) ?? null
}

// Cache en memoria del contenido ya cargado (evita re-importar en cada render).
const contentCache = new Map()

// Carga el JSON del material y lo normaliza a una lista plana de entradas, cada una
// con su título de bloque para mostrarlo como subtítulo. Devuelve null si el slug no
// existe en el catálogo. La lista plana es lo que indexa `position`.
export async function loadMaterialContent(slug) {
  if (contentCache.has(slug)) return contentCache.get(slug)
  const material = getMaterial(slug)
  if (!material) return null
  const mod = await material.load()
  const data = mod.default ?? mod
  const entries = []
  for (const block of data.entries ?? []) {
    for (const q of block.questions ?? []) {
      entries.push({
        number: q.number,
        question: q.question,
        answer: q.answer,
        refs: q.refs ?? [],
        blockTitle: block.title ?? null,
      })
    }
  }
  const content = {
    slug: data.slug,
    name: data.name,
    description: data.description,
    // Párrafos de introducción (contexto histórico). Se muestran como "ficha 0"
    // del lector: portada al abrir por primera vez, accesible desde el índice.
    intro: Array.isArray(data.intro) && data.intro.length > 0 ? data.intro : null,
    source: data.source ?? null,
    entries,
    total: entries.length,
  }
  contentCache.set(slug, content)
  return content
}

// --- Helpers sobre profiles.active_materials (array de { slug, position }) ---

export function activeMaterials(profile) {
  const list = profile?.active_materials
  return Array.isArray(list) ? list : []
}

export function isMaterialActive(profile, slug) {
  return activeMaterials(profile).some((m) => m.slug === slug)
}

export function positionOf(profile, slug) {
  const found = activeMaterials(profile).find((m) => m.slug === slug)
  return found ? found.position : null
}

// Activa un material (arranca en la entrada 1) sin duplicar si ya estaba.
export function withMaterialActivated(profile, slug) {
  const list = activeMaterials(profile)
  if (list.some((m) => m.slug === slug)) return list
  return [...list, { slug, position: 1 }]
}

// Desactiva un material. Al reactivarlo vuelve a empezar en 1 (no guardamos la
// posición de materiales apagados: es una feature liviana, sin historial oculto).
export function withMaterialDeactivated(profile, slug) {
  return activeMaterials(profile).filter((m) => m.slug !== slug)
}

// Fija la posición de un material activo (avanzar, o reiniciar en 1).
export function withMaterialPosition(profile, slug, position) {
  return activeMaterials(profile).map((m) =>
    m.slug === slug ? { ...m, position } : m
  )
}
