import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
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
import { useMyTime } from '../hooks/useMyTime.js'
import { OPEN_WHATS_NEW_EVENT } from '../lib/whatsNew.js'
import BackLink from '../components/BackLink.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import InlineError from '../components/InlineError.jsx'
import DeveloperSection from './DeveloperSection.jsx'
import UserAvatar from '../components/UserAvatar.jsx'
import AvatarCropper from '../components/AvatarCropper.jsx'
import BookCover from '../components/BookCover.jsx'
import ThanksCard from '../components/ThanksCard.jsx'
import { activeMaterials, getMaterial } from '../lib/materials.js'
import { planName } from '../lib/planLabels.js'
import { avatarBlob, removeAvatarFile, uploadAvatar } from '../lib/avatar.js'
import { saveOrRevert } from '../lib/saveWithRevert.js'
import { BellIcon, BookIcon, ChevronRight, InfoIcon, InstallIcon, PencilIcon, ShareIcon, SunIcon } from '../components/icons.jsx'
import { subscribeToPush, unsubscribeFromPush, getTimezone, isPushSupported } from '../lib/push.js'
import { exportJournal } from '../lib/exportJournal.js'
import { flushQueue, pendingCount } from '../lib/offline.js'
import { APP_VERSION_LABEL } from '../lib/appVersion.js'

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

// Fila del índice de Ajustes: ícono en su baldosa, el nombre de la sección y,
// debajo, lo que hoy tenés elegido ahí (para saber sin entrar).
function IndexRow({ to, icon, title, summary }) {
  return (
    <Link to={to} className="flex min-h-[64px] items-center gap-3.5 px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: 'var(--accent-tint)', color: 'var(--accent-ink)' }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] text-ink">{title}</span>
        {summary && <span className="mt-0.5 block truncate text-[13px] text-ink-soft">{summary}</span>}
      </span>
      <span className="text-ink-soft" style={{ opacity: 0.5 }}>
        <ChevronRight size={18} />
      </span>
    </Link>
  )
}

// Las secciones de Ajustes, en el orden del índice.
const SECTIONS = ['lectura', 'manera', 'avisos', 'apariencia', 'app', 'cuenta']

