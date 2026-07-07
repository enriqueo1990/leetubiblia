import { useState } from 'react'
import Sheet from './Sheet.jsx'
import { usePreferences } from '../lib/preferences.jsx'

// Hoja para anotar/editar la reflexión del día ("¿Qué te habló hoy?"). Feature 1.
// Componente presentacional: la persistencia (db.js) la cablea el contenedor.
// editable=false → la nota quedó sellada (día pasado): solo lectura.
//
// Mismo lenguaje que las tarjetas de Mi camino: la nota primero, la metadata
// (fecha opcional · día · plan) como pie en gris, sin mayúsculas ni acento.
export default function ReflectionSheet({
  planName,
  dayNumber,
  dateLabel,
  initialBody = '',
  editable = true,
  onClose,
  onSave,
  onDelete,
}) {
  const { t } = usePreferences()
  const [body, setBody] = useState(initialBody)
  const dirty = editable && body.trim() !== initialBody.trim()
  const canSave = editable && body.trim().length > 0 && dirty
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

  return (
    <Sheet
      title={editable ? t('reflectionSheet.titleEdit') : t('reflectionSheet.titleView')}
      plain={!editable}
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
            {t('common.save')}
          </button>
        ) : null
      }
    >
      {editable ? (
        <>
          <p className="text-[13px] text-ink-soft">
            {[cap(dateLabel), t('planes.dayN', { n: dayNumber }), planName].filter(Boolean).join(' · ')}
          </p>
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder={t('reflectionSheet.placeholder')}
            className="mt-3 w-full resize-none rounded-input px-4 py-3 text-[16px] outline-none"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--hairline)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[12px] text-ink-soft">
              {t('reflectionSheet.editHint')}
            </p>
            {initialBody && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="shrink-0 py-1 text-[13px] font-medium"
                style={{ color: 'var(--danger)' }}
              >
                {t('ajustes.eliminar')}
              </button>
            )}
          </div>
        </>
      ) : (
        /* Estampita: la nota al centro, fecha y día como pie, firma de la app.
           Pensada para que una captura se comparta tal cual (sin plan ni avisos). */
        <div className="pb-4 pt-6 text-center">
          <p className="text-[20px] leading-relaxed text-ink">{initialBody}</p>
          <p className="mt-5 text-[13px] text-ink-soft">
            {[cap(dateLabel), t('planes.dayN', { n: dayNumber })].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-9 text-[12px] font-medium">
            <span aria-hidden="true" style={{ color: 'var(--accent-ink)' }}>✦ </span>
            <span className="text-ink-soft" style={{ opacity: 0.8 }}>Lee Tu Biblia</span>
          </p>
        </div>
      )}
    </Sheet>
  )
}
