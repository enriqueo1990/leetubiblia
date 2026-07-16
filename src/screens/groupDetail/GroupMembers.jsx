import { CheckIcon, MinusIcon } from '../../components/icons.jsx'
import { initials } from '../../components/Avatars.jsx'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'

// Miembros — la gente, con su lectura (cuando compartís). Solo señalamos lo
// positivo: quien leyó hoy. El resto no muestra nada — nada de "no leyó" que
// suene a reproche. Recíproco: el chip solo aparece si vos también compartís.
export default function GroupMembers({ members, isOwner, iShare, readMap, onKick }) {
  const { t } = usePreferences()
  const { user } = useAuth()

  return (
    <>
      <h2 className="mt-7 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {t('groupDetail.members')} · {members.length}
      </h2>
      <ul className="mt-3 card divide-y divide-hairline">
        {members.map((m) => {
          const isMe = m.user_id === user?.id
          const isMemberOwner = m.role === 'owner'
          const shares = readMap.has(m.user_id)
          const readToday = readMap.get(m.user_id)
          return (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
              >
                {initials(m.display_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] text-ink">
                  {m.display_name}
                  {isMe && <span className="text-ink-soft"> {t('groupDetail.youParen')}</span>}
                  {isMemberOwner && <span className="text-[13px] text-ink-soft"> · {t('groupDetail.adminShort')}</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {iShare && shares && readToday && (
                  <span
                    className="flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-medium"
                    style={{ color: 'var(--accent-ink)', backgroundColor: 'var(--accent-tint)' }}
                  >
                    <CheckIcon size={13} strokeWidth={2.2} /> {t('groupDetail.readTodayChip')}
                  </span>
                )}
                {isOwner && !isMemberOwner && (
                  <button
                    type="button"
                    onClick={() => onKick(m)}
                    aria-label={t('groupDetail.removeAria', { name: m.display_name })}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ border: '1px solid var(--hairline)' }}
                      aria-hidden="true"
                    >
                      <MinusIcon size={16} />
                    </span>
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
