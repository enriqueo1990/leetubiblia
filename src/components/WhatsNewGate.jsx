import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { useMyTime } from '../hooks/useMyTime.js'
import {
  OPEN_WHATS_NEW_EVENT,
  WHATS_NEW_META_KEY,
  WHATS_NEW_VERSION,
  readLocalWhatsNew,
  shouldShowWhatsNew,
  writeLocalWhatsNew,
} from '../lib/whatsNew.js'
import WhatsNew from './WhatsNew.jsx'

// Decide cuándo abrir "Novedades": una vez, al entrar, a quien ya usaba la app;
// y cuando se pide desde Ajustes. Al cerrar se marca en la cuenta (y en el
// aparato, para no esperar la red).
export default function WhatsNewGate() {
  const { user, profile } = useAuth()
  const { pathname } = useLocation()
  const [myTime, setMyTime] = useMyTime(user?.id)
  const [open, setOpen] = useState(false)
  // Se decide una sola vez por sesión de la app (un ref: marcarlo no debe volver
  // a correr el efecto, que cancelaría el temporizador).
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || !user || !profile || pathname === '/orar') return
    handled.current = true
    const show = shouldShowWhatsNew({
      seenAccount: user.user_metadata?.[WHATS_NEW_META_KEY] ?? null,
      seenLocal: readLocalWhatsNew(user.id),
      accountCreatedAt: profile.created_at ?? user.created_at,
    })
    // Un respiro para que Hoy cargue detrás antes de cubrirlo.
    if (show) setTimeout(() => setOpen(true), 700)
  }, [user, profile, pathname])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_WHATS_NEW_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_WHATS_NEW_EVENT, onOpen)
  }, [])

  function close() {
    setOpen(false)
    if (!user) return
    writeLocalWhatsNew(user.id, WHATS_NEW_VERSION)
    if (user.user_metadata?.[WHATS_NEW_META_KEY] !== WHATS_NEW_VERSION) {
      supabase.auth.updateUser({ data: { [WHATS_NEW_META_KEY]: WHATS_NEW_VERSION } }).catch(() => {})
    }
  }

  if (!open) return null
  return (
    <WhatsNew
      myTimeEnabled={myTime.enabled}
      onEnableMyTime={() => setMyTime({ enabled: true, inviteDismissed: true })}
      onClose={close}
    />
  )
}
