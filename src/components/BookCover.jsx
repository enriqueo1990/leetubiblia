import { useEffect } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import { materialTheme } from '../lib/materialTheme.js'
import { BRAND_SERIF, ensureBrandFont } from '../lib/brandFont.js'

// Tapa de un material, como un libro de una colección: su color, el lomo más
// oscuro a la izquierda, el tipo arriba ("Catecismo") y el título en Newsreader.
// La misma identidad que la imagen que se comparte, para que se reconozcan.
// size: 'lg' (estante, con año y cantidad), 'sm' (para agregar), 'xs' (la ficha
// de Hoy: solo el título, chico), 'thumb' (solo color y lomo).
export default function BookCover({ slug, size = 'lg', meta = null, className = '', style = null }) {
  const { t } = usePreferences()
  const th = materialTheme(slug)
  useEffect(() => {
    if (size !== 'thumb') ensureBrandFont()
  }, [size])

  const radius = size === 'thumb' ? '2px 4px 4px 2px' : '6px 10px 10px 6px'
  const shadow = size === 'thumb' ? '0 1px 2px rgba(0,0,0,.18)' : '0 1px 2px rgba(0,0,0,.12), 0 8px 18px rgba(40,25,10,.14)'

  return (
    <div
      className={`relative flex overflow-hidden ${className}`}
      style={{ aspectRatio: '3 / 4', borderRadius: radius, backgroundColor: th.c, color: th.ink, boxShadow: `${shadow}, var(--cover-ring)`, ...style }}
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
      {(size === 'lg' || size === 'sm') && (
        <span className={`flex min-w-0 flex-1 flex-col ${size === 'lg' ? 'px-[12%] pb-[11%] pt-[14%]' : 'px-[11%] pb-[12%] pt-[14%]'}`}>
          {th.kind && (
            <span
              className="font-semibold uppercase"
              style={{ color: th.acc, fontSize: size === 'lg' ? 9 : 7.5, letterSpacing: size === 'lg' ? 1.6 : 1.2, lineHeight: 1.2 }}
            >
              {t(`library.kind.${th.kind}`)}
            </span>
          )}
          <span
            className="mt-auto"
            style={{
              fontFamily: BRAND_SERIF,
              fontWeight: 500,
              fontSize: size === 'lg' ? 21 : 15,
              lineHeight: 1.06,
              letterSpacing: -0.3,
              textWrap: 'balance',
            }}
          >
            {th.title}
          </span>
          {size === 'lg' && meta && (
            <span className="mt-2 text-[0.625rem] leading-tight" style={{ color: th.soft }}>
              {meta}
            </span>
          )}
        </span>
      )}
    </div>
  )
}
