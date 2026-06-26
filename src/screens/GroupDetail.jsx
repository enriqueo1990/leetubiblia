import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CopyIcon, RefreshIcon, CheckIcon, ChevronRight, LockIcon, PencilIcon, ShareIcon } from '../components/icons.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Avatars from '../components/Avatars.jsx'
import { useAuth } from '../lib/auth.jsx'
import {
  getGroupDetail,
  regenerateInviteCode,
  removeMember,
  leaveGroup,
  getGroupStats,
  renameGroup,
  getGroupPrayersWithIntercessors,
} from '../lib/db.js'
import { SkeletonDetail } from '../components/Skeleton.jsx'

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
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)
  const [groupPrayers, setGroupPrayers] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [inviteShared, setInviteShared] = useState(false)
  const [confirm, setConfirm] = useState(null) // { type: 'regen' } | { type: 'kick', member } | null
  const [busy, setBusy] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const d = await getGroupDetail(Number(id))
      setData(d)
      // El resumen pastoral es solo del owner (el RPC valida la propiedad adentro).
      const owner = d.members.find((m) => m.user_id === user?.id)?.role === 'owner'
      if (owner) {
        const [statsRes, prayersRes] = await Promise.allSettled([
          getGroupStats(Number(id)),
          getGroupPrayersWithIntercessors(Number(id)),
        ])
        if (statsRes.status === 'fulfilled') setStats(statsRes.value)
        if (prayersRes.status === 'fulfilled') setGroupPrayers(prayersRes.value)
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
        <button
          type="button"
          onClick={load}
          className="mt-2 text-[15px] font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          Reintentar
        </button>
      </div>
    )
  }
  if (!data) return <SkeletonDetail />

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
      // Algunos navegadores bloquean clipboard sin gesto seguro: lo mostramos
      // seleccionable para copiar a mano.
      window.prompt('Copiá el código:', group.invite_code)
    }
  }

  async function saveName() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === group.name) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    setNameError(null)
    try {
      await renameGroup(group.id, trimmed)
      setData((d) => ({ ...d, group: { ...d.group, name: trimmed } }))
      setEditingName(false)
    } catch {
      setNameError('No se pudo guardar el nombre.')
    } finally {
      setSavingName(false)
    }
  }

  // Comparte el enlace de invitación (no solo el código a tipear). navigator.share
  // en móvil; copia al portapapeles como fallback.
  async function shareInvite() {
    const url = `${window.location.origin}/join?code=${group.invite_code}`
    const text = `Te invito al grupo "${group.name}" en Lee Tu Biblia`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lee Tu Biblia', text, url })
      } catch {
        // El usuario canceló — no hacer nada.
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setInviteShared(true)
        setTimeout(() => setInviteShared(false), 1500)
      } catch {
        window.prompt('Copiá el link de invitación:', url)
      }
    }
  }

  async function runConfirm() {
    setBusy(true)
    try {
      if (confirm.type === 'regen') await regenerateInviteCode(group.id)
      else if (confirm.type === 'kick') await removeMember(group.id, confirm.member.user_id)
      else if (confirm.type === 'leave') {
        await leaveGroup(group.id, user.id)
        navigate('/grupos', { replace: true })
        return
      }
      await load()
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-2">
      <Link to="/grupos" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
        ‹ Grupos
      </Link>
      {editingName ? (
        <div className="mt-3">
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName()
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="w-full rounded-input px-4 py-3 text-[20px] font-bold outline-none"
            style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-primary)' }}
            maxLength={60}
          />
          {nameError && (
            <p className="mt-1 text-[13px]" style={{ color: 'var(--danger)' }}>{nameError}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveName}
              disabled={savingName || !nameInput.trim()}
              className="btn btn-primary"
              style={{ opacity: savingName || !nameInput.trim() ? 0.5 : 1 }}
            >
              {savingName ? '…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="px-4 py-2 text-[15px] text-ink-soft"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-[26px] font-bold tracking-tight text-ink">{group.name}</h1>
          {isOwner && (
            <button
              type="button"
              aria-label="Editar nombre del grupo"
              onClick={() => { setNameInput(group.name); setNameError(null); setEditingName(true) }}
              className="mt-1 text-ink-soft"
              style={{ opacity: 0.5 }}
            >
              <PencilIcon size={16} />
            </button>
          )}
        </div>
      )}
      <p className="mt-1 text-[14px] text-ink-soft">
        {members.length} {members.length === 1 ? 'miembro' : 'miembros'} ·{' '}
        {isOwner ? 'Sos el administrador' : 'Sos miembro'}
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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={shareInvite}
            className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[14px] font-medium text-on-accent"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <ShareIcon size={16} /> {inviteShared ? 'Copiado' : 'Compartir invitación'}
          </button>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[14px] font-medium text-ink"
            style={{ backgroundColor: 'var(--surface-alt)' }}
          >
            <CopyIcon size={16} /> {copied ? 'Copiado' : 'Copiar código'}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setConfirm({ type: 'regen' })}
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

      {/* Pedidos del grupo con intercesores — solo el owner */}
      {isOwner && groupPrayers !== null && (
        <>
          <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            Pedidos del grupo · {groupPrayers.length}
          </p>
          {groupPrayers.length === 0 ? (
            <p className="mt-3 text-[15px] text-ink-soft">Todavía no hay pedidos compartidos.</p>
          ) : (
            <ul className="mt-3 card divide-y divide-hairline">
              {groupPrayers.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-semibold text-ink leading-snug">{p.title}</span>
                    {p.status === 'answered' && (
                      <span
                        className="shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium"
                        style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-tint)' }}
                      >
                        Respondido
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-soft">{p.author_name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {p.intercessors.length > 0 ? (
                      <>
                        <Avatars people={p.intercessors} size={24} surface="var(--surface)" />
                        <span className="text-[12px] text-ink-soft">
                          {p.intercessors.length}{' '}
                          {p.intercessors.length === 1 ? 'persona orando' : 'personas orando'}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-ink-soft">Nadie orando aún</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
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
                  Administrador
                </span>
              ) : (
                isOwner && (
                  <button
                    type="button"
                    onClick={() => setConfirm({ type: 'kick', member: m })}
                    aria-label={`Quitar a ${m.display_name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] text-ink-soft"
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ border: '1px solid var(--hairline)' }}
                      aria-hidden="true"
                    >
                      −
                    </span>
                  </button>
                )
              )}
            </li>
          )
        })}
      </ul>

      {!isOwner && (
        <button
          type="button"
          onClick={() => setConfirm({ type: 'leave' })}
          className="mt-7 w-full py-3 text-center text-[16px]"
          style={{ color: 'var(--danger)' }}
        >
          Salir del grupo
        </button>
      )}

      {confirm?.type === 'leave' && (
        <ConfirmDialog
          title={`¿Salir de ${group.name}?`}
          message="Dejarás de ver y compartir pedidos en este grupo. Podés volver con el código."
          confirmLabel="Salir"
          danger
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.type === 'regen' && (
        <ConfirmDialog
          title="¿Regenerar el código?"
          message="El código anterior dejará de funcionar para nuevas invitaciones."
          confirmLabel="Regenerar"
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'kick' && (
        <ConfirmDialog
          title={`¿Quitar a ${confirm.member.display_name}?`}
          message="Dejará de ver y compartir pedidos en este grupo."
          confirmLabel="Quitar"
          danger
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
