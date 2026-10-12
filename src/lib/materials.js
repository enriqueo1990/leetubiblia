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
// `unit` nombra cada entrada en la UI ("Pregunta 3 de 107", "Artículo 3 de 37"):
//   'question' (default) · 'article' · 'item' (solo el número: para materiales
//   cuya numeración propia no coincide con la corrida 1..N, como Dort, que
//   reinicia los artículos en cada cabeza de doctrina).
// Ordenado cronológicamente por fecha de origen del material.
export const MATERIALS = [
  {
    slug: 'belga',
    name: 'Confesión Belga',
    shortName: 'Confesión Belga',
    unit: 'article',
    description: '37 artículos de la fe reformada (1561), de Dios y las Escrituras al juicio final, con pasajes para tu Biblia.',
    load: () => import('../data/materials/belga.json'),
  },
  {
    slug: 'heidelberg',
    name: 'Catecismo de Heidelberg',
    shortName: 'Heidelberg',
    description: '129 preguntas cálidas y pastorales (1563), del consuelo a la gratitud, con pasajes para tu Biblia.',
    load: () => import('../data/materials/heidelberg.json'),
  },
  {
    slug: 'dort',
    name: 'Cánones de Dort',
    shortName: 'Dort',
    unit: 'item',
    description: '59 artículos del Sínodo de Dort (1618-1619) sobre la gracia soberana de Dios, con pasajes para tu Biblia.',
    load: () => import('../data/materials/dort.json'),
  },
  {
    slug: 'westminster-menor',
    name: 'Catecismo Menor de Westminster',
    shortName: 'Catecismo Menor',
    description: '107 preguntas y respuestas sobre la fe (1647), con pasajes para buscar en tu Biblia.',
    load: () => import('../data/materials/westminster-menor.json'),
  },
  {
    slug: 'bautista-1689',
    name: 'Confesión Bautista de 1689',
    shortName: 'Confesión de 1689',
    // Cada entrada es un párrafo, numerado dentro de su capítulo ("Párrafo 2"):
    // la corrida 1..160 no coincide con esa numeración.
    unit: 'item',
    description: 'La confesión de los bautistas particulares (1677/1689) en 32 capítulos, párrafo por párrafo, con pasajes para tu Biblia.',
    load: () => import('../data/materials/bautista-1689.json'),
  },
  {
    slug: 'keach',
    name: 'Catecismo de Keach',
    shortName: 'Keach',
    description: '114 preguntas de la tradición bautista particular (1693), con pasajes para tu Biblia.',
    load: () => import('../data/materials/keach.json'),
  },
  {
    slug: 'spurgeon',
    name: 'Catecismo de Spurgeon',
    shortName: 'Spurgeon',
    description: '82 preguntas de la tradición reformada bautista (1855), claras y concisas, con pasajes para tu Biblia.',
    load: () => import('../data/materials/spurgeon.json'),
  },
  {
    slug: 'spurgeon-ninos',
    name: 'Catecismo para Niños de Spurgeon',
    shortName: 'Spurgeon para Niños',
    description: '48 preguntas sencillas para los más chicos, en la tradición de Spurgeon, con pasajes para tu Biblia.',
    load: () => import('../data/materials/spurgeon-ninos.json'),
  },
]

export function getMaterial(slug) {
  return MATERIALS.find((m) => m.slug === slug) ?? null
}

const UNIT_KEYS = {
  question: { of: 'materialsToday.questionOf', on: 'materiales.onQuestion' },
  article: { of: 'materialsToday.articleOf', on: 'materiales.onArticle' },
  item: { of: 'materialsToday.itemOf', on: 'materiales.onItem' },
}

function unitKeys(slug) {
  return UNIT_KEYS[getMaterial(slug)?.unit] ?? UNIT_KEYS.question
}

// "Pregunta 3 de 107" / "Artículo 3 de 37" / "3 de 59", según el material.
export function entryOfLabel(t, slug, n, total) {
  return t(unitKeys(slug).of, { n, total })
}

// "Vas en la pregunta 3" / "Vas en el artículo 3" / "Vas en la lectura 3".
export function currentEntryLabel(t, slug, n) {
  return t(unitKeys(slug).on, { n })
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
