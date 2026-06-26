import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PeopleIcon, ChevronRight, PlusIcon } from '../components/icons.jsx'
import Sheet from '../components/Sheet.jsx'
import { useAuth } from '../lib/auth.jsx'
import { getMyGroups, createGroup, joinGroupByCode } from '../lib/db.js'

// Grupos (documento maestro §5.6, README pantalla 6).
const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--hairline)',
  color: 'var(--text-primary)',
}

function CreateGroupSheet({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    if (name.trim().length < 2 || busy) return
    setBusy(true)
    setError(null)
    try {
      const g = await createGroup(name.trim())
      onCreated(g)
    } catch {
      setError('No se pudo crear el grupo.')
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="Crear grupo"
      onCancel={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={name.trim().length < 2 || busy}
          style={{ opacity: name.trim().length < 2 || busy ? 0.5 : 1 }}
          onClick={submit}
        >
          {busy ? 'Creando…' : 'Crear grupo'}
        </button>
      }
    >
      <div className="flex justify-center py-3">
        <div
          className="flex h-[64px] w-[64px] items-center justify-center rounded-full text-ink-soft"
          style={{ backgroundColor: 'var(--surface-alt)' }}
        >
          <PeopleIcon size={30} />
        </div>
      </div>
      <input
        type="text"
        autoFocus
        placeholder="Nombre del grupo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />
      <p className="mt-3 text-[14px] text-ink-soft">
        Vas a ser el administrador. Después podrás invitar con un código que
        generamos automáticamente.
      </p>
      {error && <p className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    </Sheet>
  )
}

function JoinGroupSheet({ onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    const c = code.trim()
    if (c.length < 4 || busy) return
    setBusy(true)
    setError(null)
    try {
      const g = await joinGroupByCode(c)
      if (!g) {
        setError('No encontramos un grupo con ese código.')
        setBusy(false)
        return
      }
      onJoined(g)
    } catch {
      setError('No se pudo unir al grupo.')
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="Unirme por código"
      onCancel={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={code.trim().length < 4 || busy}
          style={{ opacity: code.trim().length < 4 || busy ? 0.5 : 1 }}
          onClick={submit}
        >
          {busy ? 'Uniéndote…' : 'Unirme al grupo'}
        </button>
      }
    >
      <div className="flex justify-center py-3">
        <div
          className="flex h-[64px] w-[64px] items-center justify-center rounded-full text-[28px]"
          style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--accent)' }}
          aria-hidden="true"
        >
          ▦
        </div>
      </div>
      <input
        type="text"
        autoFocus
        autoCapitalize="characters"
        placeholder="CÓDIGO"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="w-full rounded-input px-4 py-3 text-center text-[24px] font-bold outline-none"
        style={{ ...inputStyle, letterSpacing: '3px' }}
      />
      <p className="mt-3 text-center text-[14px] text-ink-soft">
        Pedile el código a quien administra el grupo.
      </p>
      {error && <p className="mt-3 text-center text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    </Sheet>
  )
}

export default function Grupos() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState(null)
  const [sheet, setSheet] = useState(null) // 'create' | 'join' | null

  const load = useCallback(async () => {
    if (!user) return
    setGroups(await getMyGroups(user.id))
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="pt-2">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">Grupos</h1>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => setSheet('create')}
          className="btn btn-primary flex flex-1 items-center justify-center gap-1.5"
        >
          <PlusIcon size={18} /> Crear grupo
        </button>
        <button type="button" onClick={() => setSheet('join')} className="btn btn-secondary flex-1">
          Unirme por código
        </button>
      </div>

      {groups?.length > 0 && (
        <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          Mis grupos
        </p>
      )}

      {groups === null && <p className="mt-6 text-[15px] text-ink-soft">Cargando…</p>}
      {groups?.length === 0 && (
        <p className="mt-10 text-center text-[15px] text-ink-soft">
          Todavía no estás en ningún grupo. Creá uno o unite con un código.
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {groups?.map((g) => (
          <li key={g.id}>
            <Link to={`/grupos/${g.id}`} className="card flex items-center gap-3 p-4">
              <div
                className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-ink-soft"
                style={{ backgroundColor: 'var(--surface-alt)' }}
              >
                <PeopleIcon size={22} />
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-semibold text-ink">{g.name}</p>
                <p className="text-[13px] text-ink-soft">
                  {g.member_count} {g.member_count === 1 ? 'miembro' : 'miembros'} ·{' '}
                  {g.role === 'owner' ? 'Administrador' : 'Miembro'}
                </p>
              </div>
              <span className="text-ink-soft" style={{ opacity: 0.5 }}>
                <ChevronRight size={20} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {sheet === 'create' && (
        <CreateGroupSheet
          onClose={() => setSheet(null)}
          onCreated={(g) => {
            setSheet(null)
            navigate(`/grupos/${g.id}`)
          }}
        />
      )}
      {sheet === 'join' && (
        <JoinGroupSheet
          onClose={() => setSheet(null)}
          onJoined={(g) => {
            setSheet(null)
            navigate(`/grupos/${g.id}`)
          }}
        />
      )}
    </div>
  )
}
