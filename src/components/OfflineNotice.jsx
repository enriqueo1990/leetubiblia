import { usePreferences } from '../lib/preferences.jsx'

export default function OfflineNotice() {
  const { t } = usePreferences()
  return (
    <div
      className="mb-4 rounded-input border px-4 py-3"
      style={{
        backgroundColor: 'var(--surface-alt)',
        borderColor: 'var(--control-border)',
      }}
      role="status"
      aria-live="polite"
    >
      <p className="text-[14px] font-semibold text-ink">{t('connection.offline.title')}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{t('connection.offline.text')}</p>
    </div>
  )
}
