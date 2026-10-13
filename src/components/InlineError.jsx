// Error inline canónico: se anuncia a lectores de pantalla y vive junto al control
// que falló (no al pie de la pantalla). Un solo estilo para toda la app.
export default function InlineError({ message, className = 'mt-1' }) {
  if (!message) return null
  return (
    <p role="alert" className={`text-[13px] leading-snug ${className}`} style={{ color: 'var(--danger)' }}>
      {message}
    </p>
  )
}
