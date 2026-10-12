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
//   reinicia los artículos en cada cabeza de doctrina) · 'day' (la fecha).
// `cadence: 'calendar'` (con unit 'day'): devocional de 366 entradas, una por
// fecha; la lectura del día la da el calendario, no el marcador (ver abajo).
// Ordenado cronológicamente por fecha de origen del material.
export const MATERIALS = [
  {
    slug: 'credos',
    name: 'Credos de la iglesia antigua',
    shortName: 'Credos antiguos',
    unit: 'item',
    description: 'El Apostólico, el Niceno, Calcedonia y el Atanasiano: la fe común de la iglesia desde sus primeros siglos, en cinco lecturas.',
    load: () => import('../data/materials/credos.json'),
  },
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
    // Cada entrada es un capítulo (los largos, en partes): la corrida 1..35 no
    // coincide con la numeración de capítulos.
    unit: 'item',
    description: 'La confesión de los bautistas particulares (1677/1689), capítulo por capítulo, con las pruebas bíblicas de cada párrafo.',
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
    slug: 'spurgeon-matutinas',
    name: 'Lecturas matutinas de Spurgeon',
    shortName: 'Lecturas matutinas',
    unit: 'day',
    cadence: 'calendar',
    description: 'Una lectura devocional para cada mañana del año (1865), con el versículo del día para tu Biblia.',
    load: () => import('../data/materials/spurgeon-matutinas.json'),
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

// "Pregunta 3 de 107" / "Artículo 3 de 37" / "3 de 59" / "12 de octubre", según
// el material.
export function entryOfLabel(t, slug, n, total, locale) {
  if (getMaterial(slug)?.unit === 'day') return calendarDateLabel(n, locale)
  return t(unitKeys(slug).of, { n, total })
}

// "Vas en la pregunta 3" / "Vas en el artículo 3" / "Vas en la lectura 3" /
// "Lectura del 12 de octubre" (la de hoy, en los materiales por fecha).
export function currentEntryLabel(t, slug, n, locale) {
  if (isCalendarMaterial(slug)) {
    return t('materiales.onDay', { date: calendarDateLabel(calendarEntryNumber(), locale) })
  }
  return t(unitKeys(slug).on, { n })
}

// --- Materiales por fecha (cadence 'calendar') ---
// Entrada N = día N de un año bisiesto (1 = 1 de enero, 60 = 29 de febrero,
// 366 = 31 de diciembre). En años no bisiestos el 29 de febrero no le toca a
// ninguna fecha, pero sigue en el índice. El perfil no guarda un marcador sino
// `readOn` ('YYYY-MM-DD', fecha local): el día en que se marcó leída la de hoy.

const DAYS_BEFORE_MONTH = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

export function isCalendarMaterial(slug) {
  return getMaterial(slug)?.cadence === 'calendar'
}

export function calendarEntryNumber(date = new Date()) {
  return DAYS_BEFORE_MONTH[date.getMonth()] + date.getDate()
}

function calendarMonthDay(n) {
  let month = 11
  while (month > 0 && DAYS_BEFORE_MONTH[month] >= n) month--
  return { month, day: n - DAYS_BEFORE_MONTH[month] }
}

// Día del mes de la entrada N (para el índice, agrupado por mes).
export function calendarDayOfMonth(n) {
  return calendarMonthDay(n).day
}

// "12 de octubre" / "October 12" / "12 de outubro".
export function calendarDateLabel(n, locale = 'es') {
  const { month, day } = calendarMonthDay(n)
  return new Date(2024, month, day).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
}

export function localDateKey(date = new Date()) {
  const pad = (x) => String(x).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function readOnOf(profile, slug) {
  return activeMaterials(profile).find((m) => m.slug === slug)?.readOn ?? null
}

export function isReadToday(profile, slug, date = new Date()) {
  return readOnOf(profile, slug) === localDateKey(date)
}

// Marca (o desmarca, con null) la lectura de hoy de un material por fecha.
export function withMaterialReadOn(profile, slug, dateKey) {
  return activeMaterials(profile).map((m) => {
    if (m.slug !== slug) return m
    const { readOn: _prev, ...rest } = m
    return dateKey ? { ...rest, readOn: dateKey } : rest
  })
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
        // Número propio dentro del bloque, si el material lo trae (p. ej. el
        // párrafo dentro del capítulo en la Confesión de 1689); para el índice.
        label: q.label ?? null,
        // Ubicación propia de la entrada para la línea de metadata (p. ej.
        // "Capítulo 1, párrafos 1–5"), cuando el bloque no la dice.
        section: q.section ?? null,
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
