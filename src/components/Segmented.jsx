// Control segmentado iOS-like. options: [{ key, label }]. Controlado por value/onChange.
export default function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`flex rounded-input p-1 ${className}`}
      style={{ backgroundColor: 'var(--segment-track)' }}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className="flex-1 rounded-[11px] py-1.5 text-[14px] transition-colors duration-300"
            style={{
              backgroundColor: active ? 'var(--segment-active)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-soft)',
              fontWeight: active ? 600 : 500,
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
