import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClientSide, useAppOrigin } from './landingHydration.js'
import { SYSTEM_CSS } from './landingSystem.js'
import { isStoreApp } from '../lib/platform.js'
import { HeartIcon } from '../components/icons.jsx'
import shotHoy from '../assets/mocks/hoy-lectura.png'
import shotGrupo from '../assets/mocks/sala-grupo.png'
import shotOracion from '../assets/mocks/oracion-lista.png'
// Tamaño real (px) de cada PNG, junto a su import: reservan el lugar de la imagen
// antes de que cargue. Si se rehacen las capturas, se actualizan acá.
const SIZE_HOY = { width: 780, height: 800 }
const SIZE_GRUPO = { width: 780, height: 1688 }
const SIZE_ORACION = { width: 780, height: 1688 }
import BrandMark from '../components/BrandMark.jsx'
import BackLink from '../components/BackLink.jsx'
import { isInAppBrowser } from '../lib/platform.js'
import { CONTACT_EMAIL } from '../lib/developer.js'

// La hoja de donación (con Supabase para la meta, Sheet, etc.) se baja recién al
// tocar «Apoyar el proyecto»: leer una landing no la necesita.
const DonateFlow = lazy(() => import('./DonateFlow.jsx'))

// Kit compartido por las páginas públicas (/info, /lideres, /ayuda, /privacidad):
// primitivos de marca, íconos, mocks de producto, header y footer globales. Vive
// fuera del Gate. Concepto transversal: la app acompaña la Biblia FÍSICA, no la
// reemplaza (product-principle-physical-bible). Un solo acento (Cielo), serif
// Newsreader para los títulos y la sans del sistema para lo funcional.
// Toda landing debe montar <LandingStyle/> (clases lk-* e info-*).
//
// IMPORTANTE (prerender): estos componentes se renderizan en Node con react-dom/server
// (ver src/prerender.jsx). Nada de window/localStorage/usePreferences al renderizar;
// lo que depende del navegador se lee tras hidratar (landingHydration.js).

// El sistema nuevo (tokens, tipografía, botones, header/footer) vive en
// landingSystem.js. Acá queda lo que ya existía: la paleta SEMÁNTICA por contenido
// (oración = coral, grupos = menta), las bandas y los CTAs con respuesta al cursor.
// Los números de paso usan bg-accent-action + text-on-accent, como los pasos de
// instalar en Hoy. Idéntico en todas las páginas.
const LANDING_CSS = `
      .info-cta { transition: filter 0.15s ease, transform 0.15s ease; }
      .info-cta:hover { filter: brightness(0.94); }
      .info-cta:active { transform: translateY(1px); filter: brightness(0.9); }

      /* Paleta SEMÁNTICA de las landings — sale de los 8 acentos de la app
         (2 sepias + 6 pasteles). El color no es decoración alternada: comunica
         de qué habla cada bloque. lectura = el acento de fábrica (Cielo,
         --accent); oración = coral; grupos = menta; ajustes = neutro (el
         engranaje no es una pestaña: se señala solo la excepción). Los textos
         de cada matiz se mezclan con la tinta del modo (como accent-ink) para AA. */
      :root {
        --land-cool: #57B795; /* alias histórico = grupos */
        --hue-oracion: #E2906C;
        --hue-grupos: #57B795;
      }

      /* Bandas de sección: cada matiz lava el fondo con compromiso (no un 7%
         homeopático). Reemplazan el surface-alt casi idéntico al fondo. */
      .landing-band { background: var(--accent-tint); }
      .band-oracion { background: rgba(226, 144, 108, 0.10); }
      .band-grupos { background: rgba(87, 183, 149, 0.10); }
      /* Badges por matiz (tinte + ícono/texto del matiz, espejo del acento). */
      .hb-oracion { background: rgba(226, 144, 108, 0.17); color: #A65F41; }
      .hb-grupos { background: rgba(87, 183, 149, 0.17); color: #37826A; }
      .hb-ajustes { background: var(--segment-track); color: var(--text-soft); }
      /* Texto/eyebrow por matiz (AA vía mezcla con la tinta del modo). */
      .ht-oracion { color: #A65F41; }
      .ht-grupos { color: #37826A; }
      .ht-ajustes { color: var(--text-soft); }
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
        .ht-oracion { color: color-mix(in srgb, var(--hue-oracion) 55%, var(--text-primary)); }
        .ht-grupos { color: color-mix(in srgb, var(--hue-grupos) 55%, var(--text-primary)); }
      }
      @media (prefers-color-scheme: dark) {
        :root:not(.light) .hs-oracion { color: #1C1C1E; }
      }
      :root.dark .hs-oracion { color: #1C1C1E; }
`

