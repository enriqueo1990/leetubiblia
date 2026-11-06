// Newsreader: la serif editorial de la marca, la «voz del libro». Se usa solo en
// momentos de lectura: la referencia del día, los títulos de momentos (Mi tiempo,
// gracias, Novedades), las portadas de la Biblioteca y lo que se comparte como
// imagen. Todo lo funcional (listas, botones, formularios, Ajustes) sigue en la
// sans del sistema. Se registra con FontFace (no con CSS global) para
// que solo se descargue cuando hace falta; los .woff2 quedan en el precache del
// service worker, así funciona sin red. Solo latín y latín extendido: alcanza
// para es/en/pt.
import latinNormal from '@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?url'
import latinItalic from '@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2?url'
import extNormal from '@fontsource-variable/newsreader/files/newsreader-latin-ext-opsz-normal.woff2?url'
import extItalic from '@fontsource-variable/newsreader/files/newsreader-latin-ext-opsz-italic.woff2?url'

export const BRAND_SERIF = '"Newsreader", Georgia, "Times New Roman", serif'

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'

let ready = null

// Registra la fuente (una sola vez) y espera a que esté lista para dibujar.
// Si no carga (sin red y sin caché), resuelve igual: el canvas cae en Georgia.
export function ensureBrandFont() {
  if (ready) return ready
  if (typeof FontFace === 'undefined' || !document.fonts) return (ready = Promise.resolve(false))
  const faces = [
    [latinNormal, 'normal', LATIN],
    [latinItalic, 'italic', LATIN],
    [extNormal, 'normal', LATIN_EXT],
    [extItalic, 'italic', LATIN_EXT],
  ].map(([url, style, unicodeRange]) => {
    const face = new FontFace('Newsreader', `url(${url}) format("woff2")`, {
      style,
      weight: '200 800',
      unicodeRange,
      display: 'swap',
    })
    document.fonts.add(face)
    return face
  })
  ready = Promise.all([faces[0].load(), faces[1].load()])
    .then(() => true)
    .catch(() => false)
  return ready
}
