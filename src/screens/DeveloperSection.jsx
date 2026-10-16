import { useState } from 'react'
import { usePreferences } from '../lib/preferences.jsx'
import { useAuth } from '../lib/auth.jsx'
import { sendFeedback } from '../lib/db.js'
import {
  DEVELOPER_NAME,
  MISSION_URL,
  DONATE_LINKS,
  feedbackContext,
  feedbackMailto,
} from '../lib/developer.js'
import { initials } from '../components/Avatars.jsx'
import Sheet from '../components/Sheet.jsx'
import Segmented from '../components/Segmented.jsx'
import InlineError from '../components/InlineError.jsx'
import { ChevronRight, CheckIcon } from '../components/icons.jsx'
import { inputStyle } from '../components/formStyles.js'
import { version as APP_VERSION } from '../../package.json'

// Ajustes › "Quién hace la app". Una sola tarjeta: quién está detrás (con la
// misión), y debajo las tres puertas en su contexto —apoyar, sugerir, avisar un
// error— cada una abre su propia hoja. Reemplaza al desplegable "Apoyá la misión"
// que escondía la donación y no ofrecía ninguna vía de contacto.

function ActionRow({ title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{subtitle}</span>
      </span>
      <span className="text-ink-soft" style={{ opacity: 0.5 }}>
        <ChevronRight size={18} />
      </span>
    </button>
  )
}

function DonateSheet({ onClose }) {
  const { t } = usePreferences()
  return (
    <Sheet title={t('dev.donate')} onCancel={onClose}>
      <p className="text-[15px] leading-snug text-ink">{t('ajustes.misionText')}</p>
      <p className="mt-2 text-[13px] leading-snug text-ink-soft">{t('dev.donateIntro')}</p>
      <div className="mt-4 space-y-2">
        {DONATE_LINKS.map((d) => (
          <a
            key={d.url}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-between rounded-card px-4 py-3"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <span className="text-[15px] font-medium text-ink">{t(`ajustes.${d.key}`)}</span>
            <span className="text-[15px]" style={{ color: 'var(--accent-ink)' }} aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
      </div>
      <a
        href={MISSION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium"
        style={{ color: 'var(--accent-ink)' }}
      >
        {t('ajustes.misionLink')} ↗
      </a>
    </Sheet>
  )
}

// Una hoja para las dos puertas: el segmentado permite cambiar de "Sugerencia" a
// "Error" sin cerrar. Al enviar: gracias en la misma hoja (la confirmación
// aparece donde ocurrió el toque). Si falla, error en línea + correo de respaldo.
function FeedbackSheet({ initialKind, onClose }) {
  const { t, locale } = usePreferences()
  const { user } = useAuth()
  const [kind, setKind] = useState(initialKind)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)

  const KINDS = [
    { key: 'suggestion', label: t('dev.kindSuggestion') },
    { key: 'bug', label: t('dev.kindBug') },
  ]
  const canSend = body.trim().length > 0 && !sending
  const ctx = feedbackContext(APP_VERSION, locale)

  async function submit() {
    if (!canSend) return
    setSending(true)
    setError(false)
    try {
      await sendFeedback({ userId: user?.id, kind, body, context: ctx })
      setSent(true)
    } catch {
      setError(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <Sheet
        title={kind === 'bug' ? t('dev.bug') : t('dev.suggest')}
        onCancel={onClose}
        footer={
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('dev.done')}
          </button>
        }
      >
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <span
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
          >
            <CheckIcon size={32} strokeWidth={2.2} />
          </span>
          <p className="mt-4 text-[20px] font-semibold text-ink">{t('dev.sentTitle')}</p>
          <p className="mt-1.5 max-w-[32ch] text-[15px] leading-snug text-ink-soft">{t('dev.sentBody')}</p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      title={kind === 'bug' ? t('dev.bug') : t('dev.suggest')}
      onCancel={onClose}
      dirty={body.trim().length > 0}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSend}
          style={{ opacity: canSend ? 1 : 0.5 }}
          onClick={submit}
        >
          {sending ? t('dev.sending') : t('dev.send')}
        </button>
      }
    >
      <Segmented label={t('dev.kindLabel')} options={KINDS} value={kind} onChange={setKind} />
      <textarea
        aria-label={kind === 'bug' ? t('dev.bug') : t('dev.suggest')}
        rows={5}
        autoFocus
        maxLength={2000}
        placeholder={kind === 'bug' ? t('dev.placeholderBug') : t('dev.placeholderSuggestion')}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="mt-3 w-full resize-none rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />
      <p className="mt-2 text-[13px] leading-snug text-ink-soft">
        {kind === 'bug' ? t('dev.attachedBug', { version: APP_VERSION }) : t('dev.attachedSuggestion')}
      </p>
      {error && (
        <div className="mt-3">
          <InlineError message={t('dev.sendError')} className="" />
          <a
            href={feedbackMailto(
              kind === 'bug' ? t('dev.mailSubjectBug') : t('dev.mailSubjectSuggestion'),
              body,
              ctx
            )}
            className="mt-1 inline-block text-[13px] font-medium"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('dev.emailInstead')}
          </a>
        </div>
      )}
    </Sheet>
  )
}

export default function DeveloperSection() {
  const { t } = usePreferences()
  // null | 'donate' | 'suggestion' | 'bug'
  const [sheet, setSheet] = useState(null)

  return (
    <>
      <div className="card divide-y divide-hairline">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold"
              style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
              aria-hidden="true"
            >
              {initials(DEVELOPER_NAME)}
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-medium text-ink">{DEVELOPER_NAME}</p>
              <p className="text-[13px] text-ink-soft">{t('dev.role')}</p>
            </div>
          </div>
          <p className="mt-3 text-[15px] leading-snug text-ink">{t('dev.intro')}</p>
          <a
            href={MISSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('ajustes.misionLink')} ↗
          </a>
        </div>
        <ActionRow title={t('dev.donate')} subtitle={t('dev.donateHelp')} onClick={() => setSheet('donate')} />
        <ActionRow title={t('dev.suggest')} subtitle={t('dev.suggestHelp')} onClick={() => setSheet('suggestion')} />
        <ActionRow title={t('dev.bug')} subtitle={t('dev.bugHelp')} onClick={() => setSheet('bug')} />
      </div>

      {sheet === 'donate' && <DonateSheet onClose={() => setSheet(null)} />}
      {(sheet === 'suggestion' || sheet === 'bug') && (
        <FeedbackSheet key={sheet} initialKind={sheet} onClose={() => setSheet(null)} />
      )}
    </>
  )
}
