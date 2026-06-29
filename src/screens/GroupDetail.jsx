import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CopyIcon,
  RefreshIcon,
  CheckIcon,
  ChevronRight,
  LockIcon,
  PencilIcon,
  ShareIcon,
  PlusIcon,
  BookIcon,
  HeartIcon,
} from '../components/icons.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Avatars, { initials } from '../components/Avatars.jsx'
import { useAuth } from '../lib/auth.jsx'
import {
  getGroupDetail,
  regenerateInviteCode,
  removeMember,
  leaveGroup,
  getGroupStats,
  renameGroup,
  getGroupActivePrayers,
  getGroupReadingToday,
  getGroupTestimonies,
  addIntercession,
} from '../lib/db.js'
import { SkeletonDetail } from '../components/Skeleton.jsx'
import PrayerSheet from './PrayerSheet.jsx'

// Detalle de grupo — "de panel a sala" (Fase 3): la gente y el pulso del día
// primero; oración y lectura del grupo en la misma vista; la administración
// (código, regenerar, renombrar) abajo.
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
  const { user, profile } = useAuth()
  const iShare = !!profile?.share_reading

  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)
  const [reading, setReading] = useState([]) // [{ user_id, has_read }]
  const [prayers, setPrayers] = useState([]) // pedidos activos del grupo
  const [testimony, setTestimony] = useState(null) // último testimonio
  const [sheetOpen, setSheetOpen] = useState(false) // sheet "compartir un pedido"
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [inviteShared, setInviteShared] = useState(false)
  const [confirm, setConfirm] = useState(null) // { type } | null
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
      const owner = d.members.find((m) => m.user_id === user?.id)?.role === 'owner'
      const [readRes, prayRes, testRes, statsRes] = await Promise.allSettled([
        getGroupReadingToday(Number(id)),
        getGroupActivePrayers(Number(id)),
        getGroupTestimonies(Number(id)),
        owner ? getGroupStats(Number(id)) : Promise.resolve(null),
      ])
      if (readRes.status === 'fulfilled') setReading(readRes.value)
      if (prayRes.status === 'fulfilled') setPrayers(prayRes.value)
      if (testRes.status === 'fulfilled') setTestimony(testRes.value[0] ?? null)
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
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
  const answeredPct = answeredTotal > 0 ? Math.round((stats.answered / answeredTotal) * 100) : 0

  // Lectura del grupo: el RPC solo devuelve filas si vos compartís (recíproco).
  const readMap = new Map(reading.map((r) => [r.user_id, r.has_read]))
  const readCount = reading.filter((r) => r.has_read).length
  const prayingCount = new Set(prayers.flatMap((p) => p.intercessors.map((i) => i.user_id))).size

  const interceding = (p) => p.intercessors.some((x) => x.user_id === user?.id)

  async function orar(p) {
    if (!user || interceding(p)) return
    // Optimista: sumo mi intercesión al pedido → conteo + avatar + botón al instante.
    setPrayers((list) =>
      list.map((x) =>
        x.id === p.id
          ? { ...x, intercessors: [...x.intercessors, { user_id: user.id, display_name: 'Vos' }] }
          : x
      )
    )
    try {
      await addIntercession(p.id, user.id)
    } catch {
      /* optimista; al recargar se corrige */
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
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

  async function shareInvite() {
    const url = `${window.location.origin}/join?code=${group.invite_code}`
    const text = `Te invito al grupo "${group.name}" en Lee Tu Biblia`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lee Tu Biblia', text, url })
      } catch {
        /* cancelado */
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

      {/* Nombre (+ editar, owner) */}
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
            className="w-full rounded-input px-4 py-3 text-[18px] font-bold outline-none"
            style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-primary)' }}
            maxLength={60}
          />
          {nameError && (
            <p className="mt-1 text-[13px]" style={{ color: 'var(--danger)' }}>
              {nameError}
            </p>
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
            <button type="button" onClick={() => setEditingName(false)} className="btn btn-secondary">
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
              onClick={() => {
                setNameInput(group.name)
                setNameError(null)
                setEditingName(true)
              }}
              className="mt-1 text-ink-soft"
              style={{ opacity: 0.5 }}
            >
              <PencilIcon size={16} />
            </button>
          )}
        </div>
      )}

      <p className="mt-2 text-[14px] text-ink-soft">
        {members.length === 1
          ? 'Solo vos por ahora'
          : `${members.length} caminando juntos${isOwner ? ' · sos el administrador' : ''}`}
      </p>

      {/* HOY — el pulso del grupo */}
      <div
        className="mt-5 rounded-card p-4"
        style={{ backgroundColor: 'var(--accent-tint)', border: '1px solid var(--accent)' }}
      >
        <p
          className="text-[12px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--accent)' }}
        >
          Hoy
        </p>
        {iShare ? (
          <div className="mt-2.5 flex items-center gap-2.5 text-ink">
            <span style={{ color: 'var(--accent)' }}>
              <BookIcon size={18} />
            </span>
            <span className="text-[15px]">
              {readCount === 0 ? (
                'Todavía nadie leyó hoy'
              ) : (
                <>
                  <b>{readCount}</b> {readCount === 1 ? 'leyó' : 'leyeron'} hoy
                </>
              )}
            </span>
          </div>
        ) : (
          <Link
            to="/ajustes"
            className="mt-2.5 flex items-center gap-2.5"
            style={{ color: 'var(--accent)' }}
          >
            <BookIcon size={18} />
            <span className="text-[14px] font-medium">
              Compartí tu lectura para ver la del grupo →
            </span>
          </Link>
        )}
        <div className="mt-2 flex items-center gap-2.5 text-ink">
          <span style={{ color: 'var(--accent)' }}>
            <HeartIcon size={18} />
          </span>
          <span className="text-[15px]">
            {prayingCount > 0 && (
              <>
                <b>{prayingCount}</b> orando ·{' '}
              </>
            )}
            <b>{prayers.length}</b> {prayers.length === 1 ? 'pedido activo' : 'pedidos activos'}
          </span>
        </div>
      </div>

      {/* Oración del grupo — visible para todos, con "Orar" inline */}
      <div className="mt-7 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          Oración del grupo
        </p>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Compartir un pedido"
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-accent"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <PlusIcon size={18} />
        </button>
      </div>
      {prayers.length === 0 ? (
        <p className="mt-3 text-[15px] text-ink-soft">Todavía no hay pedidos compartidos.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {prayers.slice(0, 4).map((p) => (
              <li key={p.id} className="card p-4">
                <p className="text-[16px] font-semibold leading-snug text-ink">{p.title}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {p.intercessors.length > 0 && (
                      <Avatars people={p.intercessors} size={22} surface="var(--surface)" />
                    )}
                    <span className="truncate text-[12px] text-ink-soft">
                      {p.author_name} ·{' '}
                      {p.intercessors.length > 0
                        ? `${p.intercessors.length} orando`
                        : 'nadie todavía'}
                    </span>
                  </div>
                  {p.user_id === user?.id ? (
                    <span className="shrink-0 text-[12px] text-ink-soft">Tu pedido</span>
                  ) : interceding(p) ? (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[13px] font-semibold"
                      style={{ color: 'var(--accent)' }}
                    >
                      <CheckIcon size={15} strokeWidth={2.2} /> Orando
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => orar(p)}
                      className="shrink-0 rounded-pill px-4 py-1.5 text-[13px] font-semibold"
                      style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }}
                    >
                      Orar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/oracion?tab=grupos"
            className="mt-3 inline-block text-[14px] font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            Ver todos →
          </Link>
        </>
      )}

      {/* Testimonios — preview del último (o entrada a la lista si no hay) */}
      {testimony ? (
        <>
          <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            Testimonios
          </p>
          <Link to={`/grupos/${id}/testimonios`} className="card mt-3 block p-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-accent"
                style={{ backgroundColor: 'var(--accent-tint)' }}
              >
                <CheckIcon size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[15px] leading-relaxed text-ink">
                  "{testimony.testimony || testimony.title}"
                </p>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--accent)' }}>
                  {testimony.author_name} · Ver todos →
                </p>
              </div>
            </div>
          </Link>
        </>
      ) : (
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
      )}

      {/* Resumen pastoral — solo el owner */}
      {isOwner && stats && (
        <>
          <div className="card mt-7 p-5">
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
        </>
      )}

      {/* Miembros — la gente, con su lectura (cuando compartís) */}
      <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
        Miembros · {members.length}
      </p>
      <ul className="mt-3 card divide-y divide-hairline">
        {members.map((m) => {
          const isMe = m.user_id === user?.id
          const isMemberOwner = m.role === 'owner'
          const shares = readMap.has(m.user_id)
          const readToday = readMap.get(m.user_id)
          return (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }}
              >
                {initials(m.display_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] text-ink">
                  {m.display_name}
                  {isMe && <span className="text-ink-soft"> (vos)</span>}
                </p>
                {iShare &&
                  (shares ? (
                    readToday ? (
                      <p className="text-[12px] font-medium" style={{ color: 'var(--accent)' }}>
                        ✓ leyó hoy
                      </p>
                    ) : (
                      <p className="text-[12px] text-ink-soft">aún no leyó hoy</p>
                    )
                  ) : (
                    <p className="text-[12px] text-ink-soft" style={{ opacity: 0.7 }}>
                      no comparte su lectura
                    </p>
                  ))}
              </div>
              {isMemberOwner ? (
                <span
                  className="shrink-0 rounded-pill px-2 py-0.5 text-[12px] font-medium"
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
                    className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
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

      {/* Ajustes del grupo — invitar/administrar, abajo */}
      <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
        Invitar al grupo
      </p>
      <div className="card mt-3 p-4">
        <p className="text-[26px] font-bold text-accent" style={{ letterSpacing: '2px' }}>
          {group.invite_code}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={shareInvite}
            className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[13px] font-medium text-on-accent"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <ShareIcon size={16} /> {inviteShared ? 'Copiado' : 'Compartir invitación'}
          </button>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[13px] font-medium text-ink"
            style={{ backgroundColor: 'var(--surface-alt)' }}
          >
            <CopyIcon size={16} /> {copied ? 'Copiado' : 'Copiar código'}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setConfirm({ type: 'regen' })}
              className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[13px] font-medium text-ink"
              style={{ backgroundColor: 'var(--surface-alt)' }}
            >
              <RefreshIcon size={16} /> Regenerar
            </button>
          )}
        </div>
      </div>

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

      {sheetOpen && (
        <PrayerSheet
          mode="create"
          groups={[{ id: group.id, name: group.name }]}
          presetGroupId={group.id}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setSheetOpen(false)
            load()
          }}
        />
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
