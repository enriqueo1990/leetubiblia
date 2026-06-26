import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { getPlans, todayLocalISO } from '../lib/db.js'

// Selección / cambio de plan (documento maestro §5.3, README pantalla 3).
// Cambiar de plan arranca el nuevo desde el día 1 (plan_start_date = hoy); el
// histórico de progreso anterior NO se borra, pero no se transfiere.
function durationLabel(days) {
  if (days === 365) return 'Un año'
  if (days === 31) return '31 días'
  return `${days} días`
}

export default function Planes() {
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState(null)
  const [confirm, setConfirm] = useState(null) // plan pendiente de confirmar
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPlans().then(setPlans).catch(() => setPlans([]))
  }, [])

  const activeId = profile?.active_plan_id ?? null

  async function applyPlan(plan) {
    setSaving(true)
    await updateProfile({
      active_plan_id: plan.id,
      plan_start_date: todayLocalISO(),
    })
    setSaving(false)
    setConfirm(null)
    navigate('/')
  }

  function onPick(plan) {
    if (plan.id === activeId) return
    // Si ya hay un plan activo, confirmar el reinicio; si no, aplicar directo.
    if (activeId) setConfirm(plan)
    else applyPlan(plan)
  }

  const activeName = plans?.find((p) => p.id === activeId)?.name

  return (
    <div className="pt-2">
      <Link to="/" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
        ‹ Hoy
      </Link>
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">Planes</h1>
      <p className="mt-2 text-[16px] text-ink-soft">Un plan activo a la vez.</p>

      <div className="mt-5 space-y-3">
        {plans === null && <p className="text-[15px] text-ink-soft">Cargando…</p>}
        {plans?.map((p) => {
          const active = p.id === activeId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="w-full rounded-card p-4 text-left transition-colors duration-200"
              style={{
                backgroundColor: 'var(--surface)',
                border: active ? '1.5px solid var(--accent)' : '1px solid var(--hairline)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[18px] font-semibold text-ink">{p.name}</span>
                {active ? (
                  <span
                    className="rounded-pill px-2 py-0.5 text-[12px] font-medium"
                    style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-tint)' }}
                  >
                    Plan activo
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-soft">{durationLabel(p.duration_days)}</span>
                )}
              </div>
              {p.description && <p className="mt-1 text-[14px] text-ink-soft">{p.description}</p>}
            </button>
          )
        })}
      </div>

      {/* Confirmación de cambio */}
      {confirm && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center px-8"
          style={{ backgroundColor: 'var(--scrim)' }}
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-[320px] rounded-container p-5 text-center"
            style={{ backgroundColor: 'var(--surface)', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-bold text-ink">¿Cambiar a {confirm.name}?</h2>
            <p className="mt-2 text-[14px] text-ink-soft">
              El plan nuevo arranca desde el día 1. Tu progreso{activeName ? ` de ${activeName}` : ''} queda
              guardado, pero no se transfiere.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => setConfirm(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={saving}
                onClick={() => applyPlan(confirm)}
              >
                {saving ? '…' : 'Cambiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
