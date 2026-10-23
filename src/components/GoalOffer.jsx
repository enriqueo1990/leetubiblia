import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { recordFunnel } from '../lib/diag.js'
import { markGoalMomentSeen } from '../lib/goalOffer.js'
import DonateSheet, { GoalProgress } from './DonateSheet.jsx'
import { HeartIcon } from './icons.jsx'

// Tarjeta de la meta de donación en Hoy ("Ayudanos a llegar a las tiendas"),
// en un momento de gratitud: plan terminado o 7 / 30 días seguidos. Misma forma
// que la tarjeta de instalar: ícono, título, texto, una acción y "Ahora no".

export default function GoalOffer({ goal, moment, streak, onClose }) {
  const { user } = useAuth()
  const { t, locale } = usePreferences()
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    recordFunnel('goal_shown')
  }, [])

  function dismiss() {
    markGoalMomentSeen(user?.id, moment)
    onClose?.()
  }

  function help() {
    markGoalMomentSeen(user?.id, moment)
    recordFunnel('goal_open')
    setSheetOpen(true)
  }

  const eyebrow = moment === 'plan' ? t('goal.momentPlan') : t('goal.momentStreak', { count: streak })

  return (
    <>
      <section className="card mt-6 p-4" aria-labelledby="goal-offer-title">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
            aria-hidden="true"
          >
            <HeartIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium" style={{ color: 'var(--accent-ink)' }}>
              ✦ {eyebrow}
            </p>
            <h2 id="goal-offer-title" className="mt-0.5 text-[17px] font-semibold text-ink">
              {t('goal.title')}
            </h2>
            <p className="mt-1 text-[14px] leading-snug text-ink-soft">
              {t('goal.text', {
                currency: goal.currency,
                target: Number(goal.target).toLocaleString(locale, { maximumFractionDigits: 0 }),
              })}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <GoalProgress goal={goal} />
        </div>
        <button type="button" className="btn btn-primary mt-4" onClick={help}>
          {t('goal.cta')}
        </button>
        <button
          type="button"
          className="mt-1 min-h-11 w-full text-center text-[15px] font-medium text-ink-soft"
          onClick={dismiss}
        >
          {t('goal.dismiss')}
        </button>
      </section>

      {sheetOpen && (
        <DonateSheet
          goal={goal}
          fromGoal
          onClose={() => {
            setSheetOpen(false)
            onClose?.()
          }}
        />
      )}
    </>
  )
}
