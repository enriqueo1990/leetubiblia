import { Link } from 'react-router-dom'
import shotHoy from '../assets/mocks/hoy-lectura.png'
import shotGrupo from '../assets/mocks/sala-grupo.png'
import shotOracion from '../assets/mocks/oracion-lista.png'

// Kit compartido por las páginas públicas (/info, /lideres, /ayuda, /privacidad):
// primitivos de marca, íconos, mocks de producto y el footer global. Vive fuera
// del Gate. Concepto transversal:
// la app acompaña la Biblia FÍSICA, no la reemplaza (product-principle-physical-bible).
// Un solo acento sepia, la MISMA sans del sistema, aire en vez de tarjetas flotantes
// (design-canon). Toda landing debe montar <LandingStyle/> para las clases info-*.

// CSS local de las landings: eyebrows y números de paso en un sepia más profundo
// (AA en texto chico), CTAs que responden al cursor, y la atmósfera cálida
// compartida (resplandor y bandas). Idéntico en todas las páginas.
export function LandingStyle() {
  return (
    <style>{`
      .info-eyebrow { color: var(--accent); }
      .info-num { background: var(--accent); }
      @supports (color: color-mix(in srgb, red 50%, blue)) {
        .info-eyebrow { color: color-mix(in srgb, var(--accent) 68%, var(--text-primary)); }
        .info-num { background: color-mix(in srgb, var(--accent) 72%, var(--text-primary)); }
      }
      .info-cta { transition: filter 0.15s ease, transform 0.15s ease; }
      .info-cta:hover { filter: brightness(0.94); }
      .info-cta:active { transform: translateY(1px); filter: brightness(0.9); }

      /* Paleta SEMÁNTICA de las landings — sale de los 12 acentos de la app
         (6 sepias + 6 pasteles). El color no es decoración alternada: comunica
         de qué habla cada bloque. lectura = sepia (la marca, --accent);
         oración = coral; grupos = menta; ajustes = cielo. Los textos de cada
         matiz se mezclan con la tinta del modo (como accent-ink) para AA. */
      :root {
        --land-cool: #57B795; /* alias histórico = grupos */
        --hue-oracion: #E2906C;
        --hue-grupos: #57B795;
        --hue-ajustes: #6FA4D8;
      }

      /* Resplandor de página BITONAL: lámina cálida (sepia) a la izquierda y un
         respiro fresco (salvia) a la derecha. Nace en el borde superior, DETRÁS
         del header: header y hero son una sola pieza con profundidad de cielo. */
      .landing-glow {
        background:
          radial-gradient(ellipse 700px 500px at 26% -12%, var(--accent-tint), transparent 70%),
          radial-gradient(ellipse 620px 440px at 82% -16%, rgba(87, 183, 149, 0.10), transparent 70%);
      }
      .landing-glow-soft {
        background:
          radial-gradient(ellipse 640px 360px at 30% -18%, var(--accent-tint), transparent 70%),
          radial-gradient(ellipse 540px 320px at 84% -20%, rgba(87, 183, 149, 0.07), transparent 68%);
      }
      @supports (color: color-mix(in srgb, red 50%, blue)) {
        .landing-glow {
          background:
            radial-gradient(ellipse 700px 500px at 26% -12%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%),
            radial-gradient(ellipse 620px 440px at 82% -16%, color-mix(in srgb, var(--land-cool) 13%, transparent), transparent 70%);
        }
        .landing-glow-soft {
          background:
            radial-gradient(ellipse 640px 360px at 30% -18%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%),
            radial-gradient(ellipse 540px 320px at 84% -20%, color-mix(in srgb, var(--land-cool) 8%, transparent), transparent 68%);
        }
      }

      /* Bandas de sección: cada matiz lava el fondo con compromiso (no un 7%
         homeopático). Reemplazan el surface-alt casi idéntico al fondo. */
      .landing-band { background: var(--accent-tint); }
      .band-oracion { background: rgba(226, 144, 108, 0.10); }
      .band-grupos { background: rgba(87, 183, 149, 0.10); }
      /* Badges por matiz (tinte + ícono/texto del matiz, espejo del sepia). */
      .hb-oracion { background: rgba(226, 144, 108, 0.17); color: #A65F41; }
      .hb-grupos { background: rgba(87, 183, 149, 0.17); color: #37826A; }
      .hb-ajustes { background: rgba(111, 164, 216, 0.17); color: #4A76A8; }
      /* Texto/eyebrow por matiz (AA vía mezcla con la tinta del modo). */
      .ht-oracion { color: #A65F41; }
      .ht-grupos { color: #37826A; }
      .ht-ajustes { color: #4A76A8; }
      /* Relleno sólido coral (pill "Estoy orando" del mock de oración). */
      .hs-oracion { background: var(--hue-oracion); color: #FFFFFF; }
      @supports (color: color-mix(in srgb, red 50%, blue)) {
        .landing-band { background: color-mix(in srgb, var(--accent) 9%, var(--bg-app)); }
        .band-oracion { background: color-mix(in srgb, var(--hue-oracion) 9%, var(--bg-app)); }
        .band-grupos { background: color-mix(in srgb, var(--hue-grupos) 9%, var(--bg-app)); }
        .hb-oracion {
          background: color-mix(in srgb, var(--hue-oracion) 17%, transparent);
          color: color-mix(in srgb, var(--hue-oracion) 55%, var(--text-primary));
        }
        .hb-grupos {
          background: color-mix(in srgb, var(--hue-grupos) 17%, transparent);
          color: color-mix(in srgb, var(--hue-grupos) 55%, var(--text-primary));
        }
        .hb-ajustes {
          background: color-mix(in srgb, var(--hue-ajustes) 17%, transparent);
          color: color-mix(in srgb, var(--hue-ajustes) 55%, var(--text-primary));
        }
        .ht-oracion { color: color-mix(in srgb, var(--hue-oracion) 55%, var(--text-primary)); }
        .ht-grupos { color: color-mix(in srgb, var(--hue-grupos) 55%, var(--text-primary)); }
        .ht-ajustes { color: color-mix(in srgb, var(--hue-ajustes) 55%, var(--text-primary)); }
      }
      @media (prefers-color-scheme: dark) {
        :root:not(.light) .hs-oracion { color: #1C1C1E; }
      }
      :root.dark .hs-oracion { color: #1C1C1E; }
    `}</style>
  )
}

