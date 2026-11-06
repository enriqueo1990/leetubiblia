import { useState } from 'react'
import { usePreferences } from '../../lib/preferences.jsx'
import Sheet from '../../components/Sheet.jsx'
import InlineError from '../../components/InlineError.jsx'
import { BookIcon } from '../../components/icons.jsx'

// "¿Compartís tu lectura con el grupo?" — el momento justo para el opt-in de
// share_reading: al entrar al grupo, con un toque, sin ir a Ajustes. La lectura
// es recíproca (si no compartís, no ves la del grupo) y vale para TODOS tus
// grupos; el líder la necesita además para ver la semana de cada uno.
export default function ShareReadingSheet({ isOwner, onShare, onLater }) {
  const { t } = usePreferences()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function share() {
    if (saving) return
    setSaving(true)
    setError(false)
    const ok = await onShare()
    if (!ok) {
      setError(true)
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={t('groupDetail.shareAsk.title')}
      onCancel={onLater}
      footer={
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            aria-busy={saving}
            onClick={share}
          >
            {saving ? t('groupDetail.shareAsk.saving') : t('groupDetail.shareAsk.cta')}
          </button>
          <button
            type="button"
            className="mt-1 min-h-11 w-full text-center text-[15px] font-medium text-ink-soft"
            onClick={onLater}
          >
            {t('groupDetail.shareAsk.later')}
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center px-2 pt-2 text-center">
        <span
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
          aria-hidden="true"
        >
          <BookIcon size={30} />
        </span>
        <p className="mt-4 max-w-[34ch] text-[16px] leading-snug text-ink">
          {isOwner ? t('groupDetail.shareAsk.textOwner') : t('groupDetail.shareAsk.text')}
        </p>
        <p className="mt-2 text-[13px] leading-snug text-ink-soft">{t('groupDetail.shareAsk.note')}</p>
      </div>
      {error && <InlineError message={t('groupDetail.shareAsk.error')} className="mt-3" />}
    </Sheet>
  )
}
