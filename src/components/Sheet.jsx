// Sheet / modal (README — estructura común): grabber arriba + barra de nav
// (Cancelar / título / acción opcional) → contenido scroll → footer fijo.
// En móvil sube desde abajo; en desktop queda centrado y acotado.
export default function Sheet({ title, onCancel, action, children, footer }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={onCancel}
    >
      <div
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
            onClick={onCancel}
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
    </div>
  )
}
