import { useState } from 'react'
import { useAppUpdate } from '../hooks/useAppUpdate.js'
import { applyAppUpdate } from '../lib/appUpdate.js'
import { usePreferences } from '../lib/preferences.jsx'

export default function AppUpdateBanner() {
  const available = useAppUpdate()
  const { t } = usePreferences()
  const [dismissed, setDismissed] = useState(false)

  if (!available || dismissed) return null

  return (
    <div
      className="fixed inset-x-4 z-50 mx-auto max-w-content rounded-container p-4"
      style={{
        top: 'max(env(safe-area-inset-top), 12px)',
        backgroundColor: 'var(--surface)',
        boxShadow: 'var(--shadow-overlay)',
      }}
      role="status"
      aria-live="polite"
    >
      <p className="text-[16px] font-semibold text-ink">{t('appUpdate.title')}</p>
      <p className="mt-1 text-[13px] leading-snug text-ink-soft">{t('appUpdate.text')}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={applyAppUpdate} className="btn btn-primary flex-1 px-3 py-2 text-[15px]">
          {t('appUpdate.apply')}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="btn btn-secondary flex-1 px-3 py-2 text-[15px]"
        >
          {t('appUpdate.later')}
        </button>
      </div>
    </div>
  )
}
