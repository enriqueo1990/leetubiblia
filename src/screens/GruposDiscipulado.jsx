import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookIcon, HeartIcon, PeopleIcon, LockIcon, CheckIcon } from '../components/icons.jsx'
import {
  LandingStyle,
  Wordmark,
  Eyebrow,
  IconBadge,
  GroupMock,
  PrayerMock,
  BellIcon,
  HandsIcon,
} from './landingKit.jsx'

// Landing pública /grupos-de-discipulado — hermana de /info (ver App.jsx), fuera del
// Gate. Le habla directamente al LÍDER de grupo de discipulado:
// cómo usar la app para (1) animarse mutuamente a leer la Biblia y (2) orar
// juntos por peticiones y celebrar testimonios. Mismo lenguaje de diseño que
// /info vía landingKit; el principio sigue en pie: la app acompaña la Biblia
// FÍSICA (product-principle-physical-bible), no la reemplaza. Solo se señala lo
// positivo, y todo es opt-in: nadie queda expuesto.

// Los dos pilares para el líder, cada uno con su pantalla.
const PILAR_LECTURA = [
  {
    icon: <BookIcon size={22} />,
    title: 'Todos en el mismo plan',
    desc: 'El grupo lee el mismo plan, al mismo ritmo. Hay de qué hablar cuando se juntan.',
  },
  {
    icon: <CheckIcon size={22} strokeWidth={2} />,
    title: 'La semana de cada uno, de un vistazo',
    desc: 'Ves quién marcó su lectura hoy y en los últimos 7 días —solo lo ves vos, y no perdés el pulso aunque un día no entres.',
  },
  {
    icon: <HeartIcon size={22} />,
    title: 'Animar, no vigilar',
    desc: 'Un vistazo te dice a quién escribirle esta semana para darle un empujón con cariño.',
  },
  {
    icon: <BellIcon size={22} />,
    title: 'El recordatorio lo pone la app',
    desc: 'Cada quien recibe su aviso diario. Vos no tenés que hacer de despertador del grupo.',
  },
]

const PILAR_ORACION = [
  {
    icon: <HeartIcon size={22} />,
    title: 'Pedidos que se comparten',
    desc: 'Cada quien sube su pedido al grupo; los demás ven por qué orar durante la semana.',
  },
  {
    icon: <HandsIcon size={22} />,
    title: '“Estoy orando”',
    desc: 'Con un toque, quien ora lo marca. La persona sabe que no está sola en su pedido.',
  },
  {
    icon: <PeopleIcon size={22} />,
    title: 'Testimonios que se celebran',
    desc: 'Cuando Dios responde, el pedido se vuelve testimonio y el grupo lo celebra junto.',
  },
]

// El ritmo semanal sugerido para el líder — cuatro pasos, no una lista larga.
const RITMO = [
  'Creás el grupo y elegís un <b>plan de lectura</b> para todos',
  'Compartís el <b>código</b> por WhatsApp; cada uno entra en un toque',
  'Durante la semana <b>leen</b> y <b>comparten pedidos</b>; oran unos por otros',
  'Al juntarse, repasan lo leído y <b>celebran los testimonios</b>',
]

