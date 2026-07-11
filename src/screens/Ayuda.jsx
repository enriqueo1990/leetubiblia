import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookIcon,
  HeartIcon,
  PeopleIcon,
  ChartIcon,
  PencilIcon,
  LockIcon,
  CheckIcon,
  RefreshIcon,
} from '../components/icons.jsx'
import {
  LandingStyle,
  LandingFooter,
  IconBadge,
  Wordmark,
  Eyebrow,
  PhoneMock,
  GroupMock,
  PrayerMock,
  BellIcon,
  PaletteIcon,
  WifiOffIcon,
  AwardIcon,
  HandsIcon,
} from './landingKit.jsx'

// Página pública /ayuda — la REFERENCIA de la app (ver App.jsx, fuera del Gate).
// No es captación: es el manual al que se entra desde Ajustes → Guía de la app,
// pestaña por pestaña, con los 8 planes y los materiales. /info engancha en frío
// y es corta; /ayuda es exhaustiva. Mismo canon que toda página pública: un solo
// acento sepia, la MISMA sans del sistema, ancho de lectura acotado, aire en vez
// de tarjetas flotantes (design-canon). El texto bíblico NUNCA se muestra: la app
// acompaña la Biblia física, no la reemplaza (product-principle-physical-bible).

const HOY = [
  { icon: <BookIcon size={22} />, name: 'La lectura de hoy', desc: 'Cada mañana ves solo las referencias del día, grandes y claras. Una pantalla, una tarea.' },
  { icon: <CheckIcon size={22} strokeWidth={2} />, name: 'Marcar como leído', desc: 'Un toque y queda registrado. Si te atrasás, la app te lo dice sin culpa y podés reprogramar.' },
  { icon: <BookIcon size={22} />, name: 'Abrir en tu app de Biblia', desc: 'Un botón te lleva al capítulo exacto del día en tu app de Biblia (NBLA). Igual, la lectura la hacés en tu Biblia.' },
  { icon: <ChartIcon size={22} />, name: 'Progreso sin culpa', desc: 'Tu racha, el porcentaje completado y un mapa de las últimas cinco semanas. Tocá un día pasado para marcar lo que ya leíste.' },
  { icon: <AwardIcon size={22} />, name: 'Tu recorrido', desc: 'Un resumen de tus logros en la Palabra. Al terminar un plan, festejo y un logro para compartir.' },
  { icon: <PencilIcon size={22} />, name: 'Mi camino', desc: 'Un diario para anotar lo que Dios te va hablando en la lectura. Privado, solo tuyo.' },
]

// Los 8 planes sembrados (supabase/migrations, reading_plans). Uno activo a la vez.
const PLANES = [
  { name: 'M’Cheyne', desc: 'Toda la Biblia en un año, cuatro pasajes por día.', dur: '365 días' },
  { name: 'Antiguo y Nuevo Testamento', desc: 'Un pasaje de cada uno cada día, toda la Biblia en un año.', dur: '365 días' },
  { name: 'De Génesis a Apocalipsis', desc: 'Toda la Biblia en orden, de principio a fin.', dur: '365 días' },
  { name: 'Cronológico', desc: 'La Biblia en el orden en que ocurrieron los hechos.', dur: '365 días' },
  { name: 'Nuevo Testamento en 24 semanas', desc: 'El Nuevo Testamento completo, a buen ritmo.', dur: '168 días' },
  { name: 'Proverbios en 31 días', desc: 'Un capítulo de Proverbios por día del mes.', dur: '31 días' },
  { name: '40 días con Dios', desc: 'Lecturas breves para crecer en la fe.', dur: '40 días' },
  { name: 'Oficio Diario (Libro de Oración Común)', desc: 'Leccionario litúrgico de dos años: salmos y lecturas cada día.', dur: '2 años' },
]

const MATERIALES = [
  'Catecismo Menor de Westminster',
  'Catecismo de Heidelberg',
  'Catecismo de Spurgeon',
  'Catecismo para Niños de Spurgeon',
  'Catecismo de Keach',
  'Cánones de Dort',
]

const ORACION = [
  { icon: <HeartIcon size={22} />, name: 'Pedidos de oración', desc: 'Anotá por quién y por qué estás orando, y volvé a verlo cuando quieras.' },
  { icon: <PeopleIcon size={22} />, name: 'Privado o compartido', desc: 'Guardalo solo para vos, o compartilo con tu grupo para orar juntos.' },
  { icon: <HandsIcon size={22} />, name: 'Orar ahora', desc: 'Un modo para recorrer los pedidos —los tuyos y los del grupo— uno por uno, orando por cada uno con calma.' },
  { icon: <RefreshIcon size={22} />, name: 'Cómo sigue cada pedido', desc: 'El autor cuenta las novedades —«entró a cirugía», «salió bien»— y el grupo acompaña los pedidos largos sin que se apaguen.' },
  { icon: <BellIcon size={22} />, name: 'Cuánto vive el pedido', desc: 'Vos elegís por cuánto tiempo permanece: un día, una semana, un mes o siempre.' },
]

