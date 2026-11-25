// Materiales de lectura opcionales — catálogo + lógica.
//
// El contenido de cada material es un JSON estático en src/data/materials/. Se carga
// con import() dinámico para que Hoy solo descargue lo que el usuario tiene activo
// (Vite hace code-splitting). Estos chunks NO están en el precache del Service
// Worker: se guardan en la caché de runtime la primera vez que se usan, así que
// abrir un material nuevo sin conexión falla y las vistas deben avisar.
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
// `total`: cantidad de entradas, para mostrarla sin descargar el JSON (el test de
// la landing la compara con el archivo).
// `cadence: 'calendar'` (con unit 'day'): devocional de 366 entradas, una por
// fecha; la lectura del día la da el calendario, no el marcador (ver abajo).
// Ordenado cronológicamente por fecha de origen del material.
export const MATERIALS = [
  {
    slug: 'credos',
    total: 5,
    name: 'Credos de la iglesia antigua',
    shortName: 'Credos antiguos',
    unit: 'item',
    description: 'El Apostólico, el Niceno, Calcedonia y el Atanasiano: la fe común de la iglesia desde sus primeros siglos, en cinco lecturas.',
    load: () => import('../data/materials/credos.json'),
  },
  {
    slug: 'didaje',
    total: 8,
    name: 'La Didajé',
    shortName: 'Didajé',
    // Como Agustín: cada entrada es una lectura de uno a tres capítulos.
    unit: 'item',
    description: 'Uno de los manuales cristianos más antiguos (probablemente de fines del siglo I): los dos caminos, el bautismo, la oración y la Cena, en ocho lecturas.',
    load: () => import('../data/materials/didaje.json'),
  },
  {
    slug: 'agustin-confesiones',
    total: 144,
    name: 'Confesiones de San Agustín',
    shortName: 'Confesiones',
    // Prosa a ritmo propio: cada entrada es una lectura de varios capítulos.
    unit: 'item',
    description: 'Las Confesiones completas (397-400): la vida de Agustín contada como una oración, en lecturas de cinco a diez minutos.',
    load: () => import('../data/materials/agustin-confesiones.json'),
  },
  {
    slug: 'belga',
    total: 37,
    name: 'Confesión Belga',
    shortName: 'Confesión Belga',
    unit: 'article',
    description: '37 artículos de la fe reformada (1561), de Dios y las Escrituras al juicio final, con pasajes para tu Biblia.',
    load: () => import('../data/materials/belga.json'),
  },
  {
    slug: 'lutero-catecismo-menor',
    total: 36,
    name: 'Catecismo Menor de Lutero',
    shortName: 'Catecismo de Lutero',
    // Cada entrada es un mandamiento, artículo, petición o parte de un sacramento.
    unit: 'item',
    description: 'El catecismo de Lutero para enseñar la fe en casa (1529): mandamientos, Credo, Padrenuestro, sacramentos y oraciones diarias, con su «¿Qué significa esto?».',
    load: () => import('../data/materials/lutero-catecismo-menor.json'),
  },
  {
    slug: 'heidelberg',
    total: 129,
    name: 'Catecismo de Heidelberg',
    shortName: 'Heidelberg',
    description: '129 preguntas cálidas y pastorales (1563), del consuelo a la gratitud, con pasajes para tu Biblia.',
    load: () => import('../data/materials/heidelberg.json'),
  },
  {
    slug: 'calvino-vida-cristiana',
    total: 20,
    name: 'La vida cristiana, de Juan Calvino',
    shortName: 'La vida cristiana',
    // Como Agustín: cada entrada es una lectura de una a dos secciones.
    unit: 'item',
    description: 'Los capítulos más devocionales de la Institución (1559): no somos nuestros, la cruz, la vida futura y el uso de esta vida, en veinte lecturas.',
    load: () => import('../data/materials/calvino-vida-cristiana.json'),
  },
  {
    slug: 'dort',
    total: 59,
    name: 'Cánones de Dort',
    shortName: 'Dort',
    unit: 'item',
    description: '59 artículos del Sínodo de Dort (1618-1619) sobre la gracia soberana de Dios, con pasajes para tu Biblia.',
    load: () => import('../data/materials/dort.json'),
  },
  {
    slug: 'westminster-confesion',
    total: 36,
    name: 'Confesión de Fe de Westminster',
    shortName: 'Confesión de Westminster',
    // Como la 1689: cada entrada es un capítulo (los largos, en partes).
    unit: 'item',
    description: 'La confesión de las iglesias presbiterianas (1646), capítulo por capítulo, con las pruebas bíblicas de cada párrafo.',
    load: () => import('../data/materials/westminster-confesion.json'),
  },
  {
    slug: 'westminster-menor',
    total: 107,
    name: 'Catecismo Menor de Westminster',
    shortName: 'Catecismo Menor',
    description: '107 preguntas y respuestas sobre la fe (1647), con pasajes para buscar en tu Biblia.',
    load: () => import('../data/materials/westminster-menor.json'),
  },
  {
    slug: 'westminster-mayor',
    total: 196,
    name: 'Catecismo Mayor de Westminster',
    shortName: 'Catecismo Mayor',
    description: '196 preguntas que amplían el Menor (1648): la fe, cada mandamiento, los sacramentos y la oración, con pasajes para tu Biblia.',
    load: () => import('../data/materials/westminster-mayor.json'),
  },
  {
    slug: 'catecismo-ninos-pequenos',
    total: 145,
    name: 'Catecismo para Niños Pequeños',
    shortName: 'Niños Pequeños',
    description: '145 preguntas muy breves (1840) para enseñar la fe en familia a los más chicos, como puerta al Catecismo Menor.',
    load: () => import('../data/materials/catecismo-ninos-pequenos.json'),
  },
  {
    slug: 'bunyan-peregrino',
    total: 72,
    name: 'El progreso del peregrino',
    shortName: 'El peregrino',
    // Prosa a ritmo propio, como Agustín: cada entrada es una lectura del viaje.
    unit: 'item',
    description: 'La alegoría de Bunyan (1678), completa en su primera parte: el viaje de Cristiano hasta la Ciudad Celestial, en lecturas breves.',
    load: () => import('../data/materials/bunyan-peregrino.json'),
  },
  {
    slug: 'bautista-1689',
    total: 35,
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
    total: 114,
    name: 'Catecismo de Keach',
    shortName: 'Keach',
    description: '114 preguntas de la tradición bautista particular (1693), con pasajes para tu Biblia.',
    load: () => import('../data/materials/keach.json'),
  },
  {
    slug: 'bautista-new-hampshire',
    total: 18,
    name: 'Confesión Bautista de New Hampshire',
    shortName: 'New Hampshire',
    unit: 'article',
    description: '18 artículos breves de la fe bautista (1833/1853), los que usan muchas iglesias bautistas de América Latina, con pasajes para tu Biblia.',
    load: () => import('../data/materials/bautista-new-hampshire.json'),
  },
  {
    slug: 'spurgeon',
    total: 82,
    name: 'Catecismo de Spurgeon',
    shortName: 'Spurgeon',
    description: '82 preguntas de la tradición reformada bautista (1855), claras y concisas, con pasajes para tu Biblia.',
    load: () => import('../data/materials/spurgeon.json'),
  },
  {
    slug: 'spurgeon-matutinas',
    total: 366,
    name: 'Lecturas matutinas de Spurgeon',
    shortName: 'Lecturas matutinas',
    unit: 'day',
    cadence: 'calendar',
    description: 'Una lectura devocional para cada mañana del año (1865), con el versículo del día para tu Biblia.',
    load: () => import('../data/materials/spurgeon-matutinas.json'),
  },
  {
    slug: 'spurgeon-vespertinas',
    total: 366,
    name: 'Lecturas vespertinas de Spurgeon',
    shortName: 'Lecturas vespertinas',
    unit: 'day',
    cadence: 'calendar',
    description: 'La otra mitad de las matutinas (1868): una meditación breve para cada noche del año, con el versículo para tu Biblia.',
    load: () => import('../data/materials/spurgeon-vespertinas.json'),
  },
  {
    slug: 'spurgeon-ninos',
    total: 48,
    name: 'Catecismo para Niños de Spurgeon',
    shortName: 'Spurgeon para Niños',
    description: '48 preguntas sencillas para los más chicos, en la tradición de Spurgeon, con pasajes para tu Biblia.',
    load: () => import('../data/materials/spurgeon-ninos.json'),
  },
]

