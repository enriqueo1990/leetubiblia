import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import {
  getAdminOverview,
  getAdminSignupsSeries,
  getAdminFeedback,
  getAdminOnboardingFunnel,
} from '../lib/db.js'
import RetryError from '../components/RetryError.jsx'
import Segmented from '../components/Segmented.jsx'
import { AreaChart, ColumnChart, Delta, Meter } from './admin/charts.jsx'
import { formatCount, shortDay } from './admin/format.js'
import { BookIcon, HeartIcon, PeopleIcon, RefreshIcon } from '../components/icons.jsx'

// Panel privado del dueño (/admin). No aparece en la navegación: se entra por URL
// directa y solo responde a la cuenta admin. Toda la data llega de RPCs agregadas
// SECURITY DEFINER (migración 0021) — el cliente nunca ve filas de otros usuarios.
// La excepción es el buzón de sugerencias y errores (migración 0034), que se lee
// directo de la tabla: su policy solo deja pasar el select a is_admin().
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

// Ficha de un número. children: lo que lo pone en contexto (variación contra el
// período anterior, medidor contra el total).
function StatCard({ value, label, hint, accent, className = '', children }) {
  return (
    <div className={`card flex flex-col p-4 ${className}`}>
      <p
        className={`text-[28px] font-bold leading-none ${accent ? 'text-accent-ink' : 'text-ink'}`}
        style={{ letterSpacing: '-1px' }}
      >
        {typeof value === 'number' ? formatCount(value) : value}
      </p>
      <p className="mt-1.5 text-[13px] leading-tight text-ink-soft">{label}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-placeholder">{hint}</p> : null}
      {children ? <div className="mt-auto pt-3">{children}</div> : null}
    </div>
  )
}

// Suma de altas en la ventana [desde, hasta) contada desde el final de la serie
// (0 = hoy). null si la serie no llega tan atrás.
function signupsBetween(series, fromEnd, toEnd) {
  if (!series || series.length < toEnd) return null
  return series.slice(series.length - toEnd, series.length - fromEnd).reduce((s, d) => s + d.signups, 0)
}

// Cabecera del panel: el total como número principal y la curva de usuarios
// acumulados (se reconstruye hacia atrás restando las altas de cada día).
function UsersHero({ total, series, new30, prev30 }) {
  const data = []
  let acc = total
  for (let i = series.length - 1; i >= 0; i--) {
    data[i] = { label: shortDay(series[i].day), value: Math.max(0, acc) }
    acc -= series[i].signups
  }
  return (
    <div className="card p-4 lg:p-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="text-[13px] text-ink-soft">Usuarios registrados</p>
          <p className="mt-1 text-[52px] font-bold leading-none text-ink" style={{ letterSpacing: '-2px' }}>
            {formatCount(total)}
          </p>
          <p className="mt-2 text-[13px] text-ink-soft">+{formatCount(new30)} en los últimos 30 días</p>
          <Delta now={new30} before={prev30} period="los 30 anteriores" />
        </div>
        {series.length > 1 ? (
          <AreaChart data={data} height={150} ariaLabel={`Usuarios acumulados en los últimos ${series.length} días`} />
        ) : null}
      </div>
    </div>
  )
}

// Embudo: el paso con la mayor caída respecto del anterior va resaltado, el
// resto queda de contexto, y una nota lo dice en palabras.
function biggestDrop(rows) {
  let worst = null
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].value
    if (!prev) continue
    const loss = 1 - rows[i].value / prev
    if (loss > 0 && (!worst || loss > worst.loss)) worst = { index: i, loss, from: rows[i - 1].label, to: rows[i].label }
  }
  return worst
}

function FunnelChart({ rows, empty, children }) {
  const drop = biggestDrop(rows)
  return (
    <div className="card p-4">
      <BarList rows={rows} empty={empty} highlight={drop?.index} />
      {drop ? (
        <p className="mt-4 border-t pt-3 text-[13px] text-ink-soft" style={{ borderColor: 'var(--hairline)' }}>
          Mayor caída: <span className="font-semibold text-ink">−{Math.round(drop.loss * 100)}%</span> de «{drop.from}» a
          «{drop.to}».
        </p>
      ) : null}
      {children}
    </div>
  )
}

