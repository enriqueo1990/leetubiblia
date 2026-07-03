// Estado vacío canónico (mismo lenguaje en Diario, Grupos, Oración, Testimonios):
// círculo 72px con ícono en acento → título opcional → texto → acciones opcionales.
// Sin `icon` queda solo el texto centrado (vacíos menores, p. ej. un filtro sin items).
export default function EmptyState({ icon, title, text, children }) {
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      {icon && (
        <div
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-[30px]"
          style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--accent)' }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      {title && <h2 className="mt-5 text-[20px] font-semibold text-ink">{title}</h2>}
      <p
        className={`${title ? 'mt-2' : icon ? 'mt-4' : ''} max-w-[300px] text-[15px] leading-relaxed text-ink-soft`}
      >
        {text}
      </p>
      {children && <div className="mt-6 w-full space-y-3">{children}</div>}
    </div>
  )
}
