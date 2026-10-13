import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { useAuth } from '../lib/auth.jsx'
import { useInstallPrompt } from '../hooks/useInstallPrompt.js'
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
import InlineError from '../components/InlineError.jsx'
import { saveOrRevert } from '../lib/saveWithRevert.js'
import { ChevronRight, HeartIcon, InstallIcon, ShareIcon } from '../components/icons.jsx'
import { subscribeToPush, unsubscribeFromPush, getTimezone } from '../lib/push.js'
import { activeMaterials } from '../lib/materials.js'
import { exportJournal } from '../lib/exportJournal.js'
import { flushQueue, pendingCount } from '../lib/offline.js'
import { version as APP_VERSION } from '../../package.json'

// Ajustes (documento maestro §5.7, README pantalla 7). Acento y tema persisten en
// profiles (vía updateProfile) además de aplicarse en vivo. Recordatorio: mejor
// esfuerzo (sin prometer hora fija en iOS). Eliminar cuenta: borrado en cascada.

function SectionLabel({ children }) {
  return (
    <h2 className="mb-2 mt-7 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
      {children}
    </h2>
  )
}

// Fila de lista agrupada (estilo iOS Settings): título + subtítulo explicativo
// dentro de la fila, control a la derecha. Reemplaza al patrón "una card por
// switch + ayuda suelta debajo" que apilaba cajas monótonas.
// `error` y `note` viven en la propia fila: el resultado aparece donde ocurrió el
// toque, no al pie de la tarjeta.
function Row({ title, subtitle, control, error, note }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] text-ink">{title}</p>
        {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{subtitle}</p>}
        {note}
        <InlineError message={error} />
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
  const {
    accent, setAccent, accents, themePref, setTheme, resolvedMode, locale, setLocale, locales,
    bibleProvider, setBibleProvider, bibleProviders, t,
  } = usePreferences()
  const { user, profile, updateProfile, signOut } = useAuth()
  const { canInstall, promptInstall } = useInstallPrompt()

  const [plan, setPlan] = useState(null)
  const [shared, setShared] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  // Cerrar sesión: null | { pending } — cuántos marcados sin sincronizar se perderían.
  const [confirmSignOut, setConfirmSignOut] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const [dayInput, setDayInput] = useState('')
  const [savingDay, setSavingDay] = useState(false)
  const [savedDay, setSavedDay] = useState(false)
  // Exportar el diario: busy + resultado ('empty' | 'error' | 'downloaded').
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState(null)
  // Aviso bajo el toggle que falló al activar el push: { target, msg }.
  const [pushNote, setPushNote] = useState(null)
  // Guardado de un ajuste: cuál está guardando y cuál falló (para mostrar el error
  // en su fila y deshabilitar solo ese control).
  const [savingKey, setSavingKey] = useState(null)
  const [failedKey, setFailedKey] = useState(null)
  const [dayError, setDayError] = useState(null) // null | 'save' | 'marks'

  // Recordatorio (best-effort) — refleja el perfil.
  const reminderOn = !!profile?.reminder_enabled
  const reminderTime = profile?.reminder_time?.slice(0, 5) || '07:00'
  const reflectionsOn = !!profile?.reflections_enabled
  const shareReadingOn = !!profile?.share_reading
  const prayerFollowupOn = profile?.prayer_followup_enabled !== false // default true
  const materialsCount = activeMaterials(profile).length

  // Guarda un ajuste con reversión: si falla, `revert` deshace el cambio local y
  // se marca la fila para mostrar el error. Optimista pero honesto (canon).
  async function persist(key, patch, revert) {
    setSavingKey(key)
    setFailedKey(null)
    const ok = await saveOrRevert(() => updateProfile(patch), revert)
    setSavingKey(null)
    if (!ok) setFailedKey(key)
    return ok
  }
  const errorFor = (key) => (failedKey === key ? t('common.saveError') : null)

  // Compartir lectura con grupos (Fase 3). Al activarlo, guardamos también la
  // timezone para que el "leyó hoy" del grupo se calcule en tu hora local.
  function toggleShareReading() {
    const next = !shareReadingOn
    const patch = { share_reading: next }
    if (next) {
      const tz = getTimezone()
      if (tz) patch.timezone = tz
    }
    persist('share', patch)
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
  // Si el guardado falla se vuelve al valor anterior: si no, ProfilePrefSync lo
  // revertiría en silencio en la próxima carga del perfil.
  function pickAccent(key) {
    const prev = accent
    setAccent(key)
    persist('accent', { accent_color: key }, () => setAccent(prev))
  }
  function pickTheme(key) {
    const prev = themePref
    setTheme(key)
    persist('theme', { theme_pref: key }, () => setTheme(prev))
  }
  function pickLocale(key) {
    const prev = locale
    setLocale(key)
    persist('locale', { locale: key }, () => setLocale(prev))
  }
  function pickBibleProvider(key) {
    const prev = bibleProvider
    setBibleProvider(key)
    persist('provider', { bible_provider: key }, () => setBibleProvider(prev))
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
        setPushNote({ target: 'reminder', msg: pushReasonMessage(res.reason, t), reason: res.reason })
        return
      }
      await persist('reminder', { reminder_enabled: true, reminder_time: reminderTime + ':00' })
    } else {
      const ok = await persist('reminder', { reminder_enabled: false, reminder_time: reminderTime + ':00' })
      // Solo se borra la suscripción si el apagado quedó guardado.
      if (ok && !groupNotifOn) await unsubscribeFromPush(user.id)
    }
  }
  function changeTime(value) {
    persist('time', { reminder_enabled: reminderOn, reminder_time: value + ':00' })
  }

  // Avisos de pedidos del grupo (opt-out; default true). Al activar, aseguramos la
  // subscripción a push para que lleguen aunque no use el recordatorio diario.
  async function toggleGroupNotif() {
    const next = !groupNotifOn
    setPushNote(null)
    if (next) {
      const res = await subscribeToPush(user.id)
      if (!res.ok) {
        setPushNote({ target: 'group', msg: pushReasonMessage(res.reason, t), reason: res.reason })
        return
      }
      await persist('group', { group_prayer_notifications_enabled: true })
    } else {
      const ok = await persist('group', { group_prayer_notifications_enabled: false })
      if (ok && !reminderOn) await unsubscribeFromPush(user.id)
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
    setDayError(null)
    const { error } = await updateProfile({ plan_start_date: startDateForDay(targetDay) })
    let marksFailed = false
    if (!error) {
      try {
        if (targetDay > 1) await markDaysRead(user.id, planId, targetDay - 1)
        await unmarkDaysFrom(user.id, planId, targetDay)
      } catch {
        // El día quedó fijado pero las marcas no: se avisa en vez de dejar un
        // atraso falso sin explicación.
        marksFailed = true
      }
    }
    setSavingDay(false)
    if (error || marksFailed) {
      setDayError(error ? 'save' : 'marks')
      return
    }
    setDayInput('')
    setSavedDay(true)
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

  async function handleInstall() {
    if (installing || !canInstall) return
    setInstalling(true)
    await promptInstall()
    setInstalling(false)
  }

  // Cerrar sesión borra la caché offline y la cola de marcados: antes de pedir la
  // confirmación se intenta sincronizar, y si queda algo se avisa cuánto se pierde.
  async function askSignOut() {
    if (!user) return
    await flushQueue(user.id).catch(() => {})
    setConfirmSignOut({ pending: pendingCount(user.id) })
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
      setConfirmSignOut(null)
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

  // Aviso de por qué no se pudo activar el push, en la fila que lo pidió. En iOS
  // sin instalar, además, los pasos para agregar la app a la pantalla de inicio.
  function pushNoteFor(target) {
    if (pushNote?.target !== target) return null
    const needsInstall = pushNote.reason === 'unsupported' && isIOS() && !isStandalone()
    return (
      <div role="status" className="mt-1 text-[13px] leading-snug text-ink-soft">
        <p>{pushNote.msg}</p>
        {needsInstall && (
          <ol className="mt-1 list-decimal pl-5">
            <li>{t('onboarding.extras.step1')}</li>
            <li>{t('onboarding.extras.step2')}</li>
          </ol>
        )}
      </div>
    )
  }

  return (
    <div className="pt-2">
      {/* Ajustes cuelga de Hoy (engranaje en su header) desde que Progreso tomó
          el 4º slot de la nav primaria. */}
      <BackLink to="/" label={t('nav.hoy')} />
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('nav.ajustes')}</h1>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
      <div>
      <SectionLabel>{t('ajustes.section.lectura')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <Link
          to="/planes"
          state={{ from: { to: '/ajustes', label: t('nav.ajustes') } }}
          className="flex flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="shrink-0 text-[16px] text-ink">{t('ajustes.planDeLectura')}</span>
          <span className="flex w-full min-w-0 items-center justify-between gap-1.5 sm:w-auto sm:justify-start">
            <span className="truncate text-[15px] text-ink-soft">{plan?.name || t('ajustes.elegir')}</span>
            <span className="text-ink-soft" style={{ opacity: 0.5 }}>
              <ChevronRight size={18} />
            </span>
          </span>
        </Link>
        <Link
          to="/materiales"
          state={{ from: { to: '/ajustes', label: t('nav.ajustes') } }}
          className="flex flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-[16px] text-ink">{t('ajustes.materialesDeLectura')}</span>
          <span className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-start">
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
          error={errorFor('diario')}
          control={
            <Switch
              on={reflectionsOn}
              onChange={() => persist('diario', { reflections_enabled: !reflectionsOn })}
              label={t('ajustes.section.diario')}
              disabled={savingKey === 'diario'}
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
        {exportNote && (
          <p
            className="px-4 pb-3 text-[13px]"
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
        <Row
          title={t('ajustes.compartirLectura')}
          subtitle={t('ajustes.compartirLecturaHelp')}
          error={errorFor('share')}
          control={
            <Switch
              on={shareReadingOn}
              onChange={toggleShareReading}
              label={t('ajustes.compartirLecturaLabel')}
              disabled={savingKey === 'share'}
            />
          }
        />
      </div>
      {/* Fijar en qué día del plan vas (catch-up para quien ya venía leyendo). */}
      {currentDay != null && (
        <>
          <SectionLabel>{t('ajustes.section.queDia')}</SectionLabel>
          <div className="card p-4">
            <p className="text-[15px] text-ink-soft">
              {t('ajustes.currentDay')}: <span className="font-semibold text-ink">{currentDay}</span>{' '}
              {t('ajustes.ofTotal', { total: duration })}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-ink-soft">
              {t('ajustes.dayPositionHelp')}
            </p>
            <label htmlFor="plan-day" className="sr-only">{t('ajustes.section.queDia')}</label>
            <input
              id="plan-day"
              type="text"
              inputMode="numeric"
              value={dayInput}
              onChange={(e) => {
                setDayInput(e.target.value.replace(/[^\d]/g, ''))
                setSavedDay(false)
              }}
              placeholder={t('ajustes.dayPlaceholder', { day: currentDay })}
              className="mt-3 w-full rounded-input px-4 py-3 text-[16px] outline-none"
              style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--control-border)', color: 'var(--text-primary)' }}
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
            {dayError && (
              <InlineError
                message={dayError === 'save' ? t('common.saveError') : t('ajustes.dayMarkError')}
                className="mt-2"
              />
            )}
            {savedDay && !dayInput && (
              <p className="mt-2 text-[13px]" style={{ color: 'var(--accent-ink)' }}>
                ✓ {t('ajustes.daySaved', { day: currentDay })}
              </p>
            )}
          </div>
        </>
      )}
      </div>

      <div>

      <SectionLabel>{t('ajustes.section.acento')}</SectionLabel>
      {/* Swatch chico (28px) centrado en un área táctil de 44px: neto como en
          iOS, no círculos enormes que llenan la celda. */}
      <div className="card grid grid-cols-4 gap-1 p-3 sm:grid-cols-8">
        {accents.map((a) => {
          const selected = a.key === accent
          const swatch = resolvedMode === 'dark' ? a.dark : a.light
          return (
            <button
              key={a.key}
              type="button"
              aria-label={a.name}
              aria-pressed={selected}
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

      <InlineError message={errorFor('accent')} className="mt-2 px-1" />

      <SectionLabel>{t('ajustes.section.tema')}</SectionLabel>
      <Segmented label={t('ajustes.section.tema')} options={THEMES} value={themePref} onChange={pickTheme} />
      <InlineError message={errorFor('theme')} className="mt-2 px-1" />

      <SectionLabel>{t('ajustes.idioma')}</SectionLabel>
      <Segmented label={t('ajustes.idioma')} options={locales} value={locale} onChange={pickLocale} />
      <InlineError message={errorFor('locale')} className="mt-2 px-1" />

      <SectionLabel>{t('ajustes.proveedorBiblia')}</SectionLabel>
      <Segmented
        label={t('ajustes.proveedorBiblia')}
        options={bibleProviders}
        value={bibleProvider}
        onChange={pickBibleProvider}
      />
      <InlineError message={errorFor('provider')} className="mt-2 px-1" />
      <p className="mt-2 px-1 text-[13px] leading-snug text-ink-soft">
        {t('ajustes.proveedorBibliaHelp')}
      </p>

      <SectionLabel>{t('ajustes.section.avisos')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <Row
          title={t('ajustes.section.recordatorio')}
          subtitle={showReminderIOSNote ? t('ajustes.reminderIOSNote') : t('ajustes.reminderHelp')}
          note={pushNoteFor('reminder')}
          error={errorFor('reminder')}
          control={
            <Switch
              on={reminderOn}
              onChange={toggleReminder}
              label={t('ajustes.section.recordatorio')}
              disabled={savingKey === 'reminder'}
            />
          }
        />
        {reminderOn && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[16px] text-ink">{t('ajustes.hora')}</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => changeTime(e.target.value)}
                disabled={savingKey === 'time'}
                aria-label={t('ajustes.hora')}
                className="min-h-11 rounded-input px-3 text-[16px] outline-none"
                style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--control-border)', color: 'var(--text-primary)' }}
              />
            </div>
            <InlineError message={errorFor('time')} />
          </div>
        )}
        <Row
          title={t('ajustes.pedidosNuevos')}
          subtitle={t('ajustes.avisosGrupoHelp')}
          note={pushNoteFor('group')}
          error={errorFor('group')}
          control={
            <Switch
              on={groupNotifOn}
              onChange={toggleGroupNotif}
              label={t('ajustes.avisosGrupoLabel')}
              disabled={savingKey === 'group'}
            />
          }
        />
        <Row
          title={t('ajustes.recordarRevisar')}
          subtitle={t('ajustes.seguimientoHelp')}
          error={errorFor('followup')}
          control={
            <Switch
              on={prayerFollowupOn}
              onChange={() => persist('followup', { prayer_followup_enabled: !prayerFollowupOn })}
              label={t('ajustes.recordarRevisarLabel')}
              disabled={savingKey === 'followup'}
            />
          }
        />
      </div>

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
        {canInstall && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            aria-busy={installing}
            className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] text-ink">{t('ajustes.installApp')}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">
                {t('ajustes.installHelp')}
              </span>
            </span>
            <span
              className="flex shrink-0 items-center text-[15px] font-medium"
              style={{ color: 'var(--accent-ink)', opacity: installing ? 0.5 : 1 }}
            >
              {installing ? t('ajustes.installing') : <InstallIcon size={18} />}
            </span>
          </button>
        )}
        {/* /ayuda es pública (vive fuera del Gate) pero antes no tenía ninguna
            puerta desde adentro de la app. */}
        <Link to="/ayuda" className="flex items-center justify-between gap-4 px-4 py-3">
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

      <details className="card mt-7 overflow-hidden">
        <summary className="flex min-h-12 cursor-pointer items-center gap-2.5 px-4 py-3 text-[16px] font-medium text-ink">
          <HeartIcon size={20} /> {t('ajustes.section.mision')}
        </summary>
      <div className="border-t border-hairline p-4">
        <div className="flex items-start gap-2.5">
          <span className="shrink-0 pt-0.5 text-ink-soft">
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
              style={{ backgroundColor: 'var(--surface-alt)' }}
            >
              <span className="text-[15px] font-medium text-ink">{d.label}</span>
              <span className="text-[15px]" style={{ color: 'var(--accent-ink)' }} aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      </div>
      </details>

      <SectionLabel>{t('ajustes.section.cuenta')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <div className="px-4 py-3">
          <p className="text-[16px] text-ink">{profile?.display_name || t('ajustes.tuNombre')}</p>
          <p className="text-[13px] text-ink-soft">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={askSignOut}
          className="min-h-11 w-full px-4 py-3 text-left text-[16px] text-ink"
        >
          {t('ajustes.cerrarSesion')}
        </button>
      </div>
      {/* Eliminar la cuenta va aparte: es irreversible y no debe quedar a un toque
          de distancia de "Cerrar sesión". */}
      <div className="card mt-4">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
          className="min-h-11 w-full px-4 py-3 text-left text-[16px]"
          style={{ color: 'var(--danger)' }}
        >
          {deleting ? t('ajustes.eliminando') : t('ajustes.eliminarCuenta')}
        </button>
      </div>
      {deleteError && (
        <p className="mt-2 px-1 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>
          {t('ajustes.deleteError')}
        </p>
      )}
      </div>
      </div>

      <p className="mt-8 text-center text-[13px] text-ink-soft">{t('ajustes.version', { version: APP_VERSION })}</p>

      {confirmSignOut && (
        <ConfirmDialog
          title={t('ajustes.signOutTitle')}
          message={
            confirmSignOut.pending > 0
              ? t('ajustes.signOutPending', { count: confirmSignOut.pending })
              : t('ajustes.signOutConfirm')
          }
          confirmLabel={t('ajustes.cerrarSesion')}
          danger={confirmSignOut.pending > 0}
          busy={signingOut}
          onConfirm={handleSignOut}
          onCancel={() => setConfirmSignOut(null)}
        />
      )}

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
