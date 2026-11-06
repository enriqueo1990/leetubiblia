import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clearLeaderIntent, hasLeaderIntent } from '../lib/landingEntry.js'

// Quien llegó desde /lideres (o con ?intent=lider) y ya tiene cuenta y plan —o sea,
// el Gate lo dejó pasar a la app— aterriza en Grupos con la hoja de «crear grupo»
// abierta, en lugar de en Hoy. La intención se guardó en AuthFlow; acá se consume
// una sola vez. Solo actúa al aterrizar en la raíz: nunca arrebata una pantalla a
// quien ya está navegando.
export default function LeaderIntentRedirect() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (pathname !== '/') return
    let wants = false
    try {
      wants = hasLeaderIntent(localStorage)
      if (wants) clearLeaderIntent(localStorage)
    } catch {
      /* sin localStorage: se queda en Hoy */
    }
    if (wants) navigate('/grupos', { replace: true, state: { createGroup: true } })
  }, [pathname, navigate])

  return null
}
