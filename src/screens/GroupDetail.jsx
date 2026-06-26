import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CopyIcon, RefreshIcon, CheckIcon, ChevronRight, LockIcon } from '../components/icons.jsx'
import { useAuth } from '../lib/auth.jsx'
import { getGroupDetail, regenerateInviteCode, removeMember, getGroupStats } from '../lib/db.js'

// Detalle de grupo (documento maestro §5.6, README pantalla 6).
function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

// Una métrica del resumen pastoral (número grande en acento + etiqueta).
function Stat({ n, label }) {
  return (
    <div className="flex-1">
      <div className="text-[30px] font-bold text-accent" style={{ letterSpacing: '-1px' }}>
        {n}
      </div>
      <div className="mt-0.5 text-[12px] leading-tight text-ink-soft">{label}</div>
    </div>
  )
}

export default function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await getGroupDetail(Number(id))
      setData(d)
      // El resumen pastoral es solo del owner (el RPC valida la propiedad adentro).
      const owner = d.members.find((m) => m.user_id === user?.id)?.role === 'owner'
      if (owner) {
        try {
          setStats(await getGroupStats(Number(id)))
        } catch {
          /* sin resumen si el RPC rechaza */
        }
      }
    } catch {
      setError('No se pudo cargar el grupo.')
    }
  }, [id, user])

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
  const answeredTotal = stats ? stats.active + stats.answered : 0
  const answeredPct =
    answeredTotal > 0 ? Math.round((stats.answered / answeredTotal) * 100) : 0

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

      {/* Resumen pastoral — solo el owner */}
      {isOwner && stats && (
        <>
          <div className="card mt-5 p-5">
            <div className="flex items-center gap-1.5 text-ink-soft">
              <LockIcon size={13} />
              <span className="text-[12px] font-semibold uppercase tracking-wide">
                Resumen · solo vos lo ves
              </span>
            </div>
            <div className="mt-4 flex">
              <Stat n={stats.active} label="Pedidos activos" />
              <Stat n={stats.answered} label="Respondidos" />
              <Stat n={stats.praying_week} label="Orando esta semana" />
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--surface-alt)' }}
            >
              <div
                className="h-full"
                style={{ width: `${answeredPct}%`, backgroundColor: 'var(--accent)' }}
              />
            </div>
            <p className="mt-2 text-[12px] text-ink-soft">
              {answeredPct}% de los pedidos del grupo ya fueron respondidos.
            </p>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
            Un pulso del grupo para acompañar mejor. No es para medir a nadie.
          </p>
        </>
      )}

      {/* Testimonios — todos los miembros */}
      <Link to={`/grupos/${id}/testimonios`} className="card mt-5 flex items-center gap-3 p-4">
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-accent"
          style={{ backgroundColor: 'var(--accent-tint)' }}
        >
          <CheckIcon size={20} strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <p className="text-[16px] font-semibold text-ink">Testimonios</p>
          <p className="text-[13px] text-ink-soft">Oraciones respondidas que el grupo compartió</p>
        </div>
        <span className="text-ink-soft" style={{ opacity: 0.5 }}>
          <ChevronRight size={20} />
        </span>
      </Link>

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