const GRUPOS = [
  { icon: <LockIcon size={22} />, name: 'Uníte con un código', desc: 'Los grupos son privados. Se entra con un código corto; solo los miembros ven lo de adentro.' },
  { icon: <BookIcon size={22} />, name: 'Un plan en común', desc: 'El líder elige un plan para todo el grupo. Cada uno decide cómo sumarse: hacerlo su plan principal, o seguirlo en Hoy como lectura adicional sin soltar el propio. Así leen lo mismo, el mismo día.' },
  { icon: <HeartIcon size={22} />, name: 'Pedidos del grupo', desc: 'Vean y oren juntos por los pedidos que cada uno decide compartir, con testimonios cuando llega la respuesta.' },
  { icon: <ChartIcon size={22} />, name: 'Pulso de lectura', desc: 'Si lideras, ves quién viene leyendo, con el historial de los últimos siete días de cada miembro. Para acompañar, no vigilar.' },
  { icon: <CheckIcon size={22} strokeWidth={2} />, name: 'Resumen para el líder', desc: 'Un panorama del grupo para saber por quién preguntar y a quién animar esta semana.' },
]

const AJUSTES = [
  { icon: <PaletteIcon size={22} />, name: 'Tu color de acento', desc: 'El acento es el único color de la app. Elegí entre 12 tonos: 6 sepia y 6 pastel.' },
  { icon: <SunIcon size={22} />, name: 'Claro y oscuro', desc: 'Sigue el modo de tu teléfono. En oscuro, negro puro que descansa la vista.' },
  { icon: <BellIcon size={22} />, name: 'Recordatorio diario', desc: 'Una notificación a tu hora, para no perder el ritmo.' },
  { icon: <WifiOffIcon size={22} />, name: 'Funciona sin conexión', desc: 'Se instala como app y muestra tu lectura de hoy aún sin internet.' },
]

// Ícono de sol/luna (claro-oscuro) en el mismo trazo del kit; local a esta página.
function SunIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

