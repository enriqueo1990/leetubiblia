import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { bookLabel } from '../i18n/books.js'
import BackLink from '../components/BackLink.jsx'
import { getPlan, getPlanDays, startDateForDay, todayLocalISO, markDaysRead } from '../lib/db.js'
import { planName, planDescription } from '../lib/planLabels.js'
import { useReading } from '../hooks/useReading.js'
import ResumeFromDay from '../components/ResumeFromDay.jsx'
import { SkeletonRows } from '../components/Skeleton.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

// Detalle de un plan: descripción, duración, listado completo día-por-día con sus
// pasajes, y acción de activar. Mismo estilo que el resto (drill-in iOS).

export default function PlanDetail() {
  const { id } = useParams()
  const planId = Number(id)
  const { user, profile, updateProfile } = useAuth()
  const { t, locale } = usePreferences()
  const durationLabel = (days) =>
    days === 365 ? t('planes.durationYearLong') : t('planes.durationDays', { days })
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
      <BackLink to="/planes" label={t('nav.planes')} />

      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">
        {plan ? planName(t, plan) : t('common.plan')}
      </h1>
      {plan && (
        <p className="mt-1 text-[13px] text-ink-soft">{durationLabel(plan.duration_days)}</p>
      )}
      {plan?.description && (
        <p className="mt-3 text-[16px] text-ink-soft">{planDescription(t, plan)}</p>
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
        {isActive ? t('planes.goToday') : saving ? t('planes.activating') : t('planes.useThisPlan')}
      </button>
      {isActive && (
        <p className="mt-2 text-center text-[13px]" style={{ color: 'var(--accent-ink)' }}>
          {t('planes.isYourActive')}
        </p>
      )}

      {/* Listado día-por-día */}
      <p className="mb-2 mt-8 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
        {t('planes.readingsPerDay')}
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
                {t('planes.dayN', { n: d.day_number })}
              </span>
              <span className="flex-1 text-[15px] text-ink">
                {d.refs.map((ref, i) => (
                  <span key={i}>
                    {bookLabel(ref, locale)}
                    {i < d.refs.length - 1 && <span className="text-ink-soft"> · </span>}
                  </span>
                ))}
              </span>
              {read && (
                <span
                  className="shrink-0 pt-0.5 text-[15px] font-bold"
                  style={{ color: 'var(--accent-ink)' }}
                  aria-label={t('hoy.read')}
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
          title={t('planes.changeTitle', { name: plan ? planName(t, plan) : '' })}
          message={
            resumeDay
              ? t('planes.changeMsgResume', { day: resumeDay })
              : t('planes.changeMsgNew')
          }
          confirmLabel={saving ? '…' : t('planes.change')}
          busy={saving}
          onConfirm={activate}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  )
}
