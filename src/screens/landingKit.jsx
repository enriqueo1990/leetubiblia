import { BookIcon, HeartIcon, PeopleIcon, SlidersIcon, CheckIcon } from '../components/icons.jsx'

// Kit compartido por las landings públicas (/info y /grupos-de-discipulado): primitivos
// de marca, íconos y mocks de producto. Vive fuera del Gate. Concepto transversal:
// la app acompaña la Biblia FÍSICA, no la reemplaza (product-principle-physical-bible).
// Un solo acento sepia, la MISMA sans del sistema, aire en vez de tarjetas flotantes
// (design-canon). Toda landing debe montar <LandingStyle/> para las clases info-*.

// CSS local de las landings: eyebrows y números de paso en un sepia más profundo
// (AA en texto chico), CTAs que responden al cursor. Idéntico en todas las páginas.
export function LandingStyle() {
  return (
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
  )
}

// Íconos que la app aún no tiene, en el mismo trazo (1.7, currentColor).
export function MiniIcon({ children, size = 22 }) {
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
export const BellIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </MiniIcon>
)
export const PaletteIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M12 21a9 9 0 1 1 9-9c0 2-1 3-3 3h-1.5a1.5 1.5 0 0 0-1 2.6c.3.3.5.7.5 1.2 0 1.2-1 2.2-2 2.2z" />
    <circle cx="7.8" cy="10.3" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16.2" cy="10.3" r="1.1" fill="currentColor" stroke="none" />
  </MiniIcon>
)
export const WifiOffIcon = (p) => (
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
export const AwardIcon = (p) => (
  <MiniIcon {...p}>
    <circle cx="12" cy="9" r="6" />
    <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" />
  </MiniIcon>
)
export const HandsIcon = (p) => (
  <MiniIcon {...p}>
    <path d="M11 13V5.5a1.5 1.5 0 0 1 3 0V12" />
    <path d="M14 12V4a1.5 1.5 0 0 1 3 0v9" />
    <path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.4-3.4L4.3 15a1.5 1.5 0 0 1 2.6-1.5l1.1 1.9" />
    <path d="M11 13V6.5a1.5 1.5 0 0 0-3 0V15" />
  </MiniIcon>
)

// Badge de ícono: cuadrado con tinte de acento, ícono en acento.
export function IconBadge({ children }) {
  return (
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
      {children}
    </span>
  )
}

// Wordmark reutilizable (sans bold, como el onboarding de la app + marca libro).
export function Wordmark({ size = 'sm' }) {
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
        className={`font-bold tracking-[-0.02em] text-ink ${s ? 'text-[24px]' : 'text-[18px]'}`}
      >
        Lee Tu Biblia
      </span>
    </span>
  )
}

// Eyebrow en un sepia más profundo (mismo tono, mezclado con la tinta) para
// cumplir AA en texto chico; cae al acento puro donde no hay color-mix.
export function Eyebrow({ children }) {
  return (
    <p className="info-eyebrow text-[13px] font-semibold uppercase tracking-[0.16em]">
      {children}
    </p>
  )
}

