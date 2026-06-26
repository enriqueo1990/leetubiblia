import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { getPlans, todayLocalISO } from '../../lib/db.js'

// Elegir plan de lectura en el onboarding (documento maestro §5.3 / §5.8).
// Set active_plan_id + plan_start_date = hoy (local). El cambio de plan ya con
// progreso existente, con su confirmación, se maneja en Tarea 4.
function planDurationLabel(days) {
  if (days === 365) return 'Un año'
  if (days === 31) return '31 días'
  return `${days} días`
}

export default function ChoosePlanOnboarding() {
  const { updateProfile } = useAuth()
  const [plans, setPlans] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getPlans()
      .then((p) => {
        setPlans(p)
        if (p.length) setSelected(p[0].id)
      })
      .catch((e) => setError(e.message))
  }, [])

  async function handleStart() {
    if (!selected || saving) return
    setSaving(true)
    const { error } = await updateProfile({
      active_plan_id: selected,
      plan_start_date: todayLocalISO(),
    })
    setSaving(false)
    if (error) setError('No se pudo activar el plan. Probá de nuevo.')
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        Elegí un plan
      </h1>
      <p className="mt-2 text-[16px] text-ink-soft">Un plan activo a la vez.</p>

      <div className="mt-6 flex-1 space-y-3">
        {error && <p className="text-[14px]" style={{ color: '#D1453B' }}>{error}</p>}
        {plans === null && <p className="text-[15px] text-ink-soft">Cargando planes…</p>}

        {plans?.map((p) => {
          const active = p.id === selected
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className="w-full rounded-card p-4 text-left transition-colors duration-200"
              style={{
                backgroundColor: 'var(--surface)',
                border: active ? '1.5px solid var(--accent)' : '1px solid var(--hairline)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[18px] font-semibold text-ink">{p.name}</span>
                <span className="text-[13px] text-ink-soft">
                  {planDurationLabel(p.duration_days)}
                </span>
              </div>
              {p.description && (
                <p className="mt-1 text-[14px] text-ink-soft">{p.description}</p>
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={!selected || saving}
        className="btn btn-primary mt-4"
        style={{ opacity: !selected || saving ? 0.5 : 1 }}
        onClick={handleStart}
      >
        {saving ? 'Activando…' : 'Empezar'}
      </button>
    </div>
  )
}