// id → ancla del menú. scroll-mt deja la sección justo debajo del menú fijo.
function Section({ id, title, subtitle, children }) {
  return (
    <section id={id} className="mt-8 min-w-0 scroll-mt-[76px] lg:scroll-mt-8">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">{title}</p>
      {subtitle ? <p className="mt-0.5 text-[13px] text-placeholder">{subtitle}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

// Iconos propios del panel, mismo trazo que components/icons.jsx (SF-like, 1.7).
function PanelIcon({ size = 22, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}
const PulseIcon = (p) => (
  <PanelIcon {...p}>
    <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
  </PanelIcon>
)
const FunnelIcon = (p) => (
  <PanelIcon {...p}>
    <path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z" />
  </PanelIcon>
)
const DoorIcon = (p) => (
  <PanelIcon {...p}>
    <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M4 12h11M11 8l4 4-4 4" />
  </PanelIcon>
)
const CalendarIcon = (p) => (
  <PanelIcon {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </PanelIcon>
)
const PhoneIcon = (p) => (
  <PanelIcon {...p}>
    <rect x="7" y="3" width="10" height="18" rx="2.5" />
    <path d="M11 17.5h2" />
  </PanelIcon>
)
const GlobeIcon = (p) => (
  <PanelIcon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5Z" />
  </PanelIcon>
)
const BackIcon = (p) => (
  <PanelIcon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </PanelIcon>
)
const InboxIcon = (p) => (
  <PanelIcon {...p}>
    <path d="M4 13.5 6.2 6a1.5 1.5 0 0 1 1.4-1h8.8a1.5 1.5 0 0 1 1.4 1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-4.5Z" />
    <path d="M4 13.5h4.5l1 2h5l1-2H20" />
  </PanelIcon>
)

// Destinos del menú, en el orden de la página. Cada id es el de una <Section>;
// las secciones sin entrada propia (timezones) quedan bajo la anterior.
const NAV = [
  { id: 'usuarios', label: 'Usuarios', Icon: PeopleIcon },
  { id: 'actividad', label: 'Actividad', Icon: PulseIcon },
  { id: 'activacion', label: 'Activación', Icon: FunnelIcon },
  { id: 'onboarding', label: 'Onboarding', Icon: DoorIcon },
  { id: 'constancia', label: 'Constancia', Icon: CalendarIcon },
  { id: 'plataforma', label: 'Plataforma', Icon: PhoneIcon },
  { id: 'planes', label: 'Planes', Icon: BookIcon },
  { id: 'geografia', label: 'Geografía', Icon: GlobeIcon },
  { id: 'comunidad', label: 'Comunidad', Icon: HeartIcon },
  { id: 'buzon', label: 'Buzón', Icon: InboxIcon },
]

const NAV_IDS = NAV.map((it) => it.id)

// Pasos del embudo de onboarding (eventos 'ob_*', migración 0035), en orden.
const ONBOARDING_STEPS = [
  { step: 'ob_welcome', label: 'Vieron la bienvenida' },
  { step: 'ob_explore', label: 'Abrieron los planes' },
  { step: 'ob_plan_chosen', label: 'Eligieron plan o «después»' },
  { step: 'ob_code_sent', label: 'Pidieron el código' },
  { step: 'ob_code_verified', label: 'Entraron con el código' },
  { step: 'ob_extras_done', label: 'Terminaron el onboarding' },
  { step: 'ob_first_mark', label: 'Marcaron su primera lectura' },
]

const NAV_OFFSET = 80 // alto del menú fijo + aire: a partir de acá una sección "es la actual"

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Sección actual según el scroll: la que pasó bajo el menú más cerca de él. En
// escritorio dos secciones comparten fila (misma altura): gana la primera, salvo
// que la de al lado sea la que se eligió en el menú. Al tocar fondo gana la última, aunque
// sea corta y nunca llegue arriba.
// select() fija una sección a mano (tap en el menú) y congela el cálculo hasta
// que el scroll que dispara se detiene: si no, al llegar al fondo "Comunidad"
// se pisaría con "Buzón".
function useActiveSection(ids, enabled) {
  const [active, setActive] = useState(ids[0])
  const lock = useRef(null) // timeout mientras manda la selección manual

  const select = useCallback((id) => {
    setActive(id)
    clearTimeout(lock.current)
    lock.current = setTimeout(() => (lock.current = null), 200)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const update = () => {
      frame = 0
      if (lock.current) return
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom) return setActive(ids[ids.length - 1])
      let current = ids[0]
      let best = -Infinity
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top
        if (top != null && top <= NAV_OFFSET && top > best + 1) {
          current = id
          best = top
        }
      }
      // Si la elegida comparte fila con la ganadora, se queda la elegida.
      setActive((prev) => {
        const prevTop = document.getElementById(prev)?.getBoundingClientRect().top
        return prevTop != null && Math.abs(prevTop - best) <= 1 ? prev : current
      })
    }
    const onScroll = () => {
      if (lock.current) {
        // Sigue el scroll del salto: estirar la espera hasta que pare.
        clearTimeout(lock.current)
        lock.current = setTimeout(() => (lock.current = null), 200)
        return
      }
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ids, enabled])
  useEffect(() => () => clearTimeout(lock.current), [])
  return [active, select]
}

// Escritorio (≥1024px): sidebar fijo a la izquierda, gemelo del de la app
// (components/Sidebar.jsx): superficie con filete, ítems con icono y el activo
// en acento sobre tinte. Abajo, refrescar los números y volver a la app.
function AdminSidebar({ items, active, onSelect, updatedAt, onRefresh, refreshing }) {
  const itemClass =
    'flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-300 ease-soft'
  return (
    <aside
      className="fixed inset-y-0 left-0 hidden w-[250px] flex-col border-r border-hairline bg-surface px-4 py-7 lg:flex"
      aria-label="Secciones del panel"
    >
      <div className="px-3 pb-6">
        <span className="text-[18px] font-bold tracking-tight text-ink">Panel</span>
        <p className="mt-0.5 text-[13px] text-ink-soft">Lee Tu Biblia</p>
      </div>
      <nav className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <ul className="flex flex-col gap-1">
          {items.map(({ id, label, Icon, badge }) => {
            const on = id === active
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={on ? 'location' : undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    onSelect(id)
                  }}
                  className={itemClass}
                  style={{
                    color: on ? 'var(--accent-ink)' : 'var(--text-soft)',
                    backgroundColor: on ? 'var(--accent-tint-nav)' : 'transparent',
                  }}
                >
                  <Icon size={22} />
                  <span className="flex-1 text-[15px]" style={{ fontWeight: on ? 600 : 500 }}>
                    {label}
                  </span>
                  {badge ? (
                    <span
                      className="rounded-full px-2 text-[12px] font-semibold leading-[20px]"
                      style={{ backgroundColor: 'var(--accent-action)', color: '#fff' }}
                    >
                      {badge}
                    </span>
                  ) : null}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="mt-3 border-t border-hairline pt-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className={`${itemClass} hover:bg-[var(--accent-tint-nav)] disabled:opacity-60`}
          style={{ color: 'var(--text-soft)' }}
        >
          <RefreshIcon size={22} className={refreshing ? 'animate-spin' : ''} />
          <span className="text-[15px] font-medium">{refreshing ? 'Actualizando…' : 'Actualizar'}</span>
        </button>
        <Link to="/" className={`${itemClass} hover:bg-[var(--accent-tint-nav)]`} style={{ color: 'var(--text-soft)' }}>
          <BackIcon size={22} />
          <span className="text-[15px] font-medium">Volver a la app</span>
        </Link>
        {updatedAt ? (
          <p className="px-3 pt-2 text-[12px] text-placeholder">
            Actualizado {new Date(updatedAt).toLocaleString('es-ES')}
          </p>
        ) : null}
      </div>
    </aside>
  )
}

// Móvil/tablet: menú fijo arriba, una fila de chips desplazable con un salto
// por sección. La sección visible queda resaltada y su chip se centra solo.
function AdminNav({ items, active, onSelect }) {
  const rowRef = useRef(null)

  useEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector(`[data-nav="${active}"]`)
    if (!row || !chip) return
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2
    row.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [active])

  return (
    <nav
      aria-label="Secciones del panel"
      className="sticky top-0 z-10 -mx-5 mt-5 lg:hidden"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 10px)',
        backgroundColor: 'var(--tabbar-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <ul
        ref={rowRef}
        className="flex gap-2 overflow-x-auto px-5 pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => {
          const on = it.id === active
          return (
            <li key={it.id} className="shrink-0">
              <a
                href={`#${it.id}`}
                data-nav={it.id}
                aria-current={on ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  onSelect(it.id)
                }}
                className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[14px] transition-colors duration-200"
                style={{
                  backgroundColor: on ? 'var(--accent-action)' : 'var(--segment-track)',
                  color: on ? '#fff' : 'var(--text-soft)',
                  fontWeight: on ? 600 : 500,
                }}
              >
                {it.label}
                {it.badge ? (
                  <span
                    className="rounded-full px-1.5 text-[12px] font-semibold leading-[18px]"
                    style={{
                      backgroundColor: on ? 'rgba(255,255,255,0.25)' : 'var(--surface)',
                      color: on ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {it.badge}
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Lista de barras horizontales. rows: [{ label, value, lead?, note?, ratio? }].
// ratio (0..1) fuerza el largo de la barra; si no, se normaliza contra el máximo.
// highlight: índice de la fila a resaltar; las demás quedan de contexto.
// Barras de 8px, base recta y punta redondeada (4px).
function BarList({ rows, empty, highlight }) {
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
            <span className="shrink-0 text-[14px] font-semibold text-ink tabular-nums">
              {formatCount(r.value)}
              {r.note ? <span className="ml-2 font-normal text-ink-soft">{r.note}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-[8px] rounded-r-[4px]" style={{ backgroundColor: 'var(--surface-alt)' }}>
            <div
              className="h-full rounded-r-[4px]"
              style={{
                width: `${(r.ratio != null ? r.ratio : r.value / max) * 100}%`,
                backgroundColor: 'var(--accent)',
                opacity: highlight != null && highlight !== i ? 0.45 : 1,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Altas por día: columnas con eje, una etiqueta por semana y tooltip por día.
function SignupsChart({ series }) {
  if (!series || series.length === 0) return null
  const total = series.reduce((s, d) => s + d.signups, 0)
  const data = series.map((d, i) => ({
    value: d.signups,
    tip: shortDay(d.day, true),
    tick: (series.length - 1 - i) % 7 === 0 ? shortDay(d.day) : null,
  }))
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold text-ink">Altas por día</p>
        <p className="text-[13px] text-ink-soft">
          {formatCount(total)} en {series.length} días
        </p>
      </div>
      <div className="mt-3">
        <ColumnChart
          data={data}
          height={160}
          ariaLabel={`Altas por día, últimos ${series.length} días: ${total} en total`}
          valueLabel={(v) => `${formatCount(v)} ${v === 1 ? 'alta' : 'altas'}`}
        />
      </div>
    </div>
  )
}

// Salud por plan: empezaron, terminados (tasa) y día promedio de freno.
function PlansHealth({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="text-[15px] text-ink-soft">Sin planes todavía.</p>
  }
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {rows.map((p) => {
        const rate = pct(p.completions, p.started)
        return (
          <li key={p.slug} className="card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{p.name}</p>
              <span className="shrink-0 text-[14px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
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

const FEEDBACK_KIND = { suggestion: 'Sugerencia', bug: 'Error' }
const FEEDBACK_OPTIONS = [
  { key: 'suggestion', label: 'Sugerencias' },
  { key: 'bug', label: 'Errores' },
]

// Buzón de Ajustes › "Quién hace la app": sugerencias y reportes de error, con
// la versión y el dispositivo que los mandó. Carga aparte del resto del panel
// para que un fallo acá (tabla sin migrar, por ejemplo) no tape los números.
function FeedbackInbox({ rows, error, onRetry }) {
  const [kind, setKind] = useState('suggestion')
  if (error) {
    return (
      <div>
        <RetryError message="No se pudieron cargar las sugerencias." onRetry={onRetry} />
        <p className="mt-3 break-words text-center text-[12px] text-placeholder">{error}</p>
      </div>
    )
  }
  if (!rows) return <p className="text-[15px] text-ink-soft">Cargando…</p>
  const count = (k) => rows.filter((r) => r.kind === k).length
  const visible = rows.filter((r) => r.kind === kind)
  return (
    <div>
      <Segmented
        className="lg:max-w-[420px]"
        label="Tipo de mensaje"
        value={kind}
        onChange={setKind}
        options={FEEDBACK_OPTIONS.map((o) => ({ ...o, label: `${o.label} · ${count(o.key)}` }))}
      />
      {visible.length === 0 ? (
        <p className="mt-4 text-[15px] text-ink-soft">
          {kind === 'bug' ? 'Nadie avisó de un error todavía.' : 'Nadie sugirió nada todavía.'}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {visible.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="shrink-0 text-[12px] font-semibold uppercase tracking-wide"
                  style={{ color: r.kind === 'bug' ? 'var(--danger)' : 'var(--accent-ink)' }}
                >
                  {FEEDBACK_KIND[r.kind] || r.kind}
                </span>
                <span className="text-[13px] text-ink-soft">{new Date(r.created_at).toLocaleString('es-ES')}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-snug text-ink">{r.body}</p>
              <p className="mt-3 border-t pt-2.5 text-[12px] text-placeholder" style={{ borderColor: 'var(--hairline)' }}>
                {[
                  r.app_version ? `v${r.app_version}` : 'versión sin registrar',
                  PLATFORM_LABEL[r.platform] || r.platform || 'plataforma sin registrar',
                  r.standalone === true ? 'instalada' : r.standalone === false ? 'navegador' : null,
                  r.locale || null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Embudo de onboarding: cada paso contra la bienvenida. Con invitación se
// saltean "planes" y "eligieron plan", por eso esos pasos pueden quedar debajo
// de los siguientes.
function OnboardingFunnel({ rows, error, onRetry }) {
  if (error) {
    return (
      <div className="card p-4">
        <RetryError message="No se pudo cargar el embudo." onRetry={onRetry} />
        <p className="mt-3 break-words text-center text-[12px] text-placeholder">
          {/admin_onboarding_funnel|PGRST202|does not exist/i.test(error)
            ? 'Falta aplicar la migración 0035.'
            : error}
        </p>
      </div>
    )
  }
  if (!rows) return <p className="text-[15px] text-ink-soft">Cargando…</p>

  const count = (step) => rows.find((r) => r.step === step)?.devices ?? 0
  const base = count('ob_welcome')
  const funnelRows = ONBOARDING_STEPS.map(({ step, label }) => {
    const value = count(step)
    return {
      label,
      value,
      note: step === 'ob_welcome' ? null : `${pct(value, base)}%`,
      ratio: base ? Math.min(value / base, 1) : 0,
    }
  })

  return (
    <FunnelChart rows={base ? funnelRows : []} empty="Sin datos todavía.">
      <p className="mt-3 text-[13px] text-ink-soft">
        iPhone: {count('ob_install_step')} vieron «agregala a tu inicio» · {count('ob_install_skip')} siguieron en
        el navegador
      </p>
      {/* El nombre solo se pide a invitados (quien lee solo lo da al crear o unirse
          a un grupo): fuera del embudo para no simular una caída. */}
      <p className="mt-1.5 text-[13px] text-ink-soft">
        Invitados: {count('ob_name_saved')} pusieron su nombre
      </p>
    </FunnelChart>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const [data, setData] = useState(null) // { overview, series }
  const [error, setError] = useState(null) // string | null
  const [feedback, setFeedback] = useState(null) // filas de app_feedback | null (cargando)
  const [feedbackError, setFeedbackError] = useState(null) // string | null
  const [obFunnel, setObFunnel] = useState(null) // filas { step, devices } | null (cargando)
  const [obFunnelError, setObFunnelError] = useState(null) // string | null
  const isAdmin = user?.email === ADMIN_EMAIL
  const [active, setActive] = useActiveSection(NAV_IDS, Boolean(data))

  const load = useCallback(async () => {
    setError(null)
    try {
      const [overview, series] = await Promise.all([getAdminOverview(), getAdminSignupsSeries(90)])
      setData({ overview, series })
    } catch (e) {
      setError(e?.message || e?.hint || String(e))
    }
  }, [])

  const loadFeedback = useCallback(async () => {
    setFeedbackError(null)
    try {
      setFeedback(await getAdminFeedback({ limit: 100 }))
    } catch (e) {
      setFeedbackError(e?.message || e?.hint || String(e))
    }
  }, [])

  // Aparte del resto: si la migración 0035 no está aplicada, solo falla esta sección.
  const loadObFunnel = useCallback(async () => {
    setObFunnelError(null)
    try {
      setObFunnel(await getAdminOnboardingFunnel(30))
    } catch (e) {
      setObFunnelError(e?.message || e?.hint || String(e))
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      load()
      loadFeedback()
      loadObFunnel()
    }
  }, [isAdmin, load, loadFeedback, loadObFunnel])

  const goTo = useCallback(
    (id, smooth = true) => {
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({ block: 'start', behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
      setActive(id)
      window.history.replaceState(null, '', `#${id}`)
    },
    [setActive],
  )

  // /admin#buzon abre directo en esa sección, en cuanto el panel termina de cargar.
  const loaded = Boolean(data)
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (loaded && NAV_IDS.includes(id)) goTo(id, false)
  }, [loaded, goTo])

  // Botón "Actualizar" del sidebar: vuelve a pedir todo sin vaciar la pantalla.
  const [refreshing, setRefreshing] = useState(false)
  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([load(), loadFeedback(), loadObFunnel()])
    setRefreshing(false)
  }, [load, loadFeedback, loadObFunnel])

  const back = (
    <Link to="/" className="text-[15px] font-medium" style={{ color: 'var(--accent-ink)' }}>
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

  const navItems = NAV.map((it) => (it.id === 'buzon' && feedback?.length ? { ...it, badge: feedback.length } : it))

  // Escritorio: sidebar a la izquierda y el contenido en grilla de dashboard (filas
  // de a dos secciones). Móvil: una columna con el menú de chips arriba.
  // overflow-x-clip: tope a cualquier desborde lateral sin romper el menú sticky
  // (hidden lo convertiría en contenedor de scroll).
  return (
    <div className="min-h-full overflow-x-clip bg-app">
      {o ? (
        <AdminSidebar
          items={navItems}
          active={active}
          onSelect={goTo}
          updatedAt={o.generated_at}
          onRefresh={refreshAll}
          refreshing={refreshing}
        />
      ) : null}

      <div className={o ? 'lg:pl-[250px]' : ''}>
        <div className="mx-auto max-w-[560px] px-5 pb-16 pt-6 lg:max-w-[1080px] lg:px-10 lg:pt-10">
          <div className={o ? 'lg:hidden' : ''}>{back}</div>
          <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink lg:mt-0 lg:text-[30px]">Panel</h1>
          <p className="mt-1 text-[15px] text-ink-soft">Números de Lee Tu Biblia. Solo para vos.</p>

          {o ? <AdminNav items={navItems} active={active} onSelect={goTo} /> : null}

          {error ? (
            <div className="mt-8">
              <RetryError message="No se pudo cargar el panel." onRetry={load} />
              <p className="mt-3 break-words text-center text-[12px] text-placeholder">{error}</p>
            </div>
          ) : !o ? (
            <p className="mt-10 text-[15px] text-ink-soft">Cargando…</p>
          ) : (
            <>
              <Section id="usuarios" title="Usuarios">
                <UsersHero
                  total={o.users.total}
                  series={data.series}
                  new30={o.users.new_30d}
                  prev30={signupsBetween(data.series, 30, 60)}
                />
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <StatCard value={o.users.new_7d} label="nuevos · 7 días">
                    <Delta now={o.users.new_7d} before={signupsBetween(data.series, 7, 14)} period="los 7 anteriores" />
                  </StatCard>
                  <StatCard value={o.installs.standalone_users} label="instalaron la app" hint={`${pct(o.installs.standalone_users, o.users.total)}% de los registrados`}>
                    <Meter ratio={o.users.total ? o.installs.standalone_users / o.users.total : 0} label="Instalaron la app" />
                  </StatCard>
                  <StatCard value={o.users.with_reminder} label="con recordatorio" className="col-span-2 lg:col-span-1" hint={`${pct(o.users.with_reminder, o.users.total)}% de los registrados`}>
                    <Meter ratio={o.users.total ? o.users.with_reminder / o.users.total : 0} label="Con recordatorio" />
                  </StatCard>
                </div>
                <div className="mt-3">
                  <SignupsChart series={data.series.slice(-30)} />
                </div>
              </Section>

              <Section id="actividad" title="Actividad" subtitle="Leyeron o marcaron algo en el período.">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard value={o.active.d7} label="activos · 7 días" accent hint={`${pct(o.active.d7, o.users.total)}% de los registrados`}>
                    <Meter ratio={o.users.total ? o.active.d7 / o.users.total : 0} label="Activos 7 días" />
                  </StatCard>
                  <StatCard value={o.active.d30} label="activos · 30 días" hint={`${pct(o.active.d30, o.users.total)}% de los registrados`}>
                    <Meter ratio={o.users.total ? o.active.d30 / o.users.total : 0} label="Activos 30 días" />
                  </StatCard>
                  <StatCard value={`${pct(o.active.d7, o.active.d30)}%`} label="vuelven cada semana" hint="activos 7 días ÷ activos 30 días">
                    <Meter ratio={o.active.d30 ? o.active.d7 / o.active.d30 : 0} label="Vuelven cada semana" />
                  </StatCard>
                  <StatCard value={o.dormant_14d} label="sin volver · 14+ días" hint="fueron activos y se enfriaron" />
                </div>
              </Section>

              <div className="grid grid-cols-1 items-start gap-x-6 lg:grid-cols-2">
                <Section id="activacion" title="Activación" subtitle="Del total registrado, cuántos avanzan.">
                  <FunnelChart rows={funnel} empty="Sin usuarios todavía." />
                </Section>

                <Section
                  id="onboarding"
                  title="Onboarding"
                  subtitle="Dispositivos por paso, últimos 30 días. Se mide desde el 17/10/2026."
                >
                  <OnboardingFunnel rows={obFunnel} error={obFunnelError} onRetry={loadObFunnel} />
                </Section>
              </div>

              <div className="grid grid-cols-1 items-start gap-x-6 lg:grid-cols-2">
                <Section id="constancia" title="Constancia" subtitle="Usuarios por cantidad de días leídos.">
                  <div className="card p-4">
                    <ColumnChart
                      valueOnCap
                      height={190}
                      ariaLabel="Usuarios por cantidad de días leídos"
                      data={[
                        { tick: 'Nunca', value: o.constancy.d0 },
                        { tick: '1–6 días', value: o.constancy.d1_6 },
                        { tick: '7–29 días', value: o.constancy.d7_29 },
                        { tick: '30+ días', value: o.constancy.d30p },
                      ].map((d) => ({ ...d, tip: `${d.tick} · ${pct(d.value, o.users.total)}% del total` }))}
                    />
                  </div>
                </Section>

                <Section id="plataforma" title="Plataforma e instalación">
                  <div className="card p-4">
                    <div className="mb-4 border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[15px] text-ink">La usan instalada</p>
                        <p className="text-[14px] font-semibold text-ink tabular-nums">
                          {pct(o.installs.standalone_users, o.installs.standalone_users + o.installs.browser_only)}%
                        </p>
                      </div>
                      <div className="mt-1.5">
                        <Meter
                          ratio={
                            o.installs.standalone_users + o.installs.browser_only
                              ? o.installs.standalone_users / (o.installs.standalone_users + o.installs.browser_only)
                              : 0
                          }
                          label="La usan instalada"
                        />
                      </div>
                    </div>
                    <BarList empty="Sin datos todavía." rows={platformRows} />
                    <p
                      className="mt-4 border-t pt-3 text-[13px] text-ink-soft"
                      style={{ borderColor: 'var(--hairline)' }}
                    >
                      {o.installs.standalone_users} instalada · {o.installs.browser_only} solo navegador ·{' '}
                      {o.installs.total_opens} aperturas
                    </p>
                  </div>
                </Section>
              </div>

              <Section id="planes" title="Salud de planes" subtitle="Tasa = terminados ÷ empezados.">
                <PlansHealth rows={o.plans_health} />
              </Section>

              <div className="grid grid-cols-1 items-start gap-x-6 lg:grid-cols-2">
                <Section id="geografia" title="Países" subtitle="Se llena desde el próximo deploy.">
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
              </div>

              <Section id="comunidad" title="Comunidad y hábito">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <StatCard value={o.engagement.groups} label="grupos" />
                  <StatCard value={o.engagement.group_members} label="miembros en grupos" />
                  <StatCard
                    value={o.engagement.prayers}
                    label="oraciones"
                    hint={`${o.engagement.prayers_answered} respondidas`}
                  />
                  <StatCard value={o.engagement.plans_completed} label="planes terminados" />
                  <StatCard value={o.diary.users} label="escribieron diario" hint={`${o.diary.enabled} con diario activo`} />
                  <StatCard value={o.installs.push_devices} label="dispositivos con push" />
                </div>
              </Section>

              <Section
                id="buzon"
                title="Sugerencias y errores"
                subtitle="Lo que mandaron desde Ajustes › Quién hace la app."
              >
                <FeedbackInbox rows={feedback} error={feedbackError} onRetry={loadFeedback} />
              </Section>

              <p className="mt-10 text-center text-[12px] text-placeholder lg:hidden">
                Actualizado {new Date(o.generated_at).toLocaleString('es-ES')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
