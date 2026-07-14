import { useEffect, useRef, useState } from 'react'
import Sheet from '../components/Sheet.jsx'
import Segmented from '../components/Segmented.jsx'
import Switch from '../components/Switch.jsx'
import Avatars from '../components/Avatars.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useAuth } from '../lib/auth.jsx'
import { usePreferences } from '../lib/preferences.jsx'
import { fmtDate } from '../i18n/dates.js'
import { createPrayer, updatePrayer, deletePrayer, getIntercessors } from '../lib/db.js'
import { inputStyle } from '../components/formStyles.js'

// Crear / editar pedido de oración (documento maestro §5.5, README pantalla 5).
// Solo el autor edita/borra (garantizado además por RLS).

function FieldLabel({ children, optional }) {
  const { t } = usePreferences()
  return (
    <p className="mb-1.5 mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
      {children}
      {optional && <span className="font-normal lowercase"> ({t('common.optional')})</span>}
    </p>
  )
}

export default function PrayerSheet({ mode, prayer, groups, presetGroupId, onClose, onSaved, onDeleted }) {
  const { user } = useAuth()
  const { t, locale } = usePreferences()
  const editing = mode === 'edit'
  const VIS = [
    { key: 'private', label: t('prayerSheet.vis.private') },
    { key: 'shared', label: t('prayerSheet.vis.shared') },
  ]
  const STATUS = [
    { key: 'active', label: t('prayerSheet.status.active') },
    { key: 'answered', label: t('prayerSheet.status.answered') },
  ]
  const DURATION = [
    { key: 'day', label: t('prayerSheet.duration.day') },
    { key: 'week', label: t('prayerSheet.duration.week') },
    { key: 'month', label: t('prayerSheet.duration.month') },
    { key: 'forever', label: t('prayerSheet.duration.forever') },
  ]

  const [title, setTitle] = useState(prayer?.title ?? '')
  const [description, setDescription] = useState(prayer?.description ?? '')
  const [visibility, setVisibility] = useState(
    prayer?.visibility ?? (presetGroupId ? 'shared' : 'private')
  )
  const [groupId, setGroupId] = useState(
    prayer?.shared_group_id ?? presetGroupId ?? groups?.[0]?.id ?? null
  )
  const [status, setStatus] = useState(prayer?.status ?? 'active')
  const [duration, setDuration] = useState(prayer?.duration_type ?? 'forever')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [testimony, setTestimony] = useState(prayer?.testimony ?? '')
  const [testimonyShared, setTestimonyShared] = useState(prayer?.testimony_shared ?? false)
  const [intercessors, setIntercessors] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmShare, setConfirmShare] = useState(false)
  const titleRef = useRef(null)

  // En creación, esperar a que la animación del sheet termine antes de enfocar
  // el input — evita que el teclado compita con el slide-up en mobile.
  useEffect(() => {
    if (editing) return
    const id = setTimeout(() => titleRef.current?.focus(), 350)
    return () => clearTimeout(id)
  }, [editing])

  // ¿Hay cambios sin guardar? Para confirmar el descarte al cerrar por scrim/Escape.
  const dirty =
    title !== (prayer?.title ?? '') ||
    description !== (prayer?.description ?? '') ||
    visibility !== (prayer?.visibility ?? (presetGroupId ? 'shared' : 'private')) ||
    status !== (prayer?.status ?? 'active') ||
    groupId !== (prayer?.shared_group_id ?? presetGroupId ?? groups?.[0]?.id ?? null) ||
    duration !== (prayer?.duration_type ?? 'forever') ||
    testimony !== (prayer?.testimony ?? '') ||
    testimonyShared !== (prayer?.testimony_shared ?? false)

  // El autor ve quiénes oran por su pedido compartido (modelo pull: así "se
  // entera" sin push). Se carga sobre el pedido tal como está guardado.
  useEffect(() => {
    if (editing && prayer?.visibility === 'shared') {
      getIntercessors(prayer.id).then(setIntercessors).catch(() => {})
    }
  }, [editing, prayer])

  const needsGroup = visibility === 'shared'
  const canSave =
    title.trim().length > 0 && (!needsGroup || groupId) && !busy
  const groupName =
    prayer?.group?.name || groups?.find((g) => g.id === groupId)?.name || t('prayerSheet.yourGroupFallback')

  // Editar un pedido para exponerlo a un grupo (de privado a compartido, o
  // cambiándolo a otro grupo) muestra a gente nueva algo que antes era privado:
  // pedimos confirmación explícita antes de cruzar esa frontera.
  const willExpose =
    editing &&
    visibility === 'shared' &&
    (prayer?.visibility !== 'shared' || prayer?.shared_group_id !== groupId)

  function requestSave() {
    if (!canSave) return
    if (willExpose) {
      setConfirmShare(true)
      return
    }
    handleSave()
  }

  async function handleSave() {
    if (!canSave) return
    setConfirmShare(false)
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        // El testimonio solo aplica a una compartida respondida; si vuelve a
        // activa o a privada, se limpia lo compartido.
        const canTestimony = visibility === 'shared' && status === 'answered'
        const patch = {
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          shared_group_id: needsGroup ? groupId : null,
          status,
          // answered_at: sella al pasar a respondido; lo limpia al volver a activo.
          answered_at:
            status === 'answered'
              ? prayer.answered_at ?? new Date().toISOString()
              : null,
          testimony: canTestimony ? testimony.trim() || null : null,
          testimony_shared: canTestimony && testimonyShared,
          testimony_shared_at:
            canTestimony && testimonyShared
              ? prayer.testimony_shared_at ?? new Date().toISOString()
              : null,
          duration_type: duration,
          // Al cambiar duración en edición, recalcula desde ahora.
          expires_at: duration === 'forever' ? null
            : duration !== prayer.duration_type
              ? new Date(Date.now() + { day: 1, week: 7, month: 30 }[duration] * 86400000).toISOString()
              : prayer.expires_at,
        }
        await updatePrayer(prayer.id, patch)
      } else {
        await createPrayer({ userId: user.id, title, description, visibility, groupId, durationType: duration })
      }
      onSaved()
    } catch {
      setError(t('prayerSheet.saveError'))
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await deletePrayer(prayer.id)
      onDeleted?.() ?? onSaved()
    } catch {
      setConfirmDelete(false)
      setError(t('prayerSheet.deleteError'))
      setBusy(false)
    }
  }

  const answeredDate =
    editing && status === 'answered' && prayer?.answered_at
      ? fmtDate(prayer.answered_at, locale, { day: 'numeric', month: 'long' })
      : null

  return (
    <Sheet
      title={editing ? t('prayerSheet.editTitle') : t('prayerSheet.newTitle')}
      onCancel={onClose}
      dirty={dirty}
      footer={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          style={{ opacity: canSave ? 1 : 0.5 }}
          onClick={requestSave}
        >
          {busy ? t('prayerSheet.saving') : t('prayerSheet.save')}
        </button>
      }
    >
      {editing && prayer?.visibility === 'shared' && (
        <div className="mb-1 mt-1 flex items-center gap-2.5">
          <Avatars people={intercessors} size={26} surface="var(--bg-app)" />
          <span className="text-[13px] text-ink-soft">
            {intercessors.length > 0
              ? t('prayerSheet.prayingForThis', { count: intercessors.length })
              : t('prayerSheet.noneYet')}
          </span>
        </div>
      )}

      <FieldLabel>
        {t('prayerSheet.fieldTitle')} <span style={{ color: 'var(--accent-ink)' }}>•</span>
      </FieldLabel>
      <input
        ref={titleRef}
        type="text"
        placeholder={t('prayerSheet.titlePlaceholder')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />

      <FieldLabel optional>{t('prayerSheet.fieldDescription')}</FieldLabel>
      <textarea
        rows={3}
        placeholder={t('prayerSheet.descPlaceholder')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full resize-none rounded-input px-4 py-3 text-[16px] outline-none"
        style={inputStyle}
      />

      <FieldLabel>{t('prayerSheet.fieldDuration')}</FieldLabel>
      <Segmented options={DURATION} value={duration} onChange={setDuration} />

      <FieldLabel>{t('prayerSheet.fieldVisibility')}</FieldLabel>
      <Segmented options={VIS} value={visibility} onChange={setVisibility} />

      {needsGroup && (
        <div className="card mt-3 divide-y divide-hairline">
          {groups?.length ? (
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-[16px] text-ink">{g.name}</span>
                {g.id === groupId && (
                  <span style={{ color: 'var(--accent-ink)' }}>✓</span>
                )}
              </button>
            ))
          ) : (
            <p className="px-4 py-3 text-[15px] text-ink-soft">
              {t('prayerSheet.noGroups')}
            </p>
          )}
        </div>
      )}

      {editing && (
        <>
          <FieldLabel>{t('prayerSheet.fieldStatus')}</FieldLabel>
          <Segmented options={STATUS} value={status} onChange={setStatus} />
          {answeredDate && (
            <p className="mt-2 text-[13px]" style={{ color: 'var(--accent-ink)' }}>
              ✓ {t('prayerSheet.answeredOn', { date: answeredDate })}
            </p>
          )}

          {needsGroup && status === 'answered' && (
            <div className="card mt-4 p-4">
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-[16px] text-ink">{t('prayerSheet.shareWith', { group: groupName })}</span>
                <Switch
                  on={testimonyShared}
                  onChange={setTestimonyShared}
                  label={t('prayerSheet.shareTestimonyLabel', { group: groupName })}
                />
              </div>
              <div className="mt-3 border-t border-hairline pt-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                  {t('prayerSheet.fewWords')} <span className="font-normal lowercase">({t('common.optional')})</span>
                </p>
                <textarea
                  rows={3}
                  value={testimony}
                  onChange={(e) => setTestimony(e.target.value)}
                  placeholder={t('prayerSheet.testimonyPlaceholder')}
                  className="mt-2 w-full resize-none rounded-input px-3 py-2.5 text-[15px] outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-7 w-full py-3 text-center text-[16px]"
            style={{ color: 'var(--danger)' }}
          >
            {t('prayerSheet.deletePrayer')}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>}

      {confirmShare && (
        <ConfirmDialog
          title={t('prayerSheet.confirmShareTitle', { group: groupName })}
          message={
            prayer?.visibility !== 'shared'
              ? t('prayerSheet.confirmShareMsgPrivate', { group: groupName })
              : t('prayerSheet.confirmShareMsg', { group: groupName })
          }
          confirmLabel={t('prayerSheet.share')}
          busy={busy}
          onConfirm={handleSave}
          onCancel={() => setConfirmShare(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t('prayerSheet.confirmDeleteTitle')}
          message={t('prayerSheet.confirmDeleteMsg')}
          confirmLabel={t('ajustes.eliminar')}
          danger
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  )
}
