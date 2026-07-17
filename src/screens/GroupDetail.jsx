import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import BackLink from '../components/BackLink.jsx'
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
  getPlan,
  setGroupPlan,
  followGroupPlan,
  dayNumberFor,
  todayLocalISO,
  markDaysRead,
  unmarkDaysFrom,
} from '../lib/db.js'
import { planName } from '../lib/planLabels.js'
import { SkeletonDetail } from '../components/Skeleton.jsx'
import RetryError from '../components/RetryError.jsx'
import PrayerSheet from './PrayerSheet.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import GroupHeader from './groupDetail/GroupHeader.jsx'
import GroupPulse from './groupDetail/GroupPulse.jsx'
import GroupPlanCard from './groupDetail/GroupPlanCard.jsx'
import GroupPlanSheet from './groupDetail/GroupPlanSheet.jsx'
import GroupPrayers from './groupDetail/GroupPrayers.jsx'
import GroupTestimony from './groupDetail/GroupTestimony.jsx'
import GroupMembers from './groupDetail/GroupMembers.jsx'
import GroupPrivateStats from './groupDetail/GroupPrivateStats.jsx'
import GroupInviteSheet from './groupDetail/GroupInviteSheet.jsx'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'

// Detalle de grupo — "de panel a sala" (Fase 3): la gente y el pulso del día
// primero; oración y lectura del grupo en la misma vista; la administración
// (código, regenerar, renombrar) abajo.
export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, updateProfile } = useAuth()
  const { t } = usePreferences()
  const online = useOnlineStatus()
  const iShare = !!profile?.share_reading

  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)
  const [reading, setReading] = useState([]) // [{ user_id, has_read }]
  const [weekly, setWeekly] = useState([]) // [{ user_id, week: boolean[7] }] — solo owner
  const [prayers, setPrayers] = useState([]) // pedidos activos del grupo
  const [testimony, setTestimony] = useState(null) // último testimonio
  const [planInfo, setPlanInfo] = useState(null) // metadata del plan común del grupo
  const [sheetOpen, setSheetOpen] = useState(false) // sheet "compartir un pedido"
  const [inviteOpen, setInviteOpen] = useState(false) // sheet "invitar al grupo"
  const [planPickerOpen, setPlanPickerOpen] = useState(false) // sheet "plan del grupo" (owner)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planError, setPlanError] = useState(false)
  const [confirmAdopt, setConfirmAdopt] = useState(false) // sumarse al plan del grupo
  const [adopting, setAdopting] = useState(false)
  const [adoptError, setAdoptError] = useState(false)
  const [following, setFollowing] = useState(false) // sigo el plan como lectura adicional
  const [followError, setFollowError] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [inviteShared, setInviteShared] = useState(false)
  const [confirm, setConfirm] = useState(null) // { type } | null
  const [busy, setBusy] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState(null)
  const [prayerAction, setPrayerAction] = useState({ busyId: null, errorId: null })
  const [partialLoadError, setPartialLoadError] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    setPartialLoadError(false)
    try {
      const d = await getGroupDetail(Number(id))
      setData(d)
      const me = d.members.find((m) => m.user_id === user?.id)
      setFollowing(!!me?.follow_plan)
      const owner = me?.role === 'owner'
      const [readRes, prayRes, testRes, statsRes, weekRes, planRes] = await Promise.allSettled([
        getGroupReadingToday(Number(id)),
        getGroupActivePrayers(Number(id)),
        getGroupTestimonies(Number(id)),
        owner ? getGroupStats(Number(id)) : Promise.resolve(null),
        owner ? getGroupReadingWeek(Number(id)) : Promise.resolve([]),
        d.group.plan_id ? getPlan(d.group.plan_id) : Promise.resolve(null),
      ])
      setPartialLoadError(
        [readRes, prayRes, testRes, statsRes, weekRes, planRes].some(
          (result) => result.status === 'rejected'
        )
      )
      if (readRes.status === 'fulfilled') setReading(readRes.value)
      if (prayRes.status === 'fulfilled') setPrayers(prayRes.value)
      if (testRes.status === 'fulfilled') setTestimony(testRes.value[0] ?? null)
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      if (weekRes.status === 'fulfilled') setWeekly(weekRes.value)
      setPlanInfo(planRes.status === 'fulfilled' ? planRes.value : null)
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
      // El pulso queda como estaba, pero no mostramos ese estado como completo.
      setPartialLoadError(true)
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
  // con nombre resuelto.
  const weekMap = new Map(weekly.map((r) => [r.user_id, r.week ?? []]))
  const weekRows = members
    .filter((m) => weekMap.has(m.user_id))
    .map((m) => ({ ...m, week: weekMap.get(m.user_id) }))
  const prayingCount = new Set(prayers.flatMap((p) => p.intercessors.map((i) => i.user_id))).size

  // Plan común del grupo: día que dicta el calendario (misma regla canónica que
  // el plan personal), acotado al rango del plan. Sumado = tengo ESE plan activo
  // Y anclado a la MISMA fecha de inicio (comparación de strings YYYY-MM-DD).
  const groupPlanTotal = planInfo?.duration_days ?? null
  const groupPlanDayRaw = group.plan_start_date ? dayNumberFor(group.plan_start_date) : null
  const groupPlanFinished =
    groupPlanDayRaw != null && groupPlanTotal != null && groupPlanDayRaw > groupPlanTotal
  const groupPlanDay =
    groupPlanDayRaw != null && groupPlanTotal != null
      ? Math.min(Math.max(groupPlanDayRaw, 1), groupPlanTotal)
      : null
  const amOnGroupPlan =
    !!group.plan_id &&
    profile?.active_plan_id === group.plan_id &&
    profile?.plan_start_date === group.plan_start_date

  // El owner elige (o cambia) el plan del grupo; arranca hoy como día 1.
  async function handleSetPlan(planId) {
    if (savingPlan) return
    setSavingPlan(true)
    setPlanError(false)
    try {
      await setGroupPlan(group.id, planId, todayLocalISO())
      setPlanPickerOpen(false)
      await load()
    } catch {
      setPlanError(true)
    } finally {
      setSavingPlan(false)
    }
  }

  // Sumarse al plan del grupo: pasa a ser TU plan activo, anclado al día 1 del
  // grupo — mismo día para todos. Igual que "¿en qué día vas?" de Ajustes, el
  // progreso se sincroniza en ambos sentidos (días previos leídos, siguientes no).
  async function adoptGroupPlan() {
    if (!user || !group.plan_id || adopting) return
    setAdopting(true)
    setAdoptError(false)
    try {
      const { error: err } = await updateProfile({
        active_plan_id: group.plan_id,
        plan_start_date: group.plan_start_date,
      })
      if (err) throw err
      try {
        if (groupPlanDay != null && groupPlanDay > 1)
          await markDaysRead(user.id, group.plan_id, groupPlanDay - 1)
        if (groupPlanDay != null) await unmarkDaysFrom(user.id, group.plan_id, groupPlanDay)
      } catch {
        // No es bloqueante: el plan ya quedó activo y anclado.
      }
      // Ya es tu plan principal: seguirlo además como adicional lo duplicaría.
      if (following) {
        setFollowing(false)
        followGroupPlan(group.id, false).catch(() => {})
      }
      setConfirmAdopt(false)
    } catch {
      setAdoptError(true)
      setConfirmAdopt(false)
    } finally {
      setAdopting(false)
    }
  }

  // El modo liviano: seguir el plan del grupo como lectura adicional en Hoy,
  // sin tocar tu plan activo (ni racha ni progreso propio). Reversible y de un
  // toque — no pide confirmación. Optimista: si el servidor falla, se revierte.
  async function toggleFollow(next) {
    if (!user || !group.plan_id) return
    setFollowing(next)
    setFollowError(false)
    try {
      await followGroupPlan(group.id, next)
    } catch {
      setFollowing(!next)
      setFollowError(true)
    }
  }

  async function orar(p) {
    if (
      !user ||
      !online ||
      prayerAction.busyId != null ||
      p.intercessors.some((x) => x.user_id === user.id)
    ) return
    setPrayerAction({ busyId: p.id, errorId: null })
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
      setPrayerAction({ busyId: null, errorId: p.id })
      return
    }
    setPrayerAction({ busyId: null, errorId: null })
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
      else if (confirm.type === 'clearPlan') {
        await setGroupPlan(group.id, null)
        setPlanPickerOpen(false)
      } else if (confirm.type === 'leave') {
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
      {partialLoadError && (
        <div
          className="mt-3 rounded-input border px-4 py-3"
          style={{ backgroundColor: 'var(--surface-alt)', borderColor: 'var(--control-border)' }}
          role="status"
        >
          <p className="text-[13px] leading-snug text-ink-soft">{t('groupDetail.partialLoadError')}</p>
          <button
            type="button"
            onClick={load}
            className="mt-1 inline-flex min-h-11 items-center font-semibold text-accent-ink"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      <GroupHeader
        group={group}
        isOwner={isOwner}
        membersCount={members.length}
        editingName={editingName}
        nameInput={nameInput}
        setNameInput={setNameInput}
        nameError={nameError}
        savingName={savingName}
        onStartEdit={() => {
          setNameInput(group.name)
          setNameError(null)
          setEditingName(true)
        }}
        onSaveName={saveName}
        onCancelEdit={() => setEditingName(false)}
        onInvite={() => setInviteOpen(true)}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-6">
        <div>
          <GroupPulse
            iShare={iShare}
            readCount={readCount}
            prayingCount={prayingCount}
            prayersCount={prayers.length}
          />

          <GroupPlanCard
            isOwner={isOwner}
            planInfo={planInfo}
            groupPlanFinished={groupPlanFinished}
            groupPlanDay={groupPlanDay}
            groupPlanTotal={groupPlanTotal}
            amOnGroupPlan={amOnGroupPlan}
            following={following}
            adoptError={adoptError}
            followError={followError}
            onChangePlan={() => setPlanPickerOpen(true)}
            onOpenPicker={() => setPlanPickerOpen(true)}
            onJoinPlan={() => {
              setAdoptError(false)
              setConfirmAdopt(true)
            }}
            onToggleFollow={toggleFollow}
          />

          <GroupMembers
            members={members}
            isOwner={isOwner}
            iShare={iShare}
            readMap={readMap}
            onKick={(m) => setConfirm({ type: 'kick', member: m })}
          />
        </div>

        <div>
          <GroupPrayers
            prayers={prayers}
            groupId={id}
            groupName={group.name}
            onAddPrayer={() => setSheetOpen(true)}
            onPray={orar}
            prayerAction={prayerAction}
            online={online}
          />
          <GroupTestimony testimony={testimony} groupId={id} />
          {isOwner && <GroupPrivateStats stats={stats} weekRows={weekRows} answeredPct={answeredPct} />}
        </div>
      </div>

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
        <GroupInviteSheet
          group={group}
          isOwner={isOwner}
          copied={copied}
          inviteShared={inviteShared}
          onClose={() => setInviteOpen(false)}
          onShare={shareInvite}
          onCopyCode={copyCode}
          onRegen={() => setConfirm({ type: 'regen' })}
        />
      )}

      {planPickerOpen && (
        <GroupPlanSheet
          currentPlanId={group.plan_id ?? null}
          saving={savingPlan}
          error={planError}
          onSet={handleSetPlan}
          onClear={group.plan_id ? () => setConfirm({ type: 'clearPlan' }) : null}
          onCancel={() => {
            setPlanPickerOpen(false)
            setPlanError(false)
          }}
        />
      )}

      {confirmAdopt && planInfo && (
        <ConfirmDialog
          title={t('groupDetail.adoptTitle', { name: planName(t, planInfo) })}
          message={
            groupPlanDay != null && groupPlanDay > 1
              ? t('groupDetail.adoptMsg', { day: groupPlanDay })
              : t('groupDetail.adoptMsgDay1')
          }
          confirmLabel={t('groupDetail.adopt')}
          busy={adopting}
          onConfirm={adoptGroupPlan}
          onCancel={() => setConfirmAdopt(false)}
        />
      )}

      {confirm?.type === 'clearPlan' && (
        <ConfirmDialog
          title={t('groupDetail.clearPlanTitle')}
          message={t('groupDetail.clearPlanMsg')}
          confirmLabel={t('groupDetail.clearPlanConfirm')}
          danger
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
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
