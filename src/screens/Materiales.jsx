import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import {
  MATERIALS,
  getMaterial,
  currentEntryLabel,
  isMaterialActive,
  positionOf,
  loadMaterialContent,
  withMaterialActivated,
} from '../lib/materials.js'
import { materialTheme } from '../lib/materialTheme.js'
import { splitSentences } from '../lib/sentences.js'
import BackLink from '../components/BackLink.jsx'
import BookCover from '../components/BookCover.jsx'
import Sheet from '../components/Sheet.jsx'
import InlineError from '../components/InlineError.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { BRAND_SERIF } from '../lib/brandFont.js'

// Biblioteca (Hoy › Lecturas › Biblioteca): los materiales como una colección de
// libros. "En tu estante" son los que estás leyendo (aparecen en Hoy), con su
// avance; tocarlos abre el lector. "Para agregar" son los demás: tocarlos abre
// una vista previa con "Agregar a mi estante". Quitar uno vive en el Índice del
// lector, junto al material. Sin repisa dibujada: el estante es una sección.
export default function Materiales() {
  const { profile } = useAuth()
  const { t } = usePreferences()
  const location = useLocation()
  // El lector vuelve acá con la miga «‹ Biblioteca», y esta pantalla conserva su
  // propio origen (`back`) para que su miga no cambie según por dónde pasaste.
  const from = { to: '/materiales', label: t('nav.materiales'), back: location.state?.from }
  const [preview, setPreview] = useState(null) // slug del libro en vista previa
  // Total por slug (avance y "Completado" cuando el marcador pasó el final).
  const [totals, setTotals] = useState({})

  const shelf = MATERIALS.filter((m) => isMaterialActive(profile, m.slug))
  const rest = MATERIALS.filter((m) => !isMaterialActive(profile, m.slug))
  const shelfKey = shelf.map((m) => m.slug).join(',')

  useEffect(() => {
    let on = true
    const slugs = shelfKey ? shelfKey.split(',') : []
    Promise.all(slugs.map((slug) => loadMaterialContent(slug).catch(() => null))).then((loaded) => {
      if (!on) return
      const next = {}
      loaded.forEach((c) => {
        if (c) next[c.slug] = c.total
      })
      setTotals(next)
    })
    return () => {
      on = false
    }
  }, [shelfKey])

  return (
    <div className="pt-2">
      <BackLink to="/lecturas" label={t('nav.lecturas')} />

      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('library.title')}</h1>
      <p className="mt-2 px-1 text-[14px] text-ink-soft">{t('library.subtitle')}</p>

      {shelf.length > 0 && (
        <section className="mt-7">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[17px] font-semibold text-ink">{t('library.shelf')}</h2>
            <span className="text-[13px] tabular-nums text-ink-soft">{shelf.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {shelf.map((m) => {
              const total = totals[m.slug]
              const position = positionOf(profile, m.slug) ?? 1
              const done = total != null && position > total
              const progress = total ? Math.min(1, (position - 1) / total) : 0
              const th = materialTheme(m.slug)
              return (
                <Link
                  key={m.slug}
                  to={`/materiales/${m.slug}`}
                  state={{ from }}
                  className="block transition-transform active:scale-[0.98]"
                  aria-label={m.name}
                >
                  <BookCover slug={m.slug} meta={coverMeta(t, m.slug, th, total)} />
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--hairline)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(progress * 100, 2)}%`, backgroundColor: 'var(--accent)' }} />
                  </div>
                  <p className="mt-1.5 text-[13px] font-medium leading-snug text-ink">
                    {done ? `✓ ${t('materiales.completedReview')}` : currentEntryLabel(t, m.slug, position)}
                  </p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[17px] font-semibold text-ink">{shelf.length ? t('library.toAdd') : t('library.startHere')}</h2>
            <span className="text-[13px] text-ink-soft">{t('library.tapToSee')}</span>
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
            {rest.map((m) => (
              <button key={m.slug} type="button" onClick={() => setPreview(m.slug)} className="text-left" aria-label={m.name}>
                <BookCover slug={m.slug} size="sm" />
                <span className="mt-2 block text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
                  + {t('library.add')}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {preview && <PreviewSheet slug={preview} from={from} onClose={() => setPreview(null)} />}
    </div>
  )
}

// "1563 · 129 preguntas": el año (si se conoce) y la cantidad, en la tapa grande.
function coverMeta(t, slug, th, total) {
  const unit = getMaterial(slug)?.unit ?? 'question'
  const count = total != null ? t(`library.count.${unit}`, { count: total }) : null
  return [th.year, count].filter(Boolean).join(' · ') || null
}

// Vista previa de un libro que no está en el estante: la tapa, los datos, de qué
// trata, una muestra del texto, y "Agregar a mi estante" (que lo suma a Hoy).
function PreviewSheet({ slug, from, onClose }) {
  const { profile, updateProfile } = useAuth()
  const { t, locale } = usePreferences()
  const m = getMaterial(slug)
  const th = materialTheme(slug)
  const [content, setContent] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [added, setAdded] = useState(false) // ya está en el estante: ofrecer el paso siguiente

  useEffect(() => {
    let on = true
    loadMaterialContent(slug)
      .then((c) => on && setContent(c))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [slug])

  // La muestra: la primera oración de la primera entrada (sin el "1." de los
  // párrafos numerados de las confesiones).
  const sample = content?.entries?.[0]
    ? splitSentences(content.entries[0].answer)[0]?.text.replace(/^\d+\.\s*/, '')
    : null

  async function add() {
    if (saving) return
    setSaving(true)
    setFailed(false)
    const { error } = await updateProfile({ active_materials: withMaterialActivated(profile, slug) })
    setSaving(false)
    if (error) setFailed(true)
    else setAdded(true)
  }

  return (
    <Sheet
      title={m?.name ?? ''}
      onCancel={onClose}
      footer={
        added ? (
          <div className="space-y-1">
            {/* Es un enlace al lector: el material ya quedó activo en el perfil. */}
            <Link
              to={`/materiales/${slug}`}
              state={{ from }}
              className="btn btn-primary block text-center"
              autoFocus
            >
              {t('materialReader.start')}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="block w-full py-2 text-center text-[15px] font-medium text-ink-soft"
            >
              {t('library.momentOk')}
            </button>
          </div>
        ) : (
          <button type="button" onClick={add} disabled={saving} aria-busy={saving} className="btn btn-primary">
            {saving ? t('common.saving') : t('library.addToShelf')}
          </button>
        )
      }
    >
      {added && (
        <p role="status" className="mb-4 text-[15px] font-semibold leading-snug text-ink">
          <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✓ </span>
          {t('library.momentAdded')}
        </p>
      )}
      <div className="flex items-end gap-4">
        <div className="w-[120px] shrink-0">
          <BookCover slug={slug} meta={coverMeta(t, slug, th, content?.total)} />
        </div>
        <div className="min-w-0 pb-1">
          {th.kind && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--accent-ink)' }}>
              {t(`library.kind.${th.kind}`)}
            </p>
          )}
          <p className="mt-1.5 text-[13px] leading-snug text-ink-soft">
            {[th.year, content && t(`library.count.${m?.unit ?? 'question'}`, { count: content.total })].filter(Boolean).join(' · ')}
          </p>
          {locale !== 'es' && <p className="mt-0.5 text-[12px] text-ink-soft">{t('materiales.inSpanish')}</p>}
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{m?.description}</p>
      {sample && (
        <div className="card mt-4 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{t('library.sample')}</p>
          <p className="mt-2 text-[16px] leading-snug text-ink" style={{ fontFamily: BRAND_SERIF }}>
            «{sample}»
          </p>
        </div>
      )}
      {failed && <InlineError message={t('common.saveError')} className="mt-3" />}
    </Sheet>
  )
}
