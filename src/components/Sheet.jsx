import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog.jsx'

// Sheet / modal (README — estructura común): grabber arriba + barra de nav
// (Cancelar / título / acción opcional) → contenido scroll → footer fijo.
// En móvil sube desde abajo; en desktop queda centrado y acotado.
//
// A11y: cierra con Escape, atrapa el foco (Tab no se va al fondo) y devuelve el
// foco al elemento previo al cerrar. Si `dirty`, cerrar por scrim/Escape pide
// confirmación para no perder lo escrito (el footer/Guardar no pasa por acá).
export default function Sheet({ title, onCancel, action, children, footer, dirty = false }) {
  const panelRef = useRef(null)
  const prevFocus = useRef(null)
  const [askDiscard, setAskDiscard] = useState(false)

  function requestClose() {
    if (dirty) setAskDiscard(true)
    else onCancel()
  }

  useEffect(() => {
    prevFocus.current = document.activeElement
    // Bloquear el scroll del fondo mientras el sheet está abierto.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Foco inicial dentro del sheet.
    const focusables = () =>
      panelRef.current?.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ) ?? []
    focusables()[0]?.focus()

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key !== 'Tab') return
      const els = Array.from(focusables()).filter((el) => !el.disabled)
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevFocus.current?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-content flex-col rounded-t-container sm:rounded-container"
        style={{ backgroundColor: 'var(--bg-app)', boxShadow: '0 -8px 40px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2.5">
          <span className="h-[5px] w-9 rounded-full" style={{ backgroundColor: 'var(--faint)' }} />
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={requestClose}
            className="text-[16px]"
            style={{ color: 'var(--accent)' }}
          >
            Cancelar
          </button>
          <span className="text-[16px] font-semibold text-ink">{title}</span>
          <span className="min-w-[64px] text-right">
            {action ?? <span className="opacity-0">·</span>}
          </span>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">{footer}</div>
        )}
      </div>

      {askDiscard && (
        <ConfirmDialog
          title="¿Descartar cambios?"
          message="Lo que escribiste no se guardará."
          confirmLabel="Descartar"
          cancelLabel="Seguir editando"
          danger
          onConfirm={() => {
            setAskDiscard(false)
            onCancel()
          }}
          onCancel={() => setAskDiscard(false)}
        />
      )}
    </div>
  )
}