// Estantes de la Biblioteca: agrupados por época y tradición, como en la landing
// (/biblioteca), para elegir por la propia tradición sin recorrer trece tapas
// sueltas. Títulos y notas en i18n (library.group.<id>.title / .note). El test
// de la landing verifica que cubren todo el catálogo, una sola vez.
export const LIBRARY_SHELVES = [
  { id: 'ancient', slugs: ['didaje', 'credos', 'agustin-confesiones'] },
  { id: 'continental', slugs: ['lutero-catecismo-menor', 'belga', 'heidelberg', 'calvino-vida-cristiana', 'dort'] },
  { id: 'westminster', slugs: ['westminster-confesion', 'westminster-mayor', 'westminster-menor', 'catecismo-ninos-pequenos'] },
  { id: 'baptist', slugs: ['bunyan-peregrino', 'bautista-1689', 'keach', 'bautista-new-hampshire', 'spurgeon', 'spurgeon-ninos'] },
  { id: 'devotional', slugs: ['spurgeon-matutinas', 'spurgeon-vespertinas'] },
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
    // Devocionales: firma del autor al pie de cada entrada ("— Charles H.
    // Spurgeon") y la cita del encabezado junto al versículo, no al pie.
    author: data.author ?? null,
    headingRef: data.headingRef === true,
    // Muestra de la vista previa, cuando la primera entrada es un prólogo.
    sample: typeof data.sample === 'string' ? data.sample : null,
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
