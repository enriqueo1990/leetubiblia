// Tarjeta de error con acción de reintento. Mismo lenguaje visual que el estado
// de error de Oración/Planes, para que las pantallas que cargan datos no se
// queden colgadas en "Cargando…" ni fallen mudas ante un fallo de red.
export default function RetryError({ message = 'No se pudo cargar.', onRetry }) {
  return (
    <div
      role="alert"
      className="mt-4 rounded-card p-4 text-[15px]"
      style={{ backgroundColor: 'var(--surface-alt)' }}
    >
      <p className="text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        Reintentar
      </button>
    </div>
  )
}