function Pilar({ eyebrow, title, intro, points, mock, mockSide = 'right' }) {
  const left = mockSide === 'left'
  return (
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 max-w-[560px] text-[26px] font-bold leading-[1.16] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[32px]">
        {title}
      </h2>
      <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-ink-soft sm:text-[18px]">
        {intro}
      </p>
      <div className="mt-11 lg:flex lg:items-center lg:gap-16">
        <div className={`lg:flex-1 ${left ? 'lg:order-2' : ''}`}>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-1">
            {points.map((p) => (
              <div key={p.title} className="flex items-start gap-4">
                <IconBadge>{p.icon}</IconBadge>
                <div>
                  <h3 className="text-[17px] font-semibold text-ink">{p.title}</h3>
                  <p className="mt-1 text-[15px] leading-snug text-ink-soft">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={`mt-12 shrink-0 lg:mt-0 ${left ? 'lg:order-1' : ''}`}>{mock}</div>
      </div>
    </div>
  )
}

export default function GruposDiscipulado() {
  useEffect(() => {
    document.title = 'Lee Tu Biblia — Para líderes de grupos de discipulado'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-app text-ink">
      <LandingStyle />

      {/* Barra superior — mínima, no fija. */}
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between px-6 py-6">
        <Link to="/info" aria-label="Lee Tu Biblia">
          <Wordmark />
        </Link>
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
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
          style={{
            background:
              'radial-gradient(ellipse 620px 420px at 50% -8%, var(--accent-tint), transparent 70%)',
          }}
        />
        <div className="screen-enter relative mx-auto w-full max-w-[680px] px-6 pb-16 pt-10 text-center sm:pt-16">
          <Eyebrow>Para líderes de grupos de discipulado</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-[580px] text-[36px] font-bold leading-[1.13] tracking-[-0.03em] text-ink [text-wrap:balance] sm:text-[46px]">
            Guiá a tu grupo en la Palabra, <span className="text-accent-ink">sin chats desbordados</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-[500px] text-[18px] leading-relaxed text-ink-soft">
            Un lugar tranquilo para que tu grupo de discipulado lea la Biblia al
            mismo ritmo, se anime mutuamente y ore junto por sus pedidos —cada
            quien en su Biblia de papel, vos acompañando el camino.
          </p>
          <div className="mx-auto mt-9 max-w-[320px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Creá tu grupo gratis
            </Link>
          </div>
          <p className="mt-5 text-[15px] font-medium text-ink-soft">
            Creás el grupo en un minuto y compartís un código. Nada de instalar nada raro.
          </p>
          <p className="mt-1.5 text-[13px] text-ink-soft">
            Gratis · privado por código · sin publicidad
          </p>
        </div>
      </section>

      {/* ── EL PORQUÉ ────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-8">
        <div className="border-t border-hairline pt-12">
          <Eyebrow>Por qué</Eyebrow>
          <p className="mt-5 max-w-[580px] text-[22px] font-medium leading-[1.5] tracking-[-0.02em] text-ink sm:text-[25px]">
            Liderar un grupo no debería ser perseguir gente por WhatsApp. La app
            se ocupa del <span className="text-accent-ink">ritmo</span> —quién leyó,
            por quién orar— para que vos te ocupes de lo que importa:{' '}
            <span className="text-accent-ink">la gente</span>.
          </p>
          <p className="mt-6 max-w-[540px] text-[16px] leading-relaxed text-ink-soft">
            No es otro lector de Biblia para la pantalla. El texto vive en la
            Biblia de cada uno; acá vive el hábito que sostienen juntos.
          </p>
        </div>
      </section>

      {/* ── PILAR 1 · LEER JUNTOS ────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-16">
        <Pilar
          eyebrow="Animarse a leer"
          title="Que nadie camine solo en la lectura"
          intro="Todo el grupo en el mismo plan, avanzando a la par. Vos ves el pulso de la semana y sabés a quién darle un empujón —siempre desde el ánimo, nunca desde el control."
          points={PILAR_LECTURA}
          mock={<GroupMock />}
          mockSide="left"
        />
      </section>

      {/* ── PILAR 2 · ORAR JUNTOS ────────────────────────────── */}
      <section className="border-y border-hairline bg-surface-alt/60 py-20">
        <div className="mx-auto w-full max-w-[880px] px-6">
          <Pilar
            eyebrow="Orar juntos"
            title="Pedidos que se acompañan, respuestas que se celebran"
            intro="Cada quien comparte su pedido con el grupo. Los demás oran y lo marcan, para que nadie cargue solo. Y cuando Dios responde, el pedido se vuelve testimonio que celebran juntos."
            points={PILAR_ORACION}
            mock={<PrayerMock />}
            mockSide="right"
          />
        </div>
      </section>

      {/* ── RITMO SEMANAL ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-20">
        <Eyebrow>El ritmo de la semana</Eyebrow>
        <h2 className="mt-4 text-[28px] font-bold tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[32px]">
          Un ritmo simple para tu grupo
        </h2>
        <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-ink-soft">
          No hace falta un método complicado. Con estos cuatro pasos tu grupo
          camina en la Palabra semana a semana.
        </p>
        <ol className="mt-10 flex flex-col gap-4">
          {RITMO.map((s, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="info-num mt-[1px] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white">
                {i + 1}
              </span>
              <span
                className="pt-1 text-[16px] leading-snug text-ink [&_b]:font-semibold [&_b]:text-accent-ink"
                dangerouslySetInnerHTML={{ __html: s }}
              />
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[16px] text-ink-soft">
          ¿Querés verlo por dentro?{' '}
          <Link to="/guia-lideres" className="font-semibold text-accent-ink hover:underline">
            Mirá la guía, con capturas reales
          </Link>
        </p>
      </section>

      {/* ── PRIVACIDAD ───────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 pb-8">
        <div className="rounded-card border border-hairline bg-surface-alt/60 px-7 py-8">
          <div className="flex items-start gap-4">
            <IconBadge>
              <LockIcon size={22} />
            </IconBadge>
            <div>
              <h3 className="text-[18px] font-bold tracking-[-0.02em] text-ink">
                Privado por diseño, opt-in siempre
              </h3>
              <p className="mt-2 max-w-[540px] text-[15.5px] leading-relaxed text-ink-soft">
                El grupo es cerrado: nadie entra sin el código. Cada persona
                elige qué comparte —su lectura, sus pedidos— y qué se guarda para
                sí. Ante el grupo solo se señala lo positivo; la semana completa
                la ve únicamente el líder, y solo de quienes comparten su
                lectura. Nadie queda expuesto por atrasarse.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2 className="text-[32px] font-bold tracking-[-0.025em] text-ink sm:text-[38px]">
            Empezá con tu grupo hoy
          </h2>
          <p className="mx-auto mt-4 max-w-[420px] text-[18px] leading-relaxed text-ink-soft">
            Creá el grupo, compartí el código y caminen juntos en la Palabra.
          </p>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[17px] font-semibold text-ink">
            <span>Creá el grupo</span>
            <span aria-hidden="true" className="text-accent-ink">→</span>
            <span>Compartí el código</span>
            <span aria-hidden="true" className="text-accent-ink">→</span>
            <span>Caminen juntos</span>
          </p>
          <div className="mx-auto mt-9 max-w-[320px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Creá tu grupo gratis
            </Link>
          </div>
          <p className="mt-4 text-[14px] text-ink-soft">
            ¿Querés ver todo lo que incluye la app?{' '}
            <Link to="/info" className="font-semibold text-accent-ink hover:underline">
              Conocé Lee Tu Biblia
            </Link>
          </p>

          <p className="mx-auto mt-16 max-w-[460px] text-[17px] italic leading-relaxed text-ink-soft">
            «Y considerémonos unos a otros para estimularnos al amor y a las
            buenas obras.»
          </p>
          <p className="mt-2 text-[13px] text-ink-soft">Hebreos 10:24 · NBLA</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-3 px-6 py-10 text-center">
          <Link to="/info" aria-label="Lee Tu Biblia">
            <Wordmark />
          </Link>
          <p className="text-[13.5px] text-ink-soft">
            Hecho para acompañar a tu grupo en la Palabra.
          </p>
        </div>
      </footer>
    </div>
  )
}
