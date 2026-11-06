import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import { peekGroupByCode } from '../../lib/db.js'
import { readPendingPlan, savePendingPlan } from '../../lib/pendingPlan.js'
import { clearPendingCode, readPendingCode, savePendingCode } from '../../lib/pendingCode.js'
import PlanCatalog from '../../components/PlanCatalog.jsx'
import { classifySendError } from '../../lib/authErrors.js'
import { ShareIcon } from '../../components/icons.jsx'
import { isIOS, isIOSBrowser, isInAppBrowser, isStandalone } from '../../lib/platform.js'
import { recordFunnel } from '../../lib/diag.js'
import BrandMark from '../../components/BrandMark.jsx'
import { inputStyle } from '../../components/formStyles.js'

// Bienvenida + auth por código de email (documento maestro §5.8, README pantalla 8).
// Pasos locales: 'welcome' → ('install', solo iPhone en el navegador) →
// 'explore' (catálogo SIN cuenta) → 'form' → 'code'.
// La cuenta se pide en el momento del compromiso, no en la puerta: primero se
// elige el plan (queda pendiente en localStorage y el onboarding lo aplica al
// terminar), o se ve a qué grupo te invitaron (/join?code → peek sin sesión).
// Sin contraseña → sin recuperación.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Espera entre pedidos de código: sin ella, tocar "reenviar" varias veces agota el
// límite de envíos del servidor.
const RESEND_COOLDOWN = 30

// "‹ Volver" de la bienvenida: mismo target de 44 px que BackLink.
const BACK_CLASS =
  '-ml-2 mb-4 inline-flex min-h-11 items-center self-start px-2 text-[15px] font-medium'

// align="top": el paso del código. El teclado numérico de iOS no tiene tecla de
// enviar y, con el contenido centrado, tapa «Entrar»: arriba queda a la vista.
function Centered({ children, align = 'center' }) {
  return (
    <div
      className={`mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10 ${
        align === 'top' ? 'justify-start' : 'justify-center'
      }`}
    >
      {children}
    </div>
  )
}