// Sub-etiqueta dentro de una sección (p. ej. cada control de "Apariencia e idioma").
function SubLabel({ children }) {
  return <h3 className="mb-2 mt-4 px-1 text-[13px] font-medium text-ink-soft">{children}</h3>
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
  const { section } = useParams()

  const [plan, setPlan] = useState(null)
  const [shared, setShared] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  // Cerrar sesión: null | { pending } — cuántos marcados sin sincronizar se perderían.
  const [confirmSignOut, setConfirmSignOut] = useState(null)
  const [confirmBack, setConfirmBack] = useState(false)
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
  // Valores recién tocados que todavía esperan al servidor: el switch se mueve ya
  // (optimista) y vuelve solo si el guardado falla.
  const [pending, setPending] = useState({})
  const [failedKey, setFailedKey] = useState(null)
  const [dayError, setDayError] = useState(null) // null | 'save' | 'marks'
  // Foto de perfil: subiendo/quitando y si falló.
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const photoInput = useRef(null)
  const [cropFile, setCropFile] = useState(null) // la foto elegida, en la hoja de recorte

  // Recordatorio (best-effort) — refleja el perfil.
  const reminderOn = !!(pending.reminder_enabled ?? profile?.reminder_enabled)
  const reminderTime = profile?.reminder_time?.slice(0, 5) || '07:00'
  const reflectionsOn = !!(pending.reflections_enabled ?? profile?.reflections_enabled)
  const [myTime, setMyTime] = useMyTime(user?.id)
  const shareReadingOn = !!(pending.share_reading ?? profile?.share_reading)
  const prayerFollowupOn = (pending.prayer_followup_enabled ?? profile?.prayer_followup_enabled) !== false // default true

  // Guarda un ajuste con reversión: si falla, `revert` deshace el cambio local y
  // se marca la fila para mostrar el error. Optimista pero honesto (canon).
  async function persist(key, patch, revert) {
    setSavingKey(key)
    setFailedKey(null)
    setPending((p) => ({ ...p, ...patch }))
    const ok = await saveOrRevert(() => updateProfile(patch), revert)
    setPending((p) => {
      const n = { ...p }
      for (const k of Object.keys(patch)) delete n[k]
      return n
    })
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
  const groupNotifOn = pending.group_prayer_notifications_enabled ?? profile?.group_prayer_notifications_enabled ?? true
  // Con el switch en ON pero sin notificaciones en ESTE aparato, la fila lo dice
  // (el valor viene del perfil, no del aparato). `permTick` fuerza releer el permiso.
  const [permTick, setPermTick] = useState(0)
  function groupPushIssue() {
    void permTick
    if (!groupNotifOn) return null
    if (!isPushSupported()) return 'unsupported'
    if (Notification.permission === 'denied') return 'denied'
    if (Notification.permission === 'default') return 'default'
    return null
  }
  async function turnOnPushHere() {
    const res = await subscribeToPush(user.id)
    setPermTick((n) => n + 1)
    if (!res.ok) setPushNote({ target: 'group', msg: pushReasonMessage(res.reason, t), reason: res.reason })
  }

  async function toggleReminder() {
    const next = !reminderOn
    setPushNote(null)
    if (next) {
      // Activar = pedir permiso y suscribir. Si falla, NO encendemos el switch:
      // mostramos por qué en vez de mentir que está activo.
      setSavingKey('reminder')
      const res = await subscribeToPush(user.id)
      if (!res.ok) {
        setSavingKey(null)
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
      setSavingKey('group')
      const res = await subscribeToPush(user.id)
      if (!res.ok) {
        setSavingKey(null)
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

  // Foto de perfil: se recorta y achica acá mismo (≈20 KB) y se sube a tu
  // carpeta; el perfil guarda la URL. Quitarla vuelve a la inicial.
  function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setAvatarError(false)
    setCropFile(file)
  }
  // "Usar foto" en la hoja de recorte: el cuadrado elegido, achicado y subido.
  async function savePhoto(rect) {
    if (!cropFile || !user) return
    setAvatarBusy(true)
    setAvatarError(false)
    try {
      const blob = await avatarBlob(cropFile, rect)
      const url = await uploadAvatar(user.id, blob)
      const { error } = await updateProfile({ avatar_url: url })
      if (error) throw error
      setCropFile(null)
    } catch {
      setAvatarError(true)
      setCropFile(null)
    } finally {
      setAvatarBusy(false)
    }
  }
  async function removePhoto() {
    if (!user) return
    setAvatarBusy(true)
    setAvatarError(false)
    try {
      await removeAvatarFile(user.id)
      const { error } = await updateProfile({ avatar_url: null })
      if (error) throw error
    } catch {
      setAvatarError(true)
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleDelete() {
    setDeleteError(false)
    setDeleting(true)
    try {
      // La foto no queda huérfana en el almacenamiento.
      if (profile?.avatar_url) await removeAvatarFile(user.id).catch(() => {})
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
    if (pushNote?.target !== target) {
      const issue = target === 'group' ? groupPushIssue() : null
      if (!issue) return null
      return (
        <div role="status" className="mt-1 text-[13px] leading-snug text-ink-soft">
          <p>
            {issue === 'default'
              ? t('ajustes.push.notOnHere')
              : pushReasonMessage(issue, t)}
          </p>
          {issue === 'default' && (
            <button
              type="button"
              onClick={turnOnPushHere}
              className="mt-1 inline-flex min-h-11 items-center font-medium"
              style={{ color: 'var(--accent-ink)' }}
            >
              {t('ajustes.push.turnOn')}
            </button>
          )}
        </div>
      )
    }
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

  const fromAjustes = { to: '/ajustes/lectura', label: t('ajustes.section.lectura') }
  const shelf = activeMaterials(profile)

  // Resúmenes del índice: lo que hoy tenés elegido en cada sección.
  const themeLabel = THEMES.find((x) => x.key === themePref)?.label
  const localeLabel = locales.find((x) => x.key === locale)?.label
  const summaries = {
    lectura: [plan ? planName(t, plan) : t('ajustes.elegir'), shelf.length ? t('library.onShelf', { count: shelf.length }) : null].filter(Boolean).join(' · '),
    manera: [myTime.enabled ? t('myTime.title') : null, reflectionsOn ? t('ajustes.section.diario') : null].filter(Boolean).join(' · ') || t('ajustes.idx.mannerPlain'),
    avisos: reminderOn ? `${t('ajustes.section.recordatorio')} · ${reminderTime}` : t('ajustes.idx.reminderOff'),
    apariencia: [t(`accent.${accent}`), themeLabel, localeLabel].filter(Boolean).join(' · '),
    app: t('ajustes.idx.appSummary'),
  }
  const titles = {
    lectura: t('ajustes.section.lectura'),
    manera: t('myTime.section'),
    avisos: t('ajustes.section.avisos'),
    apariencia: t('ajustes.section.apariencia'),
    app: t('ajustes.section.laApp'),
    cuenta: t('ajustes.section.cuenta'),
  }
  const icons = {
    lectura: <BookIcon size={20} />,
    manera: <PencilIcon size={19} />,
    avisos: <BellIcon size={20} />,
    apariencia: <SunIcon size={20} />,
    app: <InfoIcon size={20} />,
  }

  if (section && !SECTIONS.includes(section)) return <Navigate to="/ajustes" replace />

  return (
    <div className="pt-2 lg:mx-auto lg:max-w-content">
      {/* Ajustes cuelga de Hoy (engranaje en su header). Es un índice: cada
          sección abre su propia pantalla, con "‹ Ajustes" para volver. */}
      {section ? (
        <>
          <BackLink to="/ajustes" label={t('nav.ajustes')} />
          <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{titles[section]}</h1>
        </>
      ) : (
        <>
          <BackLink to="/" label={t('nav.hoy')} />
          <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">{t('nav.ajustes')}</h1>
        </>
      )}

      {!section && (
        <>
          {/* Tu perfil, arriba: quién sos y la puerta a tu cuenta. */}
          <Link to="/ajustes/cuenta" className="card mt-5 flex items-center gap-3.5 px-4 py-3.5">
            <UserAvatar name={profile?.display_name || user?.email} url={profile?.avatar_url} size={48} tone="solid" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-semibold text-ink">{profile?.display_name || t('ajustes.tuNombre')}</span>
              <span className="block truncate text-[13px] text-ink-soft">{user?.email}</span>
            </span>
            <span className="text-ink-soft" style={{ opacity: 0.5 }}>
              <ChevronRight size={18} />
            </span>
          </Link>

          <div className="card mt-4 divide-y divide-hairline">
            {SECTIONS.filter((k) => k !== 'cuenta').map((k) => (
              <IndexRow key={k} to={`/ajustes/${k}`} icon={icons[k]} title={titles[k]} summary={summaries[k]} />
            ))}
          </div>

          {/* La invitación a donar, a la vista y agradecida (debajo de las secciones). */}
          <ThanksCard className="mt-6" />
        </>
      )}

      {section === 'lectura' && (
        <div>
      {/* Lectura bíblica: tu plan, grande, con su avance; cambiarlo a un toque. */}
      <SectionLabel>{t('ajustes.lectura.bible')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        {plan ? (
          <Link to={`/planes/${plan.id}`} state={{ from: fromAjustes }} className="block px-4 py-4">
            <span className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-[19px] font-semibold leading-snug text-ink">{planName(t, plan)}</span>
              <span className="shrink-0 text-ink-soft" style={{ opacity: 0.5 }}>
                <ChevronRight size={18} />
              </span>
            </span>
            {currentDay != null && duration != null && (
              <>
                <span className="mt-1 block text-[13px] tabular-nums text-ink-soft">
                  {t('lecturas.planMeta', { day: currentDay, total: duration, percent: Math.ceil(((currentDay - 1) / duration) * 100) })}
                </span>
                <span className="mt-2.5 block h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--hairline)' }}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(2, ((currentDay - 1) / duration) * 100)}%`, backgroundColor: 'var(--accent)' }}
                  />
                </span>
              </>
            )}
          </Link>
        ) : (
          <p className="px-4 py-4 text-[15px] text-ink-soft">{t('lecturas.noPlan')}</p>
        )}
        <Link
          to="/planes"
          state={{ from: fromAjustes }}
          className="flex min-h-11 items-center justify-between px-4 py-3 text-[16px] font-medium"
          style={{ color: 'var(--accent-ink)' }}
        >
          {plan ? t('lecturas.changePlan') : t('lecturas.choosePlan')}
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Lecturas adicionales: tus materiales como un estante de portadas, y la
          Biblioteca para sumar más. */}
      <SectionLabel>{t('ajustes.lectura.extras')}</SectionLabel>
      <div className="card overflow-hidden">
        {shelf.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto px-4 pb-3 pt-4" style={{ scrollbarWidth: 'none' }}>
            {shelf.map((m) => (
              <Link
                key={m.slug}
                to={`/materiales/${m.slug}`}
                state={{ from: fromAjustes }}
                className="w-[104px] shrink-0"
                aria-label={getMaterial(m.slug)?.name ?? m.slug}
              >
                <BookCover slug={m.slug} size="sm" style={{ width: 104 }} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-4 pb-1 pt-4 text-[15px] leading-snug text-ink-soft">{t('ajustes.lectura.extrasEmpty')}</p>
        )}
        <Link
          to="/materiales"
          state={{ from: fromAjustes }}
          className="flex min-h-11 items-center justify-between gap-3 border-t border-hairline px-4 py-3"
        >
          <span className="min-w-0">
            <span className="block text-[16px] font-medium" style={{ color: 'var(--accent-ink)' }}>
              {shelf.length > 0 ? t('ajustes.lectura.library') : t('ajustes.lectura.libraryEmpty')}
            </span>
            {shelf.length > 0 && <span className="block text-[13px] text-ink-soft">{t('library.onShelf', { count: shelf.length })}</span>}
          </span>
          <span style={{ color: 'var(--accent-ink)' }}>
            <ChevronRight size={18} />
          </span>
        </Link>
      </div>

      <SectionLabel>{t('ajustes.lectura.sharing')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <Row
          title={t('ajustes.compartirLectura')}
          subtitle={t('ajustes.compartirLecturaHelp')}
          error={errorFor('share')}
          control={
            <Switch
              on={shareReadingOn}
              onChange={toggleShareReading}
              label={t('ajustes.compartirLecturaLabel')}
              busy={savingKey === 'share'}
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
            {canUpdateDay && (
              <p className="mt-3 text-[13px] text-ink-soft">
                {targetDay < currentDay
                  ? t('ajustes.dayChangeBack', { day: targetDay })
                  : t('ajustes.dayChangeForward', { day: targetDay })}
              </p>
            )}
            <button
              type="button"
              onClick={() => (targetDay < currentDay ? setConfirmBack(true) : updatePlanDay())}
              disabled={!canUpdateDay || savingDay}
              className="btn btn-primary mt-3"
              style={{ opacity: !canUpdateDay || savingDay ? 0.5 : 1 }}
            >
              {savingDay ? '…' : t('ajustes.actualizar')}
            </button>
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

        </div>
      )}

      {section === 'manera' && (
        <div>
      <SectionLabel>{t('myTime.title')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <Row
          title={t('myTime.title')}
          subtitle={t('myTime.settingHelp')}
          control={<Switch on={myTime.enabled} onChange={() => setMyTime({ enabled: !myTime.enabled })} label={t('myTime.title')} />}
        />
        {myTime.enabled && (
          <>
            <Row
              title={t('myTime.includeNote')}
              subtitle={reflectionsOn ? t('myTime.includeNoteHelp') : t('myTime.includeNoteOff')}
              control={
                <Switch
                  on={myTime.note && reflectionsOn}
                  onChange={() => setMyTime({ note: !myTime.note })}
                  label={t('myTime.includeNote')}
                  disabled={!reflectionsOn}
                />
              }
            />
            <Row
              title={t('myTime.includePrayer')}
              subtitle={t('myTime.includePrayerHelp')}
              control={<Switch on={myTime.prayer} onChange={() => setMyTime({ prayer: !myTime.prayer })} label={t('myTime.includePrayer')} />}
            />
          </>
        )}
      </div>
      <p className="mt-2 px-1 text-[13px] leading-snug text-ink-soft">{t('myTime.settingNote')}</p>
      <SectionLabel>{t('ajustes.section.diario')}</SectionLabel>
      <div className="card divide-y divide-hairline">
        <Row
          title={t('ajustes.section.diario')}
          subtitle={t('ajustes.diarioHelp')}
          error={errorFor('diario')}
          control={
            <Switch
              on={reflectionsOn}
              onChange={() => persist('diario', { reflections_enabled: !reflectionsOn })}
              label={t('ajustes.section.diario')}
              busy={savingKey === 'diario'}
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
      </div>
        </div>
      )}

      {section === 'avisos' && (
        <div className="mt-5">
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
              busy={savingKey === 'reminder'}
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
              busy={savingKey === 'group'}
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
              busy={savingKey === 'followup'}
            />
          }
        />
      </div>

        </div>
      )}

      {section === 'apariencia' && (
        <div className="mt-1">
      <SubLabel>{t('ajustes.section.acento')}</SubLabel>
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
              aria-label={t(`accent.${a.key}`)}
              aria-pressed={selected}
              title={t(`accent.${a.key}`)}
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

      <SubLabel>{t('ajustes.section.tema')}</SubLabel>
      <Segmented label={t('ajustes.section.tema')} options={THEMES} value={themePref} onChange={pickTheme} />
      <InlineError message={errorFor('theme')} className="mt-2 px-1" />

      <SubLabel>{t('ajustes.idioma')}</SubLabel>
      <Segmented label={t('ajustes.idioma')} options={locales} value={locale} onChange={pickLocale} />
      <InlineError message={errorFor('locale')} className="mt-2 px-1" />

        </div>
      )}

      {section === 'app' && (
        <div className="mt-5">
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
        {/* Las novedades de la versión, para volver a verlas cuando quieras. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_WHATS_NEW_EVENT))}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] text-ink">{t('whatsNew.settingsRow')}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{t('whatsNew.settingsHelp')}</span>
          </span>
          <span className="text-ink-soft" style={{ opacity: 0.5 }}>
            <ChevronRight size={18} />
          </span>
        </button>
        {/* /ayuda es pública (vive fuera del Gate) pero antes no tenía ninguna
            puerta desde adentro de la app. */}
        <Link to="/ayuda" className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] text-ink">
              {t('ajustes.guiaApp')}
              {locale !== 'es' && t('ajustes.guideInSpanish')}
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">
              {t('ajustes.ayudaHelp')}
            </span>
          </span>
          <span className="text-ink-soft" style={{ opacity: 0.5 }}>
            <ChevronRight size={18} />
          </span>
        </Link>
      </div>

      {/* Quién hace la app: donar, sugerir, avisar un error. Vive en su propio
          componente (DeveloperSection) con sus dos hojas. */}
      <SectionLabel>{t('ajustes.section.dev')}</SectionLabel>
      <DeveloperSection />

        </div>
      )}

      {section === 'cuenta' && (
        <div className="mt-5">
      <div className="card divide-y divide-hairline">
        <div className="flex items-center gap-4 px-4 py-4">
          <UserAvatar name={profile?.display_name || user?.email} url={profile?.avatar_url} size={64} tone="solid" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold text-ink">{profile?.display_name || t('ajustes.tuNombre')}</p>
            <p className="truncate text-[13px] text-ink-soft">{user?.email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4">
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                disabled={avatarBusy}
                className="min-h-11 text-[15px] font-semibold"
                style={{ color: 'var(--accent-ink)', opacity: avatarBusy ? 0.5 : 1 }}
              >
                {avatarBusy ? t('ajustes.photo.saving') : profile?.avatar_url ? t('ajustes.photo.change') : t('ajustes.photo.add')}
              </button>
              {profile?.avatar_url && !avatarBusy && (
                <button type="button" onClick={removePhoto} className="min-h-11 text-[15px] font-medium text-ink-soft">
                  {t('ajustes.photo.remove')}
                </button>
              )}
            </div>
            <p className="text-[12px] leading-snug text-ink-soft">{t('ajustes.photo.help')}</p>
            <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={pickPhoto} aria-label={t('ajustes.photo.add')} />
            <InlineError message={avatarError ? t('ajustes.photo.error') : null} />
          </div>
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
      )}

      {!section && <p className="mt-8 text-center text-[13px] text-ink-soft">{t('ajustes.version', { version: APP_VERSION_LABEL })}</p>}

      {cropFile && (
        <AvatarCropper file={cropFile} busy={avatarBusy} onCancel={() => !avatarBusy && setCropFile(null)} onConfirm={savePhoto} />
      )}

      {confirmBack && (
        <ConfirmDialog
          danger
          title={t('ajustes.dayBackTitle', { day: targetDay })}
          message={`${t('ajustes.dayChangeBack', { day: targetDay })} ${t('ajustes.dayBackNoUndo')}`}
          confirmLabel={t('ajustes.dayBackConfirm', { day: targetDay })}
          onConfirm={() => {
            setConfirmBack(false)
            updatePlanDay()
          }}
          onCancel={() => setConfirmBack(false)}
        />
      )}

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
