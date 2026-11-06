import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { BRAND_SERIF, ensureBrandFont } from '../lib/brandFont.js'
import BookCover from './BookCover.jsx'
import { CheckIcon } from './icons.jsx'
import useDialogFocus from '../hooks/useDialogFocus.js'

// "Novedades": las pantallas de una versión grande, una por vez. Se pasa con
// "Siguiente", deslizando o con las flechas; "Saltar" cierra en cualquier
// momento. Cada pantalla: un dibujo hecho con la propia app (no capturas), un
// título en serif y dos líneas. Mi tiempo trae su botón para activarlo ahí.
export default function WhatsNew({ myTimeEnabled, onEnableMyTime, onClose }) {
  const { t } = usePreferences()
  const [i, setI] = useState(0)
  const touch = useRef(null)
  const panelRef = useRef(null)
  useDialogFocus(panelRef)

  const pages = [
    { key: 'light', art: <ArtLight />, title: t('whatsNew.light.title'), text: t('whatsNew.light.text') },
    { key: 'day', art: <ArtDay t={t} />, title: t('whatsNew.day.title'), text: t('whatsNew.day.text') },
    { key: 'myTime', art: <ArtMyTime />, title: t('whatsNew.myTime.title'), text: t('whatsNew.myTime.text'), myTime: true },
    { key: 'library', art: <ArtLibrary />, title: t('whatsNew.library.title'), text: t('whatsNew.library.text') },
  ]
  const last = i === pages.length - 1
  const page = pages[i]
  const go = (n) => setI((cur) => Math.max(0, Math.min(pages.length - 1, cur + n)))

  useEffect(() => {
    ensureBrandFont()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 backdrop-blur-sm" style={{ backgroundColor: 'var(--scrim)' }} onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-5">
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="whats-new-title"
          className="pointer-events-auto relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-t-[28px] outline-none sm:rounded-[28px]"
          style={{ backgroundColor: 'var(--bg-app)', boxShadow: 'var(--shadow-overlay)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current == null) return
            const dx = e.changedTouches[0].clientX - touch.current
            touch.current = null
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
          }}
        >
          <div className="flex items-center justify-between px-5 pt-4">
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--accent-ink)' }}>
              {t('whatsNew.kicker')}
            </span>
            {!last && (
              <button type="button" onClick={onClose} className="-mr-2 min-h-11 px-2 text-[15px] font-medium text-ink-soft">
                {t('whatsNew.skip')}
              </button>
            )}
            {last && <span className="min-h-11" />}
          </div>

          <div key={page.key} className="screen-enter min-h-[430px] px-6">
            <div
              className="relative mt-2 flex h-[220px] items-center justify-center overflow-hidden rounded-[22px]"
              style={{ backgroundColor: 'var(--surface-alt)' }}
              aria-hidden="true"
            >
              {page.art}
            </div>
            <h2 id="whats-new-title" className="mt-6 text-[28px] font-medium leading-[1.12] tracking-[-0.015em] text-ink" style={{ fontFamily: BRAND_SERIF }}>
              {page.title}
            </h2>
            <p className="mt-2.5 min-h-[72px] text-[16px] leading-relaxed text-ink-soft">{page.text}</p>
            {page.myTime && (
              <button
                type="button"
                onClick={onEnableMyTime}
                disabled={myTimeEnabled}
                className="mt-1 min-h-11 text-[15px] font-semibold"
                style={{ color: 'var(--accent-ink)' }}
              >
                {myTimeEnabled ? `✓ ${t('whatsNew.myTime.on')}` : t('whatsNew.myTime.cta')}
              </button>
            )}
          </div>

          <div className="px-6 pb-6 pt-5">
            <div className="mb-4 flex justify-center gap-1.5" role="tablist" aria-label={t('whatsNew.progress', { n: i + 1, total: pages.length })}>
              {pages.map((p, k) => (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={k === i}
                  aria-label={t('whatsNew.progress', { n: k + 1, total: pages.length })}
                  onClick={() => setI(k)}
                  className="flex h-6 items-center"
                >
                  <i
                    className="block h-1.5 rounded-full transition-all duration-300"
                    style={{ width: k === i ? 22 : 6, backgroundColor: k === i ? 'var(--accent)' : 'var(--hairline)' }}
                  />
                </button>
              ))}
            </div>
            <button type="button" onClick={last ? onClose : () => go(1)} className="btn btn-primary">
              {last ? t('whatsNew.done') : t('whatsNew.next')}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// ---- Dibujos: la app misma, en chico ----

function ArtLight() {
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 70% at 80% 0%, rgba(255,196,120,.32), transparent 70%)' }} />
      <div className="card relative w-[78%] px-5 py-4">
        <p className="text-[13px] font-semibold text-ink">Oficio Diario</p>
        <div className="mt-2 h-[2px] rounded-full" style={{ backgroundColor: 'var(--hairline)' }}>
          <div className="h-full w-[30%] rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
        </div>
        <p className="mt-3 text-[26px] font-medium leading-[1.15] text-ink" style={{ fontFamily: BRAND_SERIF }}>
          Salmos <span style={{ color: 'var(--accent-ink)' }}>19</span>
          <br />
          Isaías <span style={{ color: 'var(--accent-ink)' }}>45</span>
        </p>
      </div>
    </>
  )
}

function Dot({ done }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
      style={done ? { backgroundColor: 'var(--accent-action)' } : { boxShadow: 'inset 0 0 0 1.5px var(--faint)' }}
    >
      {done && (
        <CheckIcon size={11} stroke="#fff" strokeWidth={3.2} />
      )}
    </span>
  )
}

function ArtDay({ t }) {
  const rows = [
    { done: true, label: t('hoy.day.read') },
    { done: true, label: t('hoy.day.noteTodo'), serif: true },
    { done: false, label: t('hoy.day.prayTodo') },
  ]
  return (
    <div className="card w-[82%] overflow-hidden">
      {rows.map((r, k) => (
        <div key={k} className="flex items-center gap-3 border-t border-hairline px-4 py-3 first:border-t-0">
          <Dot done={r.done} />
          <span className={`text-[14px] ${r.done ? 'font-medium text-ink-soft' : 'font-semibold text-ink'}`}>{r.label}</span>
        </div>
      ))}
    </div>
  )
}

function ArtMyTime() {
  return <div className="breathe" />
}

function ArtLibrary() {
  const shelf = ['heidelberg', 'bautista-1689', 'spurgeon-matutinas']
  return (
    <div className="flex items-end gap-4">
      {shelf.map((slug, k) => (
        <BookCover key={slug} slug={slug} size="sm" style={{ width: k === 1 ? 104 : 92, transform: `translateY(${k === 1 ? -6 : 0}px)` }} />
      ))}
    </div>
  )
}
