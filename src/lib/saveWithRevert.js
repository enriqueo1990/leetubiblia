// Guardado "optimista pero honesto": la UI ya cambió; si el guardado falla se
// revierte. `save` puede devolver { error } (como updateProfile) o lanzar.
// Devuelve true si quedó guardado y false si no (después de revertir).
export async function saveOrRevert(save, revert) {
  let failed = false
  try {
    const res = await save()
    failed = !!res?.error
  } catch {
    failed = true
  }
  if (failed) {
    try {
      revert?.()
    } catch {
      /* revertir no debe tapar el error original */
    }
    return false
  }
  return true
}
