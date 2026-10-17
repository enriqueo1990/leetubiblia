import { useLayoutEffect, useRef, useState } from 'react'
import { formatCount } from './format.js'

// Gráficos del panel (/admin). SVG a mano, sin dependencias, medidos en píxeles
// reales (ResizeObserver) para que el texto y las puntas redondeadas no se
// deformen. Un solo tono: el acento del usuario para las marcas, los tokens de
// texto para todo lo escrito y filetes hairline para ejes y grilla.

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(Math.round(el.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// Marcas de eje limpias (1·2·5 × 10ⁿ), enteras: son conteos de personas.
function niceTicks(max, count = 3) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw))
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return ticks
}

// Columna con punta redondeada (4px) y base recta sobre la línea de base.
function columnPath(x, yTop, w, h) {
  const r = Math.min(4, w / 2, h)
  const b = yTop + h
  return `M${x},${b}V${yTop + r}A${r},${r} 0 0 1 ${x + r},${yTop}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${yTop + r}V${b}Z`
}

// Tooltip: el valor manda, la etiqueta acompaña.
function Tooltip({ x, y, width, value, label }) {
  const left = Math.min(Math.max(x, 70), Math.max(70, width - 70))
  return (
    <div
      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-[10px] px-2.5 py-1.5"
      style={{
        left,
        top: y,
        transform: 'translate(-50%, calc(-100% - 8px))',
        backgroundColor: 'var(--surface)',
        boxShadow: 'var(--shadow-card), 0 0 0 1px var(--hairline)',
      }}
      role="status"
    >
      <p className="text-[14px] font-semibold leading-tight text-ink">{value}</p>
      <p className="text-[12px] leading-tight text-ink-soft">{label}</p>
    </div>
  )
}

const AXIS = { fontSize: 11, fill: 'var(--placeholder)' }

