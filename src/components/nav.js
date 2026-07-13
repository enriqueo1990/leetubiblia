import { BookIcon, HeartIcon, PeopleIcon, ChartIcon } from './icons.jsx'

// Fuente única de la navegación: la usan tanto la tab bar (móvil/tablet) como el
// sidebar (desktop). 4 ítems fijos. Desde 2026-07 el 4º slot es Progreso (la
// recompensa del hábito: racha, calendario, diario, recorrido); Ajustes vive en
// el header de Hoy — se toca una vez al mes, no merece slot permanente.
//
// `match`: prefijos extra que encienden el ítem además de su propia ruta, para
// que las pantallas de segundo anillo no dejen el mapa apagado. Todo lo que
// cuelga de Ajustes (planes, materiales) cuelga a su vez de Hoy.
export const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.hoy', Icon: BookIcon, end: true, match: ['/hoy', '/ajustes', '/planes', '/materiales'] },
  { to: '/oracion', labelKey: 'nav.oracion', Icon: HeartIcon },
  { to: '/grupos', labelKey: 'nav.grupos', Icon: PeopleIcon, match: ['/join'] },
  { to: '/progreso', labelKey: 'nav.progreso', Icon: ChartIcon, match: ['/recorrido'] },
]

// ¿La ruta actual pertenece al subárbol de este ítem (sin ser su ruta propia)?
export function matchesExtra(item, pathname) {
  return (item.match ?? []).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}
