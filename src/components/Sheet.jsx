import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ConfirmDialog from './ConfirmDialog.jsx'

// Sheet / modal (README — estructura común): grabber arriba + barra de nav
// (Cancelar / título / acción opcional) → contenido scroll → footer fijo.
// En móvil sube desde abajo; en desktop queda centrado y acotado.
//
// A11y: cierra con Escape, atrapa el foco (Tab no se va al fondo) y devuelve el
// foco al elemento previo al cerrar. Si `dirty`, cerrar por scrim/Escape pide
// confirmación para no perder lo escrito (el footer/Guardar no pasa por acá).
//
// Teclado en iOS: el scrim y el panel son dos elementos fixed independientes.
// El panel tiene fixed bottom-0 propio, lo que hace que iOS Safari lo ancle
// al visual viewport (encima del teclado) sin necesidad de JS.
// `plain`: sin barra de nav (Cancelar/título) — solo una ✕ flotante. Para
// contenido tipo estampita (ver una nota) donde el cromo arruina la captura.
export default function Sheet({ title, onCancel, action, children, footer, dirty = false, plain = false }) {
  const panelRef = useRef(null)
  const prevFocus = useRef(null)
  const dirtyRef = useRef(dirty)
  const [askDiscard, setAskDiscard] = useState(false)

  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  function requestClose() {
    if (dirtyRef.current) setAskDiscard(true)
    else onCancel()
  }

  useEffect(() => {
    prevFocus.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusables = () =>
      panelRef.current?.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ) ?? []
    focusables()[0]?.focus()

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (dirtyRef.current) setAskDiscard(true)
        else onCancel()
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
  }, [])

  return createPortal(
    <>
      {/* Scrim: cubre toda la pantalla, click cierra */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        style={{ backgroundColor: 'var(--scrim)' }}
        onClick={requestClose}
      />

      {/* Wrapper: pointer-events-none para que clicks fuera del panel traspasen
          al scrim. Centrado en todos los tamaños con margen lateral. */}
      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-5">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="pointer-events-auto relative flex max-h-[92dvh] w-full max-w-content flex-col rounded-container"
          style={{ backgroundColor: 'var(--bg-app)', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}
        >
          {/* Nav — o solo la ✕ en la variante plain */}
          {plain ? (
            <button
              type="button"
              onClick={requestClose}
              aria-label="Cerrar"
              className="absolute right-1.5 top-1.5 z-10 flex h-11 w-11 items-center justify-center text-[16px] leading-none text-ink-soft"
              style={{ opacity: 0.55 }}
            >
              ✕
            </button>
          ) : (
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
          )}

          {/* Contenido */}
          <div className={`flex-1 overflow-y-auto px-5 pb-4 ${plain ? 'pt-8' : 'pt-2'}`}>{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-5 pb-5 pt-2">{footer}</div>
          )}
        </div>
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
    </>,
    document.body
  )
}
