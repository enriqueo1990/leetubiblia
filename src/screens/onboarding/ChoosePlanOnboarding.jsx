import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { startDateForDay, todayLocalISO, markDaysRead } from '../../lib/db.js'
import { readPendingPlan, clearPendingPlan } from '../../lib/pendingPlan.js'
import PlanCatalog from '../../components/PlanCatalog.jsx'
import { recordFunnel } from '../../lib/diag.js'

// Elegir plan de lectura en el onboarding (documento maestro §5.3 / §5.8).
// Set active_plan_id + plan_start_date = hoy (local). El cambio de plan ya con
// progreso existente, con su confirmación, se maneja en Tarea 4.
//
// Si la persona ya eligió plan ANTES de crear la cuenta (bienvenida → explorar,
// ver lib/pendingPlan.js), este paso lo aplica solo, sin volver a preguntar; la
// pantalla completa solo aparece si no hay elección pendiente o si aplicarla
// falló (y entonces queda preseleccionada para reintentar con un toque).

export default function ChoosePlanOnboarding({ onSkip }) {
  const { user, updateProfile } = useAuth()
  const { t } = usePreferences()
  const { pathname, search } = useLocation()
  const joiningFromInvite =
    pathname === '/join' && new URLSearchParams(search).has('code')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Elección pre-cuenta, leída una sola vez por instancia (ref lazy: sobrevive
  // el doble render de StrictMode). Se limpia en el efecto, no durante el render.
  const pendingRef = useRef(undefined)
  if (pendingRef.current === undefined) {
    pendingRef.current = readPendingPlan()
  }
  const pending = pendingRef.current
  const [autoApplying, setAutoApplying] = useState(Boolean(pending?.planId))
  const appliedRef = useRef(false)

  async function applyPlan(planId, resumeDay) {
    setSaving(true)
    setError(null)
    const planStart = resumeDay ? startDateForDay(resumeDay) : todayLocalISO()
    const { error } = await updateProfile({
      active_plan_id: planId,
      plan_start_date: planStart,
    })
    if (error) {
      setSaving(false)
      setError(t('onboarding.choosePlan.activateError'))
      return false
    }
    // Engancharse a mitad de plan: dar por leídos los días anteriores (1..N−1).
    if (resumeDay && resumeDay > 1 && user) {
      try {
        await markDaysRead(user.id, planId, resumeDay - 1)
      } catch {
        // No es bloqueante: el plan ya quedó activo en el día correcto.
      }
    }
    setSaving(false)
    return true
  }

  useEffect(() => {
    if (appliedRef.current) return
    appliedRef.current = true
    if (!pending) return
    clearPendingPlan()
    if (pending.skipped) {
      onSkip()
      return
    }
    applyPlan(pending.planId, pending.resumeDay).then((ok) => {
      if (!ok) setAutoApplying(false) // cae al catálogo, preseleccionado
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prefirió decidir después: onSkip corre en el efecto y el Gate avanza solo.
  if (pending?.skipped) return null

  // Aplicando la elección pre-cuenta: sin catálogo, solo el estado (si sale bien,
  // el perfil cambia y el Gate avanza solo a los extras).
  if (autoApplying) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col items-center justify-center px-7">
        <p className="text-[15px] text-ink-soft">{t('planes.activating')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10">
      <p className="text-[13px] font-medium text-accent-ink">{t('onboarding.choosePlan.step')}</p>
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        {t('onboarding.choosePlan.title')}
      </h1>
      <p className="mt-2 text-[16px] text-ink-soft">{t('planes.subtitle')}</p>

      <PlanCatalog
        onStart={(plan, resumeDay) => {
          recordFunnel('ob_plan_chosen', { plan_id: plan.id })
          applyPlan(plan.id, resumeDay)
        }}
        startLabel={t('onboarding.choosePlan.start')}
        savingLabel={t('planes.activating')}
        saving={saving}
        errorMessage={error}
        initialSelected={pending?.planId ?? null}
        initialResumeDay={pending?.resumeDay ?? null}
      />

      <div className="my-4 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[13px] text-ink-soft">{t('common.or')}</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          recordFunnel('ob_plan_chosen', { skipped: true })
          onSkip()
        }}
      >
        {joiningFromInvite
          ? t('onboarding.choosePlan.inviteCta')
          : t('onboarding.choosePlan.groupCta')}
      </button>
      <p className="mt-2 text-center text-[13px] leading-relaxed text-ink-soft">
        {joiningFromInvite
          ? t('onboarding.choosePlan.inviteHelp')
          : t('onboarding.choosePlan.groupHelp')}
      </p>
    </div>
  )
}
