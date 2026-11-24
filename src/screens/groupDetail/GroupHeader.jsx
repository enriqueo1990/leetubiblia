import { useState } from 'react'
import { PencilIcon, ShareIcon } from '../../components/icons.jsx'
import { usePreferences } from '../../lib/preferences.jsx'
import InlineError from '../../components/InlineError.jsx'
import Sheet from '../../components/Sheet.jsx'
import MeetingPicker from '../../components/MeetingPicker.jsx'
import { meetingChoice, meetingFromGroup, meetingPhrase } from '../../lib/meeting.js'
import { inputStyleOnCard } from '../../components/formStyles.js'
import { setGroupMeeting } from '../../lib/db.js'

// Hoja del administrador para cambiar cada cuánto se junta el grupo.
function MeetingSheet({ group, onClose, onSaved }) {
  const { t } = usePreferences()
  const initial = meetingFromGroup(group)
  const [meeting, setMeeting] = useState(initial)
  // Si lo guardado no es una opción común, abre directo en «Otra frecuencia».
  const [custom, setCustom] = useState(meetingChoice(initial, false) === 'custom')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const changed = meeting?.every !== initial?.every || meeting?.unit !== initial?.unit

  async function save() {
    if (busy) return
    if (!changed) return onClose()
    setBusy(true)
    setError(null)
    try {
      await setGroupMeeting(group.id, meeting)
      onSaved(meeting)
    } catch {
      setError(t('common.saveError'))
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={t('meeting.sheetTitle')}
      onCancel={onClose}
      dirty={changed}
      footer={
        <button type="button" className="btn btn-primary" disabled={busy} aria-busy={busy} onClick={save}>
          {busy ? '…' : t('common.save')}
        </button>
      }
    >
      <MeetingPicker value={meeting} onChange={setMeeting} custom={custom} setCustom={setCustom} showLabel={false} />
      <InlineError message={error} className="mt-3" />
    </Sheet>
  )
}

// Nombre del grupo (+ editar, owner), acción primaria de invitar en el header
// (mismo patrón que Grupos/Oración) y la línea de metadata de miembros.
export default function GroupHeader({
  group,
  isOwner,
  membersCount,
  editingName,
  nameInput,
  setNameInput,
  nameError,
  savingName,
  onStartEdit,
  onSaveName,
  onCancelEdit,
  onInvite,
  onMeetingSaved,
}) {
  const { t } = usePreferences()
  const [meetingOpen, setMeetingOpen] = useState(false)
  const meeting = meetingFromGroup(group)
  const phrase = meetingPhrase(t, meeting)

  return (
    <>
      {editingName ? (
        <div className="mt-3">
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            aria-label={t('grupos.nameLabel')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveName()
              if (e.key === 'Escape') onCancelEdit()
            }}
            className="w-full rounded-input px-4 py-3 text-[1.125rem] font-bold outline-none"
            style={inputStyleOnCard}
            maxLength={60}
          />
          <InlineError message={nameError} />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onSaveName}
              disabled={savingName || !nameInput.trim()}
              aria-busy={savingName}
              className="btn btn-primary"
            >
              {savingName ? '…' : t('common.save')}
            </button>
            <button type="button" onClick={onCancelEdit} className="btn btn-secondary">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[1.625rem] font-bold tracking-tight text-ink">{group.name}</h1>
            {isOwner && (
              <button
                type="button"
                aria-label={t('groupDetail.editNameAria')}
                onClick={onStartEdit}
                className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink-soft"
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
            onClick={onInvite}
            className="flex h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-on-accent lg:px-4"
            style={{ backgroundColor: 'var(--accent-action)', minWidth: 44 }}
          >
            <ShareIcon size={18} />
            <span className="hidden text-[0.9375rem] font-semibold lg:inline">{t('groupDetail.invite')}</span>
          </button>
        </div>
      )}

      <p className="mt-2 text-[0.875rem] text-ink-soft">
        {membersCount === 1
          ? t('groupDetail.onlyYou')
          : `${t('groupDetail.walkingTogether', { count: membersCount })}${isOwner ? t('groupDetail.adminSuffix') : ''}`}
      </p>

      {/* Cada cuánto se juntan: lo ven todos; solo el administrador lo cambia.
          Sin definir, solo el administrador ve la invitación a elegirlo. */}
      {isOwner ? (
        <button
          type="button"
          onClick={() => setMeetingOpen(true)}
          className={`-my-2 flex min-h-11 items-center gap-1.5 text-left text-[0.875rem] ${phrase ? 'text-ink-soft' : 'font-semibold text-accent-ink'}`}
        >
          {phrase ? t('meeting.meets', { when: phrase }) : t('meeting.pick')}
          {phrase && <PencilIcon size={14} style={{ opacity: 0.5 }} aria-hidden="true" />}
          {phrase && <span className="sr-only">{t('meeting.editAria')}</span>}
        </button>
      ) : (
        phrase && <p className="mt-1 text-[0.875rem] text-ink-soft">{t('meeting.meets', { when: phrase })}</p>
      )}

      {meetingOpen && (
        <MeetingSheet
          group={group}
          onClose={() => setMeetingOpen(false)}
          onSaved={(m) => {
            setMeetingOpen(false)
            onMeetingSaved?.(m)
          }}
        />
      )}
    </>
  )
}
