import { BookIcon, CheckIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { planName } from '../../lib/planLabels.js'

// Plan del grupo — leer lo mismo, juntos. Los miembros lo ven cuando existe;
// el owner además tiene la puerta para elegirlo/cambiarlo.
export default function GroupPlanCard({
  isOwner,
  planInfo,
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

  if (!planInfo && !isOwner) return null

  return (
    <>
      <div className="mt-7 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('groupDetail.groupPlan')}
        </p>
        {isOwner && planInfo && (
          <button
            type="button"
            onClick={onChangePlan}
            className="text-[13px] font-medium"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('groupDetail.changePlan')}
          </button>
        )}
      </div>
      {planInfo ? (
        <div className="card mt-3 p-4">
          <p className="text-[16px] font-semibold leading-snug text-ink">{planName(t, planInfo)}</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            {groupPlanFinished
              ? t('groupDetail.planFinished')
              : groupPlanDay != null
                ? `${t('planes.dayN', { n: groupPlanDay })} ${t('ajustes.ofTotal', { total: groupPlanTotal })}`
                : null}
          </p>
          {amOnGroupPlan ? (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
              <CheckIcon size={15} strokeWidth={2.2} /> {t('groupDetail.readingWithGroup')}
            </p>
          ) : !groupPlanFinished ? (
            <>
              {/* Dos maneras de leerlo: como TU plan (lo de siempre) o como
                  lectura adicional en Hoy — tu plan queda intacto. */}
              {following && (
                <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
                  <CheckIcon size={15} strokeWidth={2.2} /> {t('groupDetail.followingPlan')}
                </p>
              )}
              <button
                type="button"
                onClick={onJoinPlan}
                className="btn btn-secondary mt-3"
                style={{ border: '1px solid var(--accent-ink)', color: 'var(--accent-ink)' }}
              >
                {t('groupDetail.joinPlan')}
              </button>
              {/* Dejar de seguir no es destructivo (apaga una preferencia):
                  tinta suave, no rojo — el rojo queda para lo que duele deshacer. */}
              <button
                type="button"
                onClick={() => onToggleFollow(!following)}
                className={`mt-1 w-full py-2 text-center text-[14px] font-medium${following ? ' text-ink-soft' : ''}`}
                style={following ? undefined : { color: 'var(--accent-ink)' }}
              >
                {following ? t('groupDetail.unfollowPlan') : t('groupDetail.followPlan')}
              </button>
            </>
          ) : null}
          {adoptError && (
            <p className="mt-2 text-[13px]" style={{ color: 'var(--danger)' }}>
              {t('groupDetail.adoptError')}
            </p>
          )}
          {followError && (
            <p className="mt-2 text-[13px]" style={{ color: 'var(--danger)' }}>
              {t('groupDetail.followError')}
            </p>
          )}
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
            <span className="block text-[15px] text-ink">{t('groupDetail.noPlanYet')}</span>
            <span className="mt-0.5 block text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
              {t('groupDetail.choosePlanCta')} →
            </span>
          </span>
        </button>
      )}
    </>
  )
}
