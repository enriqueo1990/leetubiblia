import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CopyIcon, RefreshIcon } from '../components/icons.jsx'
import { useAuth } from '../lib/auth.jsx'
import { getGroupDetail, regenerateInviteCode, removeMember } from '../lib/db.js'

// Detalle de grupo (documento maestro §5.6, README pantalla 6).
function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

export default function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await getGroupDetail(Number(id)))
    } catch (e) {
      setError('No se pudo cargar el grupo.')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div className="pt-2">
        <Link to="/grupos" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
          ‹ Grupos
        </Link>
        <p className="mt-8 text-[15px] text-ink-soft">{error}</p>
      </div>
    )
  }
  if (!data) return <p className="pt-10 text-[15px] text-ink-soft">Cargando…</p>

  const { group, members } = data
  const myRole = members.find((m) => m.user_id === user?.id)?.role
  const isOwner = myRole === 'owner'

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* algunos navegadores bloquean clipboard sin gesto seguro */
    }
  }

  async function regenerate() {
    if (!window.confirm('¿Regenerar el código? El anterior dejará de funcionar.')) return
    await regenerateInviteCode(group.id)
    load()
  }

  async function kick(member) {
    if (!window.confirm(`¿Quitar a ${member.display_name} del grupo?`)) return
    await removeMember(group.id, member.user_id)
    load()
  }

  return (
    <div className="pt-2">
      <Link to="/grupos" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
        ‹ Grupos
      </Link>
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{group.name}</h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        {members.length} {members.length === 1 ? 'miembro' : 'miembros'} ·{' '}
        {isOwner ? 'Sos el owner' : 'Sos miembro'}
      </p>

      {/* Código de invitación */}
      <div className="card mt-5 p-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          Código de invitación
        </p>
        <p
          className="mt-2 text-[26px] font-bold text-accent"
          style={{ letterSpacing: '2px' }}
        >
          {group.invite_code}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[14px] font-medium text-ink"
            style={{ backgroundColor: 'var(--surface-alt)' }}
          >
            <CopyIcon size={16} /> {copied ? 'Copiado' : 'Copiar'}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={regenerate}
              className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[14px] font-medium text-ink"
              style={{ backgroundColor: 'var(--surface-alt)' }}
            >
              <RefreshIcon size={16} /> Regenerar
            </button>
          )}
        </div>
      </div>

      {/* Miembros */}
      <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
        Miembros · {members.length}
      </p>
      <ul className="mt-3 card divide-y divide-hairline">
        {members.map((m) => {
          const isMe = m.user_id === user?.id
          const isMemberOwner = m.role === 'owner'
          return (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[14px] font-semibold"
                style={{
                  backgroundColor: isMemberOwner ? 'var(--accent)' : 'var(--surface-alt)',
                  color: isMemberOwner ? 'var(--on-accent)' : 'var(--text-soft)',
                }}
              >
                {initials(m.display_name)}
              </div>
              <span className="flex-1 text-[16px] text-ink">
                {m.display_name}
                {isMe && <span className="text-ink-soft"> (vos)</span>}
              </span>
              {isMemberOwner ? (
                <span
                  className="rounded-pill px-2 py-0.5 text-[12px] font-medium"
                  style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-tint)' }}
                >
                  Owner
                </span>
              ) : (
                isOwner && (
                  <button
                    type="button"
                    onClick={() => kick(m)}
                    aria-label={`Quitar a ${m.display_name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft"
                    style={{ border: '1px solid var(--hairline)' }}
                  >
                    −
                  </button>
                )
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
