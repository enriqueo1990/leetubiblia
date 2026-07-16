// Control segmentado iOS-like. options: [{ key, label }]. Controlado por value/onChange.
export default function Segmented({ options, value, onChange, className = '', label }) {
  return (
    <div
      className={`flex rounded-input p-1 ${className}`}
      style={{ backgroundColor: 'var(--segment-track)' }}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            /* radio concéntrico: track rounded-input (14) − padding (4) = 10 */
            className="min-h-11 flex-1 rounded-[10px] px-2 py-2 text-[15px] transition-colors duration-300"
            style={{
              backgroundColor: active ? 'var(--segment-active)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-soft)',
              fontWeight: active ? 600 : 500,
              boxShadow: active ? 'var(--shadow-card)' : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
