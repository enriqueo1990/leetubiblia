// Texto y datos de /biblioteca que se comparten entre la página (Biblioteca.jsx) y
// el build (vite.config.js › LANDING_PAGES): una sola fuente para el título, la
// descripción y el FAQ. JS plano, sin JSX ni imports del navegador, porque lo
// carga Node al construir.
//
// El FAQ se publica dos veces con el MISMO texto: visible en la página y como
// FAQPage (JSON-LD) en el <head>. Si se edita una respuesta, cambia en los dos a
// la vez (ver infoCopy.js: mismo formato y mismo faqAnswerText).
//
// Los números (preguntas, artículos, lecturas) y los años salen de los JSON de
// src/data/materials/ y de src/lib/materialTheme.js; tests/biblioteca-copy.test.mjs
// los compara contra esos archivos para que no se desfasen.
import { faqAnswerText } from './infoCopy.js'

export const BIBLIOTECA_URL = 'https://leetubiblia.com/biblioteca'

export const BIBLIOTECA_META = {
  title: 'Lee Tu Biblia · Biblioteca: catecismos, credos y devocional',
  description:
    'Diez lecturas para sumar a tu día, además de tu Biblia: credos, catecismos, confesiones y las matutinas de Spurgeon. Gratis, a tu ritmo y sin atraso.',
}

// Qué hay en cada libro, tal como lo dicen los JSON (`entries`) y el catálogo
// (src/lib/materials.js). `count` es lo que se muestra en la tapa grande;
// `total` el número de entradas navegables del lector (lo que verifica el test).
export const BOOKS = {
  credos: {
    count: '5 lecturas',
    total: 5,
    year: 'Primeros siglos',
    blurb: 'El Apostólico, el Niceno, Calcedonia y el Atanasiano: la fe común de la iglesia, en cinco lecturas.',
  },
  belga: {
    count: '37 artículos',
    total: 37,
    year: '1561',
    blurb: 'De Dios y las Escrituras al juicio final, escrita por Guido de Brès, pastor de los Países Bajos.',
  },
  heidelberg: {
    count: '129 preguntas',
    total: 129,
    year: '1563',
    blurb: 'Cálido y pastoral: del consuelo a la gratitud, repartido en 52 Días del Señor, uno por domingo.',
  },
  dort: {
    count: '59 artículos',
    total: 59,
    year: '1619',
    blurb: 'Sobre la gracia soberana de Dios en la salvación. Incluye solo los artículos positivos de cada cabeza.',
  },
  'westminster-menor': {
    count: '107 preguntas',
    total: 107,
    year: '1647',
    blurb: 'Preguntas y respuestas breves para memorizar: Dios, la obra de Cristo, los mandamientos y el Padrenuestro.',
  },
  'bautista-1689': {
    count: '35 lecturas',
    total: 35,
    year: '1689',
    blurb: '32 capítulos, algunos en partes, de las Escrituras al juicio final, con las pruebas bíblicas de cada párrafo.',
  },
  keach: {
    count: '114 preguntas',
    total: 114,
    year: '1693',
    blurb: 'Sigue de cerca al Catecismo Menor de Westminster, con el bautismo del creyente.',
  },
  spurgeon: {
    count: '82 preguntas',
    total: 82,
    year: '1855',
    blurb: 'Claro y conciso, adaptado por Spurgeon de Westminster y Keach para que las familias lo memoricen.',
  },
  'spurgeon-ninos': {
    count: '48 preguntas',
    total: 48,
    year: '',
    blurb: 'Preguntas de una o dos líneas, en la tradición de Spurgeon, para los más chicos.',
  },
  'spurgeon-matutinas': {
    count: '366 lecturas',
    total: 366,
    year: '1865',
    blurb: 'Una meditación breve para cada mañana del año, con el versículo del día para buscar en tu Biblia.',
  },
}

// Los estantes: agrupados por época y tradición, sin ranking ni etiquetas de
// "mejor". Los nombres de las tradiciones son los que usan las introducciones de
// los propios materiales.
export const SHELVES = [
  {
    id: 'antigua',
    title: 'De la iglesia antigua',
    note: 'Lo que la iglesia confiesa desde sus primeros siglos.',
    slugs: ['credos'],
  },
  {
    id: 'continental',
    title: 'Reforma en el continente',
    note: 'Los Países Bajos y Alemania, siglos XVI y XVII: las llamadas Tres Formas de Unidad.',
    slugs: ['belga', 'heidelberg', 'dort'],
  },
  {
    id: 'westminster',
    title: 'Westminster',
    note: 'Pastores y teólogos de Inglaterra y Escocia, en plena guerra civil.',
    slugs: ['westminster-menor'],
  },
  {
    id: 'bautista',
    title: 'Bautistas particulares',
    note: 'La tradición de Londres, de 1689 a Spurgeon.',
    slugs: ['bautista-1689', 'keach', 'spurgeon', 'spurgeon-ninos'],
  },
  {
    id: 'devocional',
    title: 'Para cada mañana',
    note: 'Un devocional, no un catecismo: se abre solo, por fecha.',
    slugs: ['spurgeon-matutinas'],
  },
]

