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
import BackLink from '../components/BackLink.jsx'
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
import { usePreferences } from '../lib/preferences.jsx'

// Detalle de grupo — "de panel a sala" (Fase 3): la gente y el pulso del día
// primero; oración y lectura del grupo en la misma vista; la administración
// (código, regenerar, renombrar) abajo.
function Stat({ n, label }) {
  return (
    <div className="flex-1">
      <div className="stat-num text-[30px] font-bold text-accent-ink">
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
  const { t } = usePreferences()
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
      setError(t('groupDetail.loadError'))
    }
  }, [id, user, t])

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
        <BackLink to="/grupos" label={t('nav.grupos')} />
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
  const DAY_LETTERS = t('groupDetail.weekDayLetters').split(',')
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
          ? { ...x, intercessors: [...x.intercessors, { user_id: user.id, display_name: t('common.you') }] }
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
      window.prompt(t('groupDetail.copyCodePrompt'), group.invite_code)
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
      setNameError(t('groupDetail.nameError'))
    } finally {
      setSavingName(false)
    }
  }

  async function shareInvite() {
    const url = `${window.location.origin}/join?code=${group.invite_code}`
    const text = t('groupDetail.inviteText', { name: group.name })
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
        window.prompt(t('groupDetail.copyInvitePrompt'), url)
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
      <BackLink to="/grupos" label={t('nav.grupos')} />

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
              {savingName ? '…' : t('common.save')}
            </button>
            <button type="button" onClick={() => setEditingName(false)} className="btn btn-secondary">
              {t('common.cancel')}
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
                aria-label={t('groupDetail.editNameAria')}
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
            aria-label={t('groupDetail.inviteAria')}
            onClick={() => setInviteOpen(true)}
            className="flex h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-on-accent lg:px-4"
            style={{ backgroundColor: 'var(--accent)', minWidth: 44 }}
          >
            <ShareIcon size={18} />
            <span className="hidden text-[15px] font-semibold lg:inline">{t('groupDetail.invite')}</span>
          </button>
        </div>
      )}

      <p className="mt-2 text-[14px] text-ink-soft">
        {members.length === 1
          ? t('groupDetail.onlyYou')
          : `${t('groupDetail.walkingTogether', { count: members.length })}${isOwner ? t('groupDetail.adminSuffix') : ''}`}
      </p>

      {/* HOY — el pulso del grupo */}
      <div
        className="mt-5 rounded-card p-4"
        style={{ backgroundColor: 'var(--accent-tint)', border: '1px solid var(--accent)' }}
      >
        <p
          className="text-[12px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--accent-ink)' }}
        >
          {t('groupDetail.today')}
        </p>
        {iShare ? (
          <div className="mt-2.5 flex items-center gap-2.5 text-ink">
            <span style={{ color: 'var(--accent-ink)' }}>
              <BookIcon size={18} />
            </span>
            <span className="text-[15px]">
              {readCount === 0 ? (
                t('groupDetail.noneReadToday')
              ) : (
                <>
                  <b>{readCount}</b> {t('groupDetail.readTodaySuffix', { count: readCount })}
                </>
              )}
            </span>
          </div>
        ) : (
          <Link
            to="/ajustes"
            className="mt-2.5 flex items-center gap-2.5"
            style={{ color: 'var(--accent-ink)' }}
          >
            <BookIcon size={18} />
            <span className="text-[14px] font-medium">
              {t('groupDetail.shareToSee')} →
            </span>
          </Link>
        )}
        <div className="mt-2 flex items-center gap-2.5 text-ink">
          <span style={{ color: 'var(--accent-ink)' }}>
            <HeartIcon size={18} />
          </span>
          <span className="text-[15px]">
            {prayingCount > 0 && (
              <>
                <b>{prayingCount}</b> {t('groupDetail.praying')} ·{' '}
              </>
            )}
            <b>{prayers.length}</b> {t('groupDetail.activePrayers', { count: prayers.length })}
          </span>
        </div>
      </div>

      {/* Oración — visible para todos, con "Orar" inline */}
      <div className="mt-7 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          {t('nav.oracion')}
        </p>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={t('groupDetail.sharePrayerAria')}
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
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-accent-ink"
            style={{ backgroundColor: 'var(--accent-tint)' }}
            aria-hidden="true"
          >
            <HeartIcon size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] text-ink">{t('groupDetail.noPrayers')}</span>
            <span className="mt-0.5 block text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
              {t('groupDetail.shareFirst')} →
            </span>
          </span>
        </button>
      ) : (
        <>
          {/* Una sola card agrupada (filas + hairlines) en vez de una card por
              pedido: misma info, menos cajas apiladas. */}
          <ul className="card mt-3 divide-y divide-hairline">
            {prayers.slice(0, 4).map((p) => (
              <li key={p.id} className="p-4">
                <p className="text-[16px] font-semibold leading-snug text-ink">{p.title}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {p.intercessors.length > 0 && (
                      <Avatars people={p.intercessors} size={22} surface="var(--surface)" />
                    )}
                    <span className="truncate text-[12px] text-ink-soft">
                      {p.author_name} ·{' '}
                      {p.intercessors.length > 0
                        ? t('groupDetail.nPraying', { count: p.intercessors.length })
                        : t('groupDetail.nobodyYet')}
                    </span>
                  </div>
                  {p.user_id === user?.id ? (
                    <span className="shrink-0 text-[12px] text-ink-soft">{t('groupDetail.yourPrayer')}</span>
                  ) : interceding(p) ? (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[13px] font-semibold"
                      style={{ color: 'var(--accent-ink)' }}
                    >
                      <CheckIcon size={15} strokeWidth={2.2} /> {t('groupDetail.prayingStatus')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => orar(p)}
                      className="shrink-0 rounded-pill px-4 py-1.5 text-[13px] font-semibold"
                      style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
                    >
                      {t('groupDetail.pray')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/oracion?tab=grupos"
            className="mt-3 inline-block text-[14px] font-semibold"
            style={{ color: 'var(--accent-ink)' }}
          >
            {t('groupDetail.seeAll')} →
          </Link>
        </>
      )}

      {/* Testimonios — solo cuando existe el primero; una sección vacía que dice
          "no hay nada" es ruido (el flujo para crearlos nace en la oración). */}
      {testimony && (
        <>
          <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            {t('groupDetail.testimonies')}
          </p>
          <Link to={`/grupos/${id}/testimonios`} className="card mt-3 block p-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-accent-ink"
                style={{ backgroundColor: 'var(--accent-tint)' }}
              >
                <CheckIcon size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[15px] leading-relaxed text-ink">
                  "{testimony.testimony || testimony.title}"
                </p>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--accent-ink)' }}>
                  {testimony.author_name} · {t('groupDetail.seeAll')} →
                </p>
              </div>
            </div>
          </Link>
        </>
      )}

      {/* Miembros — la gente, con su lectura (cuando compartís) */}
      <p className="mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
        {t('groupDetail.members')} · {members.length}
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
                style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
              >
                {initials(m.display_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] text-ink">
                  {m.display_name}
                  {isMe && <span className="text-ink-soft"> {t('groupDetail.youParen')}</span>}
                  {isMemberOwner && <span className="text-[13px] text-ink-soft"> · {t('groupDetail.adminShort')}</span>}
                </p>
              </div>
              {/* Solo señalamos lo positivo: quien leyó hoy. El resto no muestra
                  nada — nada de "no leyó" que suene a reproche. Recíproco: el chip
                  solo aparece si vos también compartís tu lectura. */}
              <div className="flex shrink-0 items-center gap-2">
                {iShare && shares && readToday && (
                  <span
                    className="flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-medium"
                    style={{ color: 'var(--accent-ink)', backgroundColor: 'var(--accent-tint)' }}
                  >
                    <CheckIcon size={13} strokeWidth={2.2} /> {t('groupDetail.readTodayChip')}
                  </span>
                )}
                {isOwner && !isMemberOwner && (
                  <button
                    type="button"
                    onClick={() => setConfirm({ type: 'kick', member: m })}
                    aria-label={t('groupDetail.removeAria', { name: m.display_name })}
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

      {/* Lo privado del líder va debajo de todo: primero la sala compartida
          (pulso, oración, testimonios, miembros), después lo que solo él ve. */}

      {/* Lo privado del líder en UNA sola card con separador interno (resumen +
          semana): dos cajas gemelas apiladas eran ritmo monótono. */}
      {isOwner && (stats || weekRows.length > 0) && (
        <div className="card mt-7 divide-y divide-hairline">
          {stats && (
            <div className="p-5">
              <div className="flex items-center gap-1.5 text-ink-soft">
                <LockIcon size={13} />
                <span className="text-[12px] font-semibold uppercase tracking-wide">
                  {t('groupDetail.summaryPrivate')}
                </span>
              </div>
              <div className="mt-4 flex">
                <Stat n={stats.active} label={t('groupDetail.statActive')} />
                <Stat n={stats.answered} label={t('groupDetail.statAnswered')} />
                <Stat n={stats.praying_week} label={t('groupDetail.statPrayingWeek')} />
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
                {t('groupDetail.answeredPct', { pct: answeredPct })}
              </p>
            </div>
          )}

          {/* La semana del grupo (recíproco: el RPC devuelve [] si él no
              comparte). Los miembros nunca ven esta sección. */}
          {weekRows.length > 0 && (
            <div className="p-5">
              <div className="flex items-center gap-1.5 text-ink-soft">
                <LockIcon size={13} />
                <span className="text-[12px] font-semibold uppercase tracking-wide">
                  {t('groupDetail.weekPrivate')}
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
                    style={{ color: i === 6 ? 'var(--accent-ink)' : 'var(--text-soft)' }}
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
                  aria-label={t('groupDetail.weekAria', { name: m.display_name, days: readDays })}
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
                {t('groupDetail.weekHint')}
              </p>
            </div>
          )}
        </div>
      )}

      {!isOwner && (
        <button
          type="button"
          onClick={() => setConfirm({ type: 'leave' })}
          className="mt-7 w-full py-3 text-center text-[16px]"
          style={{ color: 'var(--danger)' }}
        >
          {t('groupDetail.leaveGroup')}
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
        <Sheet title={t('groupDetail.inviteAria')} onCancel={() => setInviteOpen(false)}>
          <div className="pb-1 text-center">
            <p className="text-[15px] text-ink-soft">
              {t('groupDetail.inviteDesc')}
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
                <ShareIcon size={18} /> {inviteShared ? t('groupDetail.copied') : t('groupDetail.shareInvite')}
              </button>
              <button
                type="button"
                onClick={copyCode}
                className="btn btn-secondary flex items-center justify-center gap-2"
              >
                <CopyIcon size={18} /> {copied ? t('groupDetail.copied') : t('groupDetail.copyCode')}
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setConfirm({ type: 'regen' })}
                  className="flex w-full items-center justify-center gap-1.5 py-2 text-[14px] font-medium text-ink-soft"
                >
                  <RefreshIcon size={15} /> {t('groupDetail.regenCode')}
                </button>
              )}
            </div>
            {/* El cambio de texto a "Copiado" es solo visual; lo anunciamos para lectores. */}
            <span className="sr-only" role="status" aria-live="polite">
              {copied ? t('groupDetail.srCodeCopied') : inviteShared ? t('groupDetail.srInviteCopied') : ''}
            </span>
          </div>
        </Sheet>
      )}

      {confirm?.type === 'leave' && (
        <ConfirmDialog
          title={t('groupDetail.leaveTitle', { name: group.name })}
          message={t('groupDetail.leaveMsg')}
          confirmLabel={t('groupDetail.leave')}
          danger
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'regen' && (
        <ConfirmDialog
          title={t('groupDetail.regenTitle')}
          message={t('groupDetail.regenMsg')}
          confirmLabel={t('groupDetail.regen')}
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'kick' && (
        <ConfirmDialog
          title={t('groupDetail.kickTitle', { name: confirm.member.display_name })}
          message={t('groupDetail.kickMsg')}
          confirmLabel={t('groupDetail.kick')}
          danger
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
