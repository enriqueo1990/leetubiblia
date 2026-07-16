import { useEffect } from 'react'

// Le avisa al splash estático que React ya tiene una pantalla real lista detrás.
// El splash decide cuándo retirarse para respetar la duración completa de su
// animación; este componente solo aporta la señal de disponibilidad.
export default function LaunchReady({ children }) {
  useEffect(() => {
    window.__ltbAppReady = true
    window.dispatchEvent(new Event('ltb:app-ready'))
  }, [])

  return children
}
