import { useEffect, useState } from 'react'

// Barra que se aparta mientras leés: se esconde al bajar y vuelve al subir un
// poco, al volver arriba de todo o al llegar al final (donde está la acción).
// `enabled` en false la deja siempre visible (y la repone si estaba escondida).
const THRESHOLD = 8 // px de desplazamiento antes de decidir (ignora temblores)
const TOP = 80 // cerca del comienzo, siempre visible
const BOTTOM = 48 // cerca del final, siempre visible

export function useHideOnScroll(enabled) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setHidden(false)
      return
    }
    let last = window.scrollY
    let frame = 0
    function update() {
      frame = 0
      const y = window.scrollY
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - BOTTOM
      if (y < TOP || atEnd) {
        setHidden(false)
        last = y
        return
      }
      const delta = y - last
      if (Math.abs(delta) < THRESHOLD) return
      setHidden(delta > 0)
      last = y
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled])

  return enabled && hidden
}
