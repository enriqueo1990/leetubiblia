import { useEffect } from 'react'
import { BellIcon, BookIcon, HeartIcon, PeopleIcon, LockIcon, PencilIcon } from '../components/icons.jsx'
import {
  LandingStyle,
  LandingGlow,
  LandingHeader,
  LandingFooter,
  Eyebrow,
  IconBadge,
  SectionTitle,
  SubTitle,
} from './landingKit.jsx'
import { scrollTopOnEnter } from './landingHydration.js'
import { CONTACT_EMAIL as CONTACTO } from '../lib/developer.js'

// Página pública /privacidad — la capa de confianza del sitio (ver App.jsx, fuera
// del Gate). Enlazada desde el footer global de todas las páginas. Está redactada
// contra el comportamiento REAL de la app (Supabase; correo sin contraseña;
// privado por defecto; opt-in en grupos; borrado en cascada desde Ajustes →
// Eliminar cuenta, migración 0006). Tono pastoral y claro, no jurídico: nada de
// prometer lo que la app no hace. Mismo canon de diseño vía landingKit.

const ACTUALIZADO = '6 de noviembre de 2026'

// Qué guardamos y para qué — anclado a las tablas reales del backend.
const DATOS = [
  {
    icon: <PeopleIcon size={22} />,
    title: 'Tu cuenta',
    tone: 'ajustes',
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
    tone: 'oracion',
    desc: 'Tus pedidos, sus novedades y quién está orando. Cada pedido es privado salvo que vos elijas compartirlo con un grupo.',
  },
  {
    icon: <PeopleIcon size={22} />,
    title: 'Tus grupos',
    tone: 'grupos',
    desc: 'Los grupos de los que sos parte y tu preferencia de qué compartís en ellos. Los grupos son cerrados: se entra por código.',
  },
  {
    icon: <BellIcon size={22} />,
    title: 'El recordatorio diario',
    tone: 'ajustes',
    desc: 'Si lo activás, guardamos lo justo para enviarte la notificación a tu hora. Lo apagás cuando quieras desde Ajustes.',
  },
  {
    icon: <PeopleIcon size={22} />,
    title: 'Tu foto de perfil',
    tone: 'ajustes',
    desc: 'Si subís una, la guardamos achicada. Se ve en la app solo junto a tu nombre (vos y tus grupos), aunque el archivo vive en un enlace público. Si no subís ninguna, se usa tu inicial.',
  },
  {
    icon: <LockIcon size={22} />,
    title: 'Cómo se usa la app',
    desc: 'Contamos aperturas y en qué paso del inicio se traba la gente (por ejemplo, qué plan elegiste al empezar o desde qué página pública llegaste), con un identificador del teléfono y el tipo de navegador, unido a tu cuenta si entraste. Nunca lo que anotás ni por qué orás.',
  },
  {
    icon: <PencilIcon size={22} />,
    title: 'Lo que nos escribís',
    tone: 'ajustes',
    desc: 'Si mandás una sugerencia o un problema desde Ajustes, lo guardamos con la versión de la app y el tipo de teléfono para poder responderte.',
  },
]

