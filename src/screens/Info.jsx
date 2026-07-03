import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookIcon,
  HeartIcon,
  PeopleIcon,
  SlidersIcon,
  ChartIcon,
  PencilIcon,
  LockIcon,
  CheckIcon,
} from '../components/icons.jsx'

// Landing pública /info — la única página fuera del Gate (ver App.jsx). Le habla
// a quien llega en frío (redes, un pastor pasando el link) antes de decidir
// crear cuenta. Concepto: la app acompaña la Biblia FÍSICA, no la reemplaza
// (product-principle-physical-bible). Un solo acento sepia, firma serif para el
// objeto-libro, ancho de lectura acotado, aire en vez de tarjetas flotantes.

// Firma tipográfica del "objeto libro": serif del sistema, sin sumar webfonts a
// la PWA (coherente con su ética offline/rápida).
const serif = {
  fontFamily:
    'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", ui-serif, serif',
}

// Íconos que la app aún no tiene, en el mismo trazo (1.7, currentColor).
function MiniIcon({ children, size = 22 }) {
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
const BellIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </MiniIcon>
)
const PaletteIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M12 21a9 9 0 1 1 9-9c0 2-1 3-3 3h-1.5a1.5 1.5 0 0 0-1 2.6c.3.3.5.7.5 1.2 0 1.2-1 2.2-2 2.2z" />
    <circle cx="7.8" cy="10.3" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16.2" cy="10.3" r="1.1" fill="currentColor" stroke="none" />
  </MiniIcon>
)
const WifiOffIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M8.5 16.4a5 5 0 0 1 7 0" />
    <path d="M5 12.9a10 10 0 0 1 5.2-2.7" />
    <path d="M19 12.9a10 10 0 0 0-2-1.5" />
    <path d="M2 8.8a15 15 0 0 1 4.2-2.6" />
    <path d="M22 8.8a15 15 0 0 0-11.3-3.8" />
    <circle cx="12" cy="20" r="1.1" fill="currentColor" stroke="none" />
    <path d="M2 2l20 20" />
  </MiniIcon>
)
const AwardIcon = (p) => (
  <MiniIcon {...p}>
    <circle cx="12" cy="9" r="6" />
    <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" />
  </MiniIcon>
)

// Badge de ícono: cuadrado con tinte de acento, ícono en acento.
function IconBadge({ children }) {
  return (
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
      {children}
    </span>
  )
}

