import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { PreferencesProvider } from './lib/preferences.jsx'
import './styles/index.css'
import { flushDiag } from './lib/diag.js'

// PreferencesProvider va por fuera de Auth: aplica tema/acento al instante y
// también sin sesión (onboarding). La sincronización con profiles ocurre dentro
// vía ProfilePrefSync (necesita ambos contextos).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PreferencesProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PreferencesProvider>
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

// Telemetría temporal: vuelca a Supabase los breadcrumbs de arranque acumulados
// (watchdog, reintento de perfil, getSession lento). Diferido para no competir
// con la carga inicial. Ver src/lib/diag.js — borrar cuando se confirme la causa.
setTimeout(() => {
  flushDiag()
}, 4000)
