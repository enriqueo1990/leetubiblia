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
import { ChevronRight } from '../components/icons.jsx'

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
    if (next && 'Notification' in window) {
      try {
        await Notification.requestPermission()
      } catch {
        /* best-effort */
      }
    }
    updateProfile({ reminder_enabled: next, reminder_time: reminderTime + ':00' })
  }
  function changeTime(value) {
    updateProfile({ reminder_enabled: reminderOn, reminder_time: value + ':00' })
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
    const ok = window.confirm(
      'Esto borra tu cuenta y todos tus datos (lectura, oraciones y membresías). No se puede deshacer. ¿Continuar?'
    )
    if (!ok) return
    setDeleting(true)
    try {
      await deleteAccount()
      await signOut()
      // El Gate vuelve a Bienvenida al quedar sin sesión.
    } catch {
      setDeleting(false)
      window.alert('No se pudo eliminar la cuenta. Intentá de nuevo.')
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
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={dayInput}
                onChange={(e) => {
                  setDayInput(e.target.value.replace(/[^\d]/g, ''))
                  setSavedDay(false)
                }}
                placeholder={`Ej: ${currentDay}`}
                className="w-full rounded-input px-4 py-3 text-[16px] outline-none"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={updatePlanDay}
                disabled={!canUpdateDay || savingDay}
                className="btn btn-primary shrink-0 px-5"
                style={{ opacity: !canUpdateDay || savingDay ? 0.5 : 1 }}
              >
                {savingDay ? '…' : 'Actualizar'}
              </button>
            </div>
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
      <div className="card flex items-center justify-between p-4">
        {accents.map((a) => {
          const selected = a.key === accent
          const swatch = resolvedMode === 'dark' ? a.dark : a.light
          return (
            <button
              key={a.key}
              type="button"
              aria-label={a.name}
              onClick={() => pickAccent(a.key)}
              className="h-[44px] w-[44px] rounded-full transition-transform duration-200"
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
          <button
            type="button"
            role="switch"
            aria-checked={reminderOn}
            onClick={toggleReminder}
            className="relative h-[29px] w-[48px] rounded-[15px] transition-colors duration-300"
            style={{ backgroundColor: reminderOn ? 'var(--accent)' : 'var(--surface-alt)' }}
          >
            <span
              className="absolute top-[2.5px] h-[24px] w-[24px] rounded-full bg-white transition-all duration-300"
              style={{ left: reminderOn ? 21 : 3 }}
            />
          </button>
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
            ? 'En iPhone, agregá la app a la pantalla de inicio para recibir avisos. La hora puede no ser exacta.'
            : 'El recordatorio es un aviso aproximado, no una alarma exacta.'}
        </p>
      )}

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
          onClick={handleDelete}
          disabled={deleting}
          className="w-full px-4 py-3 text-left text-[16px]"
          style={{ color: '#D1453B' }}
        >
          {deleting ? 'Eliminando…' : 'Eliminar cuenta'}
        </button>
      </div>

      <p className="mt-8 text-center text-[13px] text-ink-soft">Versión 1.0</p>
    </div>
  )
}
