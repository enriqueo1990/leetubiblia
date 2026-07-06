import { useEffect, useRef } from 'react'
import Sheet from './Sheet.jsx'

// Índice de un material (catecismo): los bloques temáticos con sus preguntas, en el
// lenguaje de listas agrupadas de la app (mismo patrón que Ajustes: etiqueta de
// sección + card con filas divididas por hairline — el idioma de iOS Settings).
//
// Reglas del marcador secuencial: leídas y la actual son tappables (salto directo);
// las futuras se ven apagadas — se muestra el camino, pero no se saltea. La actual
// se marca solo con color acento (el color dice el estado; sin negritas ni checks).
// Abre centrado en la pregunta actual.
export default function MaterialIndexSheet({ content, frontier, current, onPick, onClose }) {
  // Las entradas vienen aplanadas y en orden: re-agrupar por bloque para los títulos.
  const blocks = []
  for (const e of content.entries) {
    const prev = blocks[blocks.length - 1]
    if (!prev || prev.title !== e.blockTitle) blocks.push({ title: e.blockTitle, items: [e] })
    else prev.items.push(e)
  }

  const currentRef = useRef(null)
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <Sheet title="Índice" onCancel={onClose}>
      {blocks.map((b) => (
        <div key={b.title ?? 'bloque'} className="mb-6">
          {b.title && (
            <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              {b.title}
            </p>
          )}
          <div className="card divide-y divide-hairline">
            {b.items.map((e) => {
              const locked = e.number > frontier
              const isCurrent = e.number === current
              return (
                <button
                  key={e.number}
                  ref={isCurrent ? currentRef : undefined}
                  type="button"
                  disabled={locked}
                  onClick={() => onPick(e.number)}
                  className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left"
                  style={{ opacity: locked ? 0.4 : 1 }}
                >
                  <span className="w-7 shrink-0 text-right text-[13px] tabular-nums text-ink-soft">
                    {e.number}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-[15px] text-ink"
                    style={isCurrent ? { color: 'var(--accent)' } : undefined}
                  >
                    {e.question}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </Sheet>
  )
}
