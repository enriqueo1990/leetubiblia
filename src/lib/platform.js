// Detección de plataforma para el onboarding. En iPhone la app agregada a la
// pantalla de inicio NO comparte almacenamiento con el navegador: ni la sesión
// ni las banderas locales pasan de uno a otro. Y el push solo funciona instalada.

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  // iPadOS se presenta como Mac de escritorio; lo delata el multitáctil.
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function isStandalone() {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    )
  } catch {
    return false
  }
}

// iPhone en el navegador (Safari u otro), todavía sin instalar.
export function isIOSBrowser() {
  return isIOS() && !isStandalone()
}

// Navegadores internos de redes sociales: desde ahí no se puede agregar a inicio.
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Snapchat/i.test(navigator.userAgent)
}
