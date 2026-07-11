import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookIcon, HeartIcon, PeopleIcon, LockIcon, PencilIcon } from '../components/icons.jsx'
import { LandingStyle, LandingFooter, Wordmark, Eyebrow, IconBadge, BellIcon } from './landingKit.jsx'

// Página pública /privacidad — la capa de confianza del sitio (ver App.jsx, fuera
// del Gate). Enlazada desde el footer global de todas las páginas. Está redactada
// contra el comportamiento REAL de la app (Supabase; correo sin contraseña;
// privado por defecto; opt-in en grupos; borrado en cascada desde Ajustes →
// Eliminar cuenta, migración 0006). Tono pastoral y claro, no jurídico: nada de
// prometer lo que la app no hace. Mismo canon de diseño vía landingKit.

const CONTACTO = 'enrique.o1990@gmail.com'
const ACTUALIZADO = '11 de julio de 2026'

// Qué guardamos y para qué — anclado a las tablas reales del backend.
const DATOS = [
  {
    icon: <PeopleIcon size={22} />,
    title: 'Tu cuenta',
    desc: 'Tu correo y un nombre para mostrar. El correo es solo para entrar y para avisos del servicio; nunca para publicidad.',
  },
  {
    icon: <BookIcon size={22} />,
    title: 'Tu lectura y tu progreso',
    desc: 'Qué plan seguís, qué días marcaste como leídos y tu racha. Sirve para mostrarte tu avance y la lectura de hoy.',
  },
  {
    icon: <PencilIcon size={22} />,
    title: 'Tu diario “Mi camino”',
    desc: 'Las reflexiones que anotás. Son privadas: solo vos las ves. No se comparten con nadie, nunca.',
  },
  {
    icon: <HeartIcon size={22} />,
    title: 'Tu oración',
    desc: 'Tus pedidos, sus novedades y quién está orando. Cada pedido es privado salvo que vos elijas compartirlo con un grupo.',
  },
  {
    icon: <PeopleIcon size={22} />,
    title: 'Tus grupos',
    desc: 'Los grupos de los que sos parte y tu preferencia de qué compartís en ellos. Los grupos son cerrados: se entra por código.',
  },
  {
    icon: <BellIcon size={22} />,
    title: 'El recordatorio diario',
    desc: 'Si lo activás, guardamos lo justo para enviarte la notificación a tu hora. Lo apagás cuando quieras desde Ajustes.',
  },
]

