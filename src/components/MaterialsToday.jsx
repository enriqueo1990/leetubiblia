import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { activeMaterials, getMaterial, loadMaterialContent } from '../lib/materials.js'
import { ChevronRight } from './icons.jsx'

// Sección "Mis otras lecturas" de la pantalla Hoy. Aparece SOLO si el usuario activó
// algún material (si no, no renderiza nada → Hoy queda igual que siempre). Cada
// material es una tarjeta compacta que lleva a su vista de lectura (/materiales/:slug),
// también al estar completado (repasar / volver a empezar viven en el lector, con
// confirmación — acá no hay acciones destructivas).
export default function MaterialsToday() {
  const { profile } = useAuth()
  const { t } = usePreferences()
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
    <div className="mt-8">
      <p className="mb-2 text-[13px] font-medium text-ink-soft">{t('materialsToday.otherReadings')}</p>

      {/* Una sola card agrupada (filas + hairline), no una card por material:
          menos alto total — clave para que Hoy entre en una pantalla — y menos
          cajas apiladas. */}
      <div className="card divide-y divide-hairline">
        {list.map((m) => {
          const content = contents[m.slug]
          if (!content) return null // aún cargando: no ocupa lugar
          const done = m.position > content.total
          const entry = done ? null : content.entries[m.position - 1]

          return (
            <Link
              key={m.slug}
              to={`/materiales/${m.slug}`}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              {/* Nombre corto del catálogo: la fila entra en una línea en 375px
                  (el nombre completo vive en el lector). */}
              <span className="block min-w-0 flex-1 truncate text-[16px] text-ink">
                {getMaterial(m.slug)?.shortName ?? content.name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-[13px] tabular-nums text-ink-soft">
                  {done ? (
                    <>
                      <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
                      {t('materialsToday.completed')}
                    </>
                  ) : (
                    t('materialsToday.questionOf', { n: entry?.number ?? m.position, total: content.total })
                  )}
                </span>
                <span className="text-ink-soft" style={{ opacity: 0.5 }}>
                  <ChevronRight size={18} />
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
