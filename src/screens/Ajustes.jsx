import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { useAuth } from '../lib/auth.jsx'
import {
  getPlan,
  deleteAccount,
  dayNumberFor,
  startDateForDay,
  markDaysRead,
  unmarkDaysFrom,
} from '../lib/db.js'
import Segmented from '../components/Segmented.jsx'
import Switch from '../components/Switch.jsx'
import BackLink from '../components/BackLink.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { ChevronRight, HeartIcon, ShareIcon } from '../components/icons.jsx'
import { subscribeToPush, unsubscribeFromPush, getTimezone } from '../lib/push.js'
import { activeMaterials } from '../lib/materials.js'
import { exportJournal } from '../lib/exportJournal.js'
import { version as APP_VERSION } from '../../package.json'

// Ajustes (documento maestro §5.7, README pantalla 7). Acento y tema persisten en
// profiles (vía updateProfile) además de aplicarse en vivo. Recordatorio: mejor
// esfuerzo (sin prometer hora fija en iOS). Eliminar cuenta: borrado en cascada.

function SectionLabel({ children }) {
  return (
    <p className="mb-2 mt-7 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
      {children}
    </p>
  )
}

// Fila de lista agrupada (estilo iOS Settings): título + subtítulo explicativo
// dentro de la fila, control a la derecha. Reemplaza al patrón "una card por
// switch + ayuda suelta debajo" que apilaba cajas monótonas.
function Row({ title, subtitle, control }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] text-ink">{title}</p>
        {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{subtitle}</p>}
      </div>
      {control}
    </div>
  )
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// Mensaje honesto cuando no se pudo activar el push (subscribeToPush devuelve
// { ok:false, reason }). Así el switch no queda en ON mintiendo.
function pushReasonMessage(reason, t) {
  if (reason === 'denied') return t('ajustes.push.denied')
  if (reason === 'unsupported')
    return isIOS() && !isStandalone()
      ? t('ajustes.push.unsupportedIOS')
      : t('ajustes.push.unsupported')
  if (reason === 'no-key') return t('ajustes.push.noKey')
  return t('ajustes.push.generic')
}

