import { useState } from 'react'
import Sheet from '../components/Sheet.jsx'
import Segmented from '../components/Segmented.jsx'
import { useAuth } from '../lib/auth.jsx'
import { createPrayer, updatePrayer, deletePrayer } from '../lib/db.js'

// Crear / editar pedido de oración (documento maestro §5.5, README pantalla 5).
// Solo el autor edita/borra (garantizado además por RLS).
const VIS = [
  { key: 'private', label: 'Privado' },
  { key: 'shared', label: 'Compartir con grupo' },
]
const STATUS = [
  { key: 'active', label: 'Activo' },
  { key: 'answered', label: 'Respondido' },
]

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--hairline)',
  color: 'var(--text-primary)',
}

function FieldLabel({ children, optional }) {
  return (
    <p className="mb-1.5 mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
      {children}
      {optional && <span className="font-normal lowercase"> (opcional)</span>}
    </p>
  )
}

export default function PrayerSheet({ mode, prayer, groups, onClose, onSaved }) {
  const { user } = useAuth()
  const editing = mode === 'edit'

  const [title, setTitle] = useState(prayer?.title ?? '')
  const [description, setDescription] = useState(prayer?.description ?? '')
  const [visibility, setVisibility] = useState(prayer?.visibility ?? 'private')
  const [groupId, setGroupId] = useState(prayer?.shared_group_id ?? groups?.[0]?.id ?? null)
  const [status, setStatus] = useState(prayer?.status ?? 'active')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const needsGroup = visibility === 'shared'
  const canSave =
    title.trim().length > 0 && (!needsGroup || groupId) && !busy

  async function handleSave() {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        const patch = {
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          shared_group_id: needsGroup ? groupId : null,
          status,
          // answered_at: sella al pasar a respondido; lo limpia al volver a activo.
          answered_at:
            status === 'answered'
              ? prayer.answered_at ?? new Date().toISOString()
              : null,
        }
        await updatePrayer(prayer.id, patch)
      } else {
        await createPrayer({ userId: user.id, title, description, visibility, groupId })
      }
      onSaved()
    } catch (e) {
      setError('No se pudo guardar. Revisá los datos e intentá de nuevo.')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este pedido? No se puede deshacer.')) return
    setBusy(true)
    try {
      await deletePrayer(prayer.id)
      onSaved()
    } catch {
      setError('No se pudo eliminar.')
      setBusy(false)
    }
  }

  const answeredDate =
    editing && status === 'answered' && prayer?.answered_at
      ? new Date(prayer.answered_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
      : null

  return (
    <Sheet
      title={editing ? 'Editar pedido' : 'Nuevo pedido'}
      onCancel={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
          onClick={handleSave}
        >
          {busy ? 'Guardando…' : 'Guardar pedido'}
        </button>
      }
    >
      <FieldLabel>
        Título <span style={{ color: 'var(--accent)' }}>•</span>
      </FieldLabel>
      <input
        type="text"
        autoFocus={!editing}
        placeholder="Por qué estás orando"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />

      <FieldLabel optional>Descripción</FieldLabel>
      <textarea
        rows={3}
        placeholder="Detalles, si querés…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full resize-none rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />

      <FieldLabel>Visibilidad</FieldLabel>
      <Segmented options={VIS} value={visibility} onChange={setVisibility} />

      {needsGroup && (
        <div className="card mt-3 divide-y divide-hairline">
          {groups?.length ? (
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-[16px] text-ink">{g.name}</span>
                {g.id === groupId && (
                  <span style={{ color: 'var(--accent)' }}>✓</span>
                )}
              </button>
            ))
          ) : (
            <p className="px-4 py-3 text-[14px] text-ink-soft">
              No estás en ningún grupo todavía. Unite a uno desde Grupos para compartir.
            </p>
          )}
        </div>
      )}

      {editing && (
        <>
          <FieldLabel>Estado</FieldLabel>
          <Segmented options={STATUS} value={status} onChange={setStatus} />
          {answeredDate && (
            <p className="mt-2 text-[13px]" style={{ color: 'var(--accent)' }}>
              ✓ Respondida el {answeredDate}
            </p>
          )}

          <button
            type="button"
            onClick={handleDelete}
            className="mt-7 w-full py-3 text-center text-[16px] text-ink-soft"
          >
            Eliminar pedido
          </button>
        </>
      )}

      {error && <p className="mt-3 text-[13px]" style={{ color: '#D1453B' }}>{error}</p>}
    </Sheet>
  )
}
