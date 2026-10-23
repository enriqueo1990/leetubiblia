// "¿Compartís tu lectura con el grupo?" (ver groupDetail/ShareReadingSheet.jsx).
// Se ofrece sola UNA vez, al abrir un grupo sin compartir la lectura (recién
// unido, recién creado o miembro de antes). "Ahora no" la da por vista; después
// queda el botón del pulso del grupo, que abre la misma hoja.

const dismissKey = (uid) => `ltb.shareReadingAsk.dismissed.${uid}`

export function wasShareReadingAskDismissed(uid) {
  if (!uid) return true
  try {
    return localStorage.getItem(dismissKey(uid)) === '1'
  } catch {
    return false
  }
}

export function dismissShareReadingAsk(uid) {
  if (!uid) return
  try {
    localStorage.setItem(dismissKey(uid), '1')
  } catch {
    /* queda descartada en esta sesión */
  }
}