// dangerouslySetInnerHTML: como hijo de <style>, React escaparía las comillas del CSS
// (&quot;) al prerenderizar y el texto no coincidiría al hidratar.
export function LandingStyle() {
  // SYSTEM_CSS va primero: los matices .ht-*/.hb-* de abajo ganan a igual especificidad.
  return <style dangerouslySetInnerHTML={{ __html: SYSTEM_CSS + LANDING_CSS }} />
}

// Resplandor «luz de mañana» (cielo + un hilo de sol cálido, enmascarado para que
// se funda con el papel). Colocarlo como PRIMER hijo del wrapper de la página, que
// debe ser `relative isolate`: pinta detrás de todo (z -1), también del header
// de vidrio y del hero. `soft` para páginas-documento (/ayuda, /privacidad).
export function LandingGlow({ soft = false }) {
  return <div aria-hidden="true" className={`lk-glow ${soft ? 'lk-glow-soft' : ''}`} />
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

// Badge de ícono: cuadrado con tinte. El acento de fábrica (lectura/marca) por defecto; tone
// elige el matiz SEMÁNTICO del bloque: 'oracion' (coral), 'grupos' (menta),
// 'ajustes' (neutro). El color comunica el tema, nunca alterna porque sí.
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

// Marca: el librito (azul fijo de la marca) + «Lee Tu Biblia». Va dentro de un
// <Link> en el header y el footer.
export function Wordmark({ size = 'sm' }) {
  const lg = size === 'lg'
  return (
    <span className={`lk-brand ${lg ? 'lk-brand-lg' : ''}`}>
      <BrandMark size={lg ? 44 : 34} />
      Lee Tu Biblia
    </span>
  )
}

// Eyebrow con la cinta marcapáginas delante (firma del sistema) y el acento
// entintado para cumplir AA en texto chico. `tone` lo viste con el matiz semántico
// de su sección (oracion/grupos/ajustes). Una por sección, de ≤ 3 palabras.
export function Eyebrow({ children, tone }) {
  return <p className={`lk-eyebrow ${tone ? `ht-${tone}` : ''}`}>{children}</p>
}

// Escala de títulos de las páginas públicas (E › b.1), en la «voz del libro»:
// SectionTitle (h2, 32 → 56 px) para cada sección y SubTitle (h3 semántico, 20 → 24 px)
// para el detalle dentro de ella. Los hero y cierres usan `lk-display` directo en su
// h1/h2. `className` suma lo propio del sitio (margen, ancho máximo). Énfasis: <em>.
export function SectionTitle({ children, className = '' }) {
  return <h2 className={`lk-h2 ${className}`}>{children}</h2>
}
export function SubTitle({ children, className = '' }) {
  return <h3 className={`lk-h4 ${className}`}>{children}</h3>
}

// Navegación del sitio: las 4 páginas hermanas, en orden. Compartida por header
// y footer para que sean UNA sola fuente de verdad.
const SITE_NAV = [
  ['/info', 'Inicio'],
  ['/lideres', 'Para líderes'],
  ['/ayuda', 'Ayuda'],
  ['/privacidad', 'Privacidad'],
]

// Anillo de foco accesible (teclado) para los enlaces sueltos del contenido.
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app rounded'

// Cierre de cada sección: la guía se consulta por partes, así que hay camino de vuelta al índice.
export function BackToIndex() {
  return (
    <a
      href="#indice"
      className={`mt-10 inline-flex min-h-11 items-center text-[0.875rem] font-medium text-ink-soft transition-colors hover:text-accent-ink ${FOCUS}`}
    >
      ↑ Volver al índice
    </a>
  )
}


// Destino de los botones «entrar / empezar» de las landings: la raíz de la app con
// `?from=<página>` para saber desde qué landing llegó cada persona (se suma al
// evento ob_welcome del embudo; ver AuthFlow). Sin datos personales.
function appHref(current) {
  const key = String(current || '').replace(/^\//, '')
  return key ? `/?from=${key}` : '/'
}

// Dentro del navegador de Instagram/Facebook/TikTok no se puede instalar la app:
// se avisa ARRIBA, donde llega el tráfico frío, y no al fondo de la página.
function InAppBrowserBand() {
  const inApp = useClientSide(isInAppBrowser)
  if (!inApp) return null
  return (
    <div role="note" className="bg-accent-tint px-6 py-3 text-center text-[0.875rem] leading-snug text-ink">
      Estás en el navegador de otra app. Para instalar Lee Tu Biblia, tocá el menú{' '}
      <b>⋯</b> y elegí <b>«Abrir en Safari»</b> (o Chrome).
    </div>
  )
}

const Chevron = () => (
  <svg className="lk-ico" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
)

// Header GLOBAL de las páginas públicas: UNA fila sticky de vidrio —marca · nav ·
// «Entrar» · CTA sólida «Empezar gratis»—, con una cinta de progreso de 2 px que
// avanza con el scroll (CSS puro, donde hay soporte). La navegación entre hermanas
// queda siempre visible en escritorio; en móvil (< 900 px) es un <details> nativo
// (abre y cierra sin JS; el JS de abajo solo lo cierra al elegir un enlace y con
// Escape). Un único CTA con un único verbo en todo el sitio.
//
// Si llegaste desde adentro de la app (state.from, p. ej. Ajustes › Guía), la
// salida es el «‹ Ajustes» de siempre en lugar de «Entrar / Empezar»: la PWA no
// tiene atrás. useAppOrigin lo lee tras hidratar, así que el HTML prerenderizado
// siempre trae el CTA y el cliente lo cambia sin desajuste.
export function LandingHeader({ current }) {
  const from = useAppOrigin()
  const menuRef = useRef(null)
  const href = appHref(current)

  const closeMenu = (refocus) => {
    const el = menuRef.current
    if (!el?.open) return
    el.open = false
    if (refocus) el.querySelector('summary')?.focus()
  }

  return (
    <>
      <a href="#contenido" className="lk-skip">
        Saltar al contenido
      </a>
      <InAppBrowserBand />
      <header className="lk-hdr">
        <div className="lk-wrap lk-hdr-in">
          <Link to="/info" aria-label="Lee Tu Biblia, inicio" className="inline-flex">
            <Wordmark />
          </Link>
          <nav aria-label="Principal" className="lk-nav">
            {SITE_NAV.map(([to, label]) => (
              <Link key={to} to={to} aria-current={to === current ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="lk-actions">
            {from?.to ? (
              <BackLink to="/" label="la app" />
            ) : (
              <>
                <Link to={href} className="lk-login">
                  Entrar
                </Link>
                <Link to={href} className="lk-btn lk-btn-primary lk-btn-sm">
                  Empezar gratis
                </Link>
              </>
            )}
            <details
              ref={menuRef}
              className="lk-burger"
              onKeyDown={(e) => e.key === 'Escape' && closeMenu(true)}
            >
              <summary aria-label="Menú">
                <svg className="lk-ico lk-bars" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 8h16M4 16h16" />
                </svg>
                <svg className="lk-ico lk-x" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </summary>
              {/* El panel cierra el menú al elegir un enlace (también el de la página actual). */}
              <nav aria-label="Menú principal" className="lk-burger-panel" onClick={(e) => e.target.closest('a') && closeMenu(false)}>
                {SITE_NAV.map(([to, label]) => (
                  <Link key={to} to={to} aria-current={to === current ? 'page' : undefined}>
                    {label}
                    <Chevron />
                  </Link>
                ))}
                {!from?.to && (
                  <Link to={href} className="lk-menu-small">
                    Ya tengo cuenta · Entrar
                  </Link>
                )}
              </nav>
            </details>
          </div>
        </div>
        <div className="lk-progress" aria-hidden="true">
          <i />
        </div>
      </header>
    </>
  )
}

// "Apoyar el proyecto" del footer: discreto, al pie, para quien llega hasta el
// final (a menudo un líder mirando la app para su grupo). Abre la misma hoja de
// donación que la app, con la meta de las tiendas si está vigente. No aparece
// dentro de una app de tienda (ver isStoreApp).
// "Apoyar el proyecto" del footer: discreto, al pie, para quien llega hasta el
// final (a menudo un líder mirando la app para su grupo). Abre la misma hoja de
// donación que la app, con la meta de las tiendas si está vigente. No aparece
// dentro de una app de tienda (ver isStoreApp).
function FooterDonate() {
  const storeApp = useClientSide(isStoreApp)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(null)

  // Al acercarse el pie a la pantalla se adelanta la descarga de la hoja (y de la
  // meta): para cuando alguien toca el botón, ya está lista. Quien no llega al
  // final de la página no gasta esos datos.
  useEffect(() => {
    const el = buttonRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        import('./DonateFlow.jsx').then((m) => m.default.warm()).catch(() => {})
      },
      { rootMargin: '300px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [storeApp])

  if (storeApp) return null
  return (
    <li>
      <button ref={buttonRef} type="button" onClick={() => setOpen(true)}>
        <HeartIcon size={16} />
        Apoyar el proyecto
      </button>
      {open && (
        <Suspense fallback={null}>
          <DonateFlow onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </li>
  )
}


// Footer GLOBAL de las páginas públicas: el tejido conectivo del sitio. Idéntico
// en /info, /lideres, /ayuda y /privacidad, para que desde cualquier página se
// alcance cualquier otra en un clic (arquitectura hub-y-radios, plano). En
// columnas —App · Líderes · Proyecto · Legal— dentro de UN solo <nav>.
export function LandingFooter({ current }) {
  const link = (to, label) => (
    <li>
      <Link to={to} aria-current={to === current ? 'page' : undefined}>
        {label}
      </Link>
    </li>
  )
  return (
    <footer className="lk-foot">
      <div className="lk-wrap">
        <div className="lk-foot-grid">
          <div className="lk-foot-brand">
            <Link to="/info" aria-label="Lee Tu Biblia, inicio" className="inline-flex">
              <Wordmark />
            </Link>
            <p>Gratis · sin publicidad · hecho para acompañar tu lectura en la Palabra.</p>
          </div>
          <nav aria-label="Pie de página" className="lk-foot-nav">
            <div>
              <p className="lk-foot-h" id="lkf-app">La app</p>
              <ul className="lk-foot-list" aria-labelledby="lkf-app">
                {link('/info', 'Inicio')}
                {link('/ayuda', 'Ayuda')}
                <li>
                  <Link to={appHref(current)}>Entrar a la app</Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="lk-foot-h" id="lkf-lideres">Líderes</p>
              <ul className="lk-foot-list" aria-labelledby="lkf-lideres">
                {link('/lideres', 'Para líderes')}
              </ul>
            </div>
            <div>
              <p className="lk-foot-h" id="lkf-proyecto">Proyecto</p>
              <ul className="lk-foot-list" aria-labelledby="lkf-proyecto">
                <FooterDonate />
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`}>Contacto</a>
                </li>
              </ul>
            </div>
            <div>
              <p className="lk-foot-h" id="lkf-legal">Legal</p>
              <ul className="lk-foot-list" aria-labelledby="lkf-legal">
                {link('/privacidad', 'Privacidad')}
              </ul>
            </div>
          </nav>
        </div>
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
function Shot({ src, alt, width, height }) {
  return (
    <figure className="mx-auto w-[248px] shrink-0 sm:w-[268px]">
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className="h-auto w-full rounded-[26px] border border-hairline"
        style={{ boxShadow: '0 30px 60px -30px rgba(28, 28, 30, 0.25)' }}
      />
      <figcaption className="mx-auto mt-5 max-w-[250px] text-center text-[0.8438rem] leading-snug text-ink-soft">
        {alt}
      </figcaption>
    </figure>
  )
}

// Pantalla Hoy: se ven las REFERENCIAS del día, nunca el texto bíblico.
export function PhoneMock() {
  return (
    <Shot
      src={shotHoy}
      {...SIZE_HOY}
      alt="Así se ve Hoy: tus pasajes del día. El texto queda en tu Biblia."
    />
  )
}

// Pantalla de grupo, vista del líder: el pulso de hoy, el plan en común y la
// oración compartida — vuelve tangibles las afirmaciones de discipulado.
export function GroupMock() {
  return (
    <Shot
      src={shotGrupo}
      {...SIZE_GRUPO}
      alt="La sala del grupo: el pulso de hoy, el plan en común y la oración compartida."
    />
  )
}

// Pantalla de Oración: pedidos propios y respondidos, con testimonio.
export function PrayerMock() {
  return (
    <Shot
      src={shotOracion}
      {...SIZE_ORACION}
      alt="Tu oración: pedidos propios y respondidos, con testimonio cuando Dios contesta."
    />
  )
}
