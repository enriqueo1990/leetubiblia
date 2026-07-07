import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PeopleIcon, ChevronRight, PlusIcon } from '../components/icons.jsx'
import Sheet from '../components/Sheet.jsx'
import RetryError from '../components/RetryError.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { initials } from '../components/Avatars.jsx'
import { useAuth } from '../lib/auth.jsx'
import { getMyGroups, createGroup, joinGroupByCode } from '../lib/db.js'
import { SkeletonCards } from '../components/Skeleton.jsx'

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
  const nameRef = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => nameRef.current?.focus(), 350)
    return () => clearTimeout(id)
  }, [])

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
      <input
        ref={nameRef}
        type="text"
        placeholder="Nombre del grupo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />
      <p className="mt-3 text-[13px] text-ink-soft">
        Vas a ser el administrador. Te damos un código para invitar a quien quieras.
      </p>
      {error && <p className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    </Sheet>
  )
}

function JoinGroupSheet({ onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const codeRef = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => codeRef.current?.focus(), 350)
    return () => clearTimeout(id)
  }, [])

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
      <input
        ref={codeRef}
        type="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="CÓDIGO"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="w-full rounded-input px-4 py-3 text-center text-[24px] font-bold outline-none"
        style={{ ...inputStyle, letterSpacing: '3px' }}
      />
      <p className="mt-3 text-center text-[13px] text-ink-soft">
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
  const [error, setError] = useState(false)
  const [sheet, setSheet] = useState(null) // 'menu' | 'create' | 'join' | null

  const load = useCallback(async () => {
    if (!user) return
    setError(false)
    try {
      setGroups(await getMyGroups(user.id))
    } catch {
      setError(true)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="pt-2">
      {/* Acción primaria en el header, como en Oración: el contenido empieza bajo el título. */}
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Grupos</h1>
        <button
          type="button"
          aria-label="Agregar grupo"
          onClick={() => setSheet('menu')}
          className="flex h-[44px] items-center justify-center gap-1 rounded-full px-3 text-on-accent lg:px-4"
          style={{ backgroundColor: 'var(--accent)', minWidth: 44 }}
        >
          <PlusIcon size={20} />
          <span className="hidden text-[15px] font-semibold lg:inline">Agregar grupo</span>
        </button>
      </div>

      {error && <RetryError message="No se pudieron cargar tus grupos." onRetry={load} />}
      {groups === null && !error && (
        <div className="mt-5"><SkeletonCards count={3} /></div>
      )}

      {groups?.length === 0 && !error && (
        <EmptyState
          icon={<PeopleIcon size={32} />}
          text="Todavía no estás en ningún grupo. Creá uno o unite con un código."
        >
          <button
            type="button"
            onClick={() => setSheet('create')}
            className="btn btn-primary flex items-center justify-center gap-1.5"
          >
            <PlusIcon size={18} /> Crear grupo
          </button>
          <button type="button" onClick={() => setSheet('join')} className="btn btn-secondary">
            Unirme por código
          </button>
        </EmptyState>
      )}

      <ul className="mt-5 space-y-3">
        {groups?.map((g) => (
          <li key={g.id}>
            <Link to={`/grupos/${g.id}`} className="card flex items-center gap-3 p-4">
              <div
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
                aria-hidden="true"
              >
                {initials(g.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold text-ink">{g.name}</p>
                <p className="text-[13px] text-ink-soft">
                  {g.member_count} {g.member_count === 1 ? 'miembro' : 'miembros'}
                  {g.role === 'owner' && ' · Administrador'}
                </p>
              </div>
              <span className="text-ink-soft" style={{ opacity: 0.5 }}>
                <ChevronRight size={20} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Chooser: el + del header ofrece las dos entradas, igual que el empty state. */}
      {sheet === 'menu' && (
        <Sheet title="Agregar grupo" onCancel={() => setSheet(null)}>
          <div className="space-y-3 pb-2">
            <button
              type="button"
              onClick={() => setSheet('create')}
              className="btn btn-primary flex items-center justify-center gap-1.5"
            >
              <PlusIcon size={18} /> Crear grupo
            </button>
            <button type="button" onClick={() => setSheet('join')} className="btn btn-secondary">
              Unirme por código
            </button>
          </div>
        </Sheet>
      )}
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
