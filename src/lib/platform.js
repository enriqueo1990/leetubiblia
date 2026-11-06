// Detección de plataforma para el onboarding. En iPhone la app agregada a la
// pantalla de inicio NO comparte almacenamiento con el navegador: ni la sesión
// ni las banderas locales pasan de uno a otro. Y el push solo funciona instalada.

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS se presenta como Mac de escritorio; lo delata el multitáctil (y que
  // no diga Android: un emulador táctil corriendo en una Mac también es MacIntel).
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !/android/i.test(ua))
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

export function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

// ¿Desde qué aparato se está mirando una página pública? Para marcar el paso a
// paso de instalación que le toca ('installed' = ya corre como app instalada).
export function getInstallPlatform() {
  if (isStandalone()) return 'installed'
  if (isIOS()) return 'ios'
  if (isAndroid()) return 'android'
  return 'desktop'
}

// iPhone en el navegador (Safari u otro), todavía sin instalar.
export function isIOSBrowser() {
  return isIOS() && !isStandalone()
}

// Navegadores internos de redes sociales: desde ahí no se puede agregar a inicio.
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|BytedanceWebview|Snapchat/i.test(navigator.userAgent)
}

// ¿Corre como app de tienda? Android: la TWA de Play abre con ?source=twa (lo fija
// su twa-manifest) y con referrer android-app://. iOS (si algún día se hace con
// Capacitor): el puente nativo. La marca se guarda porque la TWA solo trae el
// parámetro en la primera carga, no al navegar ni al recargar.
// Dentro de una app de tienda no se piden donaciones: Apple y Google exigen sus
// propios cobros para eso, y la meta se costea desde la web.
const STORE_APP_KEY = 'ltb.storeApp'

export function isStoreApp() {
  if (typeof window === 'undefined') return false
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true
    const fromTwa =
      new URLSearchParams(window.location.search).get('source') === 'twa' ||
      document.referrer.startsWith('android-app://')
    if (fromTwa) {
      localStorage.setItem(STORE_APP_KEY, '1')
      return true
    }
    return localStorage.getItem(STORE_APP_KEY) === '1'
  } catch {
    return false
  }
}
