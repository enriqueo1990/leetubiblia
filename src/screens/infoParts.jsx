import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useClientSide } from './landingHydration.js'
import { InAppBrowserBand, InstallNowButton } from './landingKit.jsx'
import { getInstallPlatform } from '../lib/platform.js'
import BrandMark from '../components/BrandMark.jsx'
import { INFO_FAQ } from './infoCopy.js'

// Piezas de /info que no son el demo ni el kit compartido: íconos, la Biblia
// ilustrada, la instalación guiada y el FAQ. Se renderizan en Node al prerenderizar
// (ver src/prerender.jsx): nada de window/localStorage al renderizar; lo que depende
// del aparato se lee tras hidratar (useClientSide).

// ── Íconos: un solo sprite (stroke = currentColor) ───────────────────────────
const SPRITE = `
<symbol id="in-i-book" viewBox="0 0 24 24"><path d="M12 6.5C10.2 5.2 7.8 4.7 4 5v12c3.8-.3 6.2.2 8 1.5m0-12c1.8-1.3 4.2-1.8 8-1.5v12c-3.8-.3-6.2.2-8 1.5m0-12v12"/></symbol>
<symbol id="in-i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="in-i-heart" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.600-7 10-7 10z"/></symbol>
<symbol id="in-i-people" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3"/><path d="M3.500 19c.4-3 2.600-4.600 5.500-4.600s5.100 1.600 5.500 4.600"/><circle cx="17" cy="9.500" r="2.300"/><path d="M16.500 14.600c2.400-.2 3.800 1 4.200 3.400"/></symbol>
<symbol id="in-i-pencil" viewBox="0 0 24 24"><path d="M4 20l1-4L16.500 4.500a2.100 2.100 0 013 3L8 19z"/></symbol>
<symbol id="in-i-bell" viewBox="0 0 24 24"><path d="M6 16.500V11a6 6 0 0112 0v5.500l1.500 1.500h-15zM10 20.500a2.200 2.200 0 004 0"/></symbol>
<symbol id="in-i-lock" viewBox="0 0 24 24"><rect x="5" y="10.500" width="14" height="9.500" rx="2.500"/><path d="M8 10.500V8a4 4 0 018 0v2.500"/></symbol>
<symbol id="in-i-wifi" viewBox="0 0 24 24"><path d="M3 9.500a14 14 0 0118 0M6 13a9.500 9.500 0 0112 0M9.200 16.400a5 5 0 015.600 0M12 20h.01M4 4l16 16"/></symbol>
<symbol id="in-i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400"/></symbol>
<symbol id="in-i-moon" viewBox="0 0 24 24"><path d="M20 14.500A8 8 0 019.500 4 8 8 0 1020 14.500z"/></symbol>
<symbol id="in-i-text" viewBox="0 0 24 24"><path d="M4 19l5-13 5 13M6 14.500h6M16 19l3-8 3 8M17 16.500h4"/></symbol>
<symbol id="in-i-down" viewBox="0 0 24 24"><path d="M12 5v14m-6-6l6 6 6-6"/></symbol>
<symbol id="in-i-chart" viewBox="0 0 24 24"><path d="M5 20V11M12 20V5M19 20v-6"/></symbol>
`

export function InfoSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  )
}

export function Ico({ name, className = '' }) {
  return (
    <svg className={`in-ico ${className}`} aria-hidden="true">
      <use href={`#in-i-${name}`} />
    </svg>
  )
}

// ── Biblia de papel (ilustración propia, SVG) ────────────────────────────────
// Libro abierto con «texto» abstracto (barras, nada legible) y la cinta. Todo con
// los tokens de la página, así que cambia con el tema y el acento.
const ROWS = [138, 151.2, 164.4, 177.6, 190.8, 204, 217.2, 230.4, 243.6, 256.8, 276, 289.2, 302.4]
// Ancho de cada renglón por columna (las filas 0 y 11 son títulos de 40,5).
const COLS = {
  left: [
    [74, [40.5, 90, 90, 82.8, 64.8, 90, 90, 87.3, 77.4, 90, 90, 40.5, 77.4]],
    [176, [40.5, 90, 77.4, 90, 90, 90, 82.8, 82.8, 90, 90, 90, 40.5, 77.4]],
  ],
  right: [
    [334, [40.5, 82.8, 90, 87.3, 77.4, 90, 90, 64.8, 64.8, 77.4, 90, 40.5, 77.4]],
    [436, [40.5, 77.4, 82.8, 90, 90, 90, 77.4, 87.3, 90, 90, 82.8, 40.5, 90]],
  ],
}

