import { useState } from 'react'
import { useAuth } from '../../lib/auth.jsx'

// "¿Cómo te llamás?" — solo en la primera entrada (documento maestro §5.8).
// El magic link no captura nombre y la app lo muestra en Grupos y pedidos
// compartidos. Set profiles.display_name.
export default function AskName() {
  const { updateProfile } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const valid = name.trim().length >= 2

  async function handleContinue() {
    if (!valid || saving) return
    setSaving(true)
    setError(false)
    const { error } = await updateProfile({ display_name: name.trim() })
    setSaving(false)
    // Si todo va bien, el Gate re-evalúa solo (profile.display_name ya está).
    if (error) setError(true)
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-content flex-col justify-center px-7 py-10">
      <h1 className="text-[24px] font-bold tracking-tight text-ink">
        ¿Cómo te llamás?
      </h1>
      <p className="mt-2 text-[16px] text-ink-soft">
        Así te ven tus grupos y aparece en los pedidos que compartís.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleContinue()
        }}
        className="mt-7"
      >
        <input
          type="text"
          autoFocus
          autoComplete="name"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-input px-4 py-3.5 text-[16px] outline-none"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--hairline)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          disabled={!valid || saving}
          className="btn btn-primary mt-4"
          style={{ opacity: !valid || saving ? 0.5 : 1 }}
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
        {error && (
          <p className="mt-3 text-[14px]" style={{ color: 'var(--danger)' }}>
            No se pudo guardar. Revisá tu conexión e intentá de nuevo.
          </p>
        )}
      </form>
    </div>
  )
}
