import { useEffect } from 'react'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { flushDiag, recordAppOpen } from './lib/diag.js'
import { recordPresence } from './lib/presence.js'
import { ensureBrandFont } from './lib/brandFont.js'

export default function PrivateRoot() {
  useEffect(() => {
    recordAppOpen()
    // Newsreader: el pasaje de Hoy, las portadas y "Orar ahora" la usan.
    ensureBrandFont()
    const timer = setTimeout(() => {
      flushDiag()
      recordPresence()
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
