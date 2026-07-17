import { useEffect } from 'react'

// Le avisa al splash estático que React ya tiene una pantalla real lista detrás.
// Este componente solo aporta la señal de disponibilidad; la salida breve queda
// a cargo de la transición CSS del splash.
export default function LaunchReady({ children }) {
  useEffect(() => {
    window.__ltbAppReady = true
    window.dispatchEvent(new Event('ltb:app-ready'))
  }, [])

  return children
}
