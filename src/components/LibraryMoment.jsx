import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { getMaterial, withMaterialActivated } from '../lib/materials.js'
import { markLibraryMomentSeen } from '../lib/libraryOffer.js'
import BookCover from './BookCover.jsx'
import InlineError from './InlineError.jsx'

// La sugerencia del tercer día seguido (ver lib/libraryOffer.js): un material
// con nombre propio y "Agregar a mi estante" ahí mismo, sin pasar por la
// Biblioteca. Una sola vez: agregar o "Ahora no" la dan por vista.
export default function LibraryMoment({ slug, streak, onAdded, onClose }) {
  const { user, profile, updateProfile } = useAuth()
  const { t, locale } = usePreferences()
  const m = getMaterial(slug)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [added, setAdded] = useState(false)

  async function add() {
    if (saving) return
    setSaving(true)
    setFailed(false)
    const { error } = await updateProfile({ active_materials: withMaterialActivated(profile, slug) })
    setSaving(false)
    if (error) {
      setFailed(true)
      return
    }
    markLibraryMomentSeen(user?.id)
    onAdded?.(slug) // ya no "toca" ofrecerlo: el contenedor lo deja a la vista
    setAdded(true)
  }

  function later() {
    markLibraryMomentSeen(user?.id)
    onClose()
  }

  return (
    <section className="moment-in card mt-6 flex items-center gap-4 p-4" aria-labelledby="library-moment-title">
      <div className="w-[68px] shrink-0">
        <BookCover slug={slug} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        {added ? (
          <>
            <p className="text-[0.9375rem] font-semibold leading-snug text-ink">{t('library.momentAdded')}</p>
            <button
              type="button"
              onClick={onClose}
              className="-ml-1 mt-1 flex min-h-11 items-center px-1 text-[0.875rem] font-semibold"
              style={{ color: 'var(--accent-ink)' }}
            >
              {t('library.momentOk')}
            </button>
          </>
        ) : (
          <>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--accent-ink)' }}>
              {t('library.momentKicker', { count: streak })}
            </p>
            <h3 id="library-moment-title" className="mt-1 text-[1rem] font-semibold leading-snug text-ink">
              {t('library.momentTitle')}
            </h3>
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-soft">
              {m?.name}: {m?.description}
              {locale !== 'es' && ` ${t('materiales.inSpanish')}.`}
            </p>
            <div className="mt-1 flex items-center gap-4">
              <button
                type="button"
                onClick={add}
                disabled={saving}
                className="-ml-1 flex min-h-11 items-center px-1 text-[0.875rem] font-semibold"
                style={{ color: 'var(--accent-ink)', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? t('common.saving') : t('library.addToShelf')}
              </button>
              <button type="button" onClick={later} className="flex min-h-11 items-center px-1 text-[0.875rem] font-medium text-ink-soft">
                {t('library.notNow')}
              </button>
            </div>
            {failed && <InlineError message={t('common.saveError')} />}
          </>
        )}
      </div>
    </section>
  )
}
