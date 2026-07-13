import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { activeMaterials, getMaterial, loadMaterialContent } from '../lib/materials.js'
import { ChevronRight } from './icons.jsx'

// Descarte del aviso de descubrimiento: por dispositivo, una sola vez.
const HINT_KEY = 'ltb.materialsHint.dismissed'

// Sección "Mis otras lecturas" de la pantalla Hoy. Aparece SOLO si el usuario activó
// algún material (si no, en su lugar va UNA línea descartable que cuenta que los
// materiales existen — sin ella la feature solo vive en Ajustes y nadie la encuentra).
// Cada material es una tarjeta compacta que lleva a su vista de lectura
// (/materiales/:slug), también al estar completado (repasar / volver a empezar viven
// en el lector, con confirmación — acá no hay acciones destructivas).
export default function MaterialsToday() {
  const { profile } = useAuth()
  const { t } = usePreferences()
  const list = activeMaterials(profile)
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === '1'
    } catch {
      return true // sin storage no hay forma de recordar el descarte: mejor no insistir
    }
  })

  function dismissHint() {
    setHintDismissed(true)
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      /* queda descartado en esta sesión */
    }
  }

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

  if (list.length === 0) {
    // Descubrimiento discreto (misma voz que el aviso de atraso de Hoy: una
    // línea en tinta suave, acción implícita, descarte apenas presente).
    if (!profile || hintDismissed) return null
    return (
      <div className="mt-8 flex items-center">
        <Link
          to="/materiales"
          state={{ from: { to: '/', label: t('nav.hoy') } }}
          className="min-w-0 py-2 text-[13px] text-ink-soft"
        >
          {t('materialsToday.hint')}{' '}
          <span className="font-semibold" style={{ color: 'var(--accent-ink)' }}>
            {t('materialsToday.hintCta')} ›
          </span>
        </Link>
        <button
          type="button"
          onClick={dismissHint}
          aria-label={t('materialsToday.hintDismiss')}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center text-[15px] leading-none text-ink-soft"
          style={{ opacity: 0.5 }}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('materialsToday.otherReadings')}
        </p>
        <span
          className="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: 'var(--accent-ink)', backgroundColor: 'var(--accent-tint)' }}
        >
          {t('materialsToday.materialLabel')}
        </span>
      </div>

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
              <span className="block min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium text-ink">
                  {getMaterial(m.slug)?.shortName ?? content.name}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-ink-soft">
                  {t('materialsToday.materialMeta')}
                </span>
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