export default function AuthFlow() {
  const { signInWithEmail, verifyEmailCode, sessionExpired } = useAuth()
  const { t } = usePreferences()
  const { pathname, search } = useLocation()
  // Si la app se recargó mientras la persona buscaba el código en Mail, se
  // reabre en el paso del código (ver lib/pendingCode.js).
  const [restored] = useState(() => readPendingCode())
  const [step, setStep] = useState(restored ? 'code' : 'welcome')
  const [mode, setMode] = useState(restored ? restored.mode : 'signup') // 'signup' | 'login'
  const [formOrigin, setFormOrigin] = useState('welcome') // adónde vuelve el ‹ del form
  // plan elegido antes de la cuenta (al recargar, sale del plan pendiente guardado)
  const [pendingName, setPendingName] = useState(() => (restored ? readPendingPlan()?.name ?? null : null))
  const [email, setEmail] = useState(restored ? restored.email : '')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)
  const [resent, setResent] = useState(false)
  const [cooldown, setCooldown] = useState(() =>
    restored ? Math.max(0, RESEND_COOLDOWN - Math.floor((Date.now() - restored.sentAt) / 1000)) : 0
  )

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  // Invitación a grupo (/join?code=X): vista previa sin sesión — solo nombre y
  // cantidad de miembros (RPC anónima, migración 0032). Si falla o el código no
  // existe, la bienvenida queda genérica y Join.jsx da el error real tras entrar.
  const inviteCode =
    pathname === '/join' ? (new URLSearchParams(search).get('code') || '').trim() : ''
  const [invite, setInvite] = useState(null)

  useEffect(() => {
    if (!inviteCode) return
    let alive = true
    peekGroupByCode(inviteCode)
      .then((g) => {
        if (alive && g) setInvite(g)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [inviteCode])

  // Embudo de onboarding (/admin): cada pantalla cuenta una vez por dispositivo.
  // Quien vuelve con la sesión vencida no es una persona nueva: no se cuenta.
  // La app instalada en iPhone tampoco cuenta la bienvenida: para instalarla hubo
  // que pasar por el navegador, que ya la contó (con otro id, porque no
  // comparten almacenamiento) y la persona aparecería dos veces.
  useEffect(() => {
    const countWelcome = !sessionExpired && !(isIOS() && isStandalone())
    if (step === 'welcome' && countWelcome) recordFunnel('ob_welcome', { invite: Boolean(inviteCode) })
    if (step === 'install') recordFunnel('ob_install_step', { in_app: isInAppBrowser() })
    if (step === 'explore') recordFunnel('ob_explore')
  }, [step, sessionExpired, inviteCode])

  const valid = EMAIL_RE.test(email.trim())

  async function handleSend({ resend = false } = {}) {
    if (!valid || sending || (resend && cooldown > 0)) return
    setSending(true)
    setError(null)
    setResent(false)
    // En "ingresar" no creamos la cuenta si no existe: así un correo mal tipeado
    // no genera una cuenta nueva en silencio.
    const { error } = await signInWithEmail(email.trim(), { createIfMissing: mode === 'signup' })
    setSending(false)
    if (error) {
      // Decir la verdad: sin red o con límite de envíos NO es "no existe la cuenta".
      const kind = classifySendError(error, { mode, online: navigator.onLine })
      setError(
        kind === 'offline'
          ? t('onboarding.auth.offline')
          : kind === 'rateLimited'
            ? t('onboarding.auth.rateLimited')
            : kind === 'notFound'
              ? t('onboarding.auth.loginNotFound')
              : t('onboarding.auth.sendError')
      )
      return
    }
    if (mode === 'signup') recordFunnel('ob_code_sent', { invite: Boolean(invite) })
    savePendingCode({ email: email.trim(), mode })
    setCode('')
    setCooldown(RESEND_COOLDOWN)
    setResent(resend)
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
    clearPendingCode()
    if (mode === 'signup') recordFunnel('ob_code_verified')
    // onAuthStateChange detecta la sesión y el Gate avanza solo.
  }

  // Volver al formulario (‹ o «usá otro correo»): ese código ya no se espera.
  function backToForm() {
    clearPendingCode()
    setStep('form')
  }

  function goToForm(nextMode, origin) {
    setMode(nextMode)
    setFormOrigin(origin)
    setStep('form')
  }

  // «Empezar» de la bienvenida.
  // Invitación: derecho al registro (el plan se resuelve con el grupo).
  // La ruta sale del código en la URL, no de la vista previa: esa llega después
  // (o falla) y el botón no puede cambiar de destino bajo el dedo.
  // Sin invitación: primero explorar los planes, la cuenta después.
  // En iPhone, antes que nada, instalar: la app de inicio no comparte sesión con
  // el navegador y la cuenta se crearía dos veces. (No con invitación: instalar
  // desde /join podría perder el código.)
  function startOnboarding() {
    if (inviteCode) goToForm('signup', 'welcome')
    else setStep(isIOSBrowser() ? 'install' : 'explore')
  }

  const goToLogin = () => goToForm('login', 'welcome')

  // ---- Bienvenida ----
  if (step === 'welcome') {
    return (
      <Centered>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <BrandMark size={88} />
          <h1 className="mt-7 text-[24px] font-bold tracking-tight text-ink">
            Lee Tu Biblia
          </h1>
          {invite ? (
            <>
              <p className="mt-2 max-w-[280px] text-[17px] text-ink">
                {t('onboarding.auth.inviteTitle', { group: invite.name })}
              </p>
              {invite.member_count >= 2 && (
                <p className="mt-1.5 text-[13px] text-ink-soft">
                  {t('onboarding.auth.inviteMembers', { count: invite.member_count })}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 max-w-[280px] text-[17px] text-ink-soft">
              {t('onboarding.auth.tagline')}
            </p>
          )}
          <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-ink-soft">
            {t('onboarding.auth.physicalBibleNote')}
          </p>
          {/* Había una sesión en este dispositivo y ya no es válida. */}
          {sessionExpired && (
            <p className="mt-4 max-w-[300px] text-[14px] font-medium text-ink" role="status">
              {t('onboarding.auth.sessionExpired')}
            </p>
          )}
        </div>
        {/* Con la sesión vencida es alguien que ya tiene cuenta: «Ingresá» es el botón
            grande y crear una cuenta queda en el secundario. */}
        <div className="space-y-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={sessionExpired ? goToLogin : startOnboarding}
          >
            {sessionExpired
              ? t('onboarding.auth.login')
              : inviteCode
                ? t('onboarding.auth.inviteCta')
                : t('onboarding.auth.start')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
            onClick={sessionExpired ? startOnboarding : goToLogin}
          >
            {sessionExpired
              ? inviteCode
                ? t('onboarding.auth.inviteCta')
                : t('onboarding.auth.createAccount')
              : t('onboarding.auth.haveAccount')}
          </button>
        </div>
      </Centered>
    )
  }

  // ---- Instalar primero (iPhone en el navegador) ----
  if (step === 'install') {
    const inApp = isInAppBrowser()
    const steps = [
      t('onboarding.extras.step1'),
      t('onboarding.extras.step2'),
      t('onboarding.install.step3'),
    ]
    return (
      <Centered>
        <button
          type="button"
          className={BACK_CLASS}
          style={{ color: 'var(--accent-ink)' }}
          onClick={() => setStep('welcome')}
        >
          ‹ {t('common.back')}
        </button>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">
          {t('onboarding.install.title')}
        </h1>
        <p className="mt-2 text-[16px] text-ink-soft">{t('onboarding.install.text')}</p>

        <div className="card mt-7 p-4">
          {inApp ? (
            <p className="text-[15px] text-ink">{t('onboarding.install.inApp')}</p>
          ) : (
            <ol className="space-y-3">
              {steps.map((label, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-on-accent"
                    style={{ backgroundColor: 'var(--accent-action)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[15px] text-ink">{label}</span>
                  {i === 0 && (
                    <span className="ml-auto text-accent-ink">
                      <ShareIcon size={20} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <button
          type="button"
          className="btn btn-secondary mt-6"
          style={{ color: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
          onClick={() => {
            recordFunnel('ob_install_skip')
            setStep('explore')
          }}
        >
          {t('onboarding.install.continue')}
        </button>
      </Centered>
    )
  }

  // ---- Explorar planes (sin cuenta todavía) ----
  if (step === 'explore') {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col px-7 py-10">
        <button
          type="button"
          className={BACK_CLASS}
          style={{ color: 'var(--accent-ink)' }}
          onClick={() => setStep('welcome')}
        >
          ‹ {t('common.back')}
        </button>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">
          {t('onboarding.auth.exploreTitle')}
        </h1>
        <p className="mt-2 text-[16px] text-ink-soft">{t('onboarding.choosePlan.subtitle')}</p>

        <PlanCatalog
          onStart={(plan, resumeDay) => {
            savePendingPlan({ planId: plan.id, resumeDay, name: plan.name })
            recordFunnel('ob_plan_chosen', { plan_id: plan.id })
            setPendingName(plan.name)
            goToForm('signup', 'explore')
          }}
          startLabel={t('onboarding.auth.exploreContinue')}
        />

        <button
          type="button"
          className="mt-4 min-h-11 w-full text-center text-[15px] font-medium text-accent-ink"
          onClick={() => {
            savePendingPlan({ skipped: true })
            recordFunnel('ob_plan_chosen', { skipped: true })
            setPendingName(null)
            goToForm('signup', 'explore')
          }}
        >
          {t('onboarding.auth.exploreLater')}
        </button>
      </div>
    )
  }

  // ---- Ingresar código ----
  if (step === 'code') {
    return (
      <Centered align="top">
        <button
          type="button"
          className={BACK_CLASS}
          style={{ color: 'var(--accent-ink)' }}
          onClick={backToForm}
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
            onClick={backToForm}
            className="inline-flex min-h-11 items-center px-1 font-medium"
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
            style={{ ...inputStyle, letterSpacing: '6px' }}
          />
          {error && <p className="mt-2 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            type="submit"
            disabled={!codeValid || verifying}
            aria-busy={verifying}
            className="btn btn-primary mt-4"
          >
            {verifying ? t('onboarding.auth.verifying') : t('onboarding.auth.enter')}
          </button>
        </form>

        {resent && (
          <p className="mt-5 text-center text-[13px] text-ink-soft" role="status">
            {t('onboarding.auth.resent')}
          </p>
        )}
        <button
          type="button"
          className="mt-3 min-h-11 text-center text-[15px] text-ink-soft"
          onClick={() => handleSend({ resend: true })}
          disabled={sending || cooldown > 0}
          style={{ opacity: cooldown > 0 && !sending ? 0.6 : 1 }}
        >
          {sending
            ? t('onboarding.auth.resending')
            : cooldown > 0
              ? t('onboarding.auth.resendIn', { n: cooldown })
              : (
                <>
                  {t('onboarding.auth.notArrived')}
                  <span style={{ color: 'var(--accent-ink)' }}>{t('onboarding.auth.resendCode')}</span>
                </>
              )}
        </button>
      </Centered>
    )
  }

  // ---- Formulario (crear / ingresar) ----
  const isSignup = mode === 'signup'
  // El registro llega con contexto: qué se va a guardar con esta cuenta.
  const signupContext = isSignup
    ? invite
      ? t('onboarding.auth.signupForGroup', { group: invite.name })
      : pendingName
        ? t('onboarding.auth.signupForPlan', { plan: pendingName })
        : null
    : null
  return (
    <Centered>
      <button
        type="button"
        className={BACK_CLASS}
        style={{ color: 'var(--accent-ink)' }}
        onClick={() => setStep(formOrigin)}
      >
        ‹ {t('common.back')}
      </button>
      <h1 className="text-[26px] font-bold tracking-tight text-ink">
        {isSignup ? t('onboarding.auth.createTitle') : t('onboarding.auth.login')}
      </h1>
      {signupContext && (
        <p className="mt-2 text-[15px] text-ink-soft">{signupContext}</p>
      )}

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
          style={inputStyle}
        />
        {error && <p className="mt-2 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

        <button
          type="submit"
          disabled={!valid || sending}
          aria-busy={sending}
          className="btn btn-primary mt-4"
        >
          {sending ? t('onboarding.auth.sending') : t('onboarding.auth.sendCode')}
        </button>
      </form>

      <p className="mt-3 text-[13px] text-ink-soft">
        {t('onboarding.auth.passwordlessNote')}
      </p>

      <button
        type="button"
        className="mt-8 min-h-11 text-center text-[15px] text-ink-soft"
        onClick={() => {
          setError(null)
          setMode(isSignup ? 'login' : 'signup')
        }}
      >
        {isSignup ? t('onboarding.auth.haveAccountQ') : t('onboarding.auth.newQ')}
        <span style={{ color: 'var(--accent-ink)' }}>
          {isSignup ? t('onboarding.auth.login') : t('onboarding.auth.createOne')}
        </span>
      </button>
    </Centered>
  )
}
