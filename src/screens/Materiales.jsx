import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import {
  MATERIALS,
  getMaterial,
  currentEntryLabel,
  isMaterialActive,
  positionOf,
  readOnOf,
  loadMaterialContent,
  withMaterialActivated,
  withMaterialDeactivated,
} from '../lib/materials.js'
import Switch from '../components/Switch.jsx'
import BackLink from '../components/BackLink.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import InlineError from '../components/InlineError.jsx'
import { usePreferences } from '../lib/preferences.jsx'

// Materiales de lectura opcionales — catálogo con toggles (Hoy › Lecturas › Materiales).
// Fila estilo iOS con doble affordance (como Wi-Fi en Settings): el toggle activa/
// desactiva, y cuando está activo el cuerpo de la fila navega al lector — así
// activar no es un callejón sin salida y siempre hay camino directo a leer.
export default function Materiales() {
  const { profile, updateProfile } = useAuth()
  const { t, locale } = usePreferences()
  // Guardado de un material: cuál está guardando, cuál falló y cuál espera la
  // confirmación de apagado (el error y el estado viven junto a SU tarjeta).
  const [savingSlug, setSavingSlug] = useState(null)
  const [failedSlug, setFailedSlug] = useState(null)
  const [confirmOff, setConfirmOff] = useState(null)
  // Total por slug (para mostrar "Completado" cuando el marcador pasó el final).
  const [totals, setTotals] = useState({})

  const activeSlugs = MATERIALS.filter((m) => isMaterialActive(profile, m.slug))
    .map((m) => m.slug)
    .join(',')

  useEffect(() => {
    let on = true
    const active = activeSlugs ? activeSlugs.split(',') : []
    Promise.all(active.map((slug) => loadMaterialContent(slug).catch(() => null)))
      .then((loaded) => {
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

  // Apagar un material borra su marcador (al reactivar vuelve a empezar): si hay
  // avance, se pide confirmación antes de tirarlo por un toque accidental.
  function hasProgress(slug) {
    return (positionOf(profile, slug) ?? 1) > 1 || !!readOnOf(profile, slug)
  }

  async function toggle(slug, { confirmed = false } = {}) {
    const turningOff = isMaterialActive(profile, slug)
    if (turningOff && !confirmed && hasProgress(slug)) {
      setConfirmOff(slug)
      return
    }
    setConfirmOff(null)
    setFailedSlug(null)
    setSavingSlug(slug)
    const next = turningOff
      ? withMaterialDeactivated(profile, slug)
      : withMaterialActivated(profile, slug)
    const { error } = await updateProfile({ active_materials: next })
    setSavingSlug(null)
    if (error) setFailedSlug(slug)
  }

  return (
    <div className="pt-2">
      <BackLink to="/lecturas" label={t('nav.lecturas')} />

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
              {locale !== 'es' && (
                <p className="mt-0.5 text-[12px] text-ink-soft">{t('materiales.inSpanish')}</p>
              )}
              {on ? (
                <p className="mt-1 text-[13px] font-medium" style={{ color: 'var(--accent-ink)' }}>
                  {done ? `✓ ${t('materiales.completedReview')}` : currentEntryLabel(t, m.slug, position, locale)} ›
                </p>
              ) : (
                <p className="mt-1 text-[13px] text-ink-soft">{m.description}</p>
              )}
            </>
          )
          return (
            <div key={m.slug} className="card flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                {on ? (
                  // Activo: el cuerpo navega al lector (drill-in), el toggle apaga.
                  <Link
                    to={`/materiales/${m.slug}`}
                    state={{ from: { to: '/materiales', label: t('nav.materiales') } }}
                    className="block"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
                {failedSlug === m.slug && <InlineError message={t('common.saveError')} />}
              </div>
              <div className="shrink-0 pt-0.5">
                <Switch
                  on={on}
                  onChange={() => toggle(m.slug)}
                  label={m.name}
                  disabled={savingSlug === m.slug}
                />
              </div>
            </div>
          )
        })}
      </div>
      {confirmOff && (
        <ConfirmDialog
          title={getMaterial(confirmOff)?.name ?? ''}
          message={t('materiales.confirmOff')}
          confirmLabel={t('materiales.turnOff')}
          danger
          onConfirm={() => toggle(confirmOff, { confirmed: true })}
          onCancel={() => setConfirmOff(null)}
        />
      )}
    </div>
  )
}