// Etiquetas de la tapa (library.kind.* de es.json).
export const KIND_LABEL = {
  creeds: 'Credos',
  confession: 'Confesión',
  catechism: 'Catecismo',
  canons: 'Cánones',
  devotional: 'Devocional',
  children: 'Para niños',
}

// Una respuesta es un arreglo de trozos: string o { to, text } (enlace interno).
export const BIBLIOTECA_FAQ = [
  {
    q: '¿Cuesta algo la Biblioteca?',
    a: ['No. Es parte de la app, que es gratis y no tiene anuncios.'],
  },
  {
    q: '¿Reemplaza a mi Biblia?',
    open: true,
    a: [
      'No. Son lecturas adicionales: primero va tu lectura bíblica del día, y la Biblioteca se suma debajo, en «También hoy». Los pasajes de apoyo aparecen como referencias: los buscás en tu Biblia o los abrís en tu app de Biblia.',
    ],
  },
  {
    q: '¿Y si me atraso?',
    a: [
      'No hay atraso: no hay calendario. El marcador espera donde lo dejaste, y avanzás una lectura por día, varias de una vez o con una pausa. Las Lecturas matutinas son la excepción: van por fecha, así que cada mañana se abre la de ese día, y las demás las encontrás en el índice.',
    ],
  },
  {
    q: '¿Todos los materiales enseñan lo mismo?',
    a: [
      'No. Vienen de tradiciones distintas y no coinciden en todo. Por ejemplo, Heidelberg y Westminster enseñan que se bautiza también a los hijos de los creyentes; Keach, Spurgeon y la Confesión de 1689, que el bautismo es de quien profesa su fe. Cada material abre con una introducción histórica, y vos elegís cuáles sumar: ninguno viene activado.',
    ],
  },
  {
    q: '¿Puedo leerlos con mi grupo?',
    a: [
      'Sí. Si guiás un grupo, proponé un material y que cada uno lo agregue a su estante; cada quien avanza a su ritmo. El plan de lectura del grupo es aparte, y el avance de tus materiales lo ves solo vos. Hay más en la ',
      { to: '/lideres', text: 'guía para líderes' },
      '.',
    ],
  },
  {
    q: '¿De dónde salen los textos?',
    a: [
      'Son textos históricos de dominio público, traducidos al español para esta edición, y los materiales están en español aunque uses la app en inglés o en portugués. Los pasajes de apoyo son los del propio catecismo o confesión; en los Credos, la Confesión Belga, los Cánones de Dort y el Catecismo para Niños de Spurgeon se seleccionaron para esta edición.',
    ],
  },
  {
    q: '¿Se pueden leer sin conexión?',
    a: [
      'Sí, con la app instalada: un material que ya abriste una vez queda disponible aun sin conexión. Uno nuevo necesita conexión la primera vez.',
    ],
  },
]

// FAQPage para el <head> de /biblioteca (lo inserta vite.config.js). Mismas
// preguntas y respuestas que el FAQ visible.
export function bibliotecaFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${BIBLIOTECA_URL}#faq`,
    mainEntity: BIBLIOTECA_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: faqAnswerText(item) },
    })),
  }
}

// Pregunta 4 del Catecismo Menor de Westminster (1647, dominio público; traducción
// de esta edición, ver src/data/materials/westminster-menor.json), tal como la
// muestra el lector. Es texto del catecismo, no de la Escritura: los pasajes de
// apoyo van solo como referencias, igual que en la app.
export const LECTOR_DEMO = {
  position: 'Pregunta 4 de 107',
  block: 'Dios, sus decretos y la creación',
  question: '¿Qué es Dios?',
  answer:
    'Dios es Espíritu, y es infinito, eterno e inmutable en su ser, en sabiduría y en poder, en santidad, en justicia, en bondad y en verdad.',
  refs: ['Juan 4:24', 'Job 11:7-9', 'Salmo 90:2', 'Santiago 1:17', 'Éxodo 3:14', 'Salmo 147:5', 'Apocalipsis 4:8', 'Éxodo 34:6-7'],
}

