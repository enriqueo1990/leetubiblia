import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { joinGroupByCode } from '../lib/db.js'

// Aterrizaje del enlace de invitación: app/join?code=XXXX (documento maestro §5.6).
// Si el usuario ya está logueado, lo une al grupo y lo manda al detalle. Si llega
// sin sesión, el Gate lo lleva por onboarding primero (la URL /join?code se
// conserva) y al terminar cae acá y se une. Idempotente desde la UI.
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
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
      {status === 'joining' && <p className="text-[15px] text-ink-soft">{t('join.joining')}</p>}

      {status === 'notfound' && (
        <>
          <p className="text-[16px] text-ink">{t('grupos.notFound')}</p>
          <p className="mt-1 text-[15px] text-ink-soft">
            {t('join.linkExpired')}
          </p>
          <Link to="/grupos" className="btn btn-primary mt-6 inline-block px-8">
            {t('oracion.goToGroups')}
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <p className="text-[16px] text-ink">{t('grupos.joinError')}</p>
          <div className="mt-4 flex gap-3">
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
