import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { joinGroupByCode } from '../lib/db.js'

// Aterrizaje del enlace de invitación: app/join?code=XXXX (documento maestro §5.6).
// Si el usuario ya está logueado, lo une al grupo y lo manda al detalle. Si llega
// sin sesión, el Gate lo lleva por onboarding primero (la URL /join?code se
// conserva) y al terminar cae acá y se une. Idempotente desde la UI.
//
// Es la primera pantalla que ve un invitado frío (llega del WhatsApp de su
// líder): lleva la identidad de la app —logo + nombre— y, si el código venció,
// una salida concreta en vez de un error seco.

function Wordmark() {
  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#A88B6A" />
        <g fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z" />
          <path d="M32 20v28" />
        </g>
      </svg>
      <p className="mt-4 text-[17px] font-semibold tracking-tight text-ink">Lee Tu Biblia</p>
    </>
  )
}

export default function Join() {
  const [params] = useSearchParams()
  const code = (params.get('code') || '').trim()
  const { user } = useAuth()
  const { t } = usePreferences()
  const navigate = useNavigate()
  const [status, setStatus] = useState('joining') // joining | notfound | error
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    if (!code) {
      setStatus('notfound')
      return
    }
    done.current = true
    joinGroupByCode(code)
      .then((g) => {
        if (g) navigate(`/grupos/${g.id}`, { replace: true })
        else setStatus('notfound')
      })
      .catch(() => setStatus('error'))
  }, [code, user, navigate])

  function retry() {
    done.current = false
    setStatus('joining')
    joinGroupByCode(code)
      .then((g) => (g ? navigate(`/grupos/${g.id}`, { replace: true }) : setStatus('notfound')))
      .catch(() => setStatus('error'))
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-content flex-col items-center justify-center px-8 text-center">
      <Wordmark />

      {status === 'joining' && (
        <p className="mt-8 text-[15px] text-ink-soft">{t('join.joining')}</p>
      )}

      {status === 'notfound' && (
        <>
          <p className="mt-8 text-[17px] font-semibold text-ink">{t('grupos.notFound')}</p>
          <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-ink-soft">
            {t('join.linkExpired')} {t('join.askLeader')}
          </p>
          <Link to="/grupos" className="btn btn-primary mt-7 inline-block px-8">
            {t('oracion.goToGroups')}
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <p className="mt-8 text-[17px] font-semibold text-ink">{t('grupos.joinError')}</p>
          <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-ink-soft">
            {t('join.errorHint')}
          </p>
          <div className="mt-7 flex gap-3">
            <button type="button" onClick={retry} className="btn btn-primary px-6">
              {t('common.retry')}
            </button>
            <Link to="/grupos" className="btn btn-secondary px-6">
              {t('oracion.goToGroups')}
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
