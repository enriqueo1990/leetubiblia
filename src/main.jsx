import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import Root from './Root.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AppUpdateBanner from './components/AppUpdateBanner.jsx'
import { PreferencesProvider } from './lib/preferences.jsx'
import { initInstallPrompt } from './lib/installPrompt.js'
import { initAppUpdate } from './lib/appUpdate.js'
import './styles/index.css'

// Capturarlo antes de montar React evita perder el único evento nativo si la
// sesión tarda en hidratarse. La UI decide más tarde cuándo ofrecerlo.
initInstallPrompt()
initAppUpdate()

// PreferencesProvider va por fuera de Auth: aplica tema/acento al instante y
// también sin sesión (onboarding). La sincronización con profiles ocurre dentro
// vía ProfilePrefSync (necesita ambos contextos).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <PreferencesProvider>
          <AppUpdateBanner />
          <Root />
        </PreferencesProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
)
window.__ltbReactMounted = true

// React montó: liberamos el flag del watchdog de arranque (ver index.html) para
// que un eventual cuelgue posterior en esta misma sesión también pueda recargar.
try {
  sessionStorage.removeItem('ltb.bootReload')
} catch {
  /* no-op */
}