// ── Mocks de producto ────────────────────────────────────────────────
// Marco de teléfono compartido. El texto bíblico NUNCA aparece dentro: se ven
// referencias, estado y oración, nunca la Escritura (que vive en la Biblia física).
export function PhoneFrame({ caption, active, children }) {
  const tabs = [BookIcon, HeartIcon, PeopleIcon, SlidersIcon]
  return (
    <figure className="mx-auto w-fit">
      <div
        aria-hidden="true"
        className="rounded-[46px] border border-hairline bg-surface p-[10px]"
        style={{ boxShadow: '0 30px 60px -30px rgba(28, 28, 30, 0.25)' }}
      >
        <div className="flex h-[540px] w-[252px] flex-col overflow-hidden rounded-[36px] bg-app px-6 pb-4 pt-6">
          <div className="mx-auto mb-5 h-[5px] w-14 rounded-full bg-segment-track" />
          {children}
          <div className="mt-3 flex items-center justify-around border-t border-hairline pt-2.5">
            {tabs.map((T, i) => (
              <T
                key={i}
                size={16}
                className={i === active ? 'text-accent' : undefined}
                style={i === active ? undefined : { color: 'var(--faint)' }}
              />
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mx-auto mt-5 max-w-[250px] text-center text-[13.5px] leading-snug text-ink-soft">
        {caption}
      </figcaption>
    </figure>
  )
}

// Pantalla Hoy: evidencia sin traicionar el principio — se ven las REFERENCIAS
// del día, nunca el texto bíblico. El mock demuestra la idea junto al manifiesto.
export function PhoneMock() {
  const today = new Date()
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  )
  return (
    <PhoneFrame
      active={0}
      caption="Así se ve Hoy: tus pasajes del día. El texto queda en tu Biblia."
    >
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
    </PhoneFrame>
  )
}

// Pantalla de grupo: el pulso de hoy, los miembros y el código — vuelve
// tangibles las afirmaciones de la sección de discipulado.
export function GroupMock() {
  const members = [
    { name: 'Ana', read: true },
    { name: 'Marcos', read: true },
    { name: 'Sofía', read: true },
    { name: 'David', read: false },
  ]
  return (
    <PhoneFrame
      active={2}
      caption="El grupo de un vistazo: el pulso de hoy y el código para invitar."
    >
      <p className="text-[10.5px] font-semibold text-accent">‹ Grupos</p>
      <p className="mt-2.5 text-[17px] font-bold tracking-[-0.3px] text-ink">Grupo Norte</p>
      <p className="mt-0.5 text-[10.5px] text-ink-soft">8 miembros · Sos el admin</p>
      <div className="card mt-4 rounded-[12px] px-3.5 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.8px] text-ink-soft">Hoy</p>
        <p className="mt-1 text-[12.5px] text-ink">
          <span className="font-semibold">3 leyeron hoy</span>
          <span className="text-ink-soft"> · 2 pedidos activos</span>
        </p>
      </div>
      <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.8px] text-ink-soft">
        Miembros · 8
      </p>
      <div className="mt-2 flex flex-col gap-2.5">
        {members.map((m) => (
          <div key={m.name} className="flex items-center gap-2.5">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent-tint text-[11px] font-semibold text-accent">
              {m.name[0]}
            </span>
            <span className="text-[12.5px] font-medium text-ink">{m.name}</span>
            {m.read ? (
              <CheckIcon size={13} strokeWidth={2.4} className="ml-auto text-accent" />
            ) : (
              <span className="ml-auto text-[10px] text-ink-soft">aún no</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex-1" />
      <div className="card rounded-[12px] px-3.5 py-3">
        <p className="text-[8.5px] font-semibold uppercase tracking-[0.8px] text-ink-soft">
          Código de invitación
        </p>
        <p className="mt-1 text-[15px] font-bold tracking-[2px] text-ink">CN-7K9Q</p>
      </div>
    </PhoneFrame>
  )
}

// Pantalla de Oración del grupo: pedidos compartidos con gente orando y un
// testimonio cuando llega la respuesta. Vocabulario real de la app (Estoy
// orando / Orando / Testimonio). Solo se señala lo positivo, sin exponer a nadie.
export function PrayerMock() {
  return (
    <PhoneFrame
      active={1}
      caption="Oración del grupo: pedidos que se acompañan y testimonios que se celebran."
    >
      <p className="text-[10.5px] font-semibold text-accent">‹ Oración</p>
      <p className="mt-2.5 text-[17px] font-bold tracking-[-0.3px] text-ink">
        Pedidos del grupo
      </p>
      <p className="mt-0.5 text-[10.5px] text-ink-soft">Grupo Norte · 5 orando esta semana</p>

      <div className="card mt-4 rounded-[12px] px-3.5 py-3">
        <p className="text-[12.5px] font-medium leading-snug text-ink">
          Por la salud de mamá
        </p>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[10px] text-ink-soft">Marcos · 4 orando</span>
          <span className="rounded-full bg-accent px-2.5 py-1 text-[9.5px] font-semibold text-on-accent">
            Estoy orando
          </span>
        </div>
      </div>

      <div className="card mt-2.5 rounded-[12px] px-3.5 py-3">
        <p className="text-[12.5px] font-medium leading-snug text-ink">
          Entrevista de trabajo el jueves
        </p>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[10px] text-ink-soft">Sofía · 6 orando</span>
          <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[9.5px] font-semibold text-accent">
            Orando ✓
          </span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="rounded-[12px] border border-accent/40 bg-accent-tint px-3.5 py-3">
        <p className="text-[8.5px] font-semibold uppercase tracking-[0.8px] text-accent">
          Testimonio
        </p>
        <p className="mt-1 text-[12px] leading-snug text-ink">
          «Salió el trabajo. Gracias por orar 🙏»
        </p>
      </div>
    </PhoneFrame>
  )
}
