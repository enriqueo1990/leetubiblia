// "Engancharse" a un plan ya empezado. Si el usuario ya venía leyendo este plan
// por otro lado, en vez de arrancar desde el día 1 puede indicar en qué día va.
// Componente controlado: `day` es el número de día (>=1) o null si está apagado.
// Al guardar, el padre calcula plan_start_date = hoy − (día − 1) y da por leídos
// los días anteriores (ver startDateForDay / markDaysRead en lib/db.js).
const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--hairline)',
  color: 'var(--text-primary)',
}

export default function ResumeFromDay({ durationDays, day, onChange }) {
  const on = day != null

  function toggle() {
    onChange(on ? null : 1)
  }

  function onInput(e) {
    const raw = e.target.value.replace(/[^\d]/g, '')
    if (raw === '') {
      onChange(null)
      return
    }
    let n = Number(raw)
    if (durationDays) n = Math.min(n, durationDays)
    onChange(Math.max(1, n))
  }

  return (
    <div className="card p-4">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[15px] font-medium text-ink">
          Ya venía leyendo este plan
        </span>
        <span
          className="relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200"
          style={{ backgroundColor: on ? 'var(--accent)' : 'var(--hairline)' }}
        >
          <span
            className="absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white transition-all duration-200"
            style={{ left: on ? '21px' : '3px' }}
          />
        </span>
      </button>

      {on && (
        <div className="mt-4">
          <label className="text-[15px] text-ink-soft">¿En qué día vas?</label>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={day ?? ''}
            onChange={onInput}
            placeholder="Ej: 140"
            className="mt-2 w-full rounded-input px-4 py-3 text-[16px] outline-none"
            style={inputStyle}
          />
          <p className="mt-2 text-[13px] text-ink-soft">
            Empezarás en el día {day || '—'}
            {durationDays ? ` de ${durationDays}` : ''}. Los días anteriores quedan
            dados por leídos.
          </p>
        </div>
      )}
    </div>
  )
}
