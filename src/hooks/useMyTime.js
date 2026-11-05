import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import {
  MY_TIME_EVENT,
  MY_TIME_META_KEY,
  pickMyTime,
  readLocalMyTime,
  writeLocalMyTime,
} from '../lib/myTime.js'

// Lo último que trajo el servidor en esta sesión de la app (una vez por usuario):
// la sesión guardada puede tener user_metadata de antes de un cambio hecho en
// otro aparato.
const fetchedByUid = new Map()

// La preferencia de "Mi tiempo", de la cuenta, con su setter. Ajustes y Hoy
// quedan en sync (un evento avisa cuando cambia en otra pantalla).
export function useMyTime(uid) {
  const { user } = useAuth()
  const sessionCopy = user?.id === uid ? user?.user_metadata?.[MY_TIME_META_KEY] : null
  const [localCopy, setLocalCopy] = useState(() => readLocalMyTime(uid))
  const [serverCopy, setServerCopy] = useState(() => fetchedByUid.get(uid) ?? null)

  useEffect(() => {
    setLocalCopy(readLocalMyTime(uid))
    const sync = () => setLocalCopy(readLocalMyTime(uid))
    window.addEventListener(MY_TIME_EVENT, sync)
    return () => window.removeEventListener(MY_TIME_EVENT, sync)
  }, [uid])

  // Una vez por sesión de la app: la copia fresca del servidor.
  useEffect(() => {
    if (!uid || fetchedByUid.has(uid)) return
    let on = true
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const copy = data?.user?.id === uid ? data.user.user_metadata?.[MY_TIME_META_KEY] ?? null : null
        fetchedByUid.set(uid, copy)
        if (on) setServerCopy(copy)
      })
      .catch(() => {})
    return () => {
      on = false
    }
  }, [uid])

  const prefs = useMemo(() => pickMyTime(serverCopy, sessionCopy, localCopy), [serverCopy, sessionCopy, localCopy])

  // Cuenta y aparato se ponen de acuerdo, una vez que sabemos qué tiene el
  // servidor: si la cuenta es más nueva, el aparato guarda su copia (para
  // arrancar sin red); si solo el aparato tiene una elección (de antes de que
  // esto viviera en la cuenta), se sube.
  useEffect(() => {
    if (!uid || !fetchedByUid.has(uid)) return
    const hasAccount = !!(serverCopy || sessionCopy)
    const account = pickMyTime(serverCopy, sessionCopy)
    if (hasAccount && (!localCopy || account.updatedAt > localCopy.updatedAt)) {
      writeLocalMyTime(uid, account)
      return
    }
    if (!localCopy || (hasAccount && localCopy.updatedAt <= account.updatedAt)) return
    const next = { ...localCopy, updatedAt: localCopy.updatedAt || Date.now() }
    fetchedByUid.set(uid, next)
    setServerCopy(next)
    writeLocalMyTime(uid, next)
    supabase.auth.updateUser({ data: { [MY_TIME_META_KEY]: next } }).catch(() => {})
  }, [uid, localCopy, serverCopy, sessionCopy])

  const update = useCallback(
    (patch) => {
      if (!uid) return
      const next = { ...prefs, ...patch, updatedAt: Date.now() }
      // Primero el aparato (la pantalla responde al instante y sirve sin red);
      // después la cuenta.
      writeLocalMyTime(uid, next)
      fetchedByUid.set(uid, next)
      setServerCopy(next)
      supabase.auth.updateUser({ data: { [MY_TIME_META_KEY]: next } }).catch(() => {})
    },
    [uid, prefs]
  )

  return [prefs, update]
}
