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
    'Diecinueve lecturas para sumar a tu día, además de tu Biblia: credos, catecismos, confesiones y las matutinas de Spurgeon. Gratis, a tu ritmo y sin atraso.',
}

// Qué hay en cada libro, tal como lo dicen los JSON (`entries`) y el catálogo
// (src/lib/materials.js). `count` es lo que se muestra en la tapa grande;
// `total` el número de entradas navegables del lector (lo que verifica el test).
export const BOOKS = {
  didaje: {
    count: '8 lecturas',
    total: 8,
    year: 'Siglo I',
    blurb: 'Uno de los manuales cristianos más antiguos: los dos caminos, el bautismo, la oración y la Cena.',
  },
  credos: {
    count: '5 lecturas',
    total: 5,
    year: 'Primeros siglos',
    blurb: 'El Apostólico, el Niceno, Calcedonia y el Atanasiano: la fe común de la iglesia, en cinco lecturas.',
  },
  'agustin-confesiones': {
    count: '144 lecturas',
    total: 144,
    year: '397',
    blurb: 'La vida de Agustín contada como una oración a Dios, completa, de la infancia a la conversión y más allá.',
  },
  'lutero-catecismo-menor': {
    count: '36 lecturas',
    total: 36,
    year: '1529',
    blurb: 'El catecismo de Lutero para la casa: cada mandamiento, artículo y petición explicado con la misma pregunta sencilla.',
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
  'calvino-vida-cristiana': {
    count: '20 lecturas',
    total: 20,
    year: '1559',
    blurb: 'Lo más devocional de la Institución de Calvino: no somos nuestros, la cruz, la vida futura y el uso de esta vida.',
  },
  dort: {
    count: '59 artículos',
    total: 59,
    year: '1619',
    blurb: 'Sobre la gracia soberana de Dios en la salvación. Incluye solo los artículos positivos de cada cabeza.',
  },
  'westminster-confesion': {
    count: '36 lecturas',
    total: 36,
    year: '1646',
    blurb: 'La confesión de las iglesias presbiterianas: 33 capítulos, algunos en partes, con las pruebas bíblicas de cada párrafo.',
  },
  'westminster-menor': {
    count: '107 preguntas',
    total: 107,
    year: '1647',
    blurb: 'Preguntas y respuestas breves para memorizar: Dios, la obra de Cristo, los mandamientos y el Padrenuestro.',
  },
  'westminster-mayor': {
    count: '196 preguntas',
    total: 196,
    year: '1648',
    blurb: 'Amplía el Menor para ir más hondo: la fe, cada mandamiento en detalle, los sacramentos y el Padrenuestro.',
  },
  'catecismo-ninos-pequenos': {
    count: '145 preguntas',
    total: 145,
    year: '1840',
    blurb: 'Preguntas de una línea para los más chicos, en familia: la puerta presbiteriana al Catecismo Menor.',
  },
  'bautista-1689': {
    count: '35 lecturas',
    total: 35,
    year: '1689',
    blurb: '32 capítulos, algunos en partes, de las Escrituras al juicio final, con las pruebas bíblicas de cada párrafo.',
  },
  'bautista-new-hampshire': {
    count: '18 artículos',
    total: 18,
    year: '1833',
    blurb: 'Breve y clara, la confesión que muchas iglesias bautistas de América Latina usan como su declaración de fe.',
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
    blurb: 'Preguntas de una o dos líneas para los más chicos, de tradición spurgeoniana. No consta que lo escribiera él.',
  },
  'spurgeon-vespertinas': {
    count: '366 lecturas',
    total: 366,
    year: '1868',
    blurb: 'Una meditación breve para cada noche del año, la otra mitad de las matutinas, con el versículo para tu Biblia.',
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
    note: 'La fe de la iglesia en sus primeros siglos: cómo vivía, qué confesaba y cómo oraba.',
    slugs: ['didaje', 'credos', 'agustin-confesiones'],
  },
  {
    id: 'continental',
    title: 'Reforma en el continente',
    note: 'Wittenberg, Ginebra, los Países Bajos y Alemania, siglos XVI y XVII: Lutero, Calvino y las Tres Formas de Unidad.',
    slugs: ['lutero-catecismo-menor', 'belga', 'heidelberg', 'calvino-vida-cristiana', 'dort'],
  },
  {
    id: 'westminster',
    title: 'Westminster',
    note: 'Pastores y teólogos de Inglaterra y Escocia, en plena guerra civil.',
    slugs: ['westminster-confesion', 'westminster-mayor', 'westminster-menor', 'catecismo-ninos-pequenos'],
  },
  {
    id: 'bautista',
    title: 'Bautistas particulares',
    note: 'De la Confesión de Londres de 1689 a New Hampshire y Spurgeon.',
    slugs: ['bautista-1689', 'keach', 'bautista-new-hampshire', 'spurgeon', 'spurgeon-ninos'],
  },
  {
    id: 'devocional',
    title: 'Para cada día',
    note: 'Devocionales, no catecismos: se abren solos, por fecha, uno a la mañana y otro a la noche.',
    slugs: ['spurgeon-matutinas', 'spurgeon-vespertinas'],
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
  classic: 'Clásico',
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
      'Son textos históricos de dominio público, y los materiales están en español aunque uses la app en inglés o en portugués. Los pasajes de apoyo son los del propio catecismo o confesión; en los Credos, la Confesión Belga, los Cánones de Dort y el Catecismo para Niños de Spurgeon se seleccionaron para esta edición.',
    ],
  },
  {
    q: '¿Quién los tradujo? ¿Están revisados?',
    a: [
      'Las traducciones son propias de esta edición: se hicieron al español a partir de los textos de dominio público en inglés (o en griego y latín, según el material). Todavía no las revisó un teólogo ni un traductor profesional, así que pueden tener errores. Si encontrás alguno, escribinos a hola@leetubiblia.com y lo corregimos. Si un texto es importante para tu iglesia, contrastalo con la edición que ustedes usan.',
    ],
  },
  {
    q: '¿Lo escribió Spurgeon?',
    a: [
      'El Catecismo de Spurgeon (82 preguntas, 1855) sí es suyo. El Catecismo para Niños (48 preguntas) no sabemos con certeza que lo haya escrito él: la edición de la que sale lo presenta como un catecismo infantil «de tradición spurgeoniana». Por eso lo ofrecemos con ese nombre, pero sin atribuirle la autoría.',
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

// Lo que muestra el lector en la captura real de /biblioteca (src/assets/shots/lector-*):
// la pregunta 44 del Catecismo de Heidelberg (1563, dominio público; traducción de esta
// edición). Acá van solo la posición, el bloque y los pasajes de apoyo, que la página
// repite en su leyenda como referencias: nunca el texto de la respuesta.
export const LECTOR_DEMO = {
  position: 'Pregunta 44 de 129',
  block: 'Día del Señor 17: El descenso a los infiernos',
  refs: ['Salmo 18:5', 'Salmo 116:3', 'Mateo 26:38', 'Hebreos 5:7', 'Isaías 53:10', 'Mateo 27:46'],
}
