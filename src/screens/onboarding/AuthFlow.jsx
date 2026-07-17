import { useState } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { BookIcon } from '../../components/icons.jsx'

// Bienvenida + auth por magic link (documento maestro §5.8, README pantalla 8).
// Pasos locales: 'welcome' → 'form' (crear/ingresar) → 'sent' (revisá tu correo).
// Sin contraseña → sin recuperación.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Centered({ children }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col justify-center px-7 py-10">
      {children}
    </div>
  )
}

export default function AuthFlow() {
  const { signInWithEmail, verifyEmailCode } = useAuth()
  const { t } = usePreferences()
  const [step, setStep] = useState('welcome')
  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)

  const valid = EMAIL_RE.test(email.trim())

  async function handleSend() {
    if (!valid || sending) return
    setSending(true)
    setError(null)
    // En "ingresar" no creamos la cuenta si no existe: así un correo mal tipeado
    // no genera una cuenta nueva en silencio.
    const { error } = await signInWithEmail(email.trim(), { createIfMissing: mode === 'signup' })
    setSending(false)
    if (error) {
      setError(
        mode === 'login'
          ? t('onboarding.auth.loginNotFound')
          : t('onboarding.auth.sendError')
      )
      return
    }
    setCode('')
    setStep('code')
  }

  // Supabase permite códigos de 6 a 10 dígitos (configurable). No fijamos 6.
  const codeValid = code.length >= 6 && code.length <= 10

  async function handleVerify() {
    const token = code.trim()
    if (!codeValid || verifying) return
    setVerifying(true)
    setError(null)
    const { error } = await verifyEmailCode(email.trim(), token)
    setVerifying(false)
    if (error) {
      setError(t('onboarding.auth.codeError'))
      return
    }
    // onAuthStateChange detecta la sesión y el Gate avanza solo.
  }

  // ---- Bienvenida ----
  if (step === 'welcome') {
    return (
      <Centered>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div
            className="flex h-[88px] w-[88px] items-center justify-center rounded-container text-on-accent"
            style={{ backgroundColor: 'var(--accent-action)' }}
          >
            <BookIcon size={44} />
          </div>
          <h1 className="mt-7 text-[24px] font-bold tracking-tight text-ink">
            Lee Tu Biblia
          </h1>
          <p className="mt-2 max-w-[280px] text-[17px] text-ink-soft">
            {t('onboarding.auth.tagline')}
          </p>
          <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-ink-soft">
            {t('onboarding.auth.physicalBibleNote')}
          </p>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setMode('signup')
              setStep('form')
            }}
          >
            {t('onboarding.auth.createAccount')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
            onClick={() => {
              setMode('login')
              setStep('form')
            }}
          >
            {t('onboarding.auth.haveAccount')}
          </button>
        </div>
      </Centered>
    )
  }

  // ---- Ingresar código ----
  if (step === 'code') {
    return (
      <Centered>
        <button
          type="button"
          className="mb-6 self-start text-[15px] font-medium"
          style={{ color: 'var(--accent-ink)' }}
          onClick={() => setStep('form')}
        >
          ‹ {t('common.back')}
        </button>
        <h1 className="text-[24px] font-bold tracking-tight text-ink">{t('onboarding.auth.checkEmail')}</h1>
        <p className="mt-2 text-[16px] text-ink-soft">
          {t('onboarding.auth.sentCodePre')}
          <span className="text-ink">{email.trim()}</span>{t('onboarding.auth.sentCodePost')}
        </p>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          {t('onboarding.auth.spamHintPre')}
          <button
            type="button"
            onClick={() => setStep('form')}
            className="font-medium"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('onboarding.auth.useAnotherEmail')}
          </button>
          .
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleVerify()
          }}
          className="mt-7"
        >
          <label htmlFor="auth-code" className="mb-2 block text-[14px] font-medium text-ink">
            {t('onboarding.auth.codeLabel')}
          </label>
          <input
            id="auth-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={10}
            placeholder={t('onboarding.auth.codePlaceholder')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full rounded-input px-4 py-3.5 text-center text-[26px] font-bold outline-none"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--control-border)',
              color: 'var(--text-primary)',
              letterSpacing: '6px',
            }}
          />
          {error && <p className="mt-2 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            type="submit"
            disabled={!codeValid || verifying}
            className="btn btn-primary mt-4"
            style={{ opacity: !codeValid || verifying ? 0.5 : 1 }}
          >
            {verifying ? t('onboarding.auth.verifying') : t('onboarding.auth.enter')}
          </button>
        </form>

        <button
          type="button"
          className="mt-6 text-center text-[15px] text-ink-soft"
          onClick={handleSend}
          disabled={sending}
        >
          {sending ? t('onboarding.auth.resending') : t('onboarding.auth.notArrived')}
          {!sending && <span style={{ color: 'var(--accent-ink)' }}>{t('onboarding.auth.resendCode')}</span>}
        </button>
      </Centered>
    )
  }

  // ---- Formulario (crear / ingresar) ----
  const isSignup = mode === 'signup'
  return (
    <Centered>
      <button
        type="button"
        className="mb-6 self-start text-[15px] font-medium"
        style={{ color: 'var(--accent-ink)' }}
        onClick={() => setStep('welcome')}
      >
        ‹ {t('common.back')}
      </button>
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        {isSignup ? t('onboarding.auth.createTitle') : t('onboarding.auth.login')}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="mt-7"
      >
        <label htmlFor="auth-email" className="mb-2 block text-[14px] font-medium text-ink">
          {t('onboarding.auth.emailLabel')}
        </label>
        <input
          id="auth-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder={t('onboarding.auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-input px-4 py-3.5 text-[16px] outline-none"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--control-border)',
            color: 'var(--text-primary)',
          }}
        />
        {error && <p className="mt-2 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

        <button
          type="submit"
          disabled={!valid || sending}
          className="btn btn-primary mt-4"
          style={{ opacity: !valid || sending ? 0.5 : 1 }}
        >
          {sending ? t('onboarding.auth.sending') : t('onboarding.auth.sendCode')}
        </button>
      </form>

      <p className="mt-3 text-[13px] text-ink-soft">
        {t('onboarding.auth.passwordlessNote')}
      </p>

      <button
        type="button"
        className="mt-8 text-center text-[15px] text-ink-soft"
        onClick={() => setMode(isSignup ? 'login' : 'signup')}
      >
        {isSignup ? t('onboarding.auth.haveAccountQ') : t('onboarding.auth.newQ')}
        <span style={{ color: 'var(--accent-ink)' }}>
          {isSignup ? t('onboarding.auth.login') : t('onboarding.auth.createOne')}
        </span>
      </button>
    </Centered>
  )
}
