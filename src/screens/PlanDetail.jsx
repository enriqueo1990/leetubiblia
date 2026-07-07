import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { getPlan, getPlanDays, startDateForDay, todayLocalISO, markDaysRead } from '../lib/db.js'
import { useReading } from '../hooks/useReading.js'
import ResumeFromDay from '../components/ResumeFromDay.jsx'
import { SkeletonRows } from '../components/Skeleton.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

// Detalle de un plan: descripción, duración, listado completo día-por-día con sus
// pasajes, y acción de activar. Mismo estilo que el resto (drill-in iOS).
function durationLabel(days) {
  if (days === 365) return 'Un año · 365 días'
  if (days === 31) return '31 días'
  return `${days} días`
}

export default function PlanDetail() {
  const { id } = useParams()
  const planId = Number(id)
  const { user, profile, updateProfile } = useAuth()
  const r = useReading() // progreso del plan ACTIVO (para resaltar dónde vas leyendo)
  const navigate = useNavigate()

  const [plan, setPlan] = useState(null)
  const [days, setDays] = useState(null)
  const [resumeDay, setResumeDay] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const todayRef = useRef(null)
  const scrolled = useRef(false)

  useEffect(() => {
    let on = true
    Promise.all([getPlan(planId), getPlanDays(planId)])
      .then(([p, d]) => {
        if (!on) return
        setPlan(p)
        setDays(d)
      })
      .catch(() => on && setDays([]))
    return () => {
      on = false
    }
  }, [planId])

  const isActive = profile?.active_plan_id === planId
  // Día en el que el usuario va leyendo: el mismo ancla que "Hoy" (primer día sin
  // leer, o el de calendario si va atrasado). Solo para su plan activo.
  const currentDay = isActive ? r.displayDay : null

  // Al cargar los días, centrar en pantalla dónde vas leyendo (una sola vez).
  useEffect(() => {
    if (scrolled.current || !days || currentDay == null) return
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: 'center' })
      scrolled.current = true
    }
  }, [days, currentDay])

  async function activate() {
    setSaving(true)
    const planStart = resumeDay ? startDateForDay(resumeDay) : todayLocalISO()
    const { error } = await updateProfile({ active_plan_id: planId, plan_start_date: planStart })
    // Engancharse a mitad de plan: dar por leídos los días anteriores (1..N−1).
    if (!error && resumeDay && resumeDay > 1 && user) {
      try {
        await markDaysRead(user.id, planId, resumeDay - 1)
      } catch {
        // No es bloqueante: el plan ya quedó activo en el día correcto.
      }
    }
    setSaving(false)
    setConfirm(false)
    navigate('/')
  }

  function onActivateClick() {
    if (isActive) return navigate('/')
    // Si ya hay otro plan activo, confirmar el reinicio.
    if (profile?.active_plan_id) setConfirm(true)
    else activate()
  }

  return (
    <div className="pt-2">
      <Link to="/planes" className="text-[15px] font-medium" style={{ color: 'var(--accent-ink)' }}>
        ‹ Planes
      </Link>

      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">
        {plan?.name || 'Plan'}
      </h1>
      {plan && (
        <p className="mt-1 text-[13px] text-ink-soft">{durationLabel(plan.duration_days)}</p>
      )}
      {plan?.description && (
        <p className="mt-3 text-[16px] text-ink-soft">{plan.description}</p>
      )}

      {/* Engancharse a un plan ya empezado (solo si aún no es el activo) */}
      {!isActive && plan && (
        <div className="mt-5">
          <ResumeFromDay
            durationDays={plan.duration_days}
            day={resumeDay}
            onChange={setResumeDay}
          />
        </div>
      )}

      {/* Acción */}
      <button
        type="button"
        onClick={onActivateClick}
        disabled={saving}
        className={`btn mt-5 ${isActive ? 'btn-secondary' : 'btn-primary'}`}
      >
        {isActive ? 'Ir a Hoy' : saving ? 'Activando…' : 'Usar este plan'}
      </button>
      {isActive && (
        <p className="mt-2 text-center text-[13px]" style={{ color: 'var(--accent-ink)' }}>
          Es tu plan activo
        </p>
      )}

      {/* Listado día-por-día */}
      <p className="mb-2 mt-8 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
        Lecturas por día
      </p>
      {days === null && <SkeletonRows count={6} />}
      <ol className="card divide-y divide-hairline">
        {days?.map((d) => {
          const isCurrent = d.day_number === currentDay
          const read = isActive && r.completed.has(d.day_number)
          return (
            <li
              key={d.day_number}
              ref={isCurrent ? todayRef : undefined}
              className="flex gap-3 px-4 py-3"
              style={isCurrent ? { backgroundColor: 'var(--accent-tint)' } : undefined}
            >
              <span
                className="w-12 shrink-0 pt-0.5 text-[12px] font-semibold uppercase tracking-wide"
                style={{ color: isCurrent || read ? 'var(--accent-ink)' : 'var(--text-soft)' }}
              >
                Día {d.day_number}
              </span>
              <span className="flex-1 text-[15px] text-ink">
                {d.refs.map((ref, i) => (
                  <span key={i}>
                    {ref.label}
                    {i < d.refs.length - 1 && <span className="text-ink-soft"> · </span>}
                  </span>
                ))}
              </span>
              {read && (
                <span
                  className="shrink-0 pt-0.5 text-[15px] font-bold"
                  style={{ color: 'var(--accent-ink)' }}
                  aria-label="Leído"
                >
                  ✓
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {confirm && (
        <ConfirmDialog
          title={`¿Cambiar a ${plan?.name}?`}
          message={
            resumeDay
              ? `El plan nuevo arranca desde el día ${resumeDay}. Tu progreso anterior se guarda aparte.`
              : 'El plan nuevo arranca desde el día 1. Tu progreso anterior se guarda aparte.'
          }
          confirmLabel={saving ? '…' : 'Cambiar'}
          busy={saving}
          onConfirm={activate}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  )
}
