import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { getAdminOverview, getAdminSignupsSeries } from '../lib/db.js'
import RetryError from '../components/RetryError.jsx'

// Panel privado del dueño (/admin). No aparece en la navegación: se entra por URL
// directa y solo responde a la cuenta admin. Toda la data llega de RPCs agregadas
// SECURITY DEFINER (migración 0021) — el cliente nunca ve filas de otros usuarios.
const ADMIN_EMAIL = 'enrique.o1990@gmail.com'

// Bandera emoji a partir del código ISO-2 (regional indicators). '—' o inválido → 🌍.
function flag(cc) {
  if (!/^[A-Z]{2}$/.test(cc)) return '🌍'
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))
}

function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

const PLATFORM_LABEL = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Escritorio', '—': 'Sin registrar' }

function prettyTz(tz) {
  if (tz === '—') return 'Sin registrar'
  return tz.replace(/_/g, ' ').replace('/', ' · ')
}

function StatCard({ value, label, hint, accent }) {
  return (
    <div className="card p-4">
      <p
        className={`text-[28px] font-bold leading-none ${accent ? 'text-accent' : 'text-ink'}`}
        style={{ letterSpacing: '-1px' }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[13px] leading-tight text-ink-soft">{label}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-placeholder">{hint}</p> : null}
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="mt-8">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">{title}</p>
      {subtitle ? <p className="mt-0.5 text-[13px] text-placeholder">{subtitle}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  )
}

// Lista de barras horizontales. rows: [{ label, value, lead?, note?, ratio? }].
// ratio (0..1) fuerza el largo de la barra; si no, se normaliza contra el máximo.
function BarList({ rows, empty }) {
  if (!rows || rows.length === 0) {
    return <p className="text-[15px] text-ink-soft">{empty}</p>
  }
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
              {r.lead ? <span className="mr-2">{r.lead}</span> : null}
              {r.label}
            </span>
            <span className="shrink-0 text-[14px] font-semibold text-ink">
              {r.value}
              {r.note ? <span className="ml-2 font-normal text-ink-soft">{r.note}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-[6px] rounded-full" style={{ backgroundColor: 'var(--surface-alt)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(r.ratio != null ? r.ratio : r.value / max) * 100}%`,
                backgroundColor: 'var(--accent)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Mini gráfico de barras de altas por día (SVG inline, sin dependencias).
function SignupsChart({ series }) {
  if (!series || series.length === 0) return null
  const total = series.reduce((s, d) => s + d.signups, 0)
  const max = Math.max(...series.map((d) => d.signups), 1)
  const W = 320
  const H = 60
  const gap = 2
  const bw = (W - gap * (series.length - 1)) / series.length
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-ink">Altas por día</p>
        <p className="text-[13px] text-ink-soft">
          {total} en {series.length} días
        </p>
      </div>
      <svg className="mt-3 w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {series.map((d, i) => {
          const h = d.signups === 0 ? 1 : (d.signups / max) * H
          return (
            <rect
              key={i}
              x={i * (bw + gap)}
              y={H - h}
              width={bw}
              height={h}
              rx={Math.min(bw / 2, 1.5)}
              fill="var(--accent)"
              opacity={d.signups === 0 ? 0.18 : 1}
            />
          )
        })}
      </svg>
    </div>
  )
}

