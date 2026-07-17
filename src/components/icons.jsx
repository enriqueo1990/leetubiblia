// Iconos SVG inline, estilo SF Symbols (stroke fino ~1.7). En Fase 1 son los de
// navegación y acciones base; se pueden sustituir por Lucide manteniendo el peso.
// Cada uno hereda el color vía `currentColor` y acepta props (size, className...).

function Icon({ size = 24, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

// Hoy — libro abierto. Páginas izquierda/derecha animables por separado.
export const BookIcon = ({ className = '', ...p }) => (
  <Icon className={`icon-book ${className}`} {...p}>
    <path className="book-left"  d="M12 6.5C10.5 5.3 8.3 5 4.5 5v12c3.8 0 6 .3 7.5 1.5" />
    <path className="book-right" d="M12 6.5C13.5 5.3 15.7 5 19.5 5v12c-3.8 0-6 .3-7.5 1.5" />
    <path d="M12 6.5v12" />
  </Icon>
)

// Oración — corazón. Fill separado del stroke para poder hacer fade suave.
export const HeartIcon = ({ className = '', ...p }) => (
  <Icon className={`icon-heart ${className}`} {...p}>
    <path className="heart-fill"   fill="currentColor" stroke="none"
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
    <path className="heart-stroke"
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
  </Icon>
)

// Grupos — persona principal quieta, la segunda "llega".
export const PeopleIcon = ({ className = '', ...p }) => (
  <Icon className={`icon-people ${className}`} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <g className="person-secondary">
      <path d="M16 6.2A3 3 0 0 1 16 12" />
      <path d="M17.5 14.2c2.3.5 4 2.4 4 4.8" />
    </g>
  </Icon>
)

// Ajustes — líneas continuas, círculos con fill sólido para tapar la línea debajo.
export const SlidersIcon = ({ className = '', ...p }) => (
  <Icon className={`icon-sliders ${className}`} {...p}>
    <path d="M4 7h16M4 17h16" />
    <circle className="knob-top"    cx="16" cy="7"  r="2.2" style={{ fill: 'var(--bg-app)' }} />
    <circle className="knob-bottom" cx="8"  cy="17" r="2.2" style={{ fill: 'var(--bg-app)' }} />
  </Icon>
)

export const GearIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
  </Icon>
)

export const ChevronRight = (p) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
)

export const PlusIcon = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const MinusIcon = (p) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
)

export const XIcon = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

// Check — confirmación (intercesión activa, testimonios). Pasale strokeWidth
// mayor (p.ej. 2.2) en usos donde deba verse sólido.
export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M5 12l5 5L20 7" />
  </Icon>
)

export const LockIcon = (p) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
)

export const CopyIcon = (p) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
)

export const RefreshIcon = (p) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v4h-4" />
  </Icon>
)

export const ShareIcon = (p) => (
  <Icon {...p}>
    <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </Icon>
)

export const InstallIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 20h14" />
  </Icon>
)

export const PencilIcon = (p) => (
  <Icon {...p}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Icon>
)

// Progreso — tres barras ascendentes (chart de columnas).
export const ChartIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20v-6M12 20V8M20 20V4" />
  </Icon>
)

// Índice — lista con viñetas (list.bullet).
export const ListIcon = (p) => (
  <Icon {...p}>
    <path d="M9 6h12M9 12h12M9 18h12" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Icon>
)
