import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { activeMaterials, loadMaterialContent } from '../lib/materials.js'
import { ChevronRight } from './icons.jsx'

// Sección "Mis otras lecturas" de la pantalla Hoy. Aparece SOLO si el usuario activó
// algún material (si no, no renderiza nada → Hoy queda igual que siempre). Cada
// material es una tarjeta compacta que lleva a su vista de lectura (/materiales/:slug),
// también al estar completado (repasar / volver a empezar viven en el lector, con
// confirmación — acá no hay acciones destructivas).
export default function MaterialsToday() {
  const { profile } = useAuth()
  const list = activeMaterials(profile)

  // Contenido cargado por slug (import dinámico, cacheado en materials.js).
  const [contents, setContents] = useState({})
  const activeKey = list.map((m) => m.slug).join(',')

  useEffect(() => {
    let on = true
    Promise.all(list.map((m) => loadMaterialContent(m.slug))).then((loaded) => {
      if (!on) return
      const next = {}
      loaded.forEach((c) => {
        if (c) next[c.slug] = c
      })
      setContents(next)
    })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  if (list.length === 0) return null

  return (
    <div className="mt-10">
      <p className="mb-3 text-[13px] font-medium text-ink-soft">Mis otras lecturas</p>

      <div className="space-y-3">
        {list.map((m) => {
          const content = contents[m.slug]
          if (!content) return null // aún cargando: no ocupa lugar
          const done = m.position > content.total
          const entry = done ? null : content.entries[m.position - 1]

          return (
            <Link
              key={m.slug}
              to={`/materiales/${m.slug}`}
              className="card flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-[16px] text-ink">{content.name}</span>
                <span className="mt-0.5 block text-[13px] text-ink-soft">
                  {done ? (
                    <>
                      <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
                      Completado
                    </>
                  ) : (
                    `Pregunta ${entry?.number ?? m.position} de ${content.total}`
                  )}
                </span>
              </span>
              <span className="shrink-0 text-ink-soft" style={{ opacity: 0.5 }}>
                <ChevronRight size={18} />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
