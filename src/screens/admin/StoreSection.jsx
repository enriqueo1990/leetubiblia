import { useEffect, useState } from 'react'
import { updateDonationGoal } from '../../lib/db.js'
import { setCachedDonationGoal } from '../../hooks/useDonationGoal.js'
import RetryError from '../../components/RetryError.jsx'
import Switch from '../../components/Switch.jsx'
import InlineError from '../../components/InlineError.jsx'
import { GoalProgress } from '../../components/DonateSheet.jsx'
import { inputStyle } from '../../components/formStyles.js'
import { Meter } from './charts.jsx'

// Sección "Tiendas" de /admin (migración 0036): los números para decidir si
// pagar App Store y Play Store, y la meta de donación que debería costearlos.

const PLATFORM_LABEL = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Escritorio', '—': 'Sin registrar' }

function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function missingMigration(error) {
  return /admin_store_signals|donation_goals|PGRST202|PGRST205|does not exist/i.test(error)
}

function ErrorBlock({ message, error, onRetry }) {
  return (
    <div className="card p-4">
      <RetryError message={message} onRetry={onRetry} />
      <p className="mt-3 break-words text-center text-[0.75rem] text-placeholder">
        {missingMigration(error) ? 'Falta aplicar la migración 0036.' : error}
      </p>
    </div>
  )
}

// Un número dentro de la fila de una plataforma: valor, % sobre su base y barra.
function Cell({ label, value, base }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.75rem] leading-tight text-ink-soft">{label}</p>
      <p className="mt-0.5 text-[0.9375rem] font-semibold text-ink tabular-nums">
        {value}
        <span className="ml-1 text-[0.75rem] font-normal text-placeholder">{pct(value, base)}%</span>
      </p>
      <div className="mt-1">
        <Meter ratio={base ? value / base : 0} label={label} />
      </div>
    </div>
  )
}

// iPhone contra el resto, en una frase: ¿se pierde más gente en iPhone?
function verdict(rows) {
  const ios = rows.find((r) => r.platform === 'ios')
  const rest = rows.filter((r) => r.platform !== 'ios' && r.platform !== '—')
  const restEligible = rest.reduce((n, r) => n + r.eligible, 0)
  const restBack = rest.reduce((n, r) => n + r.came_back, 0)
  if (!ios?.eligible || !restEligible) return null
  return `Vuelven otro día: ${pct(ios.came_back, ios.eligible)}% en iPhone contra ${pct(restBack, restEligible)}% en el resto.`
}

export function StoreSignals({ data, error, onRetry }) {
  if (error) return <ErrorBlock message="No se pudieron cargar las señales." error={error} onRetry={onRetry} />
  if (!data) return <p className="text-[0.9375rem] text-ink-soft">Cargando…</p>

  const rows = data.platforms || []
  const total = rows.reduce((n, r) => n + r.users, 0)
  const habitual = rows.reduce((n, r) => n + r.habitual, 0)
  const ios = rows.find((r) => r.platform === 'ios')
  const line = verdict(rows)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-[1.75rem] font-bold leading-none text-accent-ink" style={{ letterSpacing: '-1px' }}>
            {habitual}
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-tight text-ink-soft">leen 3+ días por semana</p>
          <p className="mt-0.5 text-[0.75rem] text-placeholder">{pct(habitual, total)}% de los registrados</p>
        </div>
        <div className="card p-4">
          <p className="text-[1.75rem] font-bold leading-none text-ink" style={{ letterSpacing: '-1px' }}>
            {pct(ios?.users || 0, total)}%
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-tight text-ink-soft">se registraron en iPhone</p>
          <p className="mt-0.5 text-[0.75rem] text-placeholder">{ios?.users || 0} de {total}</p>
        </div>
      </div>

      <div className="card mt-3 divide-y divide-hairline">
        {rows.length === 0 ? (
          <p className="p-4 text-[0.9375rem] text-ink-soft">Sin usuarios todavía.</p>
        ) : (
          rows.map((r) => (
            <div key={r.platform} className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[0.9375rem] font-medium text-ink">{PLATFORM_LABEL[r.platform] || r.platform}</p>
                <p className="text-[0.8125rem] text-ink-soft tabular-nums">{r.users} registrados</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Cell label="Leyeron" value={r.read} base={r.users} />
                <Cell label="Volvieron otro día" value={r.came_back} base={r.eligible} />
                <Cell label="Habituales" value={r.habitual} base={r.users} />
                <Cell label="Instalada" value={r.installed} base={r.users} />
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-3 text-[0.8125rem] leading-snug text-ink-soft">
        {line ? `${line} ` : ''}«Volvieron» cuenta solo a quienes se registraron hace 2+ días.
      </p>
    </div>
  )
}

function toAmount(text) {
  const n = Number(String(text).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export function GoalEditor({ goal, funnel, error, onRetry, onSaved }) {
  const [raised, setRaised] = useState('')
  const [target, setTarget] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    if (!goal) return
    setRaised(String(goal.raised))
    setTarget(String(goal.target))
    setActive(goal.active)
  }, [goal])

  if (error) return <ErrorBlock message="No se pudo cargar la meta." error={error} onRetry={onRetry} />
  if (!goal) return <p className="text-[0.9375rem] text-ink-soft">Cargando…</p>

  const r = toAmount(raised)
  const tg = toAmount(target)
  const valid = r != null && tg != null && tg > 0
  const dirty = valid && (r !== goal.raised || tg !== goal.target || active !== goal.active)
  const preview = valid ? { ...goal, raised: r, target: tg } : goal

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const next = await updateDonationGoal(goal.key, { raised: r, target: tg, active })
      setCachedDonationGoal(next)
      onSaved?.(next)
      setSavedAt(new Date())
    } catch (e) {
      setSaveError(e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-4">
      <GoalProgress goal={preview} />
      <p className="mt-2 text-[0.8125rem] text-ink-soft">
        {active
          ? preview.raised >= preview.target
            ? 'Meta cumplida: la tarjeta ya no se muestra.'
            : 'Visible en Hoy (rachas de 7 y 30 días, plan terminado) y en Ajustes.'
          : 'Oculta: nadie la ve.'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[0.8125rem] text-ink-soft">Juntado ({goal.currency})</span>
          <input
            inputMode="decimal"
            value={raised}
            onChange={(e) => setRaised(e.target.value)}
            className="mt-1 w-full rounded-input px-4 py-3 text-[1rem] outline-none tabular-nums"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="text-[0.8125rem] text-ink-soft">Meta ({goal.currency})</span>
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full rounded-input px-4 py-3 text-[1rem] outline-none tabular-nums"
            style={inputStyle}
          />
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[0.9375rem] text-ink">Mostrar la meta en la app</span>
        <Switch on={active} onChange={setActive} label="Mostrar la meta en la app" />
      </div>
      <button
        type="button"
        className="btn btn-primary mt-3"
        disabled={!dirty || saving}
        aria-busy={saving}
        onClick={save}
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {saveError ? <InlineError message={`No se pudo guardar: ${saveError}`} className="mt-2" /> : null}
      {savedAt && !dirty && !saveError ? (
        <p className="mt-2 text-center text-[0.8125rem]" style={{ color: 'var(--accent-ink)' }} role="status">
          ✓ Guardado
        </p>
      ) : null}

      {funnel ? (
        <p className="mt-4 border-t pt-3 text-[0.8125rem] text-ink-soft" style={{ borderColor: 'var(--hairline)' }}>
          {funnel.shown} vieron la tarjeta · {funnel.opened} abrieron la hoja · {funnel.link} tocaron un link
        </p>
      ) : null}
    </div>
  )
}