export default function Privacidad() {
  useEffect(() => {
    document.title = 'Lee Tu Biblia — Privacidad'
    scrollTopOnEnter()
  }, [])

  return (
    <div className="relative isolate min-h-[100dvh] bg-app text-ink">
      <LandingStyle />
      {/* Resplandor suave: presencia cálida detrás del header, sin marketing. */}
      <LandingGlow soft />

      <LandingHeader current="/privacidad" />

      <main id="contenido" tabIndex={-1} className="outline-none">

      {/* ── ENCABEZADO DE DOCUMENTO ──────────────────────────── */}
      {/* Sobrio: alineado a la izquierda y con la fecha arriba, para que se lea
          como un documento de confianza —no como otro landing—. */}
      <section className="screen-enter relative mx-auto w-full max-w-[880px] px-6 pt-10">
        <div className="border-b border-hairline pb-9">
          <Eyebrow>Privacidad</Eyebrow>
          <h1 className="lk-h2 mt-4 max-w-[560px]">
            Tu vida con Dios es <em>tuya</em>
          </h1>
          <p className="mt-2 text-[0.8125rem] text-ink-soft">Última actualización: {ACTUALIZADO}</p>
          <p className="mt-5 max-w-[600px] text-[1.0312rem] leading-relaxed text-ink-soft">
            Lo que leés, lo que anotás y por lo que orás te pertenece. Acá te
            contamos —en simple— qué guardamos, qué es privado y cómo tenés el
            control. Sin letra chica.
          </p>
        </div>
      </section>

      {/* ── LO ESENCIAL ──────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-8">
        <div className="rounded-card border border-hairline bg-surface-alt/60 px-7 py-8">
          <Eyebrow>Lo esencial</Eyebrow>
          <ul className="mt-5 flex flex-col gap-3 text-[1.0312rem] leading-snug text-ink">
            <li className="flex items-start gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
              <span>La app es <b className="font-semibold text-accent-ink">gratis</b> y no tiene publicidad.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
              <span><b className="font-semibold text-accent-ink">No vendemos</b> tus datos ni se los pasamos a terceros para marketing.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
              <span>Todo es <b className="font-semibold text-accent-ink">privado por defecto</b>. Se comparte solo lo que vos elegís compartir.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
              <span>Podés <b className="font-semibold text-accent-ink">borrar tu cuenta y todos tus datos</b> cuando quieras, desde la app.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── QUÉ GUARDAMOS ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-12">
        <div className="border-t border-hairline pt-12">
          <Eyebrow>Qué guardamos y para qué</Eyebrow>
          <SectionTitle className="mt-4 max-w-[560px]">
            Solo lo necesario para que la app funcione
          </SectionTitle>
          <p className="mt-5 max-w-[560px] text-[1rem] leading-relaxed text-ink-soft">
            Guardamos lo justo para sostener tu hábito de lectura y tu vida de
            oración —nada más—. Esto es todo:
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {DATOS.map((d) => (
              <div key={d.title} className="flex items-start gap-4">
                <IconBadge tone={d.tone}>{d.icon}</IconBadge>
                <div>
                  <h3 className="text-[1.0625rem] font-semibold text-ink">{d.title}</h3>
                  <p className="mt-1 text-[0.9375rem] leading-snug text-ink-soft">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVADO Y COMPARTIDO ─────────────────────────────── */}
      <section className="landing-band py-20">
        <div className="mx-auto w-full max-w-[880px] px-6">
          <div className="flex items-start gap-4">
            <IconBadge tone="grupos">
              <LockIcon size={22} />
            </IconBadge>
            <div>
              <SectionTitle>Qué es privado y qué se comparte</SectionTitle>
              <div className="mt-5 flex flex-col gap-4 text-[1rem] leading-relaxed text-ink-soft">
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
      <section className="mx-auto w-full max-w-[880px] px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <Eyebrow>Cómo entrás</Eyebrow>
            <SubTitle className="mt-4">Con tu correo, sin contraseña</SubTitle>
            <p className="mt-3 text-[0.9688rem] leading-relaxed text-ink-soft">
              Te enviamos un código a tu correo. No manejamos ni
              guardamos contraseñas, así que no hay una que se pueda filtrar.
            </p>
          </div>
          <div>
            <Eyebrow>Dónde viven tus datos</Eyebrow>
            <SubTitle className="mt-4">En un servidor seguro</SubTitle>
            <p className="mt-3 text-[0.9688rem] leading-relaxed text-ink-soft">
              Tus datos se guardan de forma segura en nuestro proveedor de
              infraestructura (Supabase). La app se instala en tu teléfono y
              muestra tu lectura de hoy aún sin conexión.
            </p>
          </div>
        </div>
      </section>

      {/* ── TU CONTROL ───────────────────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[880px] px-6 py-16">
          <Eyebrow>Tu control</Eyebrow>
          <SectionTitle className="mt-4">Podés irte con todo lo tuyo</SectionTitle>
          <p className="mt-5 max-w-[560px] text-[1rem] leading-relaxed text-ink-soft">
            En <b className="font-semibold text-accent-ink">Ajustes → Eliminar cuenta</b> borrás tu
            cuenta y con ella todos tus datos —tu lectura, tus reflexiones, tus
            oraciones y tus membresías de grupo—. El borrado es completo y no se
            puede deshacer. También podés apagar cualquiera de los avisos —el
            recordatorio diario, los pedidos del grupo y el seguimiento de
            oración— desde Ajustes, en cualquier momento.
          </p>
        </div>
      </section>

      {/* ── CONTACTO ─────────────────────────────────────────── */}
      <section className="lk-closing border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2 className="lk-display mx-auto max-w-[14ch]">
            ¿Alguna duda?
          </h2>
          <p className="mx-auto mt-4 max-w-[440px] text-[1.0625rem] leading-relaxed text-ink-soft">
            Escribinos y con gusto te respondemos sobre tus datos o cualquier
            cosa de la app.
          </p>
          <a
            href={`mailto:${CONTACTO}`}
            className="info-cta mt-6 inline-block text-[1.0625rem] font-semibold text-accent-ink hover:underline"
          >
            {CONTACTO}
          </a>
        </div>
      </section>

      </main>

      {/* ── FOOTER GLOBAL ────────────────────────────────────── */}
      <LandingFooter current="/privacidad" />
    </div>
  )
}
