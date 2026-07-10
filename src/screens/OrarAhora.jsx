import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtDate } from '../i18n/dates.js'
import { getPrayerDeck, addIntercession, markPrayerReviewed } from '../lib/db.js'
import { HeartIcon, XIcon } from '../components/icons.jsx'
import { SkeletonDetail } from '../components/Skeleton.jsx'
import RetryError from '../components/RetryError.jsx'
import EmptyState from '../components/EmptyState.jsx'

// "Orar ahora" (Feature 3) — el hábito de orar con la misma mecánica que Hoy: una
// ficha por vez, una acción primaria por estado, un cierre que respira. Recorre
// los pedidos activos (los de mis grupos primero, ahí mi oración se registra;
// después los míos). NO agrega backend: usa el mazo de db.js, la intercesión
// existente y el reloj de revisión. La oración NO se gamifica: el cierre confirma
// que el momento pasó, sin puntajes ni racha.
export default function OrarAhora() {
  const { user } = useAuth()
  const { t, locale } = usePreferences()
  const navigate = useNavigate()
  const fmtD = (iso) => fmtDate(iso, locale, { day: 'numeric', month: 'short' })

  const [deck, setDeck] = useState(null) // null = cargando
  const [error, setError] = useState(false)
  const [idx, setIdx] = useState(0)
  const [interceded, setInterceded] = useState(0) // cuántas veces sumé mi oración

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      setDeck(await getPrayerDeck(user.id))
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

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
        <RetryError message={t('oracion.loadError')} onRetry={load} />
      </div>
    )
  }
  if (deck === null) return <SkeletonDetail />

  if (deck.length === 0) {
    return (
      <EmptyState icon={<HeartIcon size={32} />} title={t('orar.empty.title')} text={t('orar.empty.text')}>
        <button type="button" onClick={close} className="btn btn-primary inline-block px-8">
          {t('orar.back')}
        </button>
      </EmptyState>
    )
  }

  const done = idx >= deck.length
  const advance = () => setIdx((i) => i + 1)

  function pray() {
    setInterceded((c) => c + 1)
    addIntercession(deck[idx].id, user.id).catch(() => {})
    advance()
  }
  function stillSame() {
    markPrayerReviewed(deck[idx].id).catch(() => {})
    advance()
  }

  // Cierre: una línea quieta, el ✦ de la app. Sin puntajes ni racha.
  if (done) {
    return (
      <div className="flex min-h-[calc(100dvh-120px)] flex-col pt-2 lg:min-h-0">
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <span aria-hidden="true" className="text-[28px]" style={{ color: 'var(--accent-ink)' }}>
            ✦
          </span>
          <h1 className="mt-4 text-[24px] font-bold tracking-tight text-ink">
            {t('orar.done.title', { count: deck.length })}
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

  const p = deck[idx]
  const eyebrow = p.mine ? t('groupDetail.yourPrayer') : p.group?.name

  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col pt-2 lg:min-h-0">
      {/* Header: cerrar + avance. El mismo lugar en toda la sesión. */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          className="-ml-1 flex h-9 w-9 items-center justify-center text-ink-soft"
          style={{ opacity: 0.65 }}
        >
          <XIcon size={22} />
        </button>
        <span className="text-[12.5px] tabular-nums text-ink-soft">
          {t('orar.progress', { n: idx + 1, total: deck.length })}
        </span>
      </div>

      {/* La ficha: el pedido, centrado en el espacio sobre la acción. */}
      <div key={p.id} className="screen-enter flex flex-1 flex-col justify-center gap-3.5 px-0.5 py-8">
        {eyebrow && (
          <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-ink">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[25px] font-bold leading-tight tracking-tight text-ink">{p.title}</h1>
        {p.description && (
          <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink">{p.description}</p>
        )}
        <p className="text-[13px] text-ink-soft">
          {p.mine ? fmtD(p.created_at) : `${p.author_name} · ${fmtD(p.created_at)}`}
        </p>

        {/* Última actualización ("cómo sigue"): le da al momento de oración lo
            fresco del pedido. Solo si el autor contó algo. */}
        {p.latest_update && (
          <div className="mt-1 pl-3.5" style={{ borderLeft: '2px solid var(--accent)' }}>
            <p className="text-[15px] leading-relaxed text-ink">{p.latest_update.body}</p>
            <p className="mt-1 text-[12px] text-ink-soft">
              {t('prayerDetail.updates')} · {fmtD(p.latest_update.created_at)}
            </p>
          </div>
        )}
      </div>

      {/* Zona de acción (sticky, como en Hoy). Otros: orar es lo primario, seguir
          el enlace quieto. Míos: seguir es lo primario, "sigue igual" secundario. */}
      <div className="action-bar">
        <div className="lg:mx-auto lg:max-w-[440px]">
          {p.mine ? (
            <>
              <button type="button" onClick={advance} className="btn btn-primary">
                {t('orar.next')} →
              </button>
              <button
                type="button"
                onClick={stillSame}
                className="mt-1 block w-full py-2 text-center text-[15px] font-medium text-ink-soft"
              >
                {t('oracion.stillSame')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={pray}
                className="btn btn-primary flex items-center justify-center gap-2"
              >
                <HeartIcon size={18} /> {t('prayerDetail.iAmPraying')}
              </button>
              <button
                type="button"
                onClick={advance}
                className="mt-1 block w-full py-2 text-center text-[15px] font-medium"
                style={{ color: 'var(--accent-ink)' }}
              >
                {t('orar.next')} →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