function TextBars({ cols }) {
  return cols.map(([x, widths]) =>
    widths.map((w, i) => {
      const head = i === 0 || i === 11
      return head ? (
        <rect key={`${x}-${i}`} x={x} y={ROWS[i]} width={w} height="4.6" rx="1.6" fill="var(--text-primary)" opacity=".55" />
      ) : (
        <rect key={`${x}-${i}`} x={x} y={ROWS[i]} width={w} height="3.2" rx="1.6" fill="var(--in-faint)" />
      )
    })
  )
}

export function PaperBible() {
  return (
    <figure className="in-bible in-rv" aria-label="Ilustración: una Biblia de papel abierta con su cinta marcapáginas">
      <svg viewBox="0 0 600 420" aria-hidden="true">
        <defs>
          <linearGradient id="in-gut" x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset=".5" stopColor="#000" stopOpacity=".16" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="in-cov" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--accent-action) 78%, #0b1b2b)' }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--accent-action) 55%, #0b1b2b)' }} />
          </linearGradient>
          <filter id="in-sh" filterUnits="userSpaceOnUse" x="0" y="320" width="600" height="100">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>
        <ellipse cx="300" cy="376" rx="248" ry="20" fill="#102a43" opacity=".28" filter="url(#in-sh)" />
        {/* tapa */}
        <path d="M34 118 C 136 98, 232 108, 300 140 C 368 108, 464 98, 566 118 L566 340 C 464 322, 368 334, 300 368 C 232 334, 136 322, 34 340 Z" fill="url(#in-cov)" />
        {/* cantos de páginas */}
        <path d="M46 322 C 150 306, 240 316, 298 346 L298 354 C 240 324, 150 314, 46 330 Z" fill="var(--surface-alt)" stroke="var(--hairline)" />
        <path d="M554 322 C 450 306, 360 316, 302 346 L302 354 C 360 324, 450 314, 554 330 Z" fill="var(--surface-alt)" stroke="var(--hairline)" />
        <path d="M46 314 C 150 298, 240 308, 298 338 L298 346 C 240 316, 150 306, 46 322 Z" fill="var(--surface)" stroke="var(--hairline)" />
        <path d="M554 314 C 450 298, 360 308, 302 338 L302 346 C 360 316, 450 306, 554 322 Z" fill="var(--surface)" stroke="var(--hairline)" />
        {/* páginas */}
        <path d="M50 98 C 150 82, 240 92, 298 122 L298 338 C 240 308, 150 298, 50 314 Z" fill="var(--surface)" stroke="var(--hairline)" />
        <path d="M550 98 C 450 82, 360 92, 302 122 L302 338 C 360 308, 450 298, 550 314 Z" fill="var(--surface)" stroke="var(--hairline)" />
        {/* texto abstracto: dos columnas por página */}
        <g transform="skewY(2.4)">
          <g transform="translate(0,-18)">
            <TextBars cols={COLS.left} />
          </g>
        </g>
        <g transform="skewY(-2.4)">
          <g transform="translate(0,34)">
            <TextBars cols={COLS.right} />
          </g>
        </g>
        {/* lomo */}
        <path d="M258 108 C 280 116, 292 124, 300 128 C 308 124, 320 116, 342 108 L342 320 C 320 330, 308 338, 300 344 C 292 338, 280 330, 258 320 Z" fill="url(#in-gut)" />
        {/* cinta marcapáginas */}
        <g className="in-ribbon-sway">
          <path d="M310 118 L328 118 L328 398 L319 386 L310 398 Z" fill="var(--accent)" />
          <path d="M310 118 L316 118 L316 397 L310 398 Z" fill="#000" opacity=".14" />
        </g>
      </svg>
      <div className="in-bible-tag" aria-hidden="true">
        Hoy en tu app
        <b>
          Génesis <span>8 · 9 · 10 · 11</span>
        </b>
      </div>
    </figure>
  )
}

