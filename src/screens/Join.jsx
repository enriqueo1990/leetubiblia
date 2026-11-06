import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { joinGroupByCode } from '../lib/db.js'
import BrandMark from '../components/BrandMark.jsx'

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
      <BrandMark size={64} />
      <p className="mt-4 text-[1.0625rem] font-semibold tracking-tight text-ink">Lee Tu Biblia</p>
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
        <h1 className="mt-8 text-[0.9375rem] text-ink-soft">{t('join.joining')}</h1>
      )}

      {status === 'notfound' && (
        <>
          <h1 className="mt-8 text-[1.0625rem] font-semibold text-ink">{t('grupos.notFound')}</h1>
          <p className="mt-2 max-w-[300px] text-[0.9375rem] leading-relaxed text-ink-soft">
            {t('join.linkExpired')} {t('join.askLeader')}
          </p>
          <Link to="/grupos" className="btn btn-primary mt-7 inline-block px-8">
            {t('oracion.goToGroups')}
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="mt-8 max-w-[300px] text-[1.0625rem] font-semibold leading-snug text-ink">{t('grupos.joinError')}</h1>
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
