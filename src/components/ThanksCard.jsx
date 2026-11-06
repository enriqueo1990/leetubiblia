import { useState } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import { isStoreApp } from '../lib/platform.js'
import { recordFunnel } from '../lib/diag.js'
import { useDonationGoal } from '../hooks/useDonationGoal.js'
import DonateSheet from './DonateSheet.jsx'
import { HeartIcon } from './icons.jsx'

// "¿Te sirvió Lee Tu Biblia?": la invitación a donar, a la vista en Ajustes (antes
// vivía escondida dentro de La app › Quién hace la app). Agradecida, no insistente.
// Receta única de donación: tarjeta blanca, ícono en tinte de acento, título en
// sans (la serif es la voz del libro, no de los pedidos de plata), botón
// secundario y sin barra de avance (la hoja de donación la sigue mostrando).
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
      <section className={`card p-4 ${className}`} aria-labelledby="thanks-title">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
          >
            <HeartIcon size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="thanks-title" className="text-[17px] font-semibold leading-tight text-ink">
              {t('thanks.title')}
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{t('thanks.text')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={donate}
          className="btn btn-secondary mt-4"
          style={{ color: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
        >
          {t('thanks.cta')}
        </button>
      </section>
      {open && <DonateSheet goal={goal} onClose={() => setOpen(false)} />}
    </>
  )
}
