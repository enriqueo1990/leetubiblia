// Identidad de cada material: su color de portada (como una colección de
// libros) y los datos que lleva la tapa (`title`: el nombre corto de la tapa,
// en español como el contenido; `kind`: el tipo, que se traduce; `year`).
// Es la excepción deliberada a "un solo acento": vive SOLO en las portadas
// (Biblioteca, Hoy) y en lo que se comparte.
//
// Cada tema trae dos paletas:
//  - color: la tapa en color pleno (c fondo, spine lomo, ink texto, soft texto
//    secundario, acc acento del número y el lomo).
//  - papel: la alternativa sobria, fondo hueso con el lomo del color del
//    material (así se reconoce igual) y un acento legible sobre claro.

const PAPEL = { c: '#F8F7F4', ink: '#1C1C1E', soft: 'rgba(28,28,30,.62)' }

const THEMES = {
  credos: { title: 'De la iglesia antigua', c: '#4A2E4F', spine: '#37213A', ink: '#F4ECF3', soft: 'rgba(244,236,243,.62)', acc: '#E9C5A2', papelAcc: '#4A2E4F', year: '', kind: 'creeds' },
  belga: { title: 'Belga', c: '#3D5567', spine: '#2D4151', ink: '#EEF2F5', soft: 'rgba(238,242,245,.64)', acc: '#EDBE8F', papelAcc: '#3D5567', year: '1561', kind: 'confession' },
  heidelberg: { title: 'Heidelberg', c: '#1F3B2D', spine: '#152A20', ink: '#EFE9DB', soft: 'rgba(239,233,219,.64)', acc: '#C9D59E', papelAcc: '#1F3B2D', year: '1563', kind: 'catechism' },
  dort: { title: 'Dort', c: '#2F2B28', spine: '#211E1C', ink: '#F2EDE6', soft: 'rgba(242,237,230,.62)', acc: '#E0B46A', papelAcc: '#2F2B28', year: '1619', kind: 'canons' },
  'westminster-menor': { title: 'Menor de Westminster', c: '#1B2944', spine: '#121D33', ink: '#EEF0F4', soft: 'rgba(238,240,244,.62)', acc: '#E6C66E', papelAcc: '#1B2944', year: '1647', kind: 'catechism' },
  'bautista-1689': { title: 'Bautista de 1689', c: '#6B1E23', spine: '#511519', ink: '#F6ECDD', soft: 'rgba(246,236,221,.66)', acc: '#E2B66B', papelAcc: '#6B1E23', year: '1689', kind: 'confession' },
  keach: { title: 'Keach', c: '#1E5560', spine: '#163F48', ink: '#EAF3F2', soft: 'rgba(234,243,242,.64)', acc: '#F0C98E', papelAcc: '#1E5560', year: '1693', kind: 'catechism' },
  spurgeon: { title: 'Spurgeon', c: '#8C4A2B', spine: '#6E3920', ink: '#FBEFE4', soft: 'rgba(251,239,228,.66)', acc: '#F2C58E', papelAcc: '#8C4A2B', year: '1855', kind: 'catechism' },
  'spurgeon-matutinas': { title: 'Lecturas matutinas', c: '#C27B2E', spine: '#A3641F', ink: '#2A1907', soft: 'rgba(42,25,7,.66)', acc: '#FFF3E0', papelAcc: '#8A5317', year: '1865', kind: 'devotional' },
  'spurgeon-ninos': { title: 'Spurgeon para Niños', c: '#E58A6D', spine: '#CC7258', ink: '#2E140C', soft: 'rgba(46,20,12,.62)', acc: '#FFF4EC', papelAcc: '#A8492E', year: '', kind: 'children' },
}

// Tema neutro para lo que no es un material (una nota del día, el plan): la
// paleta de la marca, con el sepia como lomo.
const BRAND = { c: '#2A231C', spine: '#1E1914', ink: '#F4EFE6', soft: 'rgba(244,239,230,.64)', acc: '#D9BE97', papelAcc: '#705F4C', year: '', kind: null, papelSpine: '#A88B6A' }

export function materialTheme(slug) {
  return THEMES[slug] ?? BRAND
}

// Paleta lista para dibujar según la variante: 'color' (por defecto) o 'papel'.
// spineInk: el texto y el logo del lomo (sobre el color del lomo).
export function coverPalette(slug, variant = 'color') {
  const th = materialTheme(slug)
  if (variant === 'papel') {
    return { ...PAPEL, spine: th.papelSpine ?? th.c, spineInk: th.papelSpine ? '#FFFFFF' : th.acc, acc: th.papelAcc, light: true }
  }
  return { c: th.c, spine: th.spine, spineInk: th.acc, ink: th.ink, soft: th.soft, acc: th.acc, light: false }
}

export const COVER_VARIANTS = ['color', 'papel']
