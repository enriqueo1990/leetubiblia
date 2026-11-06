import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { TESTIMONY_REACTIONS, setTestimonyReaction } from '../lib/db.js'
import InlineError from './InlineError.jsx'

// kind (guardado en la base) → emoji. Los nombres viven en i18n: testimonyReactions.<kind>.
const EMOJI = { amen: '🙏', gloria: '🙌', alegria: '❤️' }

// Reacciones a un testimonio del grupo: tres emojis (🙏 Amén · 🙌 Gloria a Dios ·
// ❤️ Me alegra), una reacción por persona (tocar la propia la quita; tocar otra la
// cambia). Es la única parte de la app con emojis, a pedido de Enrique: como en las
// apps de mensajes, dicen más que una palabra. Cada botón lleva su nombre como
// aria-label y title. Es acompañar a quien contó cómo respondió Dios, no puntuarlo. Optimista pero
// honesto: si el guardado falla, vuelve a como estaba y avisa. El autor ve cuántos
// reaccionaron pero no reacciona a su propio testimonio.
// `initial` = { counts, mine } (o null: la función no está disponible, no se dibuja).
export default function TestimonyReactions({ prayerId, initial, isAuthor = false }) {
  const { user } = useAuth()
  const { t } = usePreferences()
  const [state, setState] = useState(initial)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!state) return null

  const total = TESTIMONY_REACTIONS.reduce((n, k) => n + state.counts[k], 0)
  if (isAuthor && total === 0) return null

  async function pick(kind) {
    if (busy || isAuthor || !user) return
    const prev = state
    const next = prev.mine === kind ? null : kind
    const counts = { ...prev.counts }
    if (prev.mine) counts[prev.mine] -= 1
    if (next) counts[next] += 1
    setState({ counts, mine: next })
    setError(false)
    setBusy(true)
    try {
      await setTestimonyReaction(prayerId, user.id, next)
    } catch {
      setState(prev)
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3">
      <div role="group" aria-label={t('testimonyReactions.group')} className="flex flex-wrap gap-2">
        {TESTIMONY_REACTIONS.map((kind) => {
          const on = state.mine === kind
          const n = state.counts[kind]
          if (isAuthor && n === 0) return null
          return (
            <button
              key={kind}
              type="button"
              disabled={isAuthor}
              aria-pressed={isAuthor ? undefined : on}
              aria-label={t(`testimonyReactions.${kind}`) + (n > 0 ? `, ${n}` : '')}
              title={t(`testimonyReactions.${kind}`)}
              onClick={() => pick(kind)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-pill border px-3.5 text-[0.875rem] font-medium transition-colors disabled:cursor-default"
              style={{
                backgroundColor: on ? 'var(--accent-tint)' : 'transparent',
                borderColor: on ? 'var(--accent-ink)' : 'var(--control-border)',
                color: on ? 'var(--accent-ink)' : 'var(--text-soft)',
              }}
            >
              <span aria-hidden="true" className="text-[1.125rem] leading-none">{EMOJI[kind]}</span>
              {n > 0 && <span aria-hidden="true" className="tabular-nums">{n}</span>}
            </button>
          )
        })}
      </div>
      <InlineError message={error ? t('testimonyReactions.error') : null} className="mt-2" />
    </div>
  )
}
