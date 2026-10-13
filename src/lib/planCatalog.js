// Catálogo de planes: orden curado y "puertas pastorales" (puro, sin Supabase).
//
// Un lector no entra por la duración sino por su situación: empezar, una
// temporada del año cristiano, un libro puntual, recorrer toda la Biblia o un
// hábito breve. La duración queda como metadato de cada tarjeta.

// Orden curado del catálogo (la terna de lanzamiento primero; lo demás después).
// Da un orden estable y con intención, en vez de ordenar solo por duración —que
// dejaba el plan de 861 días primero y los cuatro de 365 en orden indefinido.
export const PLAN_ORDER = [
  'mcheyne',
  'cronologico',
  'marcos',
  'primeros-pasos',
  'evangelios',
  'proverbios',
  'semana-santa',
  'adviento',
  'beginning',
  'at-nt',
  'nt-24-week',
  '40-dias-con-dios',
  'bcp-daily-office',
]

// Orden de las puertas en la pantalla de planes.
export const DOOR_ORDER = ['empezar', 'temporada', 'libro', 'toda', 'habito', 'mas']

// slug → puerta. Un slug sin entrada (plan nuevo todavía sin clasificar) cae en
// 'mas' en vez de desaparecer del catálogo.
export const PLAN_DOORS = {
  'primeros-pasos': 'empezar',
  marcos: 'empezar',
  'semana-santa': 'temporada',
  adviento: 'temporada',
  proverbios: 'libro',
  evangelios: 'libro',
  'nt-24-week': 'libro',
  mcheyne: 'toda',
  cronologico: 'toda',
  'at-nt': 'toda',
  beginning: 'toda',
  'bcp-daily-office': 'toda',
  '40-dias-con-dios': 'habito',
}

export function planDoor(slug) {
  return PLAN_DOORS[slug] ?? 'mas'
}
