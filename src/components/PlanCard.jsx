import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { planName, planDescription, durationLabel } from '../lib/planLabels.js'
import planMinutes from '../data/planMinutes.json'
import { RowChevron } from './icons.jsx'

// Tarjeta de un plan del catálogo: nombre, descripción, duración y, si se conocen,
// los minutos por día. Una sola forma para Planes, el onboarding y la hoja del
// líder, para que quien elige plan para un grupo vea lo mismo que cuando elige el suyo.
//
//   mode="link"    (por defecto) abre el detalle: `to` + `state`, flecha al borde
//   mode="select"  botón con aria-pressed; `active` marca el elegido (card-active)
//   active         link: es el plan en curso (rótulo «Activo»); select: el elegido
//   recommended    rótulo «Recomendado» (solo el onboarding lo usa)
export default function PlanCard({
  plan,
  mode = 'link',
  to,
  state,
  active = false,
  onSelect,
  recommended = false,
}) {
  const { t } = usePreferences()
  const minutes = planMinutes[plan.slug]
  const meta = [durationLabel(t, plan.duration_days), minutes ? t('planes.minutesPerDay', { n: minutes }) : null]
    .filter(Boolean)
    .join(' · ')

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[1.125rem] font-semibold text-ink">{planName(t, plan)}</span>
          {mode === 'link' && active && (
            <span className="rounded-pill px-2 py-0.5 text-[0.75rem] font-medium text-accent-ink bg-accent-tint">
              {t('planes.active')}
            </span>
          )}
          {mode === 'select' && active && (
            <span className="rounded-pill px-2 py-0.5 text-[0.75rem] font-medium text-accent-ink bg-accent-tint">
              {t('onboarding.choosePlan.selected')}
            </span>
          )}
        </div>
        {plan.description && <p className="mt-1 text-[0.9375rem] text-ink-soft">{planDescription(t, plan)}</p>}
        <p className="mt-1 text-[0.8125rem] text-ink-soft">{meta}</p>
        {recommended && (
          <p className="mt-2 text-[0.8125rem] font-medium text-accent-ink">{t('onboarding.choosePlan.recommended')}</p>
        )}
      </div>
      {mode === 'link' && <RowChevron />}
    </>
  )
  const cls = `card flex w-full items-center gap-3 p-4 text-left transition-colors duration-200${active ? ' card-active' : ''}`

  if (mode === 'select') {
    return (
      <button type="button" onClick={onSelect} aria-pressed={active} className={cls}>
        {body}
      </button>
    )
  }
  return (
    <Link to={to} state={state} className={cls}>
      {body}
    </Link>
  )
}
