import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { PreferencesProvider } from './lib/preferences.jsx'
import './styles/index.css'

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
