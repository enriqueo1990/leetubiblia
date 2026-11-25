import { useEffect } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import { materialTheme } from '../lib/materialTheme.js'
import { BRAND_SERIF, ensureBrandFont } from '../lib/brandFont.js'

// Tapa de un material, como un libro de una colección: su color, el lomo más
// oscuro a la izquierda, el tipo arriba ("Catecismo") y el título en Newsreader.
// La misma identidad que la imagen que se comparte, para que se reconozcan.
// size: 'hero' (la portada al abrir el libro en el lector: marco fino, motivo
// si el material lo tiene, y `meta` como pie en itálica), 'lg' (estante, con año
// y cantidad), 'sm' (para agregar), 'xs' (la ficha de Hoy: solo el título,
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
        {MOTIFS[th.motif] && <Motif color={th.acc}>{MOTIFS[th.motif]}</Motif>}
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

// El motivo de cada tapa: un dibujo alusivo a la obra, en trazo fino del color
// del acento y siempre en la misma caja (74×40), para que la colección se vea
// pareja aunque cada libro tenga su propio emblema.
function Motif({ color, children }) {
  return (
    <svg viewBox="0 0 74 40" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40%', marginTop: '14%' }}>
      {children}
    </svg>
  )
}

const MOTIFS = {
  // Lecturas matutinas: sol naciente.
  sunrise: (
    <>
      <path d="M4 36h66" />
      <path d="M19 36a18 18 0 0136 0" />
      <path d="M37 8v-6M21 14l-4-4M53 14l4-4M12 26l-6-2M62 26l6-2" />
    </>
  ),
  // Lecturas vespertinas: luna creciente con dos estrellas.
  moon: (
    <>
      <path d="M44 6a15 15 0 1 0 10 25A12 12 0 0 1 44 6z" />
      <path d="M16 12v6M13 15h6M62 9v4M60 11h4" />
    </>
  ),
  // Didajé: "hay dos caminos, uno de la vida y otro de la muerte".
  twoWays: (
    <>
      <path d="M37 38v-11c0-6-9-10-19-21M37 27c0-6 9-10 19-21" />
      <path d="M12 38h50" />
      <path d="M33 38v-1M41 38v-1" />
    </>
  ),
  // Credos de la iglesia antigua: el crismón (ji-ro) entre alfa y omega.
  chiRho: (
    <>
      <path d="M37 4v34M37 4h4a5 5 0 0 1 0 10h-4" />
      <path d="M29 12l16 20M45 12L29 32" />
      <path d="M10 30l4-12 4 12M11.5 26h5" />
      <path d="M55 30h3.5a6 6 0 1 1 7 0H69" />
    </>
  ),
  // Confesiones: el corazón encendido de Agustín ("inquieto está nuestro corazón").
  flamingHeart: (
    <>
      <path d="M37 37C25 29 23 21 28 18c3.5-2 7 0 9 3 2-3 5.5-5 9-3 5 3 3 11-9 19z" />
      <path d="M37 15c-2.5-3-1-6.5 0-10 1 3.5 2.5 7 0 10zM30 15c-2-2-1.5-4.5-.5-6.5M44 15c2-2 1.5-4.5.5-6.5" />
    </>
  ),
  // Lutero: la rosa de Lutero (corazón con la cruz, sobre la rosa).
  lutherRose: (
    <>
      <path d="M29.5 10.7A7.5 7.5 0 1 1 44.5 10.7A7.5 7.5 0 1 1 49.1 24.9A7.5 7.5 0 1 1 37 33.7A7.5 7.5 0 1 1 24.9 24.9A7.5 7.5 0 1 1 29.5 10.7z" />
      <path d="M37 29c-6-4-7.5-8-5.5-10.5 1.6-1.8 4-1.3 5.5.7 1.5-2 3.9-2.5 5.5-.7 2 2.5.5 6.5-5.5 10.5z" />
      <path d="M37 18.5v7M34.5 21.5h5" />
    </>
  ),
  // Confesión Belga: el muro del castillo de Tournai, por donde Guido de Brès
  // arrojó la confesión en 1561.
  castle: (
    <>
      <path d="M22 37V15h4v-4h4v4h4.5v-4h5v4H44v-4h4v4h4v22" />
      <path d="M33.5 37v-8a3.5 3.5 0 0 1 7 0v8" />
      <path d="M12 37h50M27 21v3M47 21v3" />
    </>
  ),
  // Heidelberg: el ancla, por su "único consuelo" (la esperanza como ancla del alma).
  anchor: (
    <>
      <circle cx="37" cy="6" r="3" />
      <path d="M37 9v28M30 14h14" />
      <path d="M24 24a13 13 0 0 0 26 0M24 24l-2.5 3.5M24 24l4 1M50 24l2.5 3.5M50 24l-4 1" />
    </>
  ),
  // Calvino: el corazón ofrecido en la mano ("mi corazón te ofrezco, Señor").
  offeredHeart: (
    <>
      <path d="M37 26c-7-4.5-8.5-9.5-6-12.5 2-2.2 4.6-1.6 6 .8 1.4-2.4 4-3 6-.8 2.5 3 1 8-6 12.5z" />
      <path d="M37 9V5M29 11l-2.5-2.5M45 11l2.5-2.5" />
      <path d="M17 26c4 7 11 11 20 11s16-4 20-11M17 26c-1.5-1.5-3-1.5-4 0M57 26c1.5-1.5 3-1.5 4 0" />
    </>
  ),
  // Dort: el tulipán (los cinco puntos de la gracia).
  tulip: (
    <>
      <path d="M30 9l3.5 4.5L37 7l3.5 6.5L44 9v7a7 7 0 0 1-14 0z" />
      <path d="M37 23v15" />
      <path d="M37 33c-6 0-10-3.5-11-9 5 .5 9 3.5 11 9zM37 30c5.5-.5 9-3.5 10-8-5 .5-8.5 3.5-10 8z" />
    </>
  ),
  // Confesión de Westminster: el ventanal ojival de la abadía.
  gothicArch: (
    <>
      <path d="M26 38V21c0-8 5-14 11-18 6 4 11 10 11 18v17" />
      <path d="M37 38V25M30 38V25c0-4 3-7 7-8.5 4 1.5 7 4.5 7 8.5v13" />
      <circle cx="37" cy="11.5" r="2.5" />
      <path d="M20 38h34" />
    </>
  ),
  // Catecismo Menor de Westminster: la corona ("glorificar a Dios y gozar de él").
  crown: (
    <>
      <path d="M24 32l-2-17 8 7 7-11 7 11 8-7-2 17z" />
      <path d="M24 36.5h26" />
      <circle cx="22" cy="13" r="1.4" />
      <circle cx="37" cy="9" r="1.4" />
      <circle cx="52" cy="13" r="1.4" />
    </>
  ),
  // Catecismo Mayor de Westminster: las tablas de la ley (su gran exposición
  // de los diez mandamientos).
  tablets: (
    <>
      <path d="M22 37V13a7 7 0 0 1 14 0v24zM38 37V13a7 7 0 0 1 14 0v24z" />
      <path d="M26 17h6M26 22h6M26 27h6M26 32h6M42 17h6M42 22h6M42 27h6M42 32h6" />
    </>
  ),
  // Catecismo para Niños Pequeños: la casa con el corazón (la fe enseñada en familia).
  home: (
    <>
      <path d="M20 22L37 8l17 14" />
      <path d="M24 19v18h26V19" />
      <path d="M37 32c-5-3-6.2-6.2-4.5-8.2 1.3-1.5 3.3-1 4.5.8 1.2-1.8 3.2-2.3 4.5-.8 1.7 2 .5 5.2-4.5 8.2z" />
      <path d="M45 12V8h3v6.5" />
    </>
  ),
  // Bautista de 1689: el agua del bautismo.
  waters: (
    <>
      <path d="M37 4c-3 4.5-6 8.5-6 12a6 6 0 0 0 12 0c0-3.5-3-7.5-6-12z" />
      <path d="M8 29c4.5-3.5 9-3.5 13.5 0s9 3.5 13.5 0 9-3.5 13.5 0 9 3.5 13.5 0" />
      <path d="M15 35c4.5-3.5 9-3.5 13.5 0s9 3.5 13.5 0 9-3.5 13.5 0" />
    </>
  ),
  // Keach: la pluma (el catecismo que escribió para las iglesias).
  quill: (
    <>
      <path d="M52 4C42 6 32 15 30 28c9-2 19-11 22-24z" />
      <path d="M52 4L23 36M36 21l5 1M33 25l4 .5" />
      <path d="M16 37h16" />
    </>
  ),
  // New Hampshire: las montañas Blancas.
  mountains: (
    <>
      <path d="M8 37l17-22 7 9 10-14 24 27" />
      <path d="M21 20l4 2.5 4-2.5M38 15.5l4 2.5 4-3" />
      <path d="M4 37h66" />
      <circle cx="58" cy="9" r="3" />
    </>
  ),
  // Catecismo de Spurgeon: el frente del Tabernáculo Metropolitano.
  temple: (
    <>
      <path d="M17 14L37 5l20 9z" />
      <path d="M20 17.5h34M22 18v16M29.5 18v16M37 18v16M44.5 18v16M52 18v16" />
      <path d="M18 34.5h38M15 38h44" />
    </>
  ),
  // El peregrino: el camino que sube a la Ciudad Celestial, en lo alto.
  pilgrimPath: (
    <>
      <path d="M20 38c4-5 14-6 14-11s-10-5-8-10 7-4 12-5" />
      <path d="M40 12V6h4v6M44 12V2.5L46.5 1 49 2.5V12M49 12V5h4v7M53 12V7.5h4V12M38 12h21" />
      <path d="M62 4l3-2M63 9h4" />
      <path d="M8 38h58" />
    </>
  ),
  // Spurgeon para Niños: el barrilete al viento.
  kite: (
    <>
      <path d="M46 3l10 11-10 14-10-14z" />
      <path d="M46 3v25M36 14h20" />
      <path d="M46 28c-2 4-6 4-9 6.5s-7 3.5-12 2.5" />
      <path d="M38 32.5l-1.5 3M31 36l-.5 3" />
      <path d="M8 20c3-2.5 6-2.5 9 0M14 12c2-1.6 4-1.6 6 0" />
    </>
  ),
}
