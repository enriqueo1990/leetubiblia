// Texto de /info que se comparte entre la página (Info.jsx) y el build
// (vite.config.js › LANDING_PAGES): una sola fuente para el título, la
// descripción y el FAQ. JS plano, sin JSX ni imports del navegador, porque lo
// carga Node al construir.
//
// El FAQ se publica dos veces con el MISMO texto: visible en la página y como
// FAQPage (JSON-LD) en el <head> de /info. Si se edita una respuesta, cambia en
// los dos a la vez. Una respuesta es un arreglo de trozos: string o
// { to, text } (enlace interno); el texto plano es la unión de los trozos.

export const INFO_URL = 'https://leetubiblia.com/info'

export const INFO_META = {
  title: 'Lee Tu Biblia · Plan de lectura bíblica diaria para tu Biblia de papel',
  description:
    'App gratis para leer la Biblia cada día: 13 planes de lectura, racha sin culpa, diario y oración, solo o con tu grupo. Acompaña tu Biblia de papel.',
}

export const INFO_FAQ = [
  {
    q: '¿Es gratis de verdad?',
    a: [
      'Sí. Sin anuncios, sin pruebas y sin suscripción. Si querés ayudar a que el proyecto siga, hay una donación discreta; nunca hace falta.',
    ],
  },
  {
    q: '¿La app muestra el texto de la Biblia?',
    open: true,
    a: [
      'No es un lector de la Biblia: la lectura es en tu Biblia de papel. La app te muestra las referencias del día y, si preferís el teléfono, tocás la referencia y se abre en YouVersion o BibleGateway. Los materiales de la Biblioteca (catecismos y confesiones) traen sus propios textos y citas de apoyo.',
    ],
  },
  {
    q: '¿Sirve para mi iglesia?',
    a: [
      'Los planes recorren la Biblia y los puede usar cualquier iglesia cristiana. Algunos materiales opcionales (catecismos y confesiones) son de tradición reformada: si no son lo tuyo, los ignorás. Los ves en la ',
      { to: '/biblioteca', text: 'Biblioteca' },
      '.',
    ],
  },
  {
    q: '¿Qué pasa con mi diario y mis oraciones?',
    a: [
      'Son tuyos. El diario es solo tuyo y tus oraciones son privadas hasta que elegís compartirlas con un grupo. Podés borrar todo desde la app. Los detalles están en la ',
      { to: '/privacidad', text: 'política de privacidad' },
      '.',
    ],
  },
  {
    q: '¿Funciona sin internet?',
    a: [
      'Instalada, te muestra la lectura de hoy aun sin conexión, y lo que marques se guarda cuando vuelva la red. Los grupos y las oraciones compartidas sí necesitan conexión.',
    ],
  },
  {
    q: '¿Y si me atraso unos días?',
    a: [
      'No pasa nada. La app te ofrece «Seguir desde donde quedé» y listo: sin culpa y sin avisos rojos.',
    ],
  },
]

export function faqAnswerText(item) {
  return item.a.map((part) => (typeof part === 'string' ? part : part.text)).join('')
}

// FAQPage para el <head> de /info (lo inserta vite.config.js). Mismas preguntas y
// respuestas que el FAQ visible.
export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${INFO_URL}#faq`,
    mainEntity: INFO_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: faqAnswerText(item) },
    })),
  }
}
