import { useState } from 'react'
import Sheet from './Sheet.jsx'
import ShareImageSheet from './ShareImageSheet.jsx'
import { ShareIcon } from './icons.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { shareQuestion } from '../lib/shareImage.js'

// Hoja para anotar/editar la reflexión del día ("¿Qué te habló hoy?"). Feature 1.
// Componente presentacional: la persistencia (db.js) la cablea el contenedor.
// editable=false → la nota quedó sellada (día pasado): solo lectura.
//
// Mismo lenguaje que las tarjetas de Mi camino: la nota primero, la metadata
// (fecha opcional · día · plan) como pie en gris, sin mayúsculas ni acento.
//
// shareData ({ meta, question, answer, refs, filename }, opcional): habilita
// compartir la nota como imagen con el mismo compositor del catecismo (estilos +
// formato + firma leetubiblia.com). Solo cuando la nota mostrada está guardada
// tal cual (nunca se comparte texto que no quedó en el diario).
export default function ReflectionSheet({
  planName,
  dayNumber,
  dateLabel,
  initialBody = '',
  editable = true,
  shareData = null,
  onClose,
  onSave,
  onDelete,
}) {
  const { t } = usePreferences()
  const [body, setBody] = useState(initialBody)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const dirty = editable && body.trim() !== initialBody.trim()
  const canSave = editable && body.trim().length > 0 && dirty && !saving && !deleting
  // Compartible = hay nota guardada y lo que se ve es exactamente eso.
  const canShare = !!shareData && !!initialBody && !dirty
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

  async function handleShare(style, format) {
    if (sharing || !shareData) return
    setShareOpen(false)
    setSharing(true)
    setShareError(false)
    try {
      await shareQuestion({ ...shareData, style, format })
    } catch {
      setShareError(true)
    } finally {
      setSharing(false)
    }
  }

  async function handleSave() {
    if (!canSave || !onSave) return
    setSaving(true)
    setSaveError(false)
    try {
      await onSave(body.trim())
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete || deleting || saving) return
    setDeleting(true)
    setDeleteError(false)
    try {
      await onDelete()
    } catch {
      setDeleteError(true)
    } finally {
      setDeleting(false)
    }
  }

  // El compositor reemplaza a la hoja de la nota (nunca dos sheets apilados);
  // cancelar vuelve a la nota.
  if (shareOpen && shareData) {
    return (
      <ShareImageSheet
        data={shareData}
        onShare={handleShare}
        onCancel={() => setShareOpen(false)}
      />
    )
  }

  const shareButton = canShare && (
    <button
      type="button"
      onClick={() => setShareOpen(true)}
      disabled={sharing}
      className="flex min-h-11 w-full items-center justify-center gap-2 text-[14px] font-semibold disabled:opacity-50"
      style={{ color: 'var(--accent-ink)' }}
    >
      <ShareIcon size={16} /> {t('reflectionSheet.shareImage')}
    </button>
  )

  return (
    <Sheet
      title={editable ? t('reflectionSheet.titleEdit') : t('reflectionSheet.titleView')}
      plain={!editable}
      dirty={dirty}
      onCancel={onClose}
      footer={
        editable ? (
          <>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className="btn btn-primary"
              style={{ opacity: canSave ? 1 : 0.5 }}
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
            {shareButton && <div className="mt-1">{shareButton}</div>}
          </>
        ) : (
          shareButton || null
        )
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
            disabled={saving}
            onChange={(e) => {
              setBody(e.target.value)
              setSaveError(false)
            }}
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
                onClick={handleDelete}
                disabled={deleting || saving}
                className="inline-flex min-h-11 shrink-0 items-center px-2 text-[13px] font-medium disabled:opacity-50"
                style={{ color: 'var(--danger)' }}
              >
                {deleting ? t('common.deleting') : t('ajustes.eliminar')}
              </button>
            )}
          </div>
          {saveError && (
            <p className="mt-2 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>
              {t('common.saveError')}
            </p>
          )}
          {deleteError && (
            <p className="mt-2 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>
              {t('common.deleteError')}
            </p>
          )}
          {shareError && (
            <p className="mt-1 text-[12px]" role="alert" style={{ color: 'var(--danger)' }}>
              {t('hoy.imageError')}
            </p>
          )}
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
          {shareError && (
            <p className="mt-3 text-[12px]" style={{ color: 'var(--danger)' }}>
              {t('hoy.imageError')}
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}
