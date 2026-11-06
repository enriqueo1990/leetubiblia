import { useEffect, useState } from 'react'
import { usePreferences } from '../../lib/preferences.jsx'
import { recordFunnel } from '../../lib/diag.js'
import { useDonationGoal } from '../../hooks/useDonationGoal.js'
import DonateSheet from '../../components/DonateSheet.jsx'

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
        {/* Sin candado: ese ícono es de los datos pastorales, no de un pedido de apoyo. */}
        <span id="group-goal-title" className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('goal.eyebrow')}
        </span>
        <p className="mt-3 text-[15px] leading-snug text-ink">{t('groupDetail.goalText')}</p>
        <button
          type="button"
          className="btn btn-secondary mt-4"
          style={{ color: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
          onClick={() => {
            recordFunnel('goal_open')
            setSheetOpen(true)
          }}
        >
          {t('goal.cta')}
        </button>
        <p className="mt-3 text-[12px] text-ink-soft">{t('groupDetail.goalLeaderNote')}</p>
      </section>

      {sheetOpen && <DonateSheet goal={goal} fromGoal onClose={() => setSheetOpen(false)} />}
    </>
  )
}
