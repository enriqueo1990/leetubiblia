import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import Root from './Root.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { PreferencesProvider } from './lib/preferences.jsx'
import './styles/index.css'

// AutoUpdate descarga la nueva versión, pero una pestaña abierta puede seguir
// controlada por el worker anterior. Al detectar un cambio de controlador se
// recarga solo si ya había un worker activo; la primera instalación no entra en
// un bucle de recargas.
function keepServiceWorkerFresh() {
  if (!('serviceWorker' in navigator)) return
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      if (!hadController || window.__ltbSwReloaded) return
      window.__ltbSwReloaded = true
      window.location.reload()
    },
    { once: true }
  )
  navigator.serviceWorker.ready
    .then((registration) => registration.update())
    .catch(() => {})
}

// PreferencesProvider va por fuera de Auth: aplica tema/acento al instante y
// también sin sesión (onboarding). La sincronización con profiles ocurre dentro
// vía ProfilePrefSync (necesita ambos contextos).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <PreferencesProvider>
          <Root />
        </PreferencesProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
)

// React montó: liberamos el flag del watchdog de arranque (ver index.html) para
// que un eventual cuelgue posterior en esta misma sesión también pueda recargar.
try {
  sessionStorage.removeItem('ltb.bootReload')
} catch {
  /* no-op */
}

if (document.readyState === 'complete') {
  keepServiceWorkerFresh()
} else {
  window.addEventListener('load', keepServiceWorkerFresh, { once: true })
}
