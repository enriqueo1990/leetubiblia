import { useCallback, useEffect, useState } from 'react'
import { MY_TIME_EVENT, readMyTime, saveMyTime } from '../lib/myTime.js'

// La preferencia de "Mi tiempo" con su setter; Ajustes y Hoy quedan en sync
// (un evento avisa cuando cambia en otra pantalla).
export function useMyTime(uid) {
  const [prefs, setPrefs] = useState(() => readMyTime(uid))
  useEffect(() => {
    setPrefs(readMyTime(uid))
    const sync = () => setPrefs(readMyTime(uid))
    window.addEventListener(MY_TIME_EVENT, sync)
    return () => window.removeEventListener(MY_TIME_EVENT, sync)
  }, [uid])
  const update = useCallback((patch) => saveMyTime(uid, { ...readMyTime(uid), ...patch }), [uid])
  return [prefs, update]
}
