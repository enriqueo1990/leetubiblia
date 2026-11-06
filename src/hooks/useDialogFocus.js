import { useEffect, useRef } from 'react'

// Manejo de foco de un diálogo modal propio (Mi tiempo, Novedades): guarda el
// elemento que tenía el foco al abrir, lleva el foco adentro (al panel, o al
// primer control si el panel no es enfocable), atrapa Tab y, al cerrar, devuelve
// el foco. Es la misma lógica de Sheet.jsx, para los diálogos que no usan Sheet.
// `panelRef` apunta al panel (idealmente con tabIndex={-1}).
export default function useDialogFocus(panelRef) {
  // Se captura en el primer render, antes de que algo de adentro tome el foco.
  const returnTo = useRef(typeof document !== 'undefined' ? document.activeElement : null)

  useEffect(() => {
    const panel = panelRef.current
    const back = returnTo.current
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true })
    }
    function onKey(e) {
      if (e.key !== 'Tab' || !panelRef.current) return
      const els = Array.from(
        panelRef.current.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.disabled)
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [panelRef])
}
