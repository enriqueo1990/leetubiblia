import { useState } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import { isStoreApp } from '../lib/platform.js'
import { recordFunnel } from '../lib/diag.js'
import { useDonationGoal } from '../hooks/useDonationGoal.js'
import { BRAND_SERIF } from '../lib/brandFont.js'
import DonateSheet, { GoalProgress } from './DonateSheet.jsx'
import { HeartIcon } from './icons.jsx'

// "¿Te sirvió Lee Tu Biblia?": la invitación a donar, a la vista en Ajustes (antes
// vivía escondida dentro de La app › Quién hace la app). Agradecida, no insistente:
// una tarjeta con tinte, una frase y un botón. Si hay una meta activa, su avance.
// En la app de tienda no se piden donaciones (ver isStoreApp).
export default function ThanksCard({ className = '' }) {
  const { t } = usePreferences()
  const goal = useDonationGoal()
  const [open, setOpen] = useState(false)
  if (isStoreApp()) return null

  function donate() {
    if (goal) recordFunnel('goal_open')
    setOpen(true)
  }

  return (
    <>
      <section
        className={`rounded-card p-5 ${className}`}
        style={{ backgroundColor: 'var(--accent-tint)' }}
        aria-labelledby="thanks-title"
      >
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--accent-action)', color: 'var(--on-accent)' }}
          >
            <HeartIcon size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="thanks-title" className="text-[21px] font-medium leading-tight text-ink" style={{ fontFamily: BRAND_SERIF }}>
              {t('thanks.title')}
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{t('thanks.text')}</p>
          </div>
        </div>
        {goal && (
          <div className="mt-4">
            <GoalProgress goal={goal} />
          </div>
        )}
        <button type="button" onClick={donate} className="btn btn-primary mt-4">
          {t('thanks.cta')}
        </button>
      </section>
      {open && <DonateSheet goal={goal} onClose={() => setOpen(false)} />}
    </>
  )
}
