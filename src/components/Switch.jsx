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
      className="relative inline-flex h-11 w-12 shrink-0 items-center justify-center"
      style={{
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden="true"
        className="relative block h-[29px] w-12 rounded-full"
        style={{
          backgroundColor: on ? 'var(--accent)' : 'var(--surface-alt)',
          border: on ? '1px solid transparent' : '1px solid var(--control-border)',
          transition: 'background-color 0.2s ease',
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            top: 2,
            left: on ? 21 : 2,
            width: 23,
            height: 23,
            backgroundColor: 'var(--on-accent)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            transition: 'left 0.2s ease',
          }}
        />
      </span>
    </button>
  )
}
