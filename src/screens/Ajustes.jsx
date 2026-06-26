import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../lib/preferences.jsx'
import { useAuth } from '../lib/auth.jsx'
import { getPlan, deleteAccount } from '../lib/db.js'
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

  const [planName, setPlanName] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Recordatorio (best-effort) — refleja el perfil.
  const reminderOn = !!profile?.reminder_enabled
  const reminderTime = profile?.reminder_time?.slice(0, 5) || '07:00'

  useEffect(() => {
    if (!profile?.active_plan_id) {
      setPlanName(null)
      return
    }
    getPlan(profile.active_plan_id)
      .then((p) => setPlanName(p.name))
      .catch(() => setPlanName(null))
  }, [profile?.active_plan_id])

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
          <span className="text-[15px] text-ink-soft">{planName || 'Elegir'}</span>
          <span className="text-ink-soft" style={{ opacity: 0.5 }}>
            <ChevronRight size={18} />
          </span>
        </span>
      </Link>

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
