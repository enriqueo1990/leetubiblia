// Placeholders de carga con pulso suave (respeta prefers-reduced-motion vía
// la regla global de index.css). aria-hidden: son puramente visuales.

const bar = (w, h, extra = {}) => (
  <div
    className="rounded-pill"
    style={{ width: w, height: h, backgroundColor: 'var(--surface-alt)', ...extra }}
  />
)

export function SkeletonCards({ count = 3 }) {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="card animate-pulse p-4" style={{ height: 70 }}>
          {bar('55%', 14)}
          <div className="mt-2.5">{bar('30%', 11)}</div>
        </li>
      ))}
    </ul>
  )
}

export function SkeletonRows({ count = 5 }) {
  return (
    <div className="card animate-pulse divide-y divide-hairline" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3">
          {bar(40, 11, { marginTop: 2, flexShrink: 0 })}
          <div className="flex-1">{bar('65%', 12)}</div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonHoy() {
  return (
    <div className="animate-pulse pt-2" aria-hidden="true">
      <div className="flex items-baseline justify-between">
        {bar(130, 11)}
        {bar(60, 11)}
      </div>
      <div className="mt-2">{bar('50%', 14)}</div>
      <div className="mt-[58px]">{bar(100, 11)}</div>
      <div className="mt-5 space-y-2">
        {bar('62%', 32)}
        {bar('45%', 32)}
      </div>
    </div>
  )
}

export function SkeletonDetail() {
  return (
    <div className="animate-pulse pt-2" aria-hidden="true">
      {bar(80, 12)}
      <div className="mt-3">{bar('68%', 26)}</div>
      <div className="mt-2">{bar('42%', 13)}</div>
      <div className="card mt-6 space-y-3 p-4">
        {bar('38%', 11)}
        {bar('55%', 20)}
        {bar('75%', 11)}
      </div>
      <div className="card mt-4 space-y-2 p-4">
        {bar('52%', 13)}
        {bar('28%', 11)}
      </div>
    </div>
  )
}
