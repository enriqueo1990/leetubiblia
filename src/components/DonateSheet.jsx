import { usePreferences } from '../lib/preferences.jsx'
import { MISSION_URL, DONATE_LINKS } from '../lib/developer.js'
import { recordFunnel } from '../lib/diag.js'
import Sheet from './Sheet.jsx'

// Hoja de donación, una sola para las dos puertas: Ajustes › "Apoyar la misión" y
// la tarjeta de la meta en Hoy. Con una meta vigente, la meta va primero (es lo
// que la gente vino a ver desde Hoy) y la misión debajo.

function money(n, locale) {
  return Number(n).toLocaleString(locale, { maximumFractionDigits: 0 })
}

// "USD 30 de 124" con su barra. La usan la hoja, la tarjeta de Hoy y /admin.
export function GoalProgress({ goal }) {
  const { t, locale } = usePreferences()
  const ratio = goal.target ? Math.min(goal.raised / goal.target, 1) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold text-ink tabular-nums">
          {t('goal.progress', {
            currency: goal.currency,
            raised: money(goal.raised, locale),
            target: money(goal.target, locale),
          })}
        </p>
        <p className="text-[13px] text-ink-soft tabular-nums">{Math.round(ratio * 100)}%</p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 18%, var(--surface))' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.target}
        aria-valuenow={goal.raised}
        aria-label={t('goal.title')}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 2 : 0)}%`, backgroundColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

// `title` reemplaza al título por defecto: la puerta que dice «Agradecer con una
// donación» abre una hoja con ese mismo nombre.
export default function DonateSheet({ goal, fromGoal = false, title = null, onClose }) {
  const { t, locale } = usePreferences()
  const goalBlock = goal ? (
    <section className="rounded-card p-4" style={{ backgroundColor: 'var(--surface)' }}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">{t('goal.eyebrow')}</p>
      <p className="mt-1 text-[15px] leading-snug text-ink">
        {t('goal.text', { currency: goal.currency, target: money(goal.target, locale) })}
      </p>
      <div className="mt-3">
        <GoalProgress goal={goal} />
      </div>
      <p className="mt-3 text-[13px] leading-snug text-ink-soft">{t('goal.surplus')}</p>
    </section>
  ) : null

  return (
    <Sheet title={title ?? (fromGoal ? t('goal.sheetTitle') : t('dev.donate'))} onCancel={onClose}>
      {fromGoal ? goalBlock : <p className="text-[15px] leading-snug text-ink">{t('ajustes.misionText')}</p>}
      {!fromGoal && goalBlock ? <div className="mt-4">{goalBlock}</div> : null}
      <p className="mt-4 text-[13px] leading-snug text-ink-soft">{t('dev.donateIntro')}</p>
      <div className="mt-2 space-y-2">
        {DONATE_LINKS.map((d) => (
          <a
            key={d.url}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => goal && recordFunnel('goal_link')}
            className="flex min-h-12 items-center justify-between rounded-card px-4 py-3"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <span className="text-[15px] font-medium text-ink">{t(`ajustes.${d.key}`)}</span>
            <span className="text-[15px]" style={{ color: 'var(--accent-ink)' }} aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
      </div>
      <a
        href={MISSION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium"
        style={{ color: 'var(--accent-ink)' }}
      >
        {t('ajustes.misionLink')} ↗
      </a>
    </Sheet>
  )
}
