import Sheet from '../../components/Sheet.jsx'
import { CopyIcon, RefreshIcon, ShareIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'

export default function GroupInviteSheet({
  group,
  isOwner,
  copied,
  inviteShared,
  onClose,
  onShare,
  onCopyCode,
  onRegen,
}) {
  const { t } = usePreferences()

  return (
    <Sheet title={t('groupDetail.inviteAria')} onCancel={onClose}>
      <div className="pb-1 text-center">
        <p className="text-[0.9375rem] text-ink-soft">{t('groupDetail.inviteDesc')}</p>
        {/* El código en tinta neutra: el acento queda para la acción real (compartir). */}
        <p className="mt-6 text-[2.5rem] font-bold text-ink" style={{ letterSpacing: '6px', paddingLeft: '6px' }}>
          {group.invite_code}
        </p>
        <div className="mt-7 space-y-3">
          <button type="button" onClick={onShare} className="btn btn-primary flex items-center justify-center gap-2">
            <ShareIcon size={18} /> {inviteShared ? t('groupDetail.srInviteCopied') : t('groupDetail.shareInvite')}
          </button>
          <button type="button" onClick={onCopyCode} className="btn btn-secondary flex items-center justify-center gap-2">
            <CopyIcon size={18} /> {copied ? t('groupDetail.srCodeCopied') : t('groupDetail.copyCode')}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={onRegen}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 text-[0.875rem] font-medium text-ink-soft"
            >
              <RefreshIcon size={15} /> {t('groupDetail.regenCode')}
            </button>
          )}
        </div>
        {/* El botón dice qué se copió; además lo anunciamos para lectores. */}
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? t('groupDetail.srCodeCopied') : inviteShared ? t('groupDetail.srInviteCopied') : ''}
        </span>
      </div>
    </Sheet>
  )
}
