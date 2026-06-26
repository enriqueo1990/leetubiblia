// Toggle accesible estilo iOS (track 48×29, knob 24). On = acento.
// Único origen del switch en la app: expone role="switch" + aria-checked para
// que el estado se anuncie. Acepta `label` (aria-label) cuando no hay texto visible.
export default function Switch({ on, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!on)}
      className="relative inline-block shrink-0"
      style={{
        width: 48,
        height: 29,
        borderRadius: 15,
        backgroundColor: on ? 'var(--accent)' : 'var(--surface-alt)',
        transition: 'background-color 0.2s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          top: 2.5,
          left: on ? 21.5 : 2.5,
          width: 24,
          height: 24,
          backgroundColor: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          transition: 'left 0.2s ease',
        }}
      />
    </button>
  )
}
