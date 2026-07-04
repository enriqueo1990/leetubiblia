import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CopyIcon,
  RefreshIcon,
  CheckIcon,
  LockIcon,
  PencilIcon,
  ShareIcon,
  PlusIcon,
  MinusIcon,
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
  getGroupReadingWeek,
  getGroupTestimonies,
  addIntercession,
} from '../lib/db.js'
import { SkeletonDetail } from '../components/Skeleton.jsx'
import RetryError from '../components/RetryError.jsx'
import Sheet from '../components/Sheet.jsx'
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
  const [weekly, setWeekly] = useState([]) // [{ user_id, week: boolean[7] }] — solo owner
  const [prayers, setPrayers] = useState([]) // pedidos activos del grupo
  const [testimony, setTestimony] = useState(null) // último testimonio
  const [sheetOpen, setSheetOpen] = useState(false) // sheet "compartir un pedido"
  const [inviteOpen, setInviteOpen] = useState(false) // sheet "invitar al grupo"
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
      const [readRes, prayRes, testRes, statsRes, weekRes] = await Promise.allSettled([
        getGroupReadingToday(Number(id)),
        getGroupActivePrayers(Number(id)),
        getGroupTestimonies(Number(id)),
        owner ? getGroupStats(Number(id)) : Promise.resolve(null),
        owner ? getGroupReadingWeek(Number(id)) : Promise.resolve([]),
      ])
      if (readRes.status === 'fulfilled') setReading(readRes.value)
      if (prayRes.status === 'fulfilled') setPrayers(prayRes.value)
      if (testRes.status === 'fulfilled') setTestimony(testRes.value[0] ?? null)
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      if (weekRes.status === 'fulfilled') setWeekly(weekRes.value)
    } catch {
      setError('No se pudo cargar el grupo.')
    }
  }, [id, user])

  // Refresco liviano: crear un pedido solo cambia la oración (y el pulso "Hoy"
  // deriva de ella), así que no vale recargar el grupo entero.
  const loadPrayers = useCallback(async () => {
    try {
      setPrayers(await getGroupActivePrayers(Number(id)))
    } catch {
      /* el pulso queda como estaba; se corrige en la próxima carga */
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
        <RetryError message={error} onRetry={load} />
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

  // Semana del grupo (solo owner): filas en el orden de la lista de miembros,
  // con nombre resuelto. Letras de los días reales que terminan hoy.
  const weekMap = new Map(weekly.map((r) => [r.user_id, r.week ?? []]))
  const weekRows = members
    .filter((m) => weekMap.has(m.user_id))
    .map((m) => ({ ...m, week: weekMap.get(m.user_id) }))
  const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d
  })
  const prayingCount = new Set(prayers.flatMap((p) => p.intercessors.map((i) => i.user_id))).size

  const interceding = (p) => p.intercessors.some((x) => x.user_id === user?.id)

  async function orar(p) {
    if (!user || interceding(p)) return
    // Optimista: sumo mi intercesión al pedido → conteo + avatar + botón al
    // instante (el pulso "Hoy" también, porque deriva de `prayers`).
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
      // Revertir: si no quedó guardado, no mostramos "Orando" como si hubiera pasado.
      setPrayers((list) =>
        list.map((x) =>
          x.id === p.id
            ? { ...x, intercessors: x.intercessors.filter((i) => i.user_id !== user.id) }
            : x
        )
      )
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
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[26px] font-bold tracking-tight text-ink">{group.name}</h1>
            {isOwner && (
              <button
                type="button"
                aria-label="Editar nombre del grupo"
                onClick={() => {
                  setNameInput(group.name)
                  setNameError(null)
                  setEditingName(true)
                }}
                className="mt-1 shrink-0 text-ink-soft"
                style={{ opacity: 0.5 }}
              >
                <PencilIcon size={16} />
              </button>
            )}
          </div>
          {/* Acción primaria en el header, como en Grupos/Oración: invitar. */}
          <button
            type="button"
            aria-label="Invitar al grupo"
            onClick={() => setInviteOpen(true)}
            className="flex h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-on-accent lg:px-4"
            style={{ backgroundColor: 'var(--accent)', minWidth: 44 }}
          >
            <ShareIcon size={18} />
            <span className="hidden text-[15px] font-semibold lg:inline">Invitar</span>
          </button>
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

      {/* Oración — visible para todos, con "Orar" inline */}
      <div className="mt-7 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          Oración
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
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="card mt-3 flex w-full items-center gap-3 p-4 text-left"
        >
          <span
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-accent"
            style={{ backgroundColor: 'var(--accent-tint)' }}
            aria-hidden="true"
          >
            <HeartIcon size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] text-ink">Todavía no hay pedidos compartidos</span>
            <span className="mt-0.5 block text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
              Compartí el primero →
            </span>
          </span>
        </button>
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

      {/* Testimonios — solo cuando existe el primero; una sección vacía que dice
          "no hay nada" es ruido (el flujo para crearlos nace en la oración). */}
      {testimony && (
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

      {/* La semana del grupo — solo el owner (y recíproco: el RPC devuelve []
          si él no comparte). Info para acompañar aunque un día no entre; los
          miembros nunca ven esta tarjeta. */}
      {isOwner && weekRows.length > 0 && (
        <div className="card mt-7 p-5">
          <div className="flex items-center gap-1.5 text-ink-soft">
            <LockIcon size={13} />
            <span className="text-[12px] font-semibold uppercase tracking-wide">
              Lectura de la semana · solo vos lo ves
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {/* Header con la letra del día real de cada columna; "hoy" en acento. */}
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="min-w-0 flex-1" />
              <div className="flex gap-1.5">
                {weekDates.map((d, i) => (
                  <span
                    key={i}
                    className="flex h-[18px] w-[18px] items-center justify-center text-[10px] font-semibold"
                    style={{ color: i === 6 ? 'var(--accent)' : 'var(--text-soft)' }}
                  >
                    {DAY_LETTERS[d.getDay()]}
                  </span>
                ))}
              </div>
            </div>
            {weekRows.map((m) => {
              const readDays = m.week.filter(Boolean).length
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3"
                  aria-label={`${m.display_name}: marcó su lectura ${readDays} de los últimos 7 días`}
                >
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {m.display_name}
                    {m.user_id === user?.id && <span className="text-ink-soft"> (vos)</span>}
                  </span>
                  <div className="flex gap-1.5" aria-hidden="true">
                    {m.week.map((read, i) => (
                      <span key={i} className="flex h-[18px] w-[18px] items-center justify-center">
                        <span
                          className="h-[10px] w-[10px] rounded-full"
                          style={
                            read
                              ? { backgroundColor: 'var(--accent)' }
                              : {
                                  backgroundColor: 'var(--surface-alt)',
                                  border: '1px solid var(--hairline)',
                                }
                          }
                        />
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[12px] text-ink-soft">
            Cada punto es un día en que esa persona marcó su lectura. Solo aparecen quienes
            comparten.
          </p>
        </div>
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
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent)' }}
              >
                {initials(m.display_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] text-ink">
                  {m.display_name}
                  {isMe && <span className="text-ink-soft"> (vos)</span>}
                  {isMemberOwner && <span className="text-[13px] text-ink-soft"> · admin</span>}
                </p>
              </div>
              {/* Solo señalamos lo positivo: quien leyó hoy. El resto no muestra
                  nada — nada de "no leyó" que suene a reproche. Recíproco: el chip
                  solo aparece si vos también compartís tu lectura. */}
              <div className="flex shrink-0 items-center gap-2">
                {iShare && shares && readToday && (
                  <span
                    className="flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-medium"
                    style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-tint)' }}
                  >
                    <CheckIcon size={13} strokeWidth={2.2} /> Leyó hoy
                  </span>
                )}
                {isOwner && !isMemberOwner && (
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
                      <MinusIcon size={16} />
                    </span>
                  </button>
                )}
              </div>
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

      {sheetOpen && (
        <PrayerSheet
          mode="create"
          groups={[{ id: group.id, name: group.name }]}
          presetGroupId={group.id}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setSheetOpen(false)
            loadPrayers()
          }}
        />
      )}

      {inviteOpen && (
        <Sheet title="Invitar al grupo" onCancel={() => setInviteOpen(false)}>
          <div className="pb-1 text-center">
            <p className="text-[15px] text-ink-soft">
              Compartí este código con quien quieras sumar al grupo.
            </p>
            {/* El código en tinta neutra: el acento queda para la acción real (compartir). */}
            <p
              className="mt-6 text-[40px] font-bold text-ink"
              style={{ letterSpacing: '6px', paddingLeft: '6px' }}
            >
              {group.invite_code}
            </p>
            <div className="mt-7 space-y-3">
              <button
                type="button"
                onClick={shareInvite}
                className="btn btn-primary flex items-center justify-center gap-2"
              >
                <ShareIcon size={18} /> {inviteShared ? 'Copiado' : 'Compartir invitación'}
              </button>
              <button
                type="button"
                onClick={copyCode}
                className="btn btn-secondary flex items-center justify-center gap-2"
              >
                <CopyIcon size={18} /> {copied ? 'Copiado' : 'Copiar código'}
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setConfirm({ type: 'regen' })}
                  className="flex w-full items-center justify-center gap-1.5 py-2 text-[14px] font-medium text-ink-soft"
                >
                  <RefreshIcon size={15} /> Regenerar código
                </button>
              )}
            </div>
            {/* El cambio de texto a "Copiado" es solo visual; lo anunciamos para lectores. */}
            <span className="sr-only" role="status" aria-live="polite">
              {copied ? 'Código copiado' : inviteShared ? 'Link de invitación copiado' : ''}
            </span>
          </div>
        </Sheet>
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
