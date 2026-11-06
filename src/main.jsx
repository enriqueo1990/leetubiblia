import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import Root from './Root.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AppUpdateBanner from './components/AppUpdateBanner.jsx'
import { PreferencesProvider } from './lib/preferences.jsx'
import { initInstallPrompt } from './lib/installPrompt.js'
import { initAppUpdate } from './lib/appUpdate.js'
import { isStoreApp } from './lib/platform.js'
import './styles/index.css'

// Capturarlo antes de montar React evita perder el único evento nativo si la
// sesión tarda en hidratarse. La UI decide más tarde cuándo ofrecerlo.
initInstallPrompt()
initAppUpdate()
// La TWA de Play trae ?source=twa solo en la primera carga: se marca antes de
// que cualquier redirección del router lo pierda.
isStoreApp()

// PreferencesProvider va por fuera de Auth: aplica tema/acento al instante y
// también sin sesión (onboarding). La sincronización con profiles ocurre dentro
// vía ProfilePrefSync (necesita ambos contextos).
const app = (
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

// Las landings públicas (/info, /lideres, /ayuda, /privacidad) se emiten con su
// HTML ya dentro de #root (data-prerendered, ver vite.config.js): React lo
// hidrata en lugar de reemplazarlo, así no hay parpadeo. El resto de rutas —y
// cualquier carga que llegue con el #root vacío, p. ej. el index.html de respaldo
// del service worker— monta de cero, con el splash.
const container = document.getElementById('root')
if (container.hasAttribute('data-prerendered')) {
  // scrollTopOnEnter (landingHydration.js) consume esta marca: en la carga en frío
  // no se fuerza el scroll arriba.
  window.__ltbHydrating = true
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
window.__ltbReactMounted = true

// React montó: liberamos el flag del watchdog de arranque (ver index.html) para
// que un eventual cuelgue posterior en esta misma sesión también pueda recargar.
try {
  sessionStorage.removeItem('ltb.bootReload')
} catch {
  /* no-op */
}