export default function Privacidad() {
  useEffect(() => {
    document.title = 'Lee Tu Biblia — Privacidad'
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
          Abrir la app
        </Link>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{
            background:
              'radial-gradient(ellipse 620px 420px at 50% -8%, var(--accent-tint), transparent 70%)',
          }}
        />
        <div className="screen-enter relative mx-auto w-full max-w-[680px] px-6 pb-12 pt-10 text-center sm:pt-16">
          <Eyebrow>Privacidad</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-[520px] text-[34px] font-bold leading-[1.14] tracking-[-0.03em] text-ink [text-wrap:balance] sm:text-[42px]">
            Tu vida con Dios es <span className="text-accent-ink">tuya</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[500px] text-[18px] leading-relaxed text-ink-soft">
            Lo que leés, lo que anotás y por lo que orás te pertenece. Acá te
            contamos —en simple— qué guardamos, qué es privado y cómo tenés el
            control. Sin letra chica.
          </p>
        </div>
      </section>

      {/* ── LO ESENCIAL ──────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-8">
        <div className="rounded-card border border-hairline bg-surface-alt/60 px-7 py-8">
          <Eyebrow>Lo esencial</Eyebrow>
          <ul className="mt-5 flex flex-col gap-3 text-[16.5px] leading-snug text-ink">
            <li className="flex items-start gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
              La app es <b className="font-semibold text-accent-ink">gratis</b> y no tiene publicidad.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
              <span><b className="font-semibold text-accent-ink">No vendemos</b> tus datos ni se los pasamos a terceros para marketing.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
              Todo es <b className="font-semibold text-accent-ink">privado por defecto</b>. Se comparte solo lo que vos elegís compartir.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
              Podés <b className="font-semibold text-accent-ink">borrar tu cuenta y todos tus datos</b> cuando quieras, desde la app.
            </li>
          </ul>
        </div>
      </section>

      {/* ── QUÉ GUARDAMOS ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-12">
        <div className="border-t border-hairline pt-12">
          <Eyebrow>Qué guardamos y para qué</Eyebrow>
          <h2 className="mt-4 max-w-[560px] text-[26px] font-bold leading-[1.16] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">
            Solo lo necesario para que la app funcione
          </h2>
          <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-ink-soft">
            Guardamos lo justo para sostener tu hábito de lectura y tu vida de
            oración —nada más—. Esto es todo:
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {DATOS.map((d) => (
              <div key={d.title} className="flex items-start gap-4">
                <IconBadge>{d.icon}</IconBadge>
                <div>
                  <h3 className="text-[17px] font-semibold text-ink">{d.title}</h3>
                  <p className="mt-1 text-[15px] leading-snug text-ink-soft">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVADO Y COMPARTIDO ─────────────────────────────── */}
      <section className="border-y border-hairline bg-surface-alt/60 py-20">
        <div className="mx-auto w-full max-w-[720px] px-6">
          <div className="flex items-start gap-4">
            <IconBadge>
              <LockIcon size={22} />
            </IconBadge>
            <div>
              <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink sm:text-[25px]">
                Qué es privado y qué se comparte
              </h2>
              <div className="mt-5 flex flex-col gap-4 text-[16px] leading-relaxed text-ink-soft">
                <p>
                  Por defecto, <b className="font-semibold text-accent-ink">nada de lo tuyo es visible para otros</b>.
                  Tu diario es siempre privado. Tus pedidos de oración son
                  privados hasta que vos decidís compartir uno con un grupo.
                </p>
                <p>
                  En un grupo, <b className="font-semibold text-accent-ink">cada persona elige qué comparte</b>:
                  su lectura, sus pedidos, o nada. El grupo es cerrado —se entra
                  por un código— y ante los demás solo se señala lo positivo:
                  nunca aparece un “no leyó”.
                </p>
                <p>
                  El líder ve el pulso de lectura de los últimos siete días,{' '}
                  <b className="font-semibold text-accent-ink">solo de quienes eligen compartir su lectura</b>,
                  para acompañar y animar —no para vigilar—. Quien prefiere no
                  compartir, no aparece.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CÓMO ENTRÁS · DÓNDE VIVE ─────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <Eyebrow>Cómo entrás</Eyebrow>
            <h3 className="mt-4 text-[19px] font-bold tracking-[-0.02em] text-ink">
              Con tu correo, sin contraseña
            </h3>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
              Te enviamos un enlace de acceso a tu correo. No manejamos ni
              guardamos contraseñas, así que no hay una que se pueda filtrar.
            </p>
          </div>
          <div>
            <Eyebrow>Dónde viven tus datos</Eyebrow>
            <h3 className="mt-4 text-[19px] font-bold tracking-[-0.02em] text-ink">
              En un servidor seguro
            </h3>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
              Tus datos se guardan de forma segura en nuestro proveedor de
              infraestructura (Supabase). La app se instala en tu teléfono y
              muestra tu lectura de hoy aún sin conexión.
            </p>
          </div>
        </div>
      </section>

      {/* ── TU CONTROL ───────────────────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[720px] px-6 py-16">
          <Eyebrow>Tu control</Eyebrow>
          <h2 className="mt-4 text-[26px] font-bold tracking-[-0.025em] text-ink sm:text-[30px]">
            Podés irte con todo lo tuyo
          </h2>
          <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-ink-soft">
            En <b className="font-semibold text-accent-ink">Ajustes → Eliminar cuenta</b> borrás tu
            cuenta y con ella todos tus datos —tu lectura, tus reflexiones, tus
            oraciones y tus membresías de grupo—. El borrado es completo y no se
            puede deshacer. También podés apagar el recordatorio diario en
            cualquier momento.
          </p>
        </div>
      </section>

      {/* ── CONTACTO ─────────────────────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2 className="text-[28px] font-bold tracking-[-0.025em] text-ink sm:text-[32px]">
            ¿Alguna duda?
          </h2>
          <p className="mx-auto mt-4 max-w-[440px] text-[17px] leading-relaxed text-ink-soft">
            Escribinos y con gusto te respondemos sobre tus datos o cualquier
            cosa de la app.
          </p>
          <a
            href={`mailto:${CONTACTO}`}
            className="info-cta mt-6 inline-block text-[17px] font-semibold text-accent-ink hover:underline"
          >
            {CONTACTO}
          </a>
          <p className="mt-10 text-[13px] text-ink-soft">
            Última actualización: {ACTUALIZADO}
          </p>
        </div>
      </section>

      {/* ── FOOTER GLOBAL ────────────────────────────────────── */}
      <LandingFooter current="/privacidad" />
    </div>
  )
}
