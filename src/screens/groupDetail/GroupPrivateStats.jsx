import { LockIcon } from '../../components/icons.jsx'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import Stat from './Stat.jsx'

// Lo privado del líder en UNA sola card con separador interno (resumen +
// semana): dos cajas gemelas apiladas eran ritmo monótono. Los miembros nunca
// ven esta sección.
export default function GroupPrivateStats({ stats, weekRows, answeredPct }) {
  const { t } = usePreferences()
  const { user } = useAuth()

  if (!stats && weekRows.length === 0) return null

  const DAY_LETTERS = t('groupDetail.weekDayLetters').split(',')
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d
  })

  return (
    <div className="card mt-7 divide-y divide-hairline">
      {stats && (
        <div className="p-5">
          <div className="flex items-center gap-1.5 text-ink-soft">
            <LockIcon size={13} />
            <span className="text-[12px] font-semibold uppercase tracking-wide">
              {t('groupDetail.summaryPrivate')}
            </span>
          </div>
          <div className="mt-4 flex">
            <Stat n={stats.active} label={t('groupDetail.statActive')} />
            <Stat n={stats.answered} label={t('groupDetail.statAnswered')} />
            <Stat n={stats.praying_week} label={t('groupDetail.statPrayingWeek')} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-alt)' }}>
            <div className="h-full" style={{ width: `${answeredPct}%`, backgroundColor: 'var(--accent)' }} />
          </div>
          <p className="mt-2 text-[12px] text-ink-soft">{t('groupDetail.answeredPct', { pct: answeredPct })}</p>
        </div>
      )}

      {weekRows.length > 0 && (
        <div className="p-5">
          <div className="flex items-center gap-1.5 text-ink-soft">
            <LockIcon size={13} />
            <span className="text-[12px] font-semibold uppercase tracking-wide">
              {t('groupDetail.weekPrivate')}
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {/* Header con la letra del día real de cada columna; "hoy" en acento. */}
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="min-w-0 flex-1" />
              <div className="flex gap-1.5">
                {weekDates.map((d, i) => (
                  <span
                    key={i}
                    className="flex h-[18px] w-[18px] items-center justify-center text-[10px] font-semibold"
                    style={{ color: i === 6 ? 'var(--accent-ink)' : 'var(--text-soft)' }}
                  >
                    {DAY_LETTERS[d.getDay()]}
                  </span>
                ))}
              </div>
            </div>
            {weekRows.map((m) => {
              const readDays = m.week.filter(Boolean).length
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3"
                  aria-label={t('groupDetail.weekAria', { name: m.display_name, days: readDays })}
                >
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {m.display_name}
                    {m.user_id === user?.id && <span className="text-ink-soft"> (vos)</span>}
                  </span>
                  <div className="flex gap-1.5" aria-hidden="true">
                    {m.week.map((read, i) => (
                      <span key={i} className="flex h-[18px] w-[18px] items-center justify-center">
                        <span
                          className="h-[10px] w-[10px] rounded-full"
                          style={
                            read
                              ? { backgroundColor: 'var(--accent)' }
                              : { backgroundColor: 'var(--surface-alt)', border: '1px solid var(--hairline)' }
                          }
                        />
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[12px] text-ink-soft">{t('groupDetail.weekHint')}</p>
        </div>
      )}
    </div>
  )
}
