import { useState } from 'react'
import { useAuth } from '../../lib/auth.jsx'
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
  const { signInWithEmail } = useAuth()
  const [step, setStep] = useState('welcome')
  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const valid = EMAIL_RE.test(email.trim())

  async function handleSend() {
    if (!valid || sending) return
    setSending(true)
    setError(null)
    const { error } = await signInWithEmail(email.trim())
    setSending(false)
    if (error) {
      setError('No pudimos enviar el enlace. Probá de nuevo.')
      return
    }
    setStep('sent')
  }

  // ---- Bienvenida ----
  if (step === 'welcome') {
    return (
      <Centered>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div
            className="flex h-[88px] w-[88px] items-center justify-center rounded-container text-on-accent"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <BookIcon size={44} />
          </div>
          <h1 className="mt-7 text-[24px] font-bold tracking-tight text-ink">
            Lee Tu Biblia
          </h1>
          <p className="mt-2 max-w-[280px] text-[17px] text-ink-soft">
            Tu lectura diaria y tus oraciones, en un solo lugar tranquilo.
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
            Crear cuenta
          </button>
          <button
            type="button"
            className="btn w-full py-3 text-[16px] font-medium"
            style={{ color: 'var(--accent)' }}
            onClick={() => {
              setMode('login')
              setStep('form')
            }}
          >
            Ya tengo cuenta
          </button>
        </div>
      </Centered>
    )
  }

  // ---- Enlace enviado ----
  if (step === 'sent') {
    return (
      <Centered>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div
            className="flex h-[84px] w-[84px] items-center justify-center rounded-full text-[34px]"
            style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }}
          >
            ✓
          </div>
          <h1 className="mt-7 text-[24px] font-bold tracking-tight text-ink">
            Revisá tu correo
          </h1>
          <p className="mt-2 max-w-[300px] text-[16px] text-ink-soft">
            Te enviamos un enlace de acceso a{' '}
            <span className="text-ink">{email.trim()}</span>. Abrilo desde este
            dispositivo para entrar.
          </p>
        </div>
        <button
          type="button"
          className="btn w-full py-3 text-[16px] font-medium"
          style={{ color: 'var(--accent)' }}
          onClick={() => setStep('form')}
        >
          Usar otro correo
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
        style={{ color: 'var(--accent)' }}
        onClick={() => setStep('welcome')}
      >
        ‹ Volver
      </button>
      <h1 className="text-[28px] font-bold tracking-tight text-ink">
        {isSignup ? 'Creá tu cuenta' : 'Ingresá'}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="mt-7"
      >
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-input px-4 py-3.5 text-[16px] outline-none"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--hairline)',
            color: 'var(--text-primary)',
          }}
        />
        {error && <p className="mt-2 text-[13px]" style={{ color: '#D1453B' }}>{error}</p>}

        <button
          type="submit"
          disabled={!valid || sending}
          className="btn btn-primary mt-4"
          style={{ opacity: !valid || sending ? 0.5 : 1 }}
        >
          {sending ? 'Enviando…' : 'Enviarme el enlace de acceso'}
        </button>
      </form>

      <p className="mt-3 text-[13px] text-ink-soft">
        Te mandamos un enlace a tu correo para entrar sin contraseña.
      </p>

      <button
        type="button"
        className="mt-8 text-center text-[14px] text-ink-soft"
        onClick={() => setMode(isSignup ? 'login' : 'signup')}
      >
        {isSignup ? '¿Ya tenés cuenta? ' : '¿Sos nuevo? '}
        <span style={{ color: 'var(--accent)' }}>
          {isSignup ? 'Ingresá' : 'Creá una cuenta'}
        </span>
      </button>
    </Centered>
  )
}