// Columnas verticales con eje Y, etiquetas abajo y tooltip por columna (puntero
// y flechas del teclado). data: [{ label, value, tip, tick? }]. tick: texto bajo
// la columna (si falta, no se rotula esa posición). valueOnCap: número sobre cada
// columna — solo para pocas columnas.
export function ColumnChart({ data, height = 150, ariaLabel, valueOnCap = false, valueLabel = (v) => formatCount(v) }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const padL = valueOnCap ? 0 : 30
  const padT = valueOnCap ? 20 : 8
  const padB = 22
  const max = Math.max(0, ...data.map((d) => d.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const plotW = Math.max(0, width - padL)
  const plotH = height - padT - padB
  const band = data.length ? plotW / data.length : 0
  // La columna nunca llena su franja: lo que sobra es aire entre columnas.
  const bw = Math.max(2, Math.min(valueOnCap ? 40 : 24, band * 0.62))
  const y = (v) => padT + plotH - (v / top) * plotH
  const cx = (i) => padL + band * i + band / 2

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - box.left - padL) / band)
    setHover(i >= 0 && i < data.length ? i : null)
  }
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : -1
    setHover((h) => Math.min(data.length - 1, Math.max(0, (h ?? (step > 0 ? -1 : data.length)) + step)))
  }

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[6px]"
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {!valueOnCap &&
            ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke="var(--hairline)" strokeWidth={1} opacity={t === 0 ? 1 : 0.6} />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" style={AXIS} className="tabular-nums">
                  {formatCount(t)}
                </text>
              </g>
            ))}
          {valueOnCap ? <line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke="var(--hairline)" strokeWidth={1} /> : null}
          {data.map((d, i) => {
            const h = Math.max(0, y(0) - y(d.value))
            const x = cx(i) - bw / 2
            const dim = hover != null && hover !== i
            return (
              <g key={i}>
                {h > 0 ? (
                  <path
                    d={columnPath(x, y(d.value), bw, h)}
                    fill="var(--accent)"
                    opacity={dim ? 0.45 : 1}
                    style={{ transition: 'opacity 150ms' }}
                  />
                ) : null}
                {valueOnCap ? (
                  <text x={cx(i)} y={y(d.value) - 6} textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--text-primary)' }}>
                    {valueLabel(d.value)}
                  </text>
                ) : null}
                {d.tick ? (
                  // En columnas angostas, la primera y la última etiqueta se
                  // alinean al borde para no salirse del gráfico.
                  <text
                    x={valueOnCap ? cx(i) : i === 0 ? x : i === data.length - 1 ? x + bw : cx(i)}
                    y={height - 6}
                    textAnchor={valueOnCap ? 'middle' : i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                    style={AXIS}
                  >
                    {d.tick}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hover != null && data[hover] ? (
        <Tooltip x={cx(hover)} y={y(data[hover].value)} width={width} value={valueLabel(data[hover].value)} label={data[hover].tip} />
      ) : null}
    </div>
  )
}

// Área de una sola serie (línea 2px + lavado al 10%) con mira vertical que se
// pega al día más cercano. data: [{ label, value }]. Eje desde cero: el área
// habla de magnitud y no puede exagerar el crecimiento.
export function AreaChart({ data, height = 140, ariaLabel, valueLabel = (v) => formatCount(v) }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const padL = 34
  const padT = 10
  const padB = 22
  const n = data.length
  const max = Math.max(0, ...data.map((d) => d.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const plotW = Math.max(0, width - padL - 6)
  const plotH = height - padT - padB
  const x = (i) => padL + (n > 1 ? (plotW * i) / (n - 1) : plotW / 2)
  const y = (v) => padT + plotH - (v / top) * plotH
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('')
  const area = n ? `${line}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : ''
  const last = n - 1
  const shown = hover ?? last

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - box.left - padL) / Math.max(1, plotW)) * (n - 1))
    setHover(Math.min(n - 1, Math.max(0, i)))
  }
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : -1
    setHover((h) => Math.min(n - 1, Math.max(0, (h ?? last) + step)))
  }

  return (
    <div ref={ref} className="relative">
      {width > 0 && n ? (
        <svg
          width={width}
          height={height}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[6px]"
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke="var(--hairline)" strokeWidth={1} opacity={t === 0 ? 1 : 0.6} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" style={AXIS} className="tabular-nums">
                {formatCount(t)}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--accent)" opacity={0.12} />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <text x={x(0)} y={height - 6} textAnchor="start" style={AXIS}>
            {data[0].label}
          </text>
          <text x={x(last)} y={height - 6} textAnchor="end" style={AXIS}>
            {data[last].label}
          </text>
          {hover != null ? (
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={y(0)} stroke="var(--text-soft)" strokeWidth={1} opacity={0.5} />
          ) : null}
          <circle cx={x(shown)} cy={y(data[shown].value)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hover != null && data[hover] ? (
        <Tooltip x={x(hover)} y={y(data[hover].value)} width={width} value={valueLabel(data[hover].value)} label={data[hover].label} />
      ) : null}
    </div>
  )
}

// Medidor de una proporción: relleno en acento sobre una pista del mismo tono,
// más clara, para que se lea la parte y el todo.
export function Meter({ ratio, label }) {
  const pctValue = Math.round(Math.min(1, Math.max(0, ratio || 0)) * 100)
  return (
    <div
      className="h-[6px] overflow-hidden rounded-full"
      style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 18%, var(--surface))' }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pctValue}
      aria-label={label}
    >
      <div className="h-full rounded-full" style={{ width: `${pctValue}%`, backgroundColor: 'var(--accent)' }} />
    </div>
  )
}

// Variación contra el período anterior: flecha + número firmado. Subir es bueno
// en todo lo que mide el panel; el color va en el texto de acento o neutro.
export function Delta({ now, before, period }) {
  if (before == null) return null
  const diff = now - before
  const up = diff > 0
  const flat = diff === 0
  return (
    <p className="mt-1 text-[12px] font-medium" style={{ color: up ? 'var(--accent-ink)' : 'var(--text-soft)' }}>
      <span aria-hidden="true">{flat ? '＝' : up ? '▲' : '▼'}</span>{' '}
      {flat ? 'igual' : `${up ? '+' : '−'}${formatCount(Math.abs(diff))}`} vs {period}
    </p>
  )
}