export default function Ajustes() {
  const { accent, setAccent, accents, themePref, setTheme, resolvedMode, locale, setLocale, locales, t } = usePreferences()
  const { user, profile, updateProfile, signOut } = useAuth()

  const [plan, setPlan] = useState(null)
  const [shared, setShared] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [dayInput, setDayInput] = useState('')
  const [savingDay, setSavingDay] = useState(false)
  const [savedDay, setSavedDay] = useState(false)
  // Exportar el diario: busy + resultado ('empty' | 'error' | 'downloaded').
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState(null)
  // Aviso bajo el toggle que falló al activar el push: { target, msg }.
  const [pushNote, setPushNote] = useState(null)

  // Recordatorio (best-effort) — refleja el perfil.
  const reminderOn = !!profile?.reminder_enabled
  const reminderTime = profile?.reminder_time?.slice(0, 5) || '07:00'
  const reflectionsOn = !!profile?.reflections_enabled
  const shareReadingOn = !!profile?.share_reading
  const prayerFollowupOn = profile?.prayer_followup_enabled !== false // default true
  const materialsCount = activeMaterials(profile).length

  // Compartir lectura con grupos (Fase 3). Al activarlo, guardamos también la
  // timezone para que el "leyó hoy" del grupo se calcule en tu hora local.
  function toggleShareReading() {
    const next = !shareReadingOn
    const patch = { share_reading: next }
    if (next) {
      const tz = getTimezone()
      if (tz) patch.timezone = tz
    }
    updateProfile(patch)
  }

  useEffect(() => {
    if (!profile?.active_plan_id) {
      setPlan(null)
      return
    }
    getPlan(profile.active_plan_id)
      .then((p) => setPlan(p))
      .catch(() => setPlan(null))
  }, [profile?.active_plan_id])

  // Día actual del plan (según plan_start_date) y validación del día a fijar.
  const duration = plan?.duration_days ?? null
  const currentDay =
    plan && profile?.plan_start_date && duration
      ? Math.min(Math.max(dayNumberFor(profile.plan_start_date), 1), duration)
      : null
  const targetDay =
    dayInput && duration ? Math.max(1, Math.min(Number(dayInput), duration)) : null
  const canUpdateDay = targetDay != null && targetDay !== currentDay

  // Persistencia: aplica en vivo (hook) + guarda en profiles.
  function pickAccent(key) {
    setAccent(key)
    updateProfile({ accent_color: key })
  }
  function pickTheme(key) {
    setTheme(key)
    updateProfile({ theme_pref: key })
  }
  function pickLocale(key) {
    setLocale(key)
    updateProfile({ locale: key })
  }
  const THEMES = [
    { key: 'auto', label: t('ajustes.theme.auto') },
    { key: 'light', label: t('ajustes.theme.light') },
    { key: 'dark', label: t('ajustes.theme.dark') },
  ]

  // La subscripción Web Push es del dispositivo y la comparten el recordatorio y
  // los avisos de grupo. Solo la borramos cuando se apagan AMBAS features; así
  // apagar el recordatorio no mata los avisos de grupo (ni al revés).
  const groupNotifOn = profile?.group_prayer_notifications_enabled ?? true

  async function toggleReminder() {
    const next = !reminderOn
    setPushNote(null)
    if (next) {
      // Activar = pedir permiso y suscribir. Si falla, NO encendemos el switch:
      // mostramos por qué en vez de mentir que está activo.
      const res = await subscribeToPush(user.id)
      if (!res.ok) {
        setPushNote({ target: 'reminder', msg: pushReasonMessage(res.reason, t) })
        return
      }
      await updateProfile({ reminder_enabled: true, reminder_time: reminderTime + ':00' })
    } else {
      await updateProfile({ reminder_enabled: false, reminder_time: reminderTime + ':00' })
      if (!groupNotifOn) await unsubscribeFromPush(user.id)
    }
  }
  function changeTime(value) {
    updateProfile({ reminder_enabled: reminderOn, reminder_time: value + ':00' })
  }

  // Avisos de pedidos del grupo (opt-out; default true). Al activar, aseguramos la
  // subscripción a push para que lleguen aunque no use el recordatorio diario.
  async function toggleGroupNotif() {
    const next = !groupNotifOn
    setPushNote(null)
    if (next) {
      const res = await subscribeToPush(user.id)
      if (!res.ok) {
        setPushNote({ target: 'group', msg: pushReasonMessage(res.reason, t) })
        return
      }
      await updateProfile({ group_prayer_notifications_enabled: true })
    } else {
      await updateProfile({ group_prayer_notifications_enabled: false })
      if (!reminderOn) await unsubscribeFromPush(user.id)
    }
  }

  // Fijar el día actual del plan: mueve plan_start_date para que hoy sea ese día y
  // SINCRONIZA el progreso en ambos sentidos. "Voy en el día N" = días previos
  // leídos y día N en adelante sin leer. El backfill (markDaysRead) cubre adelantar;
  // la limpieza (unmarkDaysFrom) cubre volver atrás —sin ella, Hoy se quedaba en el
  // día viejo ya marcado (p. ej. ir del día 5 al 3 no movía Hoy).
  async function updatePlanDay() {
    if (!profile?.active_plan_id || targetDay == null || !user) return
    const planId = profile.active_plan_id
    setSavingDay(true)
    const { error } = await updateProfile({ plan_start_date: startDateForDay(targetDay) })
    if (!error) {
      try {
        if (targetDay > 1) await markDaysRead(user.id, planId, targetDay - 1)
        await unmarkDaysFrom(user.id, planId, targetDay)
      } catch {
        // No es bloqueante: el día ya quedó fijado.
      }
    }
    setSavingDay(false)
    if (!error) {
      setDayInput('')
      setSavedDay(true)
    }
  }

  // Exportar "Mi camino" como archivo de texto: las reflexiones son del
  // usuario y tienen que poder llevárselas (especialmente antes de borrar
  // la cuenta, o simplemente para atesorarlas fuera de la app).
  async function handleExportJournal() {
    if (exporting || !user) return
    setExporting(true)
    setExportNote(null)
    try {
      const res = await exportJournal(user.id, { t, locale })
      if (res === 'empty') setExportNote('empty')
      else if (res === 'downloaded') setExportNote('downloaded')
    } catch {
      setExportNote('error')
    } finally {
      setExporting(false)
    }
  }

  async function shareApp() {
    const url = window.location.origin
    const text = t('ajustes.shareInviteText')
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lee Tu Biblia', text, url })
      } catch {
        // El usuario canceló — no hacer nada.
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      } catch {
        window.prompt(t('ajustes.copyPrompt'), url)
      }
    }
  }

  async function handleDelete() {
    setDeleteError(false)
    setDeleting(true)
    try {
      await deleteAccount()
      await signOut()
      // El Gate vuelve a Bienvenida al quedar sin sesión.
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
      setDeleteError(true)
    }
  }

  const showReminderIOSNote = reminderOn && isIOS() && !isStandalone()

  return (
    <div className="pt-2">
      {/* Ajustes cuelga de Hoy (engranaje en su header) desde que Progreso tomó
          el 4º slot de la nav primaria. */}
      <BackLink to="/" label={t('nav.hoy')} />
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('nav.ajustes')}</h1>

      <SectionLabel>{t('ajustes.section.lectura')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <Link
          to="/planes"
          state={{ from: { to: '/ajustes', label: t('nav.ajustes') } }}
          className="flex items-center justify-between px-4 py-3"
        >
          <span className="shrink-0 text-[16px] text-ink">{t('ajustes.planDeLectura')}</span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] text-ink-soft">{plan?.name || t('ajustes.elegir')}</span>
            <span className="text-ink-soft" style={{ opacity: 0.5 }}>
              <ChevronRight size={18} />
            </span>
          </span>
        </Link>
        <Link
          to="/materiales"
          state={{ from: { to: '/ajustes', label: t('nav.ajustes') } }}
          className="flex items-center justify-between px-4 py-3"
        >
          <span className="text-[16px] text-ink">{t('ajustes.materialesDeLectura')}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-[15px] text-ink-soft">
              {materialsCount > 0 ? t('ajustes.materialsActive', { count: materialsCount }) : t('ajustes.ninguno')}
            </span>
            <span className="text-ink-soft" style={{ opacity: 0.5 }}>
              <ChevronRight size={18} />
            </span>
          </span>
        </Link>
        <Row
          title={t('ajustes.section.diario')}
          subtitle={t('ajustes.diarioHelp')}
          control={
            <Switch
              on={reflectionsOn}
              onChange={() => updateProfile({ reflections_enabled: !reflectionsOn })}
              label={t('ajustes.section.diario')}
            />
          }
        />
        <button
          type="button"
          onClick={handleExportJournal}
          disabled={exporting}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] text-ink">{t('ajustes.exportDiario')}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">
              {t('ajustes.exportDiarioHelp')}
            </span>
          </span>
          <span
            className="flex shrink-0 items-center text-[15px] font-medium"
            style={{ color: 'var(--accent-ink)', opacity: exporting ? 0.5 : 1 }}
          >
            {exporting ? t('ajustes.exporting') : <ShareIcon size={18} />}
          </span>
        </button>
        <Row
          title={t('ajustes.compartirLectura')}
          subtitle={t('ajustes.compartirLecturaHelp')}
          control={
            <Switch
              on={shareReadingOn}
              onChange={toggleShareReading}
              label={t('ajustes.compartirLecturaLabel')}
            />
          }
        />
      </div>
      {exportNote && (
        <p
          className="mt-2 px-1 text-[13px]"
          role="status"
          style={{ color: exportNote === 'error' ? 'var(--danger)' : 'var(--text-soft)' }}
        >
          {exportNote === 'empty'
            ? t('ajustes.exportEmpty')
            : exportNote === 'error'
              ? t('ajustes.exportError')
              : t('ajustes.exportDownloaded')}
        </p>
      )}

      {/* Fijar en qué día del plan vas (catch-up para quien ya venía leyendo). */}
      {currentDay != null && (
        <>
          <SectionLabel>{t('ajustes.section.queDia')}</SectionLabel>
          <div className="card p-4">
            <p className="text-[15px] text-ink-soft">
              {t('ajustes.currentDay')}: <span className="font-semibold text-ink">{currentDay}</span>{' '}
              {t('ajustes.ofTotal', { total: duration })}
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={dayInput}
              onChange={(e) => {
                setDayInput(e.target.value.replace(/[^\d]/g, ''))
                setSavedDay(false)
              }}
              placeholder={t('ajustes.dayPlaceholder', { day: currentDay })}
              className="mt-3 w-full rounded-input px-4 py-3 text-[16px] outline-none"
              style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-primary)' }}
            />
            <button
              type="button"
              onClick={updatePlanDay}
              disabled={!canUpdateDay || savingDay}
              className="btn btn-primary mt-3"
              style={{ opacity: !canUpdateDay || savingDay ? 0.5 : 1 }}
            >
              {savingDay ? '…' : t('ajustes.actualizar')}
            </button>
            {canUpdateDay && (
              <p className="mt-2 text-[13px] text-ink-soft">
                {targetDay < currentDay
                  ? t('ajustes.dayChangeBack', { day: targetDay })
                  : t('ajustes.dayChangeForward', { day: targetDay })}
              </p>
            )}
            {savedDay && !dayInput && (
              <p className="mt-2 text-[13px]" style={{ color: 'var(--accent-ink)' }}>
                ✓ {t('ajustes.daySaved', { day: currentDay })}
              </p>
            )}
          </div>
        </>
      )}

      <SectionLabel>{t('ajustes.section.acento')}</SectionLabel>
      {/* Swatch chico (28px) centrado en un área táctil de 44px: neto como en
          iOS, no círculos enormes que llenan la celda. */}
      <div className="card grid grid-cols-6 gap-1 p-3">
        {accents.map((a) => {
          const selected = a.key === accent
          const swatch = resolvedMode === 'dark' ? a.dark : a.light
          return (
            <button
              key={a.key}
              type="button"
              aria-label={a.name}
              title={a.name}
              onClick={() => pickAccent(a.key)}
              className="flex h-11 items-center justify-center"
            >
              <span
                className="block h-7 w-7 rounded-full transition-transform duration-200"
                style={{
                  backgroundColor: swatch,
                  boxShadow: selected
                    ? '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)'
                    : 'none',
                }}
              />
            </button>
          )
        })}
      </div>

      <SectionLabel>{t('ajustes.section.tema')}</SectionLabel>
      <Segmented options={THEMES} value={themePref} onChange={pickTheme} />

      <SectionLabel>{t('ajustes.idioma')}</SectionLabel>
      <Segmented options={locales} value={locale} onChange={pickLocale} />

      <SectionLabel>{t('ajustes.section.avisos')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <Row
          title={t('ajustes.section.recordatorio')}
          subtitle={showReminderIOSNote ? t('ajustes.reminderIOSNote') : t('ajustes.reminderHelp')}
          control={
            <Switch on={reminderOn} onChange={toggleReminder} label={t('ajustes.section.recordatorio')} />
          }
        />
        {reminderOn && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[16px] text-ink">{t('ajustes.hora')}</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => changeTime(e.target.value)}
              className="rounded-input px-2 py-1 text-[16px] outline-none"
              style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-primary)' }}
            />
          </div>
        )}
        <Row
          title={t('ajustes.pedidosNuevos')}
          subtitle={t('ajustes.avisosGrupoHelp')}
          control={
            <Switch
              on={groupNotifOn}
              onChange={toggleGroupNotif}
              label={t('ajustes.avisosGrupoLabel')}
            />
          }
        />
        <Row
          title={t('ajustes.recordarRevisar')}
          subtitle={t('ajustes.seguimientoHelp')}
          control={
            <Switch
              on={prayerFollowupOn}
              onChange={() => updateProfile({ prayer_followup_enabled: !prayerFollowupOn })}
              label={t('ajustes.recordarRevisarLabel')}
            />
          }
        />
      </div>
      {pushNote && (
        <p className="mt-2 px-1 text-[12px] text-ink-soft">{pushNote.msg}</p>
      )}

      <SectionLabel>{t('ajustes.section.laApp')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <button
          type="button"
          onClick={shareApp}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] text-ink">{t('ajustes.compartirApp')}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">
              {t('ajustes.compartirHelp')}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-[15px] font-medium" style={{ color: 'var(--accent-ink)' }}>
            {shared ? t('ajustes.copiado') : <ShareIcon size={18} />}
          </span>
        </button>
        {/* /guia es pública (vive fuera del Gate) pero antes no tenía ninguna
            puerta desde adentro de la app. */}
        <Link to="/guia" className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] text-ink">{t('ajustes.guiaApp')}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">
              {t('ajustes.ayudaHelp')}
            </span>
          </span>
          <span className="text-ink-soft" style={{ opacity: 0.5 }}>
            <ChevronRight size={18} />
          </span>
        </Link>
      </div>

      <SectionLabel>{t('ajustes.section.mision')}</SectionLabel>
      <div
        className="card p-4"
        style={{ backgroundColor: 'var(--accent-tint)', border: '1px solid var(--accent)' }}
      >
        <div className="flex items-start gap-2.5">
          <span className="shrink-0 pt-0.5" style={{ color: 'var(--accent-ink)' }}>
            <HeartIcon size={20} />
          </span>
          <div>
            <p className="text-[15px] text-ink">
              {t('ajustes.misionText')}
            </p>
            <a
              href="https://dentonbible.org/missions/view-detail/smallgroup/oriolo-enrique-and-tamara/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium"
              style={{ color: 'var(--accent-ink)' }}
            >
              {t('ajustes.misionLink')} ↗
            </a>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[
            { label: t('ajustes.donarPaypal'), url: 'https://www.paypal.com/paypalme/EnriqueOriolo' },
            {
              label: t('ajustes.donarMPunica'),
              url: 'https://link.mercadopago.com.ar/enriqueoriolo',
            },
            { label: t('ajustes.donarMPmensual'), url: 'https://mpago.la/1EEJDnZ' },
          ].map((d) => (
            <a
              key={d.url}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-card px-4 py-3"
              style={{ backgroundColor: 'var(--surface)' }}
            >
              <span className="text-[15px] font-medium text-ink">{d.label}</span>
              <span className="text-[15px]" style={{ color: 'var(--accent-ink)' }} aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      </div>

      <SectionLabel>{t('ajustes.section.cuenta')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <div className="px-4 py-3">
          <p className="text-[16px] text-ink">{profile?.display_name || t('ajustes.tuNombre')}</p>
          <p className="text-[13px] text-ink-soft">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="w-full px-4 py-3 text-left text-[16px] text-ink"
        >
          {t('ajustes.cerrarSesion')}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
          className="w-full px-4 py-3 text-left text-[16px]"
          style={{ color: 'var(--danger)' }}
        >
          {deleting ? t('ajustes.eliminando') : t('ajustes.eliminarCuenta')}
        </button>
      </div>
      {deleteError && (
        <p className="mt-2 px-1 text-[13px]" style={{ color: 'var(--danger)' }}>
          {t('ajustes.deleteError')}
        </p>
      )}

      <p className="mt-8 text-center text-[13px] text-ink-soft">{t('ajustes.version', { version: APP_VERSION })}</p>

      {confirmDelete && (
        <ConfirmDialog
          title={t('ajustes.deleteTitle')}
          message={t('ajustes.deleteMessage')}
          confirmLabel={t('ajustes.eliminar')}
          danger
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
