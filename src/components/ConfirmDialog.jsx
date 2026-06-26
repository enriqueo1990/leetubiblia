import { useEffect, useRef } from 'react'

// Diálogo de confirmación propio (reemplaza window.confirm/alert para mantener el
// lenguaje visual de la app, incluso en PWA instalada). Cierra con Escape o tap
// en el scrim; foco inicial en la acción y trampa de foco básica.
//   danger  → la acción primaria se pinta en --danger (borrar/quitar).
//   busy    → deshabilita y muestra "…" mientras corre la acción async.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    confirmRef.current?.focus()
    function onKey(e) {
      if (e.key !== 'Escape') return
      // Consumir el Escape acá: si este diálogo está anidado en un Sheet, evita
      // que el Sheet también reaccione (capture + stopImmediatePropagation).
      e.stopImmediatePropagation()
      if (!busy) onCancel()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [busy, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-8"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={() => !busy && onCancel()}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
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
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-primary flex-1"
            disabled={busy}
            style={danger ? { backgroundColor: 'var(--danger)', color: '#fff' } : undefined}
            onClick={onConfirm}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
