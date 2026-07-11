import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import {
  MATERIALS,
  isMaterialActive,
  positionOf,
  loadMaterialContent,
  withMaterialActivated,
  withMaterialDeactivated,
} from '../lib/materials.js'
import Switch from '../components/Switch.jsx'
import BackLink from '../components/BackLink.jsx'
import { usePreferences } from '../lib/preferences.jsx'

// Materiales de lectura opcionales — catálogo con toggles (Ajustes › Materiales).
// Fila estilo iOS con doble affordance (como Wi-Fi en Settings): el toggle activa/
// desactiva, y cuando está activo el cuerpo de la fila navega al lector — así
// activar no es un callejón sin salida y siempre hay camino directo a leer.
export default function Materiales() {
  const { profile, updateProfile } = useAuth()
  const { t } = usePreferences()
  const [saveError, setSaveError] = useState(false)
  // Total por slug (para mostrar "Completado" cuando el marcador pasó el final).
  const [totals, setTotals] = useState({})

  const activeSlugs = MATERIALS.filter((m) => isMaterialActive(profile, m.slug))
    .map((m) => m.slug)
    .join(',')

  useEffect(() => {
    let on = true
    const active = activeSlugs ? activeSlugs.split(',') : []
    Promise.all(active.map((slug) => loadMaterialContent(slug))).then((loaded) => {
      if (!on) return
      const next = {}
      loaded.forEach((c) => {
        if (c) next[c.slug] = c.total
      })
      setTotals(next)
    })
    return () => {
      on = false
    }
  }, [activeSlugs])

  async function toggle(slug) {
    setSaveError(false)
    const next = isMaterialActive(profile, slug)
      ? withMaterialDeactivated(profile, slug)
      : withMaterialActivated(profile, slug)
    const { error } = await updateProfile({ active_materials: next })
    if (error) setSaveError(true)
  }

  return (
    <div className="pt-2">
      <BackLink to="/ajustes" label={t('nav.ajustes')} />

      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('ajustes.materialesDeLectura')}</h1>
      <p className="mt-2 px-1 text-[14px] text-ink-soft">
        {t('materiales.subtitle')}
      </p>

      <div className="mt-6 space-y-3">
        {MATERIALS.map((m) => {
          const on = isMaterialActive(profile, m.slug)
          const position = on ? positionOf(profile, m.slug) : null
          const total = totals[m.slug]
          const done = on && total != null && position > total
          const body = (
            <>
              <p className="text-[16px] font-medium text-ink">{m.name}</p>
              {on ? (
                <p className="mt-1 text-[13px] font-medium" style={{ color: 'var(--accent-ink)' }}>
                  {done ? `✓ ${t('materiales.completedReview')}` : t('materiales.onQuestion', { n: position })} ›
                </p>
              ) : (
                <p className="mt-1 text-[13px] text-ink-soft">{m.description}</p>
              )}
            </>
          )
          return (
            <div key={m.slug} className="card flex items-start justify-between gap-3 p-4">
              {on ? (
                // Activo: el cuerpo navega al lector (drill-in), el toggle apaga.
                <Link
                  to={`/materiales/${m.slug}`}
                  state={{ from: { to: '/materiales', label: t('nav.materiales') } }}
                  className="min-w-0 flex-1"
                >
                  {body}
                </Link>
              ) : (
                <div className="min-w-0 flex-1">{body}</div>
              )}
              <div className="shrink-0 pt-0.5">
                <Switch on={on} onChange={() => toggle(m.slug)} label={m.name} />
              </div>
            </div>
          )
        })}
      </div>
      {saveError && (
        <p className="mt-2 px-1 text-[13px]" style={{ color: 'var(--danger)' }}>
          {t('common.saveError')}
        </p>
      )}
    </div>
  )
}
