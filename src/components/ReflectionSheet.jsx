import { useState } from 'react'
import Sheet from './Sheet.jsx'

// Hoja para anotar/editar la reflexión del día ("¿Qué te habló hoy?"). Feature 1.
// Componente presentacional: la persistencia (db.js) la cablea el contenedor.
// editable=false → la nota quedó sellada (día pasado): solo lectura.
export default function ReflectionSheet({
  planName,
  dayNumber,
  initialBody = '',
  editable = true,
  onClose,
  onSave,
  onDelete,
}) {
  const [body, setBody] = useState(initialBody)
  const dirty = editable && body.trim() !== initialBody.trim()
  const canSave = editable && body.trim().length > 0 && dirty
  const meta = `${planName} · Día ${dayNumber}`

  return (
    <Sheet
      title="Tu reflexión"
      dirty={dirty}
      onCancel={onClose}
      footer={
        editable ? (
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave?.(body.trim())}
            className="btn btn-primary"
            style={{ opacity: canSave ? 1 : 0.5 }}
          >
            Guardar
          </button>
        ) : null
      }
    >
      <p
        className="text-[13px] font-medium"
        style={{ color: 'var(--accent)', letterSpacing: '0.4px' }}
      >
        {meta.toUpperCase()}
      </p>

      {editable ? (
        <>
          <p className="mt-3 text-[15px] text-ink">¿Qué te habló hoy?</p>
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Una idea, una frase… lo que te quedó"
            className="mt-2 w-full resize-none rounded-input px-4 py-3 text-[16px] outline-none"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--hairline)',
              color: 'var(--text-primary)',
            }}
          />
          <p className="mt-2 text-[12px] text-ink-soft">
            Podés editarla hoy. Mañana queda guardada como está.
          </p>
          {initialBody && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="mt-4 text-[14px] font-medium"
              style={{ color: 'var(--danger)' }}
            >
              Eliminar nota
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 text-[17px] leading-relaxed text-ink">{initialBody}</p>
          <p className="mt-4 text-[12px] text-ink-soft">
            Esta nota quedó sellada. Las reflexiones se editan solo el día que las escribís.
          </p>
        </>
      )}
    </Sheet>
  )
}