// Resplandor superior de página. Colocarlo como PRIMER hijo del wrapper
// (que debe ser \`relative\`): pinta detrás del header y del hero, unificándolos.
// \`soft\` para páginas-documento (/ayuda, /privacidad): presencia, sin marketing.
export function LandingGlow({ soft = false }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 ${soft ? 'landing-glow-soft h-[300px]' : 'landing-glow h-[620px]'}`}
    />
  )
}

// Íconos que la app aún no tiene, en el mismo trazo (1.7, currentColor).
export function MiniIcon({ children, size = 22 }) {
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
    >
      {children}
    </svg>
  )
}
export const BellIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </MiniIcon>
)
export const PaletteIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M12 21a9 9 0 1 1 9-9c0 2-1 3-3 3h-1.5a1.5 1.5 0 0 0-1 2.6c.3.3.5.7.5 1.2 0 1.2-1 2.2-2 2.2z" />
    <circle cx="7.8" cy="10.3" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16.2" cy="10.3" r="1.1" fill="currentColor" stroke="none" />
  </MiniIcon>
)
export const WifiOffIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M8.5 16.4a5 5 0 0 1 7 0" />
    <path d="M5 12.9a10 10 0 0 1 5.2-2.7" />
    <path d="M19 12.9a10 10 0 0 0-2-1.5" />
    <path d="M2 8.8a15 15 0 0 1 4.2-2.6" />
    <path d="M22 8.8a15 15 0 0 0-11.3-3.8" />
    <circle cx="12" cy="20" r="1.1" fill="currentColor" stroke="none" />
    <path d="M2 2l20 20" />
  </MiniIcon>
)
export const AwardIcon = (p) => (
  <MiniIcon {...p}>
    <circle cx="12" cy="9" r="6" />
    <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" />
  </MiniIcon>
)
export const HandsIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M11 13V5.5a1.5 1.5 0 0 1 3 0V12" />
    <path d="M14 12V4a1.5 1.5 0 0 1 3 0v9" />
    <path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.4-3.4L4.3 15a1.5 1.5 0 0 1 2.6-1.5l1.1 1.9" />
    <path d="M11 13V6.5a1.5 1.5 0 0 0-3 0V15" />
  </MiniIcon>
)

// Badge de ícono: cuadrado con tinte. Sepia (lectura/marca) por defecto; tone
// elige el matiz SEMÁNTICO del bloque: 'oracion' (coral), 'grupos' (menta),
// 'ajustes' (cielo). El color comunica el tema, nunca alterna porque sí.
const BADGE_TONES = {
  oracion: 'hb-oracion',
  grupos: 'hb-grupos',
  ajustes: 'hb-ajustes',
  cool: 'hb-grupos', // alias histórico
}
export function IconBadge({ children, tone }) {
  return (
    <span
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${
        BADGE_TONES[tone] ?? 'bg-accent-tint text-accent'
      }`}
    >
      {children}
    </span>
  )
}

