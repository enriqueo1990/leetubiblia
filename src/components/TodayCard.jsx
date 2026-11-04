import { BRAND_SERIF } from '../lib/brandFont.js'

// "Tu día": lo que sigue después de leer, en una sola tarjeta con filas. Cada
// fila es una invitación, no una obligación: sin marcas de "te faltó". Una fila
// hecha lleva el círculo lleno; una pendiente, el círculo vacío y un chevron.
// `rows`: [{ key, done, title, sub, serif, onClick }]. Sin onClick la fila es
// solo lectura (por ejemplo "Leíste tu lectura").
export default function TodayCard({ rows, className = '' }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      {rows.map((row) => {
        const inner = (
          <>
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={
                row.done
                  ? { backgroundColor: 'var(--accent-action)' }
                  : { boxShadow: 'inset 0 0 0 1.6px var(--faint)' }
              }
            >
              {row.done && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1">
              {row.serif ? (
                <span className="line-clamp-2 text-[16px] italic leading-snug text-ink" style={{ fontFamily: BRAND_SERIF }}>
                  {row.title}
                </span>
              ) : (
                <span className={`block text-[16px] leading-tight ${row.done ? 'font-medium text-ink-soft' : 'font-semibold text-ink'}`}>
                  {row.title}
                </span>
              )}
              {row.sub && <span className="mt-0.5 line-clamp-1 text-[13px] leading-snug text-ink-soft">{row.sub}</span>}
            </span>
            {row.onClick && (
              <span aria-hidden="true" className="text-[20px] leading-none" style={{ color: 'var(--faint)' }}>
                ›
              </span>
            )}
          </>
        )
        const cls = 'flex w-full items-center gap-3.5 px-4 py-3.5 text-left border-t border-hairline first:border-t-0'
        return row.onClick ? (
          <button key={row.key} type="button" onClick={row.onClick} className={`${cls} min-h-[60px]`}>
            {inner}
          </button>
        ) : (
          <div key={row.key} className={cls}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
