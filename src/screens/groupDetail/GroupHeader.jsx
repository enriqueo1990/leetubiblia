import { PencilIcon, ShareIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'

// Nombre del grupo (+ editar, owner), acción primaria de invitar en el header
// (mismo patrón que Grupos/Oración) y la línea de metadata de miembros.
export default function GroupHeader({
  group,
  isOwner,
  membersCount,
  editingName,
  nameInput,
  setNameInput,
  nameError,
  savingName,
  onStartEdit,
  onSaveName,
  onCancelEdit,
  onInvite,
}) {
  const { t } = usePreferences()

  return (
    <>
      {editingName ? (
        <div className="mt-3">
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveName()
              if (e.key === 'Escape') onCancelEdit()
            }}
            className="w-full rounded-input px-4 py-3 text-[18px] font-bold outline-none"
            style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-primary)' }}
            maxLength={60}
          />
          {nameError && (
            <p className="mt-1 text-[13px]" style={{ color: 'var(--danger)' }}>
              {nameError}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onSaveName}
              disabled={savingName || !nameInput.trim()}
              className="btn btn-primary"
              style={{ opacity: savingName || !nameInput.trim() ? 0.5 : 1 }}
            >
              {savingName ? '…' : t('common.save')}
            </button>
            <button type="button" onClick={onCancelEdit} className="btn btn-secondary">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[26px] font-bold tracking-tight text-ink">{group.name}</h1>
            {isOwner && (
              <button
                type="button"
                aria-label={t('groupDetail.editNameAria')}
                onClick={onStartEdit}
                className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink-soft"
                style={{ opacity: 0.5 }}
              >
                <PencilIcon size={16} />
              </button>
            )}
          </div>
          {/* Acción primaria en el header, como en Grupos/Oración: invitar. */}
          <button
            type="button"
            aria-label={t('groupDetail.inviteAria')}
            onClick={onInvite}
            className="flex h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-on-accent lg:px-4"
            style={{ backgroundColor: 'var(--accent-action)', minWidth: 44 }}
          >
            <ShareIcon size={18} />
            <span className="hidden text-[15px] font-semibold lg:inline">{t('groupDetail.invite')}</span>
          </button>
        </div>
      )}

      <p className="mt-2 text-[14px] text-ink-soft">
        {membersCount === 1
          ? t('groupDetail.onlyYou')
          : `${t('groupDetail.walkingTogether', { count: membersCount })}${isOwner ? t('groupDetail.adminSuffix') : ''}`}
      </p>
    </>
  )
}