// Salud por plan: empezaron, terminados (tasa) y día promedio de freno.
function PlansHealth({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="text-[15px] text-ink-soft">Sin planes todavía.</p>
  }
  return (
    <ul className="space-y-3">
      {rows.map((p) => {
        const rate = pct(p.completions, p.started)
        return (
          <li key={p.slug} className="card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{p.name}</p>
              <span className="shrink-0 text-[14px] font-semibold" style={{ color: 'var(--accent)' }}>
                {rate}%
              </span>
            </div>
            <div className="mt-2 h-[6px] rounded-full" style={{ backgroundColor: 'var(--surface-alt)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${rate}%`, backgroundColor: 'var(--accent)' }}
              />
            </div>
            <p className="mt-2 text-[13px] text-ink-soft">
              {p.started} empezaron · {p.completions} terminaron · {p.active_now} activos ahora
              {p.stall_day ? ` · se frenan ~día ${p.stall_day}` : ''}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const [data, setData] = useState(null) // { overview, series }
  const [error, setError] = useState(false)
  const isAdmin = user?.email === ADMIN_EMAIL

  const load = useCallback(async () => {
    setError(false)
    try {
      const [overview, series] = await Promise.all([getAdminOverview(), getAdminSignupsSeries(30)])
      setData({ overview, series })
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  const back = (
    <Link to="/" className="text-[15px] font-medium" style={{ color: 'var(--accent)' }}>
      ‹ Volver
    </Link>
  )

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[560px] px-5 pt-6">
        {back}
        <div className="mt-16 text-center">
          <p className="text-[17px] text-ink">Esta página es privada.</p>
        </div>
      </div>
    )
  }

  const o = data?.overview

  // Filas del embudo de activación, normalizadas contra el total de registrados.
  const funnel = o
    ? [
        { label: 'Registrados', value: o.users.total },
        { label: 'Eligieron plan', value: o.users.with_plan, note: `${pct(o.users.with_plan, o.users.total)}%` },
        { label: 'Leyeron ≥1 día', value: o.users.activated, note: `${pct(o.users.activated, o.users.total)}%` },
        { label: 'Activos · 30 días', value: o.active.d30, note: `${pct(o.active.d30, o.users.total)}%` },
      ].map((r) => ({ ...r, ratio: o.users.total ? r.value / o.users.total : 0 }))
    : []

  const platformRows = o
    ? Object.entries(o.platform || {})
        .map(([k, v]) => ({ label: PLATFORM_LABEL[k] || k, value: v }))
        .sort((a, b) => b.value - a.value)
    : []

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-16 pt-6">
      {back}
      <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">Panel</h1>
      <p className="mt-1 text-[15px] text-ink-soft">Números de Lee Tu Biblia. Solo para vos.</p>

      {error ? (
        <div className="mt-8">
          <RetryError message="No se pudo cargar el panel." onRetry={load} />
        </div>
      ) : !o ? (
        <p className="mt-10 text-[15px] text-ink-soft">Cargando…</p>
      ) : (
        <>
          <Section title="Usuarios">
            <div className="grid grid-cols-2 gap-3">
              <StatCard value={o.users.total} label="usuarios registrados" accent />
              <StatCard value={o.installs.standalone_users} label="instalaron la app" hint="abrieron instalada" />
              <StatCard value={o.users.new_7d} label="nuevos · 7 días" />
              <StatCard value={o.users.new_30d} label="nuevos · 30 días" />
            </div>
          </Section>

          <Section title="Activación" subtitle="Del total registrado, cuántos avanzan.">
            <div className="card p-4">
              <BarList rows={funnel} empty="Sin usuarios todavía." />
            </div>
          </Section>

          <Section title="Actividad">
            <div className="grid grid-cols-2 gap-3">
              <StatCard value={o.active.d7} label="activos · 7 días" accent />
              <StatCard value={o.active.d30} label="activos · 30 días" />
              <StatCard value={o.dormant_14d} label="sin volver · 14+ días" hint="fueron activos y se enfriaron" />
              <StatCard value={o.users.with_reminder} label="con recordatorio" />
            </div>
          </Section>

          <div className="mt-4">
            <SignupsChart series={data.series} />
          </div>

          <Section title="Constancia" subtitle="Usuarios por cantidad de días leídos.">
            <div className="card p-4">
              <BarList
                empty="Nadie leyó todavía."
                rows={[
                  { label: 'Nunca leyeron', value: o.constancy.d0 },
                  { label: '1 a 6 días', value: o.constancy.d1_6 },
                  { label: '7 a 29 días', value: o.constancy.d7_29 },
                  { label: '30+ días', value: o.constancy.d30p },
                ]}
              />
            </div>
          </Section>

          <Section title="Salud de planes" subtitle="Tasa = terminados ÷ empezados.">
            <PlansHealth rows={o.plans_health} />
          </Section>

          <Section title="Plataforma e instalación">
            <div className="card p-4">
              <BarList empty="Sin datos todavía." rows={platformRows} />
              <p className="mt-4 border-t pt-3 text-[13px] text-ink-soft" style={{ borderColor: 'var(--hairline)' }}>
                {o.installs.standalone_users} instalada · {o.installs.browser_only} solo navegador ·{' '}
                {o.installs.total_opens} aperturas
              </p>
            </div>
          </Section>

          <Section title="Países" subtitle="Se llena desde el próximo deploy.">
            <div className="card p-4">
              <BarList
                empty="Sin datos de país todavía."
                rows={(o.countries || []).map((c) => ({
                  label: c.country === '—' ? 'Sin registrar' : c.country,
                  lead: flag(c.country),
                  value: c.users,
                }))}
              />
            </div>
          </Section>

          <Section title="Geografía por timezone" subtitle="Aproximación retroactiva, hasta que el país se acumule.">
            <div className="card p-4">
              <BarList
                empty="Sin timezones registrados."
                rows={(o.timezones || []).map((t) => ({ label: prettyTz(t.tz), value: t.users }))}
              />
            </div>
          </Section>

          <Section title="Comunidad y hábito">
            <div className="grid grid-cols-2 gap-3">
              <StatCard value={o.engagement.groups} label="grupos" />
              <StatCard value={o.engagement.group_members} label="miembros en grupos" />
              <StatCard value={o.engagement.prayers} label="oraciones" hint={`${o.engagement.prayers_answered} respondidas`} />
              <StatCard value={o.engagement.plans_completed} label="planes terminados" />
              <StatCard value={o.diary.users} label="escribieron diario" hint={`${o.diary.enabled} con diario activo`} />
              <StatCard value={o.installs.push_devices} label="dispositivos con push" />
            </div>
          </Section>

          <p className="mt-10 text-center text-[12px] text-placeholder">
            Actualizado {new Date(o.generated_at).toLocaleString('es-ES')}
          </p>
        </>
      )}
    </div>
  )
}
