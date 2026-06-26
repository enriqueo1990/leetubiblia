import { BookIcon, HeartIcon, PeopleIcon, SlidersIcon } from './icons.jsx'

// Fuente única de la navegación: la usan tanto la tab bar (móvil/tablet) como el
// sidebar (desktop). 4 ítems fijos — ver documento maestro §4.6.
export const NAV_ITEMS = [
  { to: '/', label: 'Hoy', Icon: BookIcon, end: true },
  { to: '/oracion', label: 'Oración', Icon: HeartIcon },
  { to: '/grupos', label: 'Grupos', Icon: PeopleIcon },
  { to: '/ajustes', label: 'Ajustes', Icon: SlidersIcon },
]
