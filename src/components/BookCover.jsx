import { useEffect } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import { materialTheme } from '../lib/materialTheme.js'
import { BRAND_SERIF, ensureBrandFont } from '../lib/brandFont.js'
import { MOTIFS, RING } from './coverMotifs.js'

// Tapa de un material, como un libro de una colección: su color, el lomo más
// oscuro a la izquierda, el tipo arriba ("Catecismo") y el título en Newsreader.
// La misma identidad que la imagen que se comparte, para que se reconozcan.
// size: 'hero' (la portada al abrir el libro en el lector: marco fino, el
// emblema de la obra, y `meta` como pie en itálica), 'lg' (estante, con el
// emblema, el año y la cantidad), 'sm' (para agregar, también con el emblema), 'xs' (la ficha de Hoy: solo el título,
// chico), 'thumb' (solo color y lomo).
export default function BookCover({ slug, size = 'lg', meta = null, className = '', style = null }) {
  const { t } = usePreferences()
  const th = materialTheme(slug)
  useEffect(() => {
    if (size !== 'thumb') ensureBrandFont()
  }, [size])

  if (size === 'hero') return <HeroCover th={th} meta={meta} kind={th.kind ? t(`library.kind.${th.kind}`) : null} className={className} style={style} />

  const radius = size === 'thumb' ? '2px 4px 4px 2px' : '6px 10px 10px 6px'
  const shadow = size === 'thumb' ? '0 1px 2px rgba(0,0,0,.18)' : '0 1px 2px rgba(0,0,0,.12), 0 8px 18px rgba(40,25,10,.14)'
  const lg = size === 'lg'

  return (
    <div
      className={`relative flex overflow-hidden ${className}`}
      // Las medidas del texto van en % del ancho (container query): la misma tapa
      // sirve en el estante de dos o tres columnas y en la vista previa, y la
      // palabra más larga del título ("Westminster", "Confesiones") nunca se corta.
      style={{ aspectRatio: '3 / 4', containerType: 'inline-size', borderRadius: radius, backgroundColor: th.c, color: th.ink, boxShadow: `${shadow}, var(--cover-ring)`, ...style }}
      aria-hidden={size === 'thumb' ? 'true' : undefined}
    >
      <span className="h-full shrink-0" style={{ width: '9%', backgroundColor: th.spine }} />
      <span className="absolute inset-y-0" style={{ left: '9%', width: 1.5, backgroundColor: 'rgba(255,255,255,.12)' }} />
      {size === 'xs' && (
        <span
          lang="es"
          className="flex min-w-0 flex-1 items-end px-[10%] pb-[12%]"
          style={{ fontFamily: BRAND_SERIF, fontWeight: 500, fontSize: 8.5, lineHeight: 1.08, hyphens: 'auto', overflowWrap: 'break-word' }}
        >
          {th.title}
        </span>
      )}
      {(lg || size === 'sm') && (
        <span className={`flex min-w-0 flex-1 flex-col ${lg ? 'px-[12%] pb-[11%] pt-[14%]' : 'px-[11%] pb-[12%] pt-[14%]'}`}>
          {th.kind && (
            <span
              className="font-semibold uppercase"
              style={{ color: th.acc, fontSize: lg ? 'max(7px, 5.4cqi)' : 'max(6.5px, 7cqi)', letterSpacing: '0.16em', lineHeight: 1.2 }}
            >
              {t(`library.kind.${th.kind}`)}
            </span>
          )}
          {MOTIFS[th.motif] && (
            <span className="flex min-h-0 flex-1 items-center py-[5%]">
              <Emblem motif={MOTIFS[th.motif]} color={th.acc} bold style={{ width: lg ? '46%' : '48%', maxHeight: '100%' }} align="xMinYMid" />
            </span>
          )}
          <span
            className="mt-auto"
            style={{
              fontFamily: BRAND_SERIF,
              fontWeight: 500,
              fontSize: `${titleCqi(th.title, lg ? 12.7 : 14.3)}cqi`,
              lineHeight: 1.06,
              letterSpacing: '-0.015em',
              textWrap: 'balance',
            }}
          >
            {th.title}
          </span>
          {lg && meta && (
            <span className="mt-[6%] leading-tight" style={{ color: th.soft, fontSize: 'max(9px, 6cqi)' }}>
              {meta}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

// Tamaño del título en % del ancho de la tapa: el de base, salvo que la palabra
// más larga no entre en el ancho útil (≈ 66 % de la tapa, en Newsreader).
function titleCqi(title, base) {
  const longest = Math.max(...String(title).split(/\s+/).map((w) => w.length))
  return Math.min(base, 138 / longest)
}

// La tapa grande del lector: la misma identidad que en el estante, con el
// acabado de una tapa de verdad (marco fino estampado, el motivo del material).
// Las medidas van en % del ancho (container query) para que escale entero.
function HeroCover({ th, meta, kind, className, style }) {
  return (
    <div
      className={`relative flex overflow-hidden ${className}`}
      style={{
        aspectRatio: '3 / 4',
        containerType: 'inline-size',
        borderRadius: '6px 12px 12px 6px',
        backgroundColor: th.c,
        color: th.ink,
        boxShadow: '0 1px 2px rgba(0,0,0,.12), 0 18px 36px rgba(80,45,15,.22), var(--cover-ring)',
        ...style,
      }}
      aria-hidden="true"
    >
      <span className="h-full shrink-0" style={{ width: '9%', backgroundColor: th.spine }} />
      <span className="absolute inset-y-0" style={{ left: '9%', width: 1.5, backgroundColor: 'rgba(255,255,255,.14)' }} />
      <span
        className="pointer-events-none absolute"
        style={{ top: '4%', right: '5%', bottom: '4%', left: '14%', border: `1px solid ${th.acc}`, opacity: 0.45, borderRadius: '2px 6px 6px 2px' }}
      />
      <span className="relative flex min-w-0 flex-1 flex-col items-center px-[9%] pb-[11%] pt-[12%] text-center">
        {kind && (
          <span className="font-bold uppercase" style={{ color: th.acc, fontSize: '5cqi', letterSpacing: '0.2em', lineHeight: 1.2 }}>
            {kind}
          </span>
        )}
        {MOTIFS[th.motif] && (
          <span className="flex min-h-0 w-full flex-1 items-center justify-center">
            <Emblem motif={MOTIFS[th.motif]} color={th.acc} style={{ width: '54%', maxHeight: '100%' }} />
          </span>
        )}
        <span
          className="mt-auto"
          style={{ fontFamily: BRAND_SERIF, fontWeight: 500, fontSize: '14.5cqi', lineHeight: 1.02, letterSpacing: '-0.01em', textWrap: 'balance' }}
        >
          {th.title}
        </span>
        {meta && (
          <span className="mt-[6%]" style={{ fontFamily: BRAND_SERIF, fontStyle: 'italic', fontSize: '6.4cqi', color: th.soft }}>
            {meta}
          </span>
        )}
      </span>
    </div>
  )
}

// El emblema de la tapa: el sello de la obra (coverMotifs.js) dentro de su
// medallón, en el color del acento. `bold` engrosa el trazo para las tapas
// chicas del estante, donde el sombreado fino se perdería.
function Emblem({ motif, color, bold = false, style, align = 'xMidYMid' }) {
  return (
    <svg viewBox="0 0 120 120" preserveAspectRatio={`${align} meet`} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={RING.main} strokeWidth={bold ? 2 : 1.5} />
      <path d={RING.thin} strokeWidth={bold ? 1.1 : 0.9} />
      <path d={motif.main} strokeWidth={bold ? 2.4 : 1.8} />
      {motif.thin && <path d={motif.thin} strokeWidth={bold ? 1.3 : 1} />}
      {motif.fill && <path d={motif.fill} fill={color} stroke="none" />}
    </svg>
  )
}
