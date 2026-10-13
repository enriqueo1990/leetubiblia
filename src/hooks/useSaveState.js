import { useCallback, useState } from 'react'
import { saveOrRevert } from '../lib/saveWithRevert.js'

// Estado de un guardado para mostrar el error junto al control que lo disparó.
//   const { saving, error, run } = useSaveState()
//   run(() => updateProfile({...}), () => setX(anterior))
// `run` devuelve true/false. Limpia el error al próximo intento.
export function useSaveState() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  // Un setState tardío en un componente desmontado es inocuo en React 18, así que
  // no hace falta cleanup de montaje.
  const run = useCallback(async (save, revert) => {
    setSaving(true)
    setError(false)
    const ok = await saveOrRevert(save, revert)
    setSaving(false)
    setError(!ok)
    return ok
  }, [])

  const clearError = useCallback(() => setError(false), [])
  return { saving, error, run, clearError }
}
