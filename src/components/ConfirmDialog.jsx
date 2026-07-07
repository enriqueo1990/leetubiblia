import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePreferences } from '../lib/preferences.jsx'

// Diálogo de confirmación propio (reemplaza window.confirm/alert para mantener el
// lenguaje visual de la app, incluso en PWA instalada). Cierra con Escape o tap
// en el scrim; foco inicial en la acción y trampa de foco básica.
//   danger  → la acción primaria se pinta en --danger (borrar/quitar).
//   busy    → deshabilita y muestra "…" mientras corre la acción async.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const { t } = usePreferences()
  const confirm = confirmLabel ?? t('common.confirm')
  const cancel = cancelLabel ?? t('common.cancel')
  const confirmRef = useRef(null)
  const panelRef = useRef(null)
  const prevFocus = useRef(null)

  // Foco inicial + devolución al cerrar. Deps vacías: no debe re-ejecutarse al
  // cambiar `busy` (si no, robaría el foco a mitad de la acción async).
  useEffect(() => {
    prevFocus.current = document.activeElement
    confirmRef.current?.focus()
    return () => prevFocus.current?.focus?.()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        // Consumir el Escape acá: si este diálogo está anidado en un Sheet, evita
        // que el Sheet también reaccione (capture + stopImmediatePropagation).
        e.stopImmediatePropagation()
        if (!busy) onCancel()
        return
      }
      // Trampa de foco: Tab no se escapa al contenido de fondo.
      if (e.key !== 'Tab') return
      const els = Array.from(
        panelRef.current?.querySelectorAll('button:not([disabled])') ?? []
      )
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
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [busy, onCancel])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-8 backdrop-blur-sm"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={() => !busy && onCancel()}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className="w-full max-w-[320px] rounded-container p-5 text-center"
        style={{ backgroundColor: 'var(--surface)', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[18px] font-bold text-ink">{title}</h2>
        {message && <p className="mt-2 text-[15px] text-ink-soft">{message}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            disabled={busy}
            onClick={onCancel}
          >
            {cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-primary flex-1"
            disabled={busy}
            style={danger ? { backgroundColor: 'var(--danger)', color: '#fff' } : undefined}
            onClick={onConfirm}
          >
            {busy ? '…' : confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
