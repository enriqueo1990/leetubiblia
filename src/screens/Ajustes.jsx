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
} from '../lib/db.js'
import Segmented from '../components/Segmented.jsx'
import Switch from '../components/Switch.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { ChevronRight, HeartIcon } from '../components/icons.jsx'
import { subscribeToPush, unsubscribeFromPush } from '../lib/push.js'
import { version as APP_VERSION } from '../../package.json'

// Ajustes (documento maestro §5.7, README pantalla 7). Acento y tema persisten en
// profiles (vía updateProfile) además de aplicarse en vivo. Recordatorio: mejor
// esfuerzo (sin prometer hora fija en iOS). Eliminar cuenta: borrado en cascada.
const THEMES = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
]

function SectionLabel({ children }) {
  return (
    <p className="mb-2 mt-7 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
      {children}
    </p>
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

export default function Ajustes() {
  const { accent, setAccent, accents, themePref, setTheme, resolvedMode } = usePreferences()
  const { user, profile, updateProfile, signOut } = useAuth()

  const [plan, setPlan] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [dayInput, setDayInput] = useState('')
  const [savingDay, setSavingDay] = useState(false)
  const [savedDay, setSavedDay] = useState(false)

  // Recordatorio (best-effort) — refleja el perfil.
  const reminderOn = !!profile?.reminder_enabled
  const reminderTime = profile?.reminder_time?.slice(0, 5) || '07:00'

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

  async function toggleReminder() {
    const next = !reminderOn
    // Activar = pedir permiso y suscribir este dispositivo a Web Push; desactivar
    // = quitar la subscription. Guardamos la intención igual aunque el push falle
    // (p. ej. iOS sin instalar): el aviso de abajo guía al usuario.
    if (next) {
      await subscribeToPush(user.id)
    } else {
      await unsubscribeFromPush(user.id)
    }
    updateProfile({ reminder_enabled: next, reminder_time: reminderTime + ':00' })
  }
  function changeTime(value) {
    updateProfile({ reminder_enabled: reminderOn, reminder_time: value + ':00' })
  }

  // Avisos de pedidos del grupo (opt-out; default true). Al activar, aseguramos la
  // subscripción a push para que lleguen aunque no use el recordatorio diario.
  const groupNotifOn = profile?.group_prayer_notifications_enabled ?? true
  async function toggleGroupNotif() {
    const next = !groupNotifOn
    if (next) await subscribeToPush(user.id)
    updateProfile({ group_prayer_notifications_enabled: next })
  }

  // Fijar el día actual del plan: mueve plan_start_date para que hoy sea ese día y
  // da por leídos los días anteriores (mismo mecanismo que el enganche del onboarding).
  async function updatePlanDay() {
    if (!profile?.active_plan_id || targetDay == null) return
    const planId = profile.active_plan_id
    setSavingDay(true)
    const { error } = await updateProfile({ plan_start_date: startDateForDay(targetDay) })
    if (!error && targetDay > 1 && user) {
      try {
        await markDaysRead(user.id, planId, targetDay - 1)
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
      <h1 className="text-[26px] font-bold tracking-tight text-ink">Ajustes</h1>

      <SectionLabel>Lectura</SectionLabel>
      <Link to="/planes" className="card flex items-center justify-between px-4 py-3">
        <span className="text-[16px] text-ink">Plan de lectura</span>
        <span className="flex items-center gap-1.5">
          <span className="text-[15px] text-ink-soft">{plan?.name || 'Elegir'}</span>
          <span className="text-ink-soft" style={{ opacity: 0.5 }}>
            <ChevronRight size={18} />
          </span>
        </span>
      </Link>

      {/* Fijar en qué día del plan vas (catch-up para quien ya venía leyendo). */}
      {currentDay != null && (
        <>
          <SectionLabel>¿En qué día vas?</SectionLabel>
          <div className="card p-4">
            <p className="text-[14px] text-ink-soft">
              Día actual: <span className="font-semibold text-ink">{currentDay}</span> de {duration}
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={dayInput}
              onChange={(e) => {
                setDayInput(e.target.value.replace(/[^\d]/g, ''))
                setSavedDay(false)
              }}
              placeholder={`Ej: ${currentDay}`}
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
              {savingDay ? '…' : 'Actualizar'}
            </button>
            {canUpdateDay && (
              <p className="mt-2 text-[13px] text-ink-soft">
                Hoy pasará al día {targetDay}. Los días anteriores quedan como leídos.
              </p>
            )}
            {savedDay && !dayInput && (
              <p className="mt-2 text-[13px]" style={{ color: 'var(--accent)' }}>
                ✓ Listo, hoy es el día {currentDay}
              </p>
            )}
          </div>
        </>
      )}

      <SectionLabel>Color de acento</SectionLabel>
      <div className="card grid grid-cols-6 gap-3 p-4">
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
              className="aspect-square w-full rounded-full transition-transform duration-200"
              style={{
                backgroundColor: swatch,
                boxShadow: selected
                  ? '0 0 0 2px var(--bg-app), 0 0 0 4px var(--accent)'
                  : 'none',
              }}
            />
          )
        })}
      </div>

      <SectionLabel>Tema</SectionLabel>
      <Segmented options={THEMES} value={themePref} onChange={pickTheme} />

      <SectionLabel>Recordatorio diario</SectionLabel>
      <div className="card divide-y divide-hairline">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[16px] text-ink">Activar</span>
          <Switch on={reminderOn} onChange={toggleReminder} label="Recordatorio diario" />
        </div>
        {reminderOn && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[16px] text-ink">Hora</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => changeTime(e.target.value)}
              className="rounded-input px-2 py-1 text-[16px] outline-none"
              style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-primary)' }}
            />
          </div>
        )}
      </div>
      {reminderOn && (
        <p className="mt-2 px-1 text-[12px] text-ink-soft">
          {showReminderIOSNote
            ? 'En iPhone, agregá la app a la pantalla de inicio para recibir las notificaciones.'
            : 'Te llega una notificación a la hora elegida. Puede demorar unos minutos.'}
        </p>
      )}

      <SectionLabel>Avisos del grupo</SectionLabel>
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[16px] text-ink">Pedidos de oración nuevos</span>
          <Switch
            on={groupNotifOn}
            onChange={toggleGroupNotif}
            label="Avisos de pedidos del grupo"
          />
        </div>
      </div>
      <p className="mt-2 px-1 text-[12px] text-ink-soft">
        Te avisamos cuando alguien comparte un pedido en un grupo tuyo.
      </p>

      <SectionLabel>Apoyá la misión</SectionLabel>
      <div
        className="card p-4"
        style={{ backgroundColor: 'var(--accent-tint)', border: '1px solid var(--accent)' }}
      >
        <div className="flex items-start gap-2.5">
          <span className="shrink-0 pt-0.5" style={{ color: 'var(--accent)' }}>
            <HeartIcon size={20} />
          </span>
          <div>
            <p className="text-[14px] text-ink">
              Soy pastor misionero y creé esta app para acercarnos cada día mejor a la Palabra.
              Tu aporte es una gran ayuda a seguir sirviendo a tiempo completo. ¡Gracias!
            </p>
            <a
              href="https://dentonbible.org/missions/view-detail/smallgroup/oriolo-enrique-and-tamara/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Conocé más sobre nuestra misión ↗
            </a>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[
            { label: 'Donar con PayPal', url: 'https://www.paypal.com/paypalme/EnriqueOriolo' },
            {
              label: 'Donación única · MercadoPago',
              url: 'https://link.mercadopago.com.ar/enriqueoriolo',
            },
            { label: 'Apoyo mensual · MercadoPago', url: 'https://mpago.la/1EEJDnZ' },
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
              <span className="text-[14px]" style={{ color: 'var(--accent)' }} aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      </div>

      <SectionLabel>Cuenta</SectionLabel>
      <div className="card divide-y divide-hairline">
        <div className="px-4 py-3">
          <p className="text-[16px] text-ink">{profile?.display_name || 'Tu nombre'}</p>
          <p className="text-[13px] text-ink-soft">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="w-full px-4 py-3 text-left text-[16px] text-ink"
        >
          Cerrar sesión
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
          className="w-full px-4 py-3 text-left text-[16px]"
          style={{ color: 'var(--danger)' }}
        >
          {deleting ? 'Eliminando…' : 'Eliminar cuenta'}
        </button>
      </div>
      {deleteError && (
        <p className="mt-2 px-1 text-[13px]" style={{ color: 'var(--danger)' }}>
          No se pudo eliminar la cuenta. Intentá de nuevo.
        </p>
      )}

      <p className="mt-8 text-center text-[13px] text-ink-soft">Versión {APP_VERSION}</p>

      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar tu cuenta?"
          message="Se borran tu cuenta y todos tus datos (lectura, oraciones y membresías). No se puede deshacer."
          confirmLabel="Eliminar"
          danger
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
