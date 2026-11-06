import { BookIcon, CheckIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { planName } from '../../lib/planLabels.js'
import RetryError from '../../components/RetryError.jsx'
import InlineError from '../../components/InlineError.jsx'
import SectionLabel from '../../components/SectionLabel.jsx'

// Plan del grupo — leer lo mismo, juntos. Los miembros lo ven cuando existe;
// el owner además tiene la puerta para elegirlo/cambiarlo.
export default function GroupPlanCard({
  isOwner,
  planInfo,
  hasPlan = false,
  onRetryPlan,
  groupPlanFinished,
  groupPlanDay,
  groupPlanTotal,
  amOnGroupPlan,
  following,
  adoptError,
  followError,
  onChangePlan,
  onOpenPicker,
  onJoinPlan,
  onToggleFollow,
}) {
  const { t } = usePreferences()

  // El grupo tiene plan pero no se pudo cargar: avisar con reintento. Mostrar el
  // vacío ("Elegí un plan") sería mentir, y al usarlo pisaría el plan vigente.
  if (hasPlan && !planInfo) {
    return (
      <>
        <SectionLabel className="mt-7 mb-0">{t('groupDetail.groupPlan')}</SectionLabel>
        <RetryError message={t('groupDetail.planLoadError')} onRetry={onRetryPlan} />
      </>
    )
  }

  if (!planInfo && !isOwner) return null

  return (
    <>
      <SectionLabel
        className="mt-7 mb-0"
        action={
          isOwner && planInfo && !groupPlanFinished ? (
            <button
              type="button"
              onClick={onChangePlan}
              className="-mr-2 inline-flex min-h-11 items-center px-2 text-[0.8125rem] font-medium"
              style={{ color: 'var(--accent-ink)' }}
            >
              {t('groupDetail.changePlan')}
            </button>
          ) : null
        }
      >
        {t('groupDetail.groupPlan')}
      </SectionLabel>
      {planInfo ? (
        <div className="card mt-3 p-4">
          <p className="text-[1rem] font-semibold leading-snug text-ink">{planName(t, planInfo)}</p>
          <p className="mt-1 text-[0.8125rem] text-ink-soft">
            {groupPlanFinished
              ? t('groupDetail.planFinished')
              : groupPlanDay != null
                ? `${t('planes.dayN', { n: groupPlanDay })} ${t('ajustes.ofTotal', { total: groupPlanTotal })}`
                : null}
          </p>
          {amOnGroupPlan ? (
            <p className="mt-3 flex items-center gap-1.5 text-[0.8125rem] font-semibold" style={{ color: 'var(--accent-ink)' }}>
              <CheckIcon size={15} strokeWidth={2.2} /> {t('groupDetail.readingWithGroup')}
            </p>
          ) : !groupPlanFinished ? (
            <>
              {/* Dos maneras de leerlo: como TU plan (lo de siempre) o como
                  lectura adicional en Hoy — tu plan queda intacto. */}
              <button
                type="button"
                onClick={onJoinPlan}
                className="btn btn-secondary mt-3"
                style={{ border: '1px solid var(--accent-ink)', color: 'var(--accent-ink)' }}
              >
                {t('groupDetail.joinPlan')}
              </button>
              {/* Seguirlo (o dejar de seguirlo) es una fila: la confirmación ocupa el
                  lugar del botón y no empuja nada bajo el dedo. Dejar de seguir no
                  es destructivo (apaga una preferencia): tinta suave, no rojo. */}
              <div className="mt-1 flex items-center justify-between gap-3">
                {following ? (
                  <>
                    <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-semibold" style={{ color: 'var(--accent-ink)' }}>
                      <CheckIcon size={15} strokeWidth={2.2} className="shrink-0" /> {t('groupDetail.followingPlan')}
                    </p>
                    <button
                      type="button"
                      onClick={() => onToggleFollow(false)}
                      className="min-h-11 shrink-0 px-1 text-[0.8125rem] font-medium text-ink-soft"
                    >
                      {t('groupDetail.unfollowPlan')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleFollow(true)}
                    className="min-h-11 w-full py-2 text-center text-[0.875rem] font-medium"
                    style={{ color: 'var(--accent-ink)' }}
                  >
                    {t('groupDetail.followPlan')}
                  </button>
                )}
              </div>
            </>
          ) : null}
          {/* Terminado: el paso siguiente es elegir otro plan (líder) o esperar (miembro). */}
          {groupPlanFinished &&
            (isOwner ? (
              <button type="button" onClick={onOpenPicker} className="btn btn-secondary mt-3">
                {t('groupDetail.pickNextPlan')}
              </button>
            ) : (
              <p className="mt-3 text-[0.8125rem] leading-snug text-ink-soft">{t('groupDetail.nextPlanSoon')}</p>
            ))}
          {adoptError && <InlineError message={t('groupDetail.adoptError')} className="mt-2" />}
          {followError && <InlineError message={t('groupDetail.followError')} className="mt-2" />}
        </div>
      ) : (
        <button type="button" onClick={onOpenPicker} className="card mt-3 flex w-full items-center gap-3 p-4 text-left">
          <span
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-accent-ink"
            style={{ backgroundColor: 'var(--accent-tint)' }}
            aria-hidden="true"
          >
            <BookIcon size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.9375rem] text-ink">{t('groupDetail.noPlanYet')}</span>
            <span className="mt-0.5 block text-[0.8125rem] font-semibold" style={{ color: 'var(--accent-ink)' }}>
              {t('groupDetail.choosePlanCta')} ›
            </span>
          </span>
        </button>
      )}
    </>
  )
}
