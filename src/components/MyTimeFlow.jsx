import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { addIntercession, getPrayerDeck, markPrayerReviewed } from '../lib/db.js'
import { myTimeSteps } from '../lib/myTime.js'
import { markPrayedToday } from '../lib/prayedToday.js'
import { dayPeriod } from '../lib/dayLight.js'
import { BRAND_SERIF } from '../lib/brandFont.js'
import PassageList from './PassageList.jsx'
import useDialogFocus from '../hooks/useDialogFocus.js'

// "Mi tiempo": el recorrido guiado y opcional del tiempo diario, a pantalla
// completa y sin apuro. Prepararse → leer en tu Biblia (la app muestra los
// pasajes y espera) → una línea → orar por un pedido → cierre. La nota y la
// oración son opcionales (Ajustes) y cada paso se puede saltar. Leer se marca al
// tocar "Ya leí": si cerrás después, la lectura igual quedó.
export default function MyTimeFlow({
  refs,
  doneToday,
  onMarkRead,
  note,
  noteEditable,
  onSaveNote,
  prefs,
  reflectionsEnabled,
  daysRead,
  onPhoto,
  onClose,
}) {
  const { user } = useAuth()
  const { t, locale, bibleProvider } = usePreferences()
  // Una nota de un día pasado no se reescribe: ese paso no aplica.
  const steps = myTimeSteps({ ...prefs, reflectionsEnabled: reflectionsEnabled && (!note || noteEditable) })
  const [i, setI] = useState(0)
  const step = steps[i]
  const next = () => setI((n) => Math.min(n + 1, steps.length - 1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [body, setBody] = useState(note?.body ?? '')
  const [noted, setNoted] = useState(false)
  const [deck, setDeck] = useState(null) // pedidos para orar (los propios primero)
  const [pi, setPi] = useState(0)
  const [prayedFor, setPrayedFor] = useState(null)
  const [time] = useState(() => new Date().toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }))
  const period = dayPeriod()
  const panelRef = useRef(null)
  useDialogFocus(panelRef)
  // Cada paso lleva el foco a su título (tabIndex -1), así el lector de pantalla
  // anuncia el paso nuevo. El primer paso no: lo anuncia el diálogo al abrirse.
  useEffect(() => {
    if (i === 0) return
    const h = panelRef.current?.querySelector('[data-step-title]')
    if (h) {
      h.tabIndex = -1
      h.focus({ preventScroll: true })
    }
  }, [i, step])

  // La pantalla de abajo no se desliza mientras dura el recorrido; Escape cierra.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Los pedidos se traen al llegar a orar. Sin pedidos (o sin red), el paso se
  // salta solo: el recorrido nunca se traba.
  useEffect(() => {
    if (step !== 'pray' || deck != null || !user) return
    let on = true
    getPrayerDeck(user.id)
      .then((d) => {
        if (!on) return
        const ordered = [...d.filter((p) => p.mine), ...d.filter((p) => !p.mine)]
        setDeck(ordered)
        if (!ordered.length) next()
      })
      .catch(() => {
        if (on) next()
      })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, deck, user])

  async function run(fn) {
    if (busy) return
    setBusy(true)
    setError(false)
    try {
      await fn()
      next()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const read = () => run(async () => {
    if (!doneToday) await onMarkRead()
  })
  const saveNote = () => run(async () => {
    await onSaveNote(body.trim())
    setNoted(true)
  })
  const prayer = deck?.[pi] ?? null
  const amen = () => run(async () => {
    if (prayer.mine) await markPrayerReviewed(prayer.id)
    else await addIntercession(prayer.id, user.id)
    markPrayedToday(user.id, prayer.title)
    setPrayedFor(prayer.title)
  })

  const btn = (label, onClick, disabled = false) => (
    <button type="button" onClick={onClick} disabled={disabled || busy} className="btn btn-primary" style={{ opacity: disabled || busy ? 0.6 : 1 }}>
      {label}
    </button>
  )
  const link = (label, onClick) => (
    <button type="button" onClick={onClick} className="block min-h-11 w-full text-center text-[15px] font-medium text-ink-soft">
      {label}
    </button>
  )
  const serif = { fontFamily: BRAND_SERIF }
  const title = (text) => (
    <h2 data-step-title className="mt-3.5 text-[36px] font-medium leading-[1.12] tracking-[-0.02em] text-ink outline-none" style={serif}>
      {text}
    </h2>
  )
  const kicker = (text) => (
    <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--accent-ink)' }}>
      {text}
    </p>
  )

  let content = null
  let foot = null
  if (step === 'prepare') {
    content = (
      <>
        {kicker(t('myTime.kickerTime', { time }))}
        {title(t('myTime.prepare.title'))}
        <p className="mt-3.5 text-[17px] leading-relaxed text-ink-soft">{t('myTime.prepare.text')}</p>
        <div className="breathe mx-auto mt-10" aria-hidden="true" />
      </>
    )
    foot = btn(t('myTime.prepare.cta'), next)
  } else if (step === 'read') {
    content = (
      <>
        {kicker(t('myTime.read.kicker'))}
        {title(t('myTime.read.title'))}
        <div className="mt-5 space-y-1">
          <PassageList refs={refs} locale={locale} provider={bibleProvider} externalHint={t('hoy.externalBibleHint')} />
        </div>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-soft">{t('myTime.read.text')}</p>
      </>
    )
    foot = btn(doneToday ? t('myTime.read.ctaDone') : t('myTime.read.cta'), read)
  } else if (step === 'note') {
    content = (
      <>
        {kicker(t('myTime.note.kicker'))}
        {title(t('myTime.note.title'))}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          autoFocus
          placeholder={t('myTime.note.placeholder')}
          aria-label={t('myTime.note.title')}
          className="mt-6 w-full resize-none rounded-[18px] p-4 text-[18px] leading-relaxed text-ink outline-none"
          style={{ ...serif, backgroundColor: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--hairline)' }}
        />
      </>
    )
    foot = (
      <>
        {btn(t('myTime.note.cta'), saveNote, !body.trim())}
        {link(t('myTime.note.skip'), next)}
      </>
    )
  } else if (step === 'pray') {
    content = prayer ? (
      <>
        {kicker(t('myTime.pray.kicker'))}
        {title(t('myTime.pray.title'))}
        <div className="card mt-6 p-5" style={{ boxShadow: 'inset 0 0 0 1px var(--hairline)' }}>
          <p className="text-[17px] font-semibold leading-snug text-ink">{prayer.title}</p>
          <p className="mt-1 text-[14px] text-ink-soft">{prayer.mine ? t('myTime.pray.mine') : prayer.group?.name ?? t('myTime.pray.group')}</p>
        </div>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">{t('myTime.pray.text')}</p>
      </>
    ) : (
      <p className="text-center text-[15px] text-ink-soft">{t('common.loading')}</p>
    )
    // Orar es opcional como todo el recorrido: "Hoy no" siempre está; "Otro
    // pedido" cuando hay más de uno.
    foot = prayer && (
      <>
        {btn(t('myTime.pray.cta'), amen)}
        <div className="flex">
          {deck.length > 1 && link(t('myTime.pray.other'), () => setPi((n) => (n + 1) % deck.length))}
          {link(t('myTime.pray.skip'), next)}
        </div>
      </>
    )
  } else {
    const summary = [
      t('myTime.done.read'),
      noted && t('myTime.done.noted'),
      prayedFor && t('myTime.done.prayed', { title: prayedFor }),
      t('myTime.done.bye'),
    ]
      .filter(Boolean)
      .join(' ')
    content = (
      <div className="text-center">
        {kicker(t('myTime.done.kicker'))}
        <p className="mt-5 text-[96px] font-medium leading-none tabular-nums" style={{ ...serif, color: 'var(--accent-ink)' }}>
          {daysRead}
        </p>
        {title(t('myTime.done.days', { count: daysRead }))}
        <p className="mx-auto mt-3.5 max-w-[30ch] text-[16px] leading-relaxed text-ink-soft">{summary}</p>
      </div>
    )
    foot = (
      <>
        {btn(t('myTime.done.cta'), onClose)}
        <button
          type="button"
          onClick={onPhoto}
          className="block min-h-11 w-full text-center text-[15px] font-semibold"
          style={{ color: 'var(--accent-ink)' }}
        >
          {t('photo.cta')}
        </button>
      </>
    )
  }

  // Va al body (como Sheet): dentro de Hoy quedaría atrapado en su contexto de
  // apilamiento, debajo de la barra lateral y de las pestañas.
  return createPortal(
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t('myTime.title')}
      className="fixed inset-0 z-50 isolate flex flex-col overflow-y-auto outline-none"
      style={{ backgroundColor: 'var(--bg-app)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div aria-hidden="true" className={`day-light ${period}`} style={{ left: 0, right: 0 }} />
      <div className="mx-auto flex w-full max-w-content flex-1 flex-col px-6 pb-6 pt-4">
        <div className="flex items-center justify-between">
          {step !== 'done' ? (
            <button type="button" onClick={onClose} className="-ml-1 min-h-11 px-1 text-[15px] font-medium text-ink-soft">
              {t('common.close')}
            </button>
          ) : (
            <span />
          )}
          <span className="flex gap-1.5" role="img" aria-label={t('myTime.progress', { n: i + 1, total: steps.length })}>
            {steps.slice(0, -1).map((s, k) => (
              <i key={s} className="block h-1 w-5 rounded-full" style={{ backgroundColor: k <= i ? 'var(--accent)' : 'var(--hairline)' }} />
            ))}
          </span>
        </div>
        <div key={step} className="screen-enter flex flex-1 flex-col justify-center py-8">
          {content}
        </div>
        {error && (
          <p className="pb-2 text-center text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>
            {t('common.saveError')}
          </p>
        )}
        <div className="space-y-1.5">{foot}</div>
      </div>
    </div>,
    document.body,
  )
}