// ── Instalación guiada ───────────────────────────────────────────────────────
// Pestañas iPhone | Android con radios nativos y CSS (funciona sin JS; sin JS queda
// iPhone). Tras hidratar se marca el aparato real: en Android se abre su pestaña, y
// el aparato (o «ya instalada», o «estás en la compu») se señala con una etiqueta.
export function InstallGuide() {
  const platform = useClientSide(getInstallPlatform)
  const root = useRef(null)
  const touched = useRef(false)

  useEffect(() => {
    if (platform !== 'android' || touched.current) return
    const tab = root.current?.querySelector('.in-tab-and')
    if (tab) tab.checked = true
  }, [platform])

  const here = (target) => (platform === target ? <span className="in-here">Tu teléfono</span> : null)

  return (
    <div className="in-tabs" ref={root}>
      {/* Desde el navegador de Instagram/Facebook/TikTok no se instala: se avisa acá también. */}
      <InAppBrowserBand inline />
      {/* Android/Chrome: el navegador ofrece instalar con un toque. Los pasos siguen debajo. */}
      <InstallNowButton className="in-installnow" />
      <div className="in-tab-labels" role="radiogroup" aria-label="Tu teléfono" onChange={() => (touched.current = true)}>
        <label className="in-tab">
          <input type="radio" name="in-plat" className="in-tab-ios" defaultChecked />
          iPhone{here('ios')}
        </label>
        <label className="in-tab">
          <input type="radio" name="in-plat" className="in-tab-and" />
          Android{here('android')}
        </label>
      </div>

      <div className="in-panel in-p-ios">
        <ol className="in-isteps">
          <li>
            <div>
              <b>Abrí esta página en Safari.</b>
              <small>¿Venís de Instagram o Facebook? Tocá ⋯ y elegí «Abrir en Safari».</small>
            </div>
          </li>
          <li>
            <div>
              <b>Tocá Compartir y «Agregar a pantalla de inicio».</b>
            </div>
          </li>
          <li>
            <div>
              <b>Abrila desde el ícono y creá tu cuenta ahí.</b>
              <small>Así tu cuenta queda en la app y te llegan los recordatorios.</small>
            </div>
          </li>
        </ol>
      </div>
      <div className="in-panel in-p-and">
        <ol className="in-isteps">
          <li>
            <div>
              <b>Abrí esta página en Chrome.</b>
              <small>¿Venís de Instagram o Facebook? Tocá ⋮ y elegí «Abrir en el navegador».</small>
            </div>
          </li>
          <li>
            <div>
              <b>Tocá «Instalar» (o ⋮ y «Instalar app»).</b>
            </div>
          </li>
          <li>
            <div>
              <b>Abrila desde el ícono y creá tu cuenta.</b>
            </div>
          </li>
        </ol>
      </div>

      <p className={`in-callout ${platform === 'desktop' || platform === 'installed' ? 'in-here-now' : ''}`}>
        <Ico name="sun" />
        {platform === 'installed' ? (
          <span>
            <b>Ya la tenés instalada.</b> Abrila desde el ícono de tu pantalla de inicio.
          </span>
        ) : (
          <span>
            <b>¿Estás en la compu?</b> No hace falta instalar nada: usala en el navegador, y la instalás en el teléfono
            cuando quieras.
          </span>
        )}
      </p>
    </div>
  )
}

// Ícono de la app sobre una pantalla de inicio abstracta (decorativo).
export function InstallArt() {
  return (
    <div className="in-icon-art in-rv in-rv-2" aria-hidden="true">
      <div className="in-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className="in-app">
        <BrandMark size={200} />
      </div>
      <span className="in-lab">Lee Tu Biblia</span>
    </div>
  )
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
// <details> nativos. El mismo texto se publica como FAQPage en el <head> (infoCopy,
// bibliotecaCopy). `items` por defecto es el de /info; otras landings pasan el suyo.
export function FaqList({ items = INFO_FAQ }) {
  return (
    <div className="in-faq in-rv">
      {items.map((item) => (
        <details key={item.q} open={item.open || undefined}>
          <summary>
            {item.q}
            <span className="in-pm">
              <Ico name="plus" />
            </span>
          </summary>
          <div className="in-ans">
            {item.a.map((part, i) =>
              typeof part === 'string' ? (
                part
              ) : (
                <Link key={i} to={part.to} className="lk-textlink">
                  {part.text}
                </Link>
              )
            )}
          </div>
        </details>
      ))}
    </div>
  )
}
