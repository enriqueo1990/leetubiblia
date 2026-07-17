import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PeopleIcon, ChevronRight, PlusIcon } from '../components/icons.jsx'
import Sheet from '../components/Sheet.jsx'
import RetryError from '../components/RetryError.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { initials } from '../components/Avatars.jsx'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { getMyGroups, createGroup, joinGroupByCode } from '../lib/db.js'
import { SkeletonCards } from '../components/Skeleton.jsx'
import { inputStyle } from '../components/formStyles.js'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'

// Grupos (documento maestro §5.6, README pantalla 6).

function CreateGroupSheet({ onClose, onCreated, online = true }) {
  const { t } = usePreferences()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => nameRef.current?.focus(), 350)
    return () => clearTimeout(id)
  }, [])

  async function submit() {
    if (!online || name.trim().length < 2 || busy) return
    setBusy(true)
    setError(null)
    try {
      const g = await createGroup(name.trim())
      onCreated(g)
    } catch {
      setError(t('grupos.createError'))
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={t('grupos.createTitle')}
      onCancel={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!online || name.trim().length < 2 || busy}
          style={{ opacity: !online || name.trim().length < 2 || busy ? 0.5 : 1 }}
          onClick={submit}
        >
          {busy ? t('grupos.creating') : t('grupos.createTitle')}
        </button>
      }
    >
      <label htmlFor="group-name" className="mb-2 block text-[14px] font-medium text-ink">
        {t('grupos.nameLabel')}
      </label>
      <input
        id="group-name"
        ref={nameRef}
        type="text"
        placeholder={t('grupos.namePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />
      <p className="mt-3 text-[13px] text-ink-soft">
        {t('grupos.createHelp')}
      </p>
      {error && <p className="mt-3 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    </Sheet>
  )
}

function JoinGroupSheet({ onClose, onJoined, online = true }) {
  const { t } = usePreferences()
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
    if (!online || c.length < 4 || busy) return
    setBusy(true)
    setError(null)
    try {
      const g = await joinGroupByCode(c)
      if (!g) {
        setError(t('grupos.notFound'))
        setBusy(false)
        return
      }
      onJoined(g)
    } catch {
      setError(t('grupos.joinError'))
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={t('grupos.joinTitle')}
      onCancel={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!online || code.trim().length < 4 || busy}
          style={{ opacity: !online || code.trim().length < 4 || busy ? 0.5 : 1 }}
          onClick={submit}
        >
          {busy ? t('grupos.joining') : t('grupos.joinButton')}
        </button>
      }
    >
      <label htmlFor="group-code" className="mb-2 block text-center text-[14px] font-medium text-ink">
        {t('grupos.codeLabel')}
      </label>
      <input
        id="group-code"
        ref={codeRef}
        type="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder={t('grupos.codePlaceholder')}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="w-full rounded-input px-4 py-3 text-center text-[24px] font-bold outline-none"
        style={{ ...inputStyle, letterSpacing: '3px' }}
      />
      <p className="mt-3 text-center text-[13px] text-ink-soft">
        {t('grupos.joinHelp')}
      </p>
      {error && <p className="mt-3 text-center text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    </Sheet>
  )
}

export default function Grupos() {
  const { user } = useAuth()
  const { t } = usePreferences()
  const navigate = useNavigate()
  const online = useOnlineStatus()
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
        <h1 className="text-[26px] font-bold tracking-tight text-ink">{t('nav.grupos')}</h1>
        <button
          type="button"
          aria-label={t('grupos.addGroup')}
          onClick={() => setSheet('menu')}
          disabled={!online}
          className="flex h-[44px] items-center justify-center gap-1 rounded-full px-3 text-on-accent lg:px-4"
          style={{ backgroundColor: 'var(--accent-action)', minWidth: 44, opacity: online ? 1 : 0.45 }}
        >
          <PlusIcon size={20} />
          <span className="hidden text-[15px] font-semibold lg:inline">{t('grupos.addGroup')}</span>
        </button>
      </div>

      {error && <RetryError message={t('grupos.loadError')} onRetry={load} />}
      {groups === null && !error && (
        <div className="mt-5"><SkeletonCards count={3} /></div>
      )}

      {groups?.length === 0 && !error && (
        <EmptyState
          icon={<PeopleIcon size={32} />}
          text={t('grupos.empty')}
        >
          <button
            type="button"
            onClick={() => setSheet('create')}
            disabled={!online}
            className="btn btn-primary flex items-center justify-center gap-1.5"
          >
            <PlusIcon size={18} /> {t('grupos.createTitle')}
          </button>
          <button type="button" onClick={() => setSheet('join')} disabled={!online} className="btn btn-secondary">
            {t('grupos.joinTitle')}
          </button>
        </EmptyState>
      )}

      <ul className="mt-5 space-y-3">
        {groups?.map((g) => (
          <li key={g.id}>
            <Link
              to={`/grupos/${g.id}`}
              state={{ from: { to: '/grupos', label: t('nav.grupos') } }}
              className="card flex items-center gap-3 p-4"
            >
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
                  {t('grupos.members', { count: g.member_count })}
                  {g.role === 'owner' && ` · ${t('grupos.admin')}`}
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
        <Sheet title={t('grupos.addGroup')} onCancel={() => setSheet(null)}>
          <div className="space-y-3 pb-2">
            <button
              type="button"
              onClick={() => setSheet('create')}
              disabled={!online}
              className="btn btn-primary flex items-center justify-center gap-1.5"
            >
              <PlusIcon size={18} /> {t('grupos.createTitle')}
            </button>
            <button type="button" onClick={() => setSheet('join')} disabled={!online} className="btn btn-secondary">
              {t('grupos.joinTitle')}
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'create' && (
        <CreateGroupSheet
          online={online}
          onClose={() => setSheet(null)}
          onCreated={(g) => {
            setSheet(null)
            navigate(`/grupos/${g.id}`, { state: { from: { to: '/grupos', label: t('nav.grupos') } } })
          }}
        />
      )}
      {sheet === 'join' && (
        <JoinGroupSheet
          online={online}
          onClose={() => setSheet(null)}
          onJoined={(g) => {
            setSheet(null)
            navigate(`/grupos/${g.id}`, { state: { from: { to: '/grupos', label: t('nav.grupos') } } })
          }}
        />
      )}
    </div>
  )
}
