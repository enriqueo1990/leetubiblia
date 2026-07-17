let initialized = false
let updateAvailable = false
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener())
}

// Descarga la versión nueva, pero nunca recarga una pantalla por su cuenta.
// Si el usuario ya tenía un Service Worker activo, el cambio de controlador
// significa que hay una versión lista: la UI ofrece aplicarla en un momento seguro.
export function initAppUpdate() {
  if (initialized || !('serviceWorker' in navigator)) return
  initialized = true
  const hadController = Boolean(navigator.serviceWorker.controller)

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return
    updateAvailable = true
    notify()
  })

  const check = () => {
    navigator.serviceWorker.ready
      .then((registration) => registration.update())
      .catch(() => {})
  }
  if (document.readyState === 'complete') check()
  else window.addEventListener('load', check, { once: true })
}

export function getAppUpdateSnapshot() {
  return updateAvailable
}

export function subscribeToAppUpdate(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function applyAppUpdate() {
  window.location.reload()
}