// Rejilla de funciones: badge + nombre + descripción. Aire, sin tarjetas flotantes.
function FeatureGrid({ items }) {
  return (
    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
      {items.map((f) => (
        <div key={f.name} className="flex items-start gap-4">
          <IconBadge>{f.icon}</IconBadge>
          <div>
            <p className="text-[17px] font-semibold text-ink">{f.name}</p>
            <p className="mt-1 text-[15px] leading-snug text-ink-soft">{f.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Encabezado de sección de pestaña: eyebrow + título grande.
function TabHead({ eyebrow, title, intro }) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 max-w-[560px] text-[28px] font-bold leading-[1.14] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[32px]">
        {title}
      </h2>
      {intro && (
        <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-ink-soft">{intro}</p>
      )}
    </>
  )
}

export default function Ayuda() {
  useEffect(() => {
    document.title = 'Lee Tu Biblia — Guía completa de la app'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-app text-ink">
      <LandingStyle />

      {/* Barra superior — mínima, no fija. */}
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between px-6 py-6">
        <Wordmark />
        <Link
          to="/"
          className="rounded-pill px-3 py-2 text-[15px] font-semibold text-ink-soft transition-colors hover:text-accent-ink"
        >
          Entrar
        </Link>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background:
              'radial-gradient(ellipse 620px 420px at 50% -8%, var(--accent-tint), transparent 70%)',
          }}
        />
        <div className="screen-enter relative mx-auto w-full max-w-[680px] px-6 pb-14 pt-10 text-center sm:pt-16">
          <Eyebrow>Guía completa</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-[560px] text-[38px] font-bold leading-[1.12] tracking-[-0.03em] text-ink [text-wrap:balance] sm:text-[46px]">
            Todo lo que hace <span className="whitespace-nowrap text-accent-ink">Lee Tu Biblia</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[500px] text-[18px] leading-relaxed text-ink-soft">
            Un recorrido por cada función, pestaña por pestaña: tu lectura, la
            oración, los grupos de discipulado y los detalles a tu gusto. La
            Palabra la leés en tu Biblia de papel; la app acompaña el hábito.
          </p>
          {/* Índice de las cuatro pestañas. */}
          <div className="mx-auto mt-9 flex max-w-[440px] flex-wrap justify-center gap-2">
            {[
              ['Hoy', '#hoy'],
              ['Oración', '#oracion'],
              ['Grupos', '#grupos'],
              ['Ajustes', '#ajustes'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="info-cta rounded-pill bg-surface-alt px-4 py-2 text-[14px] font-semibold text-ink-soft transition-colors hover:text-accent-ink"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOY / LECTURA ────────────────────────────────────── */}
      <section id="hoy" className="mx-auto w-full max-w-[880px] scroll-mt-6 px-6 py-16">
        <div className="border-t border-hairline pt-12 lg:flex lg:items-start lg:gap-16">
          <div className="lg:flex-1">
            <TabHead
              eyebrow="Pestaña · Hoy"
              title="Tu lectura del día, sin ruido"
              intro="El corazón de la app. Cada mañana ves qué toca leer; un toque para marcarlo y tu avance se cuida solo, sin regaños."
            />
            <div className="mt-10">
              <FeatureGrid items={HOY} />
            </div>
          </div>
          <div className="mt-12 shrink-0 lg:mt-0">
            <PhoneMock />
          </div>
        </div>

        {/* Los 8 planes. */}
        <div className="mt-16 border-t border-hairline pt-12">
          <Eyebrow>Planes de lectura</Eyebrow>
          <h3 className="mt-4 text-[22px] font-bold tracking-[-0.02em] text-ink sm:text-[25px]">
            Ocho planes, uno para cada temporada
          </h3>
          <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-ink-soft">
            Desde 31 días hasta dos años. Un plan activo a la vez, para no dispersarte.
          </p>
          <ul className="mt-8 flex flex-col">
            {PLANES.map((p) => (
              <li
                key={p.name}
                className="flex items-baseline justify-between gap-4 border-t border-hairline py-4 first:border-t-0"
              >
                <div>
                  <p className="text-[16.5px] font-semibold text-ink">{p.name}</p>
                  <p className="mt-0.5 text-[14.5px] leading-snug text-ink-soft">{p.desc}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-accent-ink">
                  {p.dur}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Materiales. */}
        <div className="mt-16 border-t border-hairline pt-12">
          <Eyebrow>Materiales opcionales</Eyebrow>
          <h3 className="mt-4 text-[22px] font-bold tracking-[-0.02em] text-ink sm:text-[25px]">
            Para enriquecer tu tiempo
          </h3>
          <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-ink-soft">
            Catecismos y confesiones históricas que acompañan la lectura, cada uno con su breve introducción.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {MATERIALES.map((m) => (
              <span
                key={m}
                className="rounded-pill bg-accent-tint px-4 py-2 text-[14px] font-semibold text-accent-ink"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── ORACIÓN ──────────────────────────────────────────── */}
      <section id="oracion" className="scroll-mt-6 border-y border-hairline bg-surface-alt/60 py-20">
        <div className="mx-auto w-full max-w-[880px] px-6 lg:flex lg:items-start lg:gap-16">
          <div className="lg:order-2 lg:flex-1">
            <TabHead
              eyebrow="Pestaña · Oración"
              title="Lo que estás pidiendo, en un solo lugar"
              intro="Anotá tus pedidos y volvé a ellos. Guardalos para vos o compartilos con tu gente, acompañá cómo sigue cada uno y celebren juntos la respuesta."
            />
            <div className="mt-10">
              <FeatureGrid items={ORACION} />
            </div>
          </div>
          <div className="mt-12 shrink-0 lg:order-1 lg:mt-0">
            <PrayerMock />
          </div>
        </div>
      </section>

      {/* ── GRUPOS ───────────────────────────────────────────── */}
      <section id="grupos" className="mx-auto w-full max-w-[880px] scroll-mt-6 px-6 py-20">
        <div className="lg:flex lg:items-start lg:gap-16">
          <div className="lg:flex-1">
            <TabHead
              eyebrow="Pestaña · Grupos"
              title="Nadie camina solo"
              intro="Grupos cerrados de discipulado. Se entra por código y nada es público: leen un mismo plan, oran juntos y se acompañan en el camino."
            />
            <div className="mt-10">
              <FeatureGrid items={GRUPOS} />
            </div>
          </div>
          <div className="mt-12 shrink-0 lg:mt-0">
            <GroupMock />
          </div>
        </div>
      </section>

      {/* ── AJUSTES ──────────────────────────────────────────── */}
      <section id="ajustes" className="scroll-mt-6 border-t border-hairline">
        <div className="mx-auto w-full max-w-[720px] px-6 py-20">
          <TabHead
            eyebrow="Pestaña · Ajustes"
            title="Tuya, a tu manera"
            intro="Pequeños detalles para que la app se sienta propia y descanse la vista."
          />
          <div className="mt-10">
            <FeatureGrid items={AJUSTES} />
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2 className="text-[32px] font-bold tracking-[-0.025em] text-ink sm:text-[38px]">
            Esta mañana, abrí tu Biblia
          </h2>
          <p className="mx-auto mt-4 max-w-[400px] text-[18px] leading-relaxed text-ink-soft">
            Lee Tu Biblia te acompaña el resto: el plan, la racha, la oración y tu gente.
          </p>
          <div className="mx-auto mt-8 max-w-[300px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Empezá gratis
            </Link>
          </div>
          <p className="mt-5 text-[14px] text-ink-soft">
            ¿Querés la versión corta?{' '}
            <Link to="/info" className="font-semibold text-accent-ink">
              Mirá la presentación
            </Link>
          </p>

          <p className="mx-auto mt-16 max-w-[420px] text-[17px] italic leading-relaxed text-ink-soft">
            «Santifícalos en la verdad; Tu palabra es verdad.»
          </p>
          <p className="mt-2 text-[13px] text-ink-soft">Juan 17:17 · NBLA</p>
        </div>
      </section>

      {/* ── FOOTER GLOBAL ────────────────────────────────────── */}
      <LandingFooter current="/ayuda" />
    </div>
  )
}
