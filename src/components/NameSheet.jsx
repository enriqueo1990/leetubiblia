import { useState } from 'react'
import Sheet from './Sheet.jsx'
import MyNameField from './MyNameField.jsx'
import InlineError from './InlineError.jsx'
import { usePreferences } from '../lib/preferences.jsx'

// Hoja para corregir el nombre que ven tu grupo y los pedidos compartidos.
// Mínimo 2 caracteres después de trim (igual que AskName). `onSave(name)` devuelve
// true si quedó guardado; si falla, la hoja queda abierta con el error.
export default function NameSheet({ initial = '', onSave, onClose }) {
  const { t } = usePreferences()
  const [name, setName] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const trimmed = name.trim()
  const valid = trimmed.length >= 2
  const dirty = trimmed !== initial.trim()

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    setError(false)
    const ok = await onSave(trimmed)
    setSaving(false)
    if (ok) onClose()
    else setError(true)
  }

  return (
    <Sheet
      title={t('ajustes.tuNombre')}
      dirty={dirty}
      onCancel={onClose}
      footer={
        <button
          type="button"
          onClick={save}
          disabled={!valid || !dirty || saving}
          className="btn btn-primary"
          style={{ opacity: !valid || !dirty || saving ? 0.5 : 1 }}
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <MyNameField id="edit-name" value={name} onChange={setName} autoFocus />
        <InlineError message={error ? t('common.saveError') : null} />
      </form>
    </Sheet>
  )
}
