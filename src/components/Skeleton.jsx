// Placeholder de carga: barras/tarjetas atenuadas con pulso suave (respeta
// prefers-reduced-motion vía la regla global de index.css). Mejor percepción de
// velocidad que un "Cargando…" plano. aria-hidden: es puramente visual.
export function SkeletonCards({ count = 3 }) {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="card p-4 animate-pulse"
          style={{ height: 70 }}
        >
          <div
            className="rounded-pill"
            style={{ width: '55%', height: 14, backgroundColor: 'var(--surface-alt)' }}
          />
          <div
            className="mt-2.5 rounded-pill"
            style={{ width: '30%', height: 11, backgroundColor: 'var(--surface-alt)' }}
          />
        </li>
      ))}
    </ul>
  )
}
