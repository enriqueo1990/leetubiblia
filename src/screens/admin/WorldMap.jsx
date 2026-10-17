import { useMemo, useRef, useState } from 'react'
import worldMap from './worldMap.json'
import { countryName, formatCount } from './format.js'

// Mapa coroplético de usuarios por país. Las formas vienen pre-proyectadas
// (scripts/gen-admin-map.mjs): acá solo se pintan. Magnitud = un solo tono en
// tres pasos (--ramp-1..3, admin.css) con cortes logarítmicos, porque pocos
// países concentran casi todo; "sin usuarios" queda en el gris de la pista.

// Cortes por orden de magnitud: con máximo 50 → 1–3 · 4–13 · 14–50.
function binsFor(max) {
  if (max <= 1) return [1, 1]
  if (max === 2) return [1, 2]
  const a = Math.max(1, Math.round(max ** (1 / 3)))
  const b = Math.max(a + 1, Math.round(max ** (2 / 3)))
  return [a, Math.min(b, max - 1)]
}

const RAMP = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)']
const EMPTY = 'var(--segment-track)'

export default function WorldMap({ counts, ariaLabel }) {
  const wrap = useRef(null)
  const [hover, setHover] = useState(null) // { id, x, y }
  const max = Math.max(0, ...Object.values(counts))
  const [a, b] = binsFor(max)
  const fill = (n) => (!n ? EMPTY : n <= a ? RAMP[0] : n <= b ? RAMP[1] : RAMP[2])

  // El país señalado se dibuja último para que su contorno no quede tapado.
  const ordered = useMemo(() => {
    if (!hover) return worldMap.countries
    return [...worldMap.countries.filter((c) => c.id !== hover.id), ...worldMap.countries.filter((c) => c.id === hover.id)]
  }, [hover])

  const legend =
    max === 0
      ? []
      : [
          { color: RAMP[0], label: a === 1 ? '1' : `1–${a}` },
          ...(b > a ? [{ color: RAMP[1], label: b === a + 1 ? `${b}` : `${a + 1}–${b}` }] : []),
          ...(max > b ? [{ color: RAMP[2], label: max === b + 1 ? `${max}` : `${b + 1}–${formatCount(max)}` }] : []),
        ]

  const onMove = (e, id) => {
    const box = wrap.current.getBoundingClientRect()
    setHover({ id, x: e.clientX - box.left, y: e.clientY - box.top })
  }

  return (
    <div>
      <div ref={wrap} className="relative" onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${worldMap.w} ${worldMap.h}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
          {ordered.map((c) => {
            const on = hover?.id === c.id
            return (
              <path
                key={c.id}
                d={c.d}
                fill={fill(counts[c.id])}
                stroke={on ? 'var(--text-primary)' : 'var(--surface)'}
                strokeWidth={on ? 1.2 : 0.6}
                strokeLinejoin="round"
                onPointerMove={(e) => onMove(e, c.id)}
                onPointerDown={(e) => onMove(e, c.id)}
              />
            )
          })}
        </svg>
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-[10px] px-2.5 py-1.5"
            style={{
              left: Math.min(Math.max(hover.x, 70), (wrap.current?.clientWidth || 140) - 70),
              top: hover.y,
              transform: 'translate(-50%, calc(-100% - 12px))',
              backgroundColor: 'var(--surface)',
              boxShadow: 'var(--shadow-card), 0 0 0 1px var(--hairline)',
            }}
          >
            <p className="text-[14px] font-semibold leading-tight text-ink">
              {formatCount(counts[hover.id] || 0)} {counts[hover.id] === 1 ? 'usuario' : 'usuarios'}
            </p>
            <p className="text-[12px] leading-tight text-ink-soft">{countryName(hover.id)}</p>
          </div>
        ) : null}
      </div>
      {legend.length ? (
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-soft">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: EMPTY }} />
            sin usuarios
          </li>
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 tabular-nums">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
