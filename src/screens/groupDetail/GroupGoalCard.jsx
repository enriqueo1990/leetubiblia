import { useEffect, useState } from 'react'
import { LockIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { recordFunnel } from '../../lib/diag.js'
import { useDonationGoal } from '../../hooks/useDonationGoal.js'
import DonateSheet, { GoalProgress } from '../../components/DonateSheet.jsx'

// Meta de donación (tiendas) para el líder, en su zona privada al final del
// grupo: los líderes son quienes más aprovechan la app. Quieta, sin "Ahora no":
// no interrumpe nada y desaparece sola cuando la meta se cumple o se apaga.
export default function GroupGoalCard() {
  const { t } = usePreferences()
  const goal = useDonationGoal()
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (goal) recordFunnel('goal_shown')
  }, [goal])

  if (!goal) return null

  return (
    <>
      <section className="card mt-7 p-5" aria-labelledby="group-goal-title">
        <div className="flex items-center gap-1.5 text-ink-soft">
          <LockIcon size={13} />
          <span id="group-goal-title" className="text-[12px] font-semibold uppercase tracking-wide">
            {t('groupDetail.goalPrivate')}
          </span>
        </div>
        <p className="mt-3 text-[15px] leading-snug text-ink">{t('groupDetail.goalText')}</p>
        <div className="mt-4">
          <GoalProgress goal={goal} />
        </div>
        <button
          type="button"
          className="btn btn-secondary mt-4"
          onClick={() => {
            recordFunnel('goal_open')
            setSheetOpen(true)
          }}
        >
          {t('goal.cta')}
        </button>
      </section>

      {sheetOpen && <DonateSheet goal={goal} fromGoal onClose={() => setSheetOpen(false)} />}
    </>
  )
}