// Wordmark reutilizable (sans bold, como el onboarding de la app + marca libro).
export function Wordmark({ size = 'sm' }) {
  const s = size === 'lg'
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className={`inline-flex items-center justify-center rounded-[12px] bg-accent-action ${
          s ? 'h-14 w-14' : 'h-9 w-9'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" width={s ? 34 : 22} height={s ? 34 : 22}>
          <g
            fill="none"
            stroke="var(--on-accent)"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z" />
            <path d="M32 20v28" />
          </g>
        </svg>
      </span>
      <span
        className={`font-bold tracking-[-0.02em] text-ink ${s ? 'text-[24px]' : 'text-[18px]'}`}
      >
        Lee Tu Biblia
      </span>
    </span>
  )
}

// Eyebrow en un sepia más profundo (mismo tono, mezclado con la tinta) para
// cumplir AA en texto chico; cae al acento puro donde no hay color-mix.
// tone lo viste con el matiz semántico de su sección (oracion/grupos/ajustes).
export function Eyebrow({ children, tone }) {
  return (
    <p
      className={`info-eyebrow text-[13px] font-semibold uppercase tracking-[0.16em] ${
        tone ? `ht-${tone}` : ''
      }`}
    >
      {children}
    </p>
  )
}

// Navegación del sitio: las 4 páginas hermanas, en orden. Compartida por header
// y footer para que sean UNA sola fuente de verdad.
const SITE_NAV = [
  ['/info', 'Inicio'],
  ['/lideres', 'Para líderes'],
  ['/ayuda', 'Ayuda'],
  ['/privacidad', 'Privacidad'],
]

// Anillo de foco accesible (teclado): mismo en todos los enlaces/CTA públicos.
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app rounded'

// Header GLOBAL de las páginas públicas. Dos filas: (1) wordmark + acción, y
// (2) la navegación entre hermanas, VISIBLE arriba —no oculta tras un menú— para
// que quien no baje al footer igual pueda saltar de página. El enlace activo
// marca "estás acá" (doble función: orientación + navegación). En móvil la fila
// de navegación hace scroll horizontal si no entran todos.
//
// `width` alinea el borde izquierdo del header con el ancho de contenido de la
// página (mismo valor que su encabezado superior), para que wordmark, nav y
// contenido compartan gutter. La CTA "Abrir la app" es SECUNDARIA (ghost): la
// CTA sólida de cada página es la protagonista, no compite con el header.
export function LandingHeader({ current, width = 'max-w-[880px]' }) {
  return (
    <header className={`relative mx-auto w-full ${width} px-6 pt-6`}>
      <div className="flex items-center justify-between gap-4">
        <Link to="/info" aria-label="Lee Tu Biblia" className={FOCUS}>
          <Wordmark />
        </Link>
        <Link
          to="/"
          className={`shrink-0 rounded-pill bg-accent-tint px-4 py-2 text-[14.5px] font-semibold text-accent-ink transition-[filter] hover:brightness-95 ${FOCUS}`}
        >
          Abrir la app
        </Link>
      </div>
      {/* Sin divisor: la separación la dan el aire y el resplandor de página.
          El activo es una píldora con tinte, con outdent (-mx) para que su TEXTO
          conserve el borde izquierdo alineado con el contenido. El contenedor
          scrolleable compensa con -mx-3/px-3: espacio de sangrado DENTRO del
          scrollport para que el fondo de la píldora no se recorte. */}
      <nav className="-mx-3 mt-3.5 flex items-center gap-x-5 overflow-x-auto whitespace-nowrap px-3 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SITE_NAV.map(([to, label]) =>
          to === current ? (
            <span
              key={to}
              aria-current="page"
              className="-mx-3 rounded-pill bg-accent-tint px-3 py-1.5 text-[14.5px] font-semibold text-accent-ink"
            >
              {label}
            </span>
          ) : (
            <Link
              key={to}
              to={to}
              className={`text-[14.5px] font-medium text-ink-soft transition-colors hover:text-accent-ink ${FOCUS}`}
            >
              {label}
            </Link>
          )
        )}
      </nav>
    </header>
  )
}

// Footer GLOBAL de las páginas públicas: el tejido conectivo del sitio. Idéntico
// en /info, /lideres, /ayuda y /privacidad, para que desde cualquier página se
// alcance cualquier otra en un clic (arquitectura hub-y-radios, plano). Espeja la
// navegación del header para quien llega hasta el final de la página.
export function LandingFooter({ current, width = 'max-w-[880px]' }) {
  return (
    <footer className="border-t border-hairline">
      <div className={`mx-auto flex w-full ${width} flex-col items-center gap-6 px-6 py-12 text-center`}>
        <Link to="/info" aria-label="Lee Tu Biblia" className={FOCUS}>
          <Wordmark />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
          {SITE_NAV.map(([to, label]) =>
            to === current ? (
              <span key={to} className="text-[14px] font-semibold text-ink" aria-current="page">
                {label}
              </span>
            ) : (
              <Link
                key={to}
                to={to}
                className={`text-[14px] font-medium text-ink-soft transition-colors hover:text-accent-ink ${FOCUS}`}
              >
                {label}
              </Link>
            )
          )}
          <Link
            to="/"
            className={`text-[14px] font-semibold text-accent-ink transition-colors hover:underline ${FOCUS}`}
          >
            Abrir la app →
          </Link>
        </nav>
        <p className="text-[13px] leading-relaxed text-ink-soft">
          Gratis · sin publicidad · hecho para acompañar tu lectura en la Palabra.
        </p>
      </div>
    </footer>
  )
}

// ── Mocks de producto ────────────────────────────────────────────────
// CAPTURAS REALES de la app (no ilustraciones): mismo tratamiento visual que
// /lideres — imagen con borde + sombra, alto natural (Shot). Se retoman con
// scripts/capture-guia-lideres.mjs cuando cambia la UI. El texto bíblico NUNCA
// aparece: se ven referencias, estado y oración, nunca la Escritura (que vive
// en la Biblia física) — las capturas ya respetan eso por diseño de la app.
function Shot({ src, alt }) {
  return (
    <figure className="mx-auto w-[248px] shrink-0 sm:w-[268px]">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-[26px] border border-hairline"
        style={{ boxShadow: '0 30px 60px -30px rgba(28, 28, 30, 0.25)' }}
      />
      <figcaption className="mx-auto mt-5 max-w-[250px] text-center text-[13.5px] leading-snug text-ink-soft">
        {alt}
      </figcaption>
    </figure>
  )
}

// Pantalla Hoy: se ven las REFERENCIAS del día, nunca el texto bíblico.
export function PhoneMock() {
  return <Shot src={shotHoy} alt="Así se ve Hoy: tus pasajes del día. El texto queda en tu Biblia." />
}

// Pantalla de grupo, vista del líder: el pulso de hoy, el plan en común y la
// oración compartida — vuelve tangibles las afirmaciones de discipulado.
export function GroupMock() {
  return (
    <Shot
      src={shotGrupo}
      alt="La sala del grupo: el pulso de hoy, el plan en común y la oración compartida."
    />
  )
}

// Pantalla de Oración: pedidos propios y respondidos, con testimonio.
export function PrayerMock() {
  return (
    <Shot
      src={shotOracion}
      alt="Tu oración: pedidos propios y respondidos, con testimonio cuando Dios contesta."
    />
  )
}
