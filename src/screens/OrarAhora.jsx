import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtDate } from '../i18n/dates.js'
import { getPrayerDeck, addIntercession, markPrayerReviewed } from '../lib/db.js'
import { HeartIcon, XIcon } from '../components/icons.jsx'
import { SkeletonDetail } from '../components/Skeleton.jsx'
import RetryError from '../components/RetryError.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'

const PRAYER_TRANSITION_MS = 700

function BreathingLabel({ done, doneText, children }) {
  return (
    <span className="relative inline-grid min-h-[1.25em] place-items-center">
      <span
        aria-hidden={done}
        className={`col-start-1 row-start-1 flex items-center justify-center gap-2 transition-opacity duration-[700ms] ease-soft ${
          done ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {children}
      </span>
      <span
        aria-hidden={!done}
        className={`col-start-1 row-start-1 transition-opacity duration-[700ms] ease-soft ${
          done ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {doneText}
      </span>
    </span>
  )
}

// "Orar ahora" (Feature 3) — el hábito de orar con la misma mecánica que Hoy: una
// ficha por vez, una acción primaria por estado, un cierre que respira. Recorre
// primero mis pedidos; después pregunta si quiero acompañar los pedidos de mis
// grupos. NO agrega backend: usa el mazo de db.js, la intercesión existente y el
// reloj de revisión. La oración NO se gamifica: el cierre confirma que el momento
// pasó, sin puntajes ni racha.
export default function OrarAhora() {
  const { user } = useAuth()
  const { t, locale } = usePreferences()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const fmtD = (iso) => fmtDate(iso, locale, { day: 'numeric', month: 'short' })
  const fmtLongD = (iso) => fmtDate(iso, locale, { day: 'numeric', month: 'long' })

  const [deck, setDeck] = useState(null) // null = cargando
  const [error, setError] = useState(false)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState('mine')
  const [interceded, setInterceded] = useState(0) // cuántas veces sumé mi oración
  const [leaving, setLeaving] = useState(false)
  const [pressedAction, setPressedAction] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState(false)
  const transitionTimer = useRef(null)

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      setDeck(await getPrayerDeck(user.id))
      setIdx(0)
      setPhase('mine')
      setInterceded(0)
      setActionError(false)
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  useEffect(
    () => () => {
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current)
    },
    []
  )

  // Al cambiar de ficha, subir arriba (fichas largas dejan scroll).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [idx])

  function close() {
    navigate('/oracion')
  }

  if (error) {
    return (
      <div className="pt-2">
        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          className="-ml-2 mb-3 flex h-11 w-11 items-center justify-center text-ink-soft"
        >
          <XIcon size={22} />
        </button>
        <RetryError message={t('oracion.loadError')} onRetry={load} />
      </div>
    )
  }
  if (deck === null) {
    return (
      <div className="pt-2">
        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          className="-ml-2 mb-3 flex h-11 w-11 items-center justify-center text-ink-soft"
        >
          <XIcon size={22} />
        </button>
        <SkeletonDetail />
      </div>
    )
  }

  if (deck.length === 0) {
    return (
      <EmptyState icon={<HeartIcon size={32} />} title={t('orar.empty.title')} text={t('orar.empty.text')}>
        <button type="button" onClick={close} className="btn btn-primary inline-block px-8">
          {t('orar.back')}
        </button>
      </EmptyState>
    )
  }

  const mineDeck = deck.filter((p) => p.mine)
  const groupDeck = deck.filter((p) => !p.mine)
  const activeDeck = phase === 'groups' ? groupDeck : mineDeck
  const completedMine = phase === 'mine' && idx >= mineDeck.length
  const askGroups = completedMine && groupDeck.length > 0
  const done = (phase === 'groups' && idx >= groupDeck.length) || (completedMine && groupDeck.length === 0)
  const completedCount = phase === 'groups'
    ? mineDeck.length + Math.min(idx, groupDeck.length)
    : Math.min(idx, mineDeck.length)

  function advance(afterAction, action = 'next') {
    if (leaving) return
    if (typeof afterAction === 'function') afterAction()
    setPressedAction(action)
    setLeaving(true)
    transitionTimer.current = window.setTimeout(() => {
      setIdx((i) => i + 1)
      setLeaving(false)
      setPressedAction(null)
    }, PRAYER_TRANSITION_MS + 60)
  }

  async function pray() {
    if (!online || actionBusy || leaving) return
    setActionBusy(true)
    setActionError(false)
    try {
      await addIntercession(activeDeck[idx].id, user.id)
      setInterceded((c) => c + 1)
      advance(null, 'primary')
    } catch {
      setActionError(true)
    } finally {
      setActionBusy(false)
    }
  }
  async function stillSame() {
    if (!online || actionBusy || leaving) return
    setActionBusy(true)
    setActionError(false)
    try {
      await markPrayerReviewed(activeDeck[idx].id)
      advance(null, 'primary')
    } catch {
      setActionError(true)
    } finally {
      setActionBusy(false)
    }
  }

  function startGroupPrayer() {
    setIdx(0)
    setPhase('groups')
  }

  if (askGroups) {
    return (
      <div className="flex min-h-[calc(100dvh-56px)] flex-col pt-2 lg:min-h-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            aria-label={t('common.close')}
            className="-ml-2 flex h-11 w-11 items-center justify-center text-ink-soft"
            style={{ opacity: 0.65 }}
          >
            <XIcon size={22} />
          </button>
        </div>
        <div className="prayer-card-enter flex flex-1 flex-col justify-center py-7 lg:mx-auto lg:w-full lg:max-w-[440px]">
          <article className="card flex min-h-[360px] flex-col items-center justify-center px-6 py-7 text-center">
            <div className="flex flex-col items-center justify-center gap-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-ink">
                {t('orar.groupsPrompt.eyebrow')}
              </p>
              <div className="mx-auto max-w-[340px] space-y-3">
                <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">
                  {t('orar.groupsPrompt.title')}
                </h1>
                <p className="text-[16px] leading-relaxed text-ink-soft">
                  {t('orar.groupsPrompt.text', { count: groupDeck.length })}
                </p>
              </div>
            </div>
          </article>
        </div>
        <div className="action-bar">
          <div className="space-y-2 lg:mx-auto lg:max-w-[440px]">
            <button type="button" onClick={startGroupPrayer} className="btn btn-primary">
              {t('orar.groupsPrompt.primary')}
            </button>
            <button type="button" onClick={close} className="btn btn-secondary">
              {t('orar.groupsPrompt.secondary')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Cierre: una línea quieta, el ✦ de la app. Sin puntajes ni racha.
  if (done) {
    return (
      <div className="flex min-h-[calc(100dvh-56px)] flex-col pt-2 lg:min-h-0">
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <span aria-hidden="true" className="text-[28px]" style={{ color: 'var(--accent-ink)' }}>
            ✦
          </span>
          <h1 className="mt-4 text-[24px] font-bold tracking-tight text-ink">
            {t('orar.done.title', { count: completedCount })}
          </h1>
          <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-ink-soft">
            {interceded > 0 ? t('orar.done.shared') : t('orar.done.quiet')}
          </p>
        </div>
        <div className="action-bar">
          <div className="lg:mx-auto lg:max-w-[440px]">
            <button type="button" onClick={close} className="btn btn-secondary">
              {t('orar.back')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const p = activeDeck[idx]
  const isLast = idx === activeDeck.length - 1
  const actionLabel = isLast ? t('orar.finish') : t('orar.nextPrayer')
  const currentActionLabel = actionBusy
    ? t('common.saving')
    : actionError
      ? t('common.retry')
      : actionLabel
  const eyebrow = p.mine ? null : p.group?.name
  const meta = p.mine
    ? t('orar.myRequestMeta', { date: fmtLongD(p.created_at) })
    : t('orar.groupRequestMeta', { name: p.author_name, date: fmtLongD(p.created_at) })

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col pt-2 lg:min-h-0">
      {/* Header: cerrar + avance. El mismo lugar en toda la sesión. */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          className="-ml-2 flex h-11 w-11 items-center justify-center text-ink-soft"
          style={{ opacity: 0.65 }}
        >
          <XIcon size={22} />
        </button>
        <span className="text-[12.5px] tabular-nums text-ink-soft">
          {t('orar.progress', { n: idx + 1, total: activeDeck.length })}
        </span>
      </div>
      <div className="mx-auto mt-3 h-1.5 w-28 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${((idx + 1) / activeDeck.length) * 100}%` }}
        />
      </div>

      {/* Una nota por pedido: centrada, personal, con el mínimo cromo posible. */}
      <div
        key={p.id}
        className="prayer-card-enter flex flex-1 flex-col justify-center gap-3 py-7 lg:mx-auto lg:w-full lg:max-w-[440px]"
      >
        {eyebrow && (
          <p className="text-center text-[12px] font-semibold uppercase tracking-wide text-accent-ink">
            {eyebrow}
          </p>
        )}
        <article
          className={`card flex min-h-[360px] flex-col items-center justify-center px-6 py-7 text-center transition-all duration-[700ms] ease-soft ${
            leaving ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-7">
            <div className="w-full space-y-5">
              <div className="mx-auto max-w-[340px] space-y-4">
                <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{p.title}</h1>
                {p.description && (
                  <p className="whitespace-pre-line text-[17px] leading-relaxed text-ink">{p.description}</p>
                )}
              </div>

              {/* Última actualización ("cómo sigue"): le da al momento de oración
                  lo fresco del pedido. Solo si el autor contó algo. */}
              {p.latest_update && (
                <div className="mx-auto max-w-[330px] pt-2">
                  <div className="mx-auto mb-4 h-px w-12" style={{ backgroundColor: 'var(--hairline)' }} />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    {t('prayerDetail.updates')}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">
                    {p.latest_update.body}
                  </p>
                  <p className="mt-2 text-[12px] text-ink-soft">
                    {fmtD(p.latest_update.created_at)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </article>
        <p
          className={`text-center text-[13px] text-ink-soft transition-all duration-[700ms] ease-soft ${
            leaving ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
          }`}
        >
          {meta}
        </p>
      </div>

      {/* Una sola acción: orar/revisar este pedido y pasar al siguiente. */}
      <div className="action-bar">
        <div className="lg:mx-auto lg:max-w-[440px]">
          {p.mine ? (
            <button
              type="button"
              onClick={stillSame}
              disabled={!online || leaving || actionBusy}
              aria-label={pressedAction === 'primary' ? t('orar.keepPraying') : currentActionLabel}
              className={`btn btn-primary flex items-center justify-center ${
                pressedAction === 'primary' ? 'prayer-action-breathe' : ''
              }`}
            >
              <BreathingLabel done={pressedAction === 'primary'} doneText={t('orar.keepPraying')}>
                {currentActionLabel}
              </BreathingLabel>
            </button>
          ) : (
            <button
              type="button"
              onClick={pray}
              disabled={!online || leaving || actionBusy}
              aria-label={pressedAction === 'primary' ? t('orar.keepPraying') : currentActionLabel}
              className={`btn btn-primary flex items-center justify-center gap-2 ${
                pressedAction === 'primary' ? 'prayer-action-breathe' : ''
              }`}
            >
              <BreathingLabel done={pressedAction === 'primary'} doneText={t('orar.keepPraying')}>
                {currentActionLabel}
              </BreathingLabel>
            </button>
          )}
          {actionError && (
            <p className="mt-2 text-center text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>
              {t('orar.actionError')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
