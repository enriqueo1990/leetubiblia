import { PHONESHOT_CSS } from './phoneShotStyles.js'

// Captura REAL de la app dentro del marco de teléfono de los demos (el CSS del marco
// es el de demoStyles.js). Las capturas salen de la cuenta de ejemplo («Lucía», plan
// Cronológico, día 14) con scripts/capture-demo.mjs y se optimizan con
// scripts/optimize-shots.mjs (AVIF y WebP a 780 px, en src/assets/shots/; Vite les pone
// hash). Nunca muestran texto bíblico: solo referencias (y, en la Biblioteca, texto de
// catecismo). Sin JS ni estado: se renderiza en Node al prerenderizar.
//
// - <picture> AVIF con WebP de reserva, width/height explícitos (relación 780×1688:
//   CLS 0) y decoding="async". Lazy salvo `priority` (la del hero, que además va con
//   fetchpriority="high").
// - Claro/noche sin JS: ver phoneShotStyles.js (prefers-color-scheme por <source>,
//   tema forzado de la app por clases .light/.dark, y «Ver en noche» con un checkbox).
// - Cada captura lleva el rótulo «Así se ve, de verdad», para distinguirla de los
//   demos dibujados (que dicen «Demo con datos de ejemplo»).
// La página monta <PhoneShotStyle /> una vez (o <DemoStyle />, que ya lo incluye).

const URLS = import.meta.glob('../assets/shots/*-780.{avif,webp}', { eager: true, query: '?url', import: 'default' })
const W = 780
const H = 1688

function url(shot, mode, ext) {
  const u = URLS[`../assets/shots/${shot}-${mode}-780.${ext}`]
  if (!u) throw new Error(`PhoneShot: falta la captura ${shot}-${mode}-780.${ext} en src/assets/shots/`)
  return u
}

export function PhoneShotStyle() {
  return <style dangerouslySetInnerHTML={{ __html: PHONESHOT_CSS }} />
}

function Img({ shot, mode, alt, eager }) {
  return (
    <img
      src={url(shot, mode, 'webp')}
      width={W}
      height={H}
      alt={alt}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      {...(eager ? { fetchpriority: 'high' } : {})}
    />
  )
}

const Sun = () => (
  <svg className="in-ico in-i-sun" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </svg>
)
const Moon = () => (
  <svg className="in-ico in-i-moon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />
  </svg>
)

// shot: 'hoy' | 'orar' | 'oracion' | 'progreso' | 'biblioteca' | 'lector'.
// alt: qué se ve (descriptivo, sin texto bíblico). caption: una frase corta que lee
// quien mira. width: ancho máximo del teléfono en px. flip: suma «Ver en noche / Ver en
// claro». tilt: el teléfono apenas inclinado (hero).
export default function PhoneShot({
  shot,
  alt,
  caption,
  note = 'Así se ve, de verdad · datos de ejemplo',
  width = 300,
  priority = false,
  flip = false,
  tilt = false,
  className = '',
}) {
  return (
    <figure
      className={`in-demo in-static in-demo-fig ps${tilt ? ' ps-tilt' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--demo-w': `${width}px` }}
    >
      <div className="in-phone">
        <div className="in-screen ps-screen">
          <picture className="ps-pic ps-auto">
            <source media="(prefers-color-scheme: dark)" type="image/avif" srcSet={url(shot, 'noche', 'avif')} />
            <source media="(prefers-color-scheme: dark)" type="image/webp" srcSet={url(shot, 'noche', 'webp')} />
            <source type="image/avif" srcSet={url(shot, 'claro', 'avif')} />
            <Img shot={shot} mode="claro" alt={alt} eager={priority} />
          </picture>
          <picture className="ps-pic ps-light">
            <source type="image/avif" srcSet={url(shot, 'claro', 'avif')} />
            <Img shot={shot} mode="claro" alt={alt} />
          </picture>
          <picture className="ps-pic ps-dark">
            <source type="image/avif" srcSet={url(shot, 'noche', 'avif')} />
            <Img shot={shot} mode="noche" alt={alt} />
          </picture>
        </div>
      </div>
      <figcaption className="in-demo-cap">
        {caption && <b>{caption}</b>}
        <span>{note}</span>
        {flip && (
          <label className="in-flip">
            <input type="checkbox" className="in-flipbox ps-flipbox" />
            <Sun />
            <Moon />
            <span className="in-l-light">Ver en noche</span>
            <span className="in-l-dark">Ver en claro</span>
          </label>
        )}
      </figcaption>
    </figure>
  )
}
