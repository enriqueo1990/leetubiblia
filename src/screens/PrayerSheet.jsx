import { useEffect, useState } from 'react'
import Sheet from '../components/Sheet.jsx'
import Segmented from '../components/Segmented.jsx'
import Switch from '../components/Switch.jsx'
import Avatars from '../components/Avatars.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useAuth } from '../lib/auth.jsx'
import { createPrayer, updatePrayer, deletePrayer, getIntercessors } from '../lib/db.js'

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
  const [testimony, setTestimony] = useState(prayer?.testimony ?? '')
  const [testimonyShared, setTestimonyShared] = useState(prayer?.testimony_shared ?? false)
  const [intercessors, setIntercessors] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmShare, setConfirmShare] = useState(false)

  // ¿Hay cambios sin guardar? Para confirmar el descarte al cerrar por scrim/Escape.
  const dirty =
    title !== (prayer?.title ?? '') ||
    description !== (prayer?.description ?? '') ||
    visibility !== (prayer?.visibility ?? 'private') ||
    status !== (prayer?.status ?? 'active') ||
    groupId !== (prayer?.shared_group_id ?? groups?.[0]?.id ?? null) ||
    testimony !== (prayer?.testimony ?? '') ||
    testimonyShared !== (prayer?.testimony_shared ?? false)

  // El autor ve quiénes oran por su pedido compartido (modelo pull: así "se
  // entera" sin push). Se carga sobre el pedido tal como está guardado.
  useEffect(() => {
    if (editing && prayer?.visibility === 'shared') {
      getIntercessors(prayer.id).then(setIntercessors).catch(() => {})
    }
  }, [editing, prayer])

  const needsGroup = visibility === 'shared'
  const canSave =
    title.trim().length > 0 && (!needsGroup || groupId) && !busy
  const groupName =
    prayer?.group?.name || groups?.find((g) => g.id === groupId)?.name || 'tu grupo'

  // Editar un pedido para exponerlo a un grupo (de privado a compartido, o
  // cambiándolo a otro grupo) muestra a gente nueva algo que antes era privado:
  // pedimos confirmación explícita antes de cruzar esa frontera.
  const willExpose =
    editing &&
    visibility === 'shared' &&
    (prayer?.visibility !== 'shared' || prayer?.shared_group_id !== groupId)

  function requestSave() {
    if (!canSave) return
    if (willExpose) {
      setConfirmShare(true)
      return
    }
    handleSave()
  }

  async function handleSave() {
    if (!canSave) return
    setConfirmShare(false)
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        // El testimonio solo aplica a una compartida respondida; si vuelve a
        // activa o a privada, se limpia lo compartido.
        const canTestimony = visibility === 'shared' && status === 'answered'
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
          testimony: canTestimony ? testimony.trim() || null : null,
          testimony_shared: canTestimony && testimonyShared,
          testimony_shared_at:
            canTestimony && testimonyShared
              ? prayer.testimony_shared_at ?? new Date().toISOString()
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
    setBusy(true)
    try {
      await deletePrayer(prayer.id)
      onSaved()
    } catch {
      setConfirmDelete(false)
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
      dirty={dirty}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
          onClick={requestSave}
        >
          {busy ? 'Guardando…' : 'Guardar pedido'}
        </button>
      }
    >
      {editing && prayer?.visibility === 'shared' && (
        <div className="mb-1 mt-1 flex items-center gap-2.5">
          <Avatars people={intercessors} size={26} surface="var(--bg-app)" />
          <span className="text-[13px] text-ink-soft">
            {intercessors.length > 0
              ? `${intercessors.length} ${
                  intercessors.length === 1 ? 'persona está orando' : 'personas están orando'
                } por esto`
              : 'Nadie se sumó a orar todavía'}
          </span>
        </div>
      )}

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
            <p className="px-4 py-3 text-[15px] text-ink-soft">
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

          {needsGroup && status === 'answered' && (
            <div className="card mt-4 p-4">
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-[16px] text-ink">Compartir con {groupName}</span>
                <Switch
                  on={testimonyShared}
                  onChange={setTestimonyShared}
                  label={`Compartir testimonio con ${groupName}`}
                />
              </div>
              <div className="mt-3 border-t border-hairline pt-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                  Unas palabras <span className="font-normal lowercase">(opcional)</span>
                </p>
                <textarea
                  rows={3}
                  value={testimony}
                  onChange={(e) => setTestimony(e.target.value)}
                  placeholder="Contá brevemente cómo se respondió…"
                  className="mt-2 w-full resize-none rounded-input px-3 py-2.5 text-[15px] outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-7 w-full py-3 text-center text-[16px]"
            style={{ color: 'var(--danger)' }}
          >
            Eliminar pedido
          </button>
        </>
      )}

      {error && <p className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>}

      {confirmShare && (
        <ConfirmDialog
          title={`¿Compartir con ${groupName}?`}
          message={
            prayer?.visibility !== 'shared'
              ? `Este pedido era privado. Al compartirlo, todos los miembros de ${groupName} van a poder verlo.`
              : `Todos los miembros de ${groupName} van a poder ver este pedido.`
          }
          confirmLabel="Compartir"
          busy={busy}
          onConfirm={handleSave}
          onCancel={() => setConfirmShare(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar este pedido?"
          message="No se puede deshacer."
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  )
}
