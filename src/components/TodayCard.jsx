import { BRAND_SERIF } from '../lib/brandFont.js'
import { CheckIcon, RowChevron } from './icons.jsx'

// "Tu día": lo que sigue después de leer, en una sola tarjeta con filas. Cada
// fila es una invitación, no una obligación: sin marcas de "te faltó". Una fila
// hecha lleva el círculo lleno; una pendiente, el círculo vacío y un chevron.
// `rows`: [{ key, done, title, sub, serif, onClick, a11yLabel, describeTitle }].
// `a11yLabel` es lo que dice el lector de pantalla de una fila tocable (qué
// hace al tocarla); con `describeTitle` el texto visible queda como descripción
// (útil cuando es largo, como una nota). Sin onClick la fila es
// solo lectura (por ejemplo la oración ya hecha). «Leíste tu lectura» sí lleva
// onClick: es la puerta a desmarcar.
export default function TodayCard({ rows, footer = null, className = '' }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      {rows.map((row) => {
        const inner = (
          <>
            {row.icon ? (
              // Una invitación sin "hecho/pendiente" (compartir): su ícono en
              // lugar del círculo.
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-soft">
                {row.icon}
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={
                  row.done
                    ? { backgroundColor: 'var(--accent-action)' }
                    : { boxShadow: 'inset 0 0 0 1.6px var(--control-border)' }
                }
              >
                {row.done && (
                  <CheckIcon size={13} stroke="#fff" strokeWidth={3} />
                )}
              </span>
            )}
            <span className="min-w-0 flex-1">
              {row.serif ? (
                <span
                  id={row.describeTitle ? `today-row-${row.key}-title` : undefined}
                  className="line-clamp-2 text-[1rem] italic leading-snug text-ink"
                  style={{ fontFamily: BRAND_SERIF }}
                >
                  {row.title}
                </span>
              ) : (
                <span className={`block text-[1rem] leading-tight ${row.done ? 'font-medium text-ink-soft' : row.icon ? 'font-medium text-ink' : 'font-semibold text-ink'}`}>
                  {row.title}
                </span>
              )}
              {row.sub && <span className="mt-0.5 line-clamp-1 text-[0.8125rem] leading-snug text-ink-soft">{row.sub}</span>}
            </span>
            {row.onClick && (
              <RowChevron />
            )}
          </>
        )
        const cls = 'flex w-full items-center gap-3.5 px-4 py-3.5 text-left border-t border-hairline first:border-t-0'
        return row.onClick ? (
          <button
            key={row.key}
            type="button"
            onClick={row.onClick}
            aria-label={row.a11yLabel}
            aria-describedby={row.a11yLabel && row.describeTitle ? `today-row-${row.key}-title` : undefined}
            className={`${cls} min-h-[60px]`}
          >
            {inner}
          </button>
        ) : (
          <div key={row.key} className={cls}>
            {inner}
          </div>
        )
      })}
      {/* Pie: el cierre del día, adentro de la tarjeta (no flota suelto). */}
      {footer && (
        <div className="border-t border-hairline px-4 py-3.5 text-[0.9375rem] leading-snug" style={{ backgroundColor: 'var(--accent-tint)' }}>
          {footer}
        </div>
      )}
    </div>
  )
}
