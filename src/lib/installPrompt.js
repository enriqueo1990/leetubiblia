// Captura temprana del prompt nativo de instalación para poder ofrecerlo recién
// después de que la persona obtuvo valor. `beforeinstallprompt` no existe en iOS;
// allí se conserva la guía manual que ya muestra el onboarding.
let initialized = false
let deferredPrompt = null
let installed = false
let revision = 0
const listeners = new Set()

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function notify() {
  revision += 1
  for (const listener of listeners) listener()
}

export function initInstallPrompt() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  installed = isStandalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    notify()
  })
}

export function subscribeInstallPrompt(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getInstallPromptRevision() {
  return revision
}

export function canInstallApp() {
  return !installed && deferredPrompt != null
}

export async function requestAppInstall() {
  const prompt = deferredPrompt
  if (!prompt || installed) return { outcome: 'unavailable' }

  try {
    await prompt.prompt()
    const choice = await prompt.userChoice
    // El evento solo se puede usar una vez, incluso si la persona cancela el
    // diálogo del navegador. El navegador emitirá otro cuando corresponda.
    if (deferredPrompt === prompt) deferredPrompt = null
    notify()
    return choice ?? { outcome: 'dismissed' }
  } catch {
    // Si el navegador rechazó abrirlo antes de consumirlo, conservarlo permite
    // reintentar desde Ajustes.
    return { outcome: 'error' }
  }
}