// Wordmark reutilizable (serif + marca libro).
function Wordmark({ size = 'sm' }) {
  const s = size === 'lg'
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className={`inline-flex items-center justify-center rounded-[12px] bg-accent ${
          s ? 'h-14 w-14' : 'h-9 w-9'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" width={s ? 34 : 22} height={s ? 34 : 22}>
          <g
            fill="none"
            stroke="var(--on-accent)"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z" />
            <path d="M32 20v28" />
          </g>
        </svg>
      </span>
      <span
        style={serif}
        className={`font-semibold tracking-[-0.01em] text-ink ${s ? 'text-[26px]' : 'text-[19px]'}`}
      >
        Lee Tu Biblia
      </span>
    </span>
  )
}

// Eyebrow en un sepia más profundo (mismo tono, mezclado con la tinta) para
// cumplir AA en texto chico; cae al acento puro donde no hay color-mix.
function Eyebrow({ children }) {
  return (
    <p className="info-eyebrow text-[13px] font-semibold uppercase tracking-[0.16em]">
      {children}
    </p>
  )
}

// ── Mock de la pantalla Hoy ──────────────────────────────────────────
// Evidencia de producto sin traicionar el principio: se ven las REFERENCIAS del
// día, nunca el texto bíblico — el mock demuestra la idea al lado del manifiesto.
function PhoneMock() {
  const today = new Date()
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  )
  return (
    <figure className="mx-auto w-fit">
      <div
        aria-hidden="true"
        className="rounded-[46px] border border-hairline bg-surface p-[10px]"
        style={{ boxShadow: '0 30px 60px -30px rgba(28, 28, 30, 0.25)' }}
      >
        <div className="flex h-[540px] w-[252px] flex-col overflow-hidden rounded-[36px] bg-app px-6 pb-4 pt-6">
          <div className="mx-auto mb-5 h-[5px] w-14 rounded-full bg-segment-track" />
          <p className="text-[10.5px] font-medium uppercase tracking-[0.6px] text-ink-soft">
            {today}
          </p>
          <p className="mt-1.5 text-[12px] font-semibold text-accent">
            Plan M’Cheyne · Día {dayOfYear}
          </p>
          <p className="mt-6 text-[11px] font-medium text-ink-soft">Lectura de hoy</p>
          <div className="mt-2 flex flex-col gap-[3px] text-[23px] font-medium leading-[1.28] tracking-[-0.4px] text-ink">
            <span>Jeremías 33</span>
            <span>Salmos 5–6</span>
            <span>Mateo 7</span>
            <span>Lucas 22</span>
          </div>
          <p className="mt-5 text-[11.5px] font-semibold text-accent">Racha de 12 días</p>
          <div className="flex-1" />
          <div className="rounded-[12px] bg-accent py-2.5 text-center text-[12.5px] font-semibold text-on-accent">
            Marcar como leído
          </div>
          <div className="mt-2 rounded-[12px] border border-hairline py-2 text-center text-[11.5px] font-medium text-ink">
            Abrir en mi app de Biblia ↗
          </div>
          <div className="mt-3 flex items-center justify-around border-t border-hairline pt-2.5">
            <BookIcon size={16} className="text-accent" />
            <HeartIcon size={16} style={{ color: 'var(--faint)' }} />
            <PeopleIcon size={16} style={{ color: 'var(--faint)' }} />
            <SlidersIcon size={16} style={{ color: 'var(--faint)' }} />
          </div>
        </div>
      </div>
      <figcaption className="mx-auto mt-5 max-w-[250px] text-center text-[13.5px] leading-snug text-ink-soft">
        Así se ve Hoy: tus pasajes del día. El texto queda en tu Biblia.
      </figcaption>
    </figure>
  )
}

// Funcionalidades agrupadas: tres clusters con jerarquía en vez de una grilla
// plana de nueve ítems idénticos (chunking ≤4 por grupo).
const CLUSTERS = [
  {
    label: 'Tu lectura',
    items: [
      { icon: <BookIcon size={22} />, name: '8 planes de lectura', desc: 'M’Cheyne, Cronológico, Proverbios y más. Uno a la vez, a tu ritmo.' },
      { icon: <ChartIcon size={22} />, name: 'Racha sin culpa', desc: 'Progreso visual y mapa de tus semanas. Sin presión si te atrasás.' },
      { icon: <PencilIcon size={22} />, name: 'Diario “Mi camino”', desc: 'Una línea de reflexión por día. Privado, solo tuyo.' },
      { icon: <BellIcon size={22} />, name: 'Recordatorio diario', desc: 'Una notificación a tu hora, para no perder el ritmo.' },
    ],
  },
  {
    label: 'Oración y grupo',
    items: [
      { icon: <HeartIcon size={22} />, name: 'Oración', desc: 'Pedidos propios o compartidos, con testimonios cuando Dios responde.' },
      { icon: <PeopleIcon size={22} />, name: 'Grupos', desc: 'Vean quién leyó hoy, oren juntos y celebren lo que Dios hace.' },
    ],
  },
  {
    label: 'Además',
    items: [
      { icon: <AwardIcon size={22} />, name: 'Tu recorrido', desc: 'Un resumen de tus logros y una imagen para compartir al terminar un plan.' },
      { icon: <PaletteIcon size={22} />, name: 'A tu gusto', desc: '12 acentos de color y modo claro u oscuro automático.' },
      { icon: <WifiOffIcon size={22} />, name: 'Funciona sin conexión', desc: 'Se instala como app y muestra tu lectura de hoy aún sin internet.' },
    ],
  },
]

const DISCIPULADO = [
  {
    icon: <LockIcon size={22} />,
    title: 'Grupos cerrados por código',
    desc: 'Creás un grupo privado y compartís un código corto. Nadie entra sin él.',
  },
  {
    icon: <BookIcon size={22} />,
    title: 'Quién leyó hoy',
    desc: 'Ves el pulso del grupo —cuántos abrieron su Biblia hoy— con respeto por quien prefiere no compartir.',
  },
  {
    icon: <HeartIcon size={22} />,
    title: 'Oración que se acompaña',
    desc: 'Pedidos compartidos, gente orando por cada uno, y testimonios cuando llega la respuesta.',
  },
  {
    icon: <CheckIcon size={22} strokeWidth={2} />,
    title: 'Resumen para el líder',
    desc: 'Un panorama del grupo para saber por quién preguntar y a quién animar esta semana.',
  },
]

function Steps({ title, steps }) {
  return (
    <div className="flex-1">
      <h3 className="mb-5 text-[15px] font-bold uppercase tracking-[0.08em] text-ink">
        {title}
      </h3>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-4">
            <span className="info-num mt-[1px] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white">
              {i + 1}
            </span>
            <span
              className="pt-1 text-[16px] leading-snug text-ink [&_b]:font-semibold [&_b]:text-accent"
              dangerouslySetInnerHTML={{ __html: s }}
            />
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function Info() {
  useEffect(() => {
    document.title = 'Lee Tu Biblia — Compañero de lectura bíblica y oración'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-app text-ink">
      {/* Ajustes solo de esta página: eyebrows y números de paso en un sepia más
          profundo (AA en texto chico) y CTAs que responden al cursor. */}
      <style>{`
        .info-eyebrow { color: var(--accent); }
        .info-num { background: var(--accent); }
        @supports (color: color-mix(in srgb, red 50%, blue)) {
          .info-eyebrow { color: color-mix(in srgb, var(--accent) 68%, var(--text-primary)); }
          .info-num { background: color-mix(in srgb, var(--accent) 72%, var(--text-primary)); }
        }
        .info-cta { transition: filter 0.15s ease, transform 0.15s ease; }
        .info-cta:hover { filter: brightness(0.94); }
        .info-cta:active { transform: translateY(1px); filter: brightness(0.9); }
      `}</style>

      {/* Barra superior — mínima, no fija. */}
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between px-6 py-6">
        <Wordmark />
        <Link
          to="/"
          className="rounded-pill px-3 py-2 text-[15px] font-semibold text-ink-soft transition-colors hover:text-accent"
        >
          Entrar
        </Link>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Viñeta de papel: acento apenas insinuado, no un gradiente de fondo. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
          style={{
            background:
              'radial-gradient(ellipse 620px 420px at 50% -8%, var(--accent-tint), transparent 70%)',
          }}
        />
        <div className="screen-enter relative mx-auto w-full max-w-[680px] px-6 pb-16 pt-10 text-center sm:pt-16">
          <Eyebrow>Compañero de lectura bíblica</Eyebrow>
          <h1
            style={serif}
            className="mx-auto mt-5 max-w-[560px] text-[40px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink [text-wrap:balance] sm:text-[52px]"
          >
            El hábito de abrir <span className="text-accent">tu Biblia</span>, sostenido día a día.
          </h1>
          <p className="mx-auto mt-6 max-w-[480px] text-[18px] leading-relaxed text-ink-soft">
            Tu plan, tu racha, tu diario y tus oraciones —solo o con tu grupo—
            para sostener la lectura en tu Biblia de papel. No es otro lector
            para la pantalla.
          </p>
          <div className="mx-auto mt-9 max-w-[300px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Empezá gratis
            </Link>
          </div>
          <p className="mt-5 text-[15px] font-medium text-ink-soft">
            Más de 100 lectores ya sostienen su hábito acá.
          </p>
          <p className="mt-1.5 text-[13px] text-ink-soft">
            Gratis · solo tu correo, sin contraseña · sin publicidad
          </p>
        </div>
      </section>

      {/* ── LA IDEA + PRODUCTO ───────────────────────────────── */}
      {/* El manifiesto al lado de la pantalla que lo demuestra: referencias sí,
          texto bíblico no. Único momento asimétrico de la página, a propósito. */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-16">
        <div className="border-t border-hairline pt-12 lg:flex lg:items-center lg:gap-16">
          <div className="lg:flex-1">
            <Eyebrow>La idea</Eyebrow>
            <p
              style={serif}
              className="mt-5 max-w-[560px] text-[24px] font-medium leading-[1.5] tracking-[-0.01em] text-ink sm:text-[27px]"
            >
              «Lee Tu Biblia» significa leé <span className="text-accent">tu</span>{' '}
              Biblia: la de papel, la que subrayás. La app no compite con ese
              momento —lo cuida. El texto vive en tus páginas; acá vive el hábito.
            </p>
            <p className="mt-6 max-w-[520px] text-[16px] leading-relaxed text-ink-soft">
              ¿Preferís leer en el celular? También. Con un toque te abrimos el
              pasaje del día en tu app de Biblia —la app no reemplaza ese momento,
              te acompaña hasta él.
            </p>
          </div>
          <div className="mt-12 shrink-0 lg:mt-0">
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ──────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-8">
        <Eyebrow>Qué incluye</Eyebrow>
        <h2
          style={serif}
          className="mt-4 text-[30px] font-semibold tracking-[-0.02em] text-ink [text-wrap:balance] sm:text-[34px]"
        >
          Todo lo que sostiene el hábito
        </h2>
        <div className="mt-10 flex flex-col gap-12">
          {CLUSTERS.map((c) => (
            <div key={c.label}>
              <h3 className="mb-6 border-b border-hairline pb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                {c.label}
              </h3>
              <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {c.items.map((f) => (
                  <div key={f.name} className="flex items-start gap-4">
                    <IconBadge>{f.icon}</IconBadge>
                    <div>
                      <p className="text-[17px] font-semibold text-ink">{f.name}</p>
                      <p className="mt-1 text-[15px] leading-snug text-ink-soft">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DISCIPULADO (sección propia, destacada) ──────────── */}
      <section className="mt-16 border-y border-hairline bg-surface-alt/60 py-20">
        <div className="mx-auto w-full max-w-[720px] px-6">
          <Eyebrow>Para líderes y pastores</Eyebrow>
          <h2
            style={serif}
            className="mt-4 max-w-[560px] text-[30px] font-semibold leading-[1.14] tracking-[-0.02em] text-ink [text-wrap:balance] sm:text-[36px]"
          >
            Una herramienta para discipular, no solo una app personal
          </h2>
          <p className="mt-6 max-w-[560px] text-[18px] leading-relaxed text-ink-soft">
            Rinde de verdad en comunidad. Si guiás una célula, un grupo de
            discipulado o una congregación, tenés lo necesario para caminar con
            tu gente en la Palabra —sin grupos de chat desbordados—, con la
            privacidad de cada uno como punto de partida.
          </p>

          <div className="mt-11 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {DISCIPULADO.map((d) => (
              <div key={d.title} className="flex items-start gap-4">
                <IconBadge>{d.icon}</IconBadge>
                <div>
                  <h3 className="text-[17px] font-semibold text-ink">{d.title}</h3>
                  <p className="mt-1 text-[15px] leading-snug text-ink-soft">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* El camino del líder: empezar cuesta un minuto. */}
          <div className="mt-12">
            <p className="text-[14px] font-medium text-ink-soft">
              Empezar con tu grupo lleva un minuto:
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[17px] font-semibold text-ink">
              <span>Creá el grupo</span>
              <span aria-hidden="true" className="text-accent">→</span>
              <span>Compartí el código</span>
              <span aria-hidden="true" className="text-accent">→</span>
              <span>Caminen juntos</span>
            </p>
          </div>

          <p className="mt-9 text-[15px] italic leading-relaxed text-ink-soft">
            Todo es opt-in: cada persona elige qué comparte con el grupo. Nadie
            queda expuesto.
          </p>
        </div>
      </section>

      {/* ── INSTALACIÓN ──────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-20">
        <Eyebrow>En 2 minutos</Eyebrow>
        <h2
          style={serif}
          className="mt-4 text-[30px] font-semibold tracking-[-0.02em] text-ink [text-wrap:balance] sm:text-[34px]"
        >
          Instalala como app
        </h2>
        <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-ink-soft">
          No hace falta ninguna tienda: ya estás en el lugar. Creá tu cuenta y
          agregala a tu pantalla de inicio.
        </p>
        <div className="mt-11 flex flex-col gap-12 sm:flex-row sm:gap-14">
          <Steps
            title="Android"
            steps={[
              'En Chrome, tocá el menú <b>⋮</b> arriba a la derecha',
              'Elegí <b>Instalar app</b>',
              'Confirmá — listo',
            ]}
          />
          <Steps
            title="iPhone"
            steps={[
              'En Safari, tocá el ícono de <b>Compartir</b>',
              'Elegí <b>Agregar a pantalla de inicio</b>',
              'Tocá <b>Agregar</b> — listo',
            ]}
          />
        </div>
        <p className="mt-9 max-w-[560px] text-[14px] leading-relaxed text-ink-soft">
          ¿Llegaste desde Instagram o Facebook? Tocá el menú del navegador
          interno y elegí «Abrir en Safari» (o Chrome) antes de instalar.
        </p>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2
            style={serif}
            className="text-[34px] font-semibold tracking-[-0.02em] text-ink sm:text-[40px]"
          >
            Empezá hoy
          </h2>
          <p className="mx-auto mt-4 max-w-[380px] text-[18px] leading-relaxed text-ink-soft">
            Sumate gratis y sostené tu lectura, un día a la vez.
          </p>
          <div className="mx-auto mt-8 max-w-[300px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Empezá gratis
            </Link>
          </div>

          {/* La firma que ya usa el splash de la app: landing y producto, unidos. */}
          <p
            style={serif}
            className="mx-auto mt-16 max-w-[420px] text-[19px] italic leading-relaxed text-ink-soft"
          >
            «Santifícalos en la verdad; Tu palabra es verdad.»
          </p>
          <p className="mt-2 text-[13px] text-ink-soft">Juan 17:17 · NBLA</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-3 px-6 py-10 text-center">
          <Wordmark />
          <p className="text-[13.5px] text-ink-soft">
            Hecho para acompañar tu lectura en la Palabra.
          </p>
        </div>
      </footer>
    </div>
  )
}
