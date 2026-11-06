import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LandingStyle,
  LandingGlow,
  LandingHeader,
  LandingFooter,
  Eyebrow,
  SectionTitle,
  SubTitle,
  AppLink,
} from './landingKit.jsx'
import { scrollTopOnEnter, useLandingView } from './landingHydration.js'
import {
  DemoStyle,
  HoyConGruposDemo,
  SalaGrupoDemo,
  PulsoLiderDemo,
} from './landingDemos.jsx'
import PhoneShot from './PhoneShot.jsx'

// Landing pública /lideres — cómo usar la app con un grupo pequeño (ver App.jsx,
// fuera del Gate). Es una guía práctica, no una pieza de venta: lo que arma el
// líder, lo que hace cada miembro, lo que se ve en la semana, qué hacer en la
// reunión y las dudas de siempre. Frases cortas y los nombres EXACTOS de los
// botones de la app, para que se pueda seguir con el teléfono en la mano.
// El principio sigue: cada uno lee en su Biblia FÍSICA
// (product-principle-physical-bible); solo se muestra lo positivo.

// Bloque de pasos numerados. Los nombres de botones van en <b>, en tinta y entre «comillas»
// (el acento queda para lo tocable: acá no hay nada que tocar).
function Steps({ eyebrow, title, steps, children }) {
  return (
    <section className="mx-auto w-full max-w-[880px] px-6 py-8">
      <div className="border-t border-hairline pt-12">
        <Eyebrow>{eyebrow}</Eyebrow>
        <SectionTitle className="mt-4">{title}</SectionTitle>
        <ol className="mt-8 flex max-w-[600px] flex-col gap-5">
          {steps.map(([head, body], i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="mt-[1px] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-action text-[0.9375rem] font-bold text-on-accent">
                {i + 1}
              </span>
              <span className="pt-1">
                <span className="block text-[1.0625rem] font-semibold leading-snug text-ink">{head}</span>
                <span className="mt-1 block text-[1rem] leading-snug text-ink-soft [&_b]:font-semibold [&_b]:text-ink">
                  {body}
                </span>
              </span>
            </li>
          ))}
        </ol>
        {children}
      </div>
    </section>
  )
}

// Lo que se ve durante la semana: texto corto + la pantalla (un demo con datos de
// ejemplo o una captura real: ver landingDemos.jsx y PhoneShot.jsx). En escritorio van de a dos.
function Week({ title, children, demo }) {
  return (
    <div className="in-duo-item">
      <div className="in-duo-text">
        <SubTitle>{title}</SubTitle>
        <p className="text-[1.0312rem] leading-relaxed text-ink-soft [&_b]:font-semibold [&_b]:text-ink">{children}</p>
      </div>
      {demo}
    </div>
  )
}

const FAQ = [
  ['¿Cuesta algo?', 'No. Es gratis y sin publicidad, para vos y para tu grupo.'],
  [
    '¿La app muestra el texto de la Biblia?',
    'No es un lector de la Biblia: cada uno lee en su Biblia de papel. La app dice qué leer hoy y, si alguien quiere, abre el pasaje en YouVersion o BibleGateway con un toque. Los materiales de la Biblioteca (catecismos y confesiones) traen sus propios textos y citas de apoyo.',
  ],
  [
    '¿Se ve quién no leyó?',
    'Entre los miembros, no: solo se ve quién sí leyó. Vos, como líder, ves los últimos 7 días de quienes comparten su lectura, para saber a quién escribirle. Ellos lo saben: la app se lo dice al activarlo.',
  ],
  [
    '¿Y si alguien ya tiene su propio plan?',
    'Lo sigue leyendo. Puede sumar el del grupo como lectura extra, y los dos aparecen en su pantalla Hoy.',
  ],
  [
    '¿Podemos leer también un catecismo juntos?',
    <>
      Sí. Cada uno suma el mismo material a su estante en la{' '}
      <Link to="/biblioteca" className="lk-textlink">
        Biblioteca
      </Link>{' '}
      y lo lee a su ritmo, en Hoy, junto al plan del grupo. El avance de cada material es personal: la app no lo comparte.
    </>,
  ],
  [
    '¿Quién ve los pedidos de oración?',
    'Solo los miembros del grupo, y solo los pedidos que cada uno elige compartir. Lo demás es privado.',
  ],
  [
    '¿Necesitan instalar algo?',
    'No hace falta: se abre desde el navegador. En el iPhone conviene agregarla a la pantalla de inicio (Compartir › Agregar a inicio) para recibir el recordatorio diario.',
  ],
]

export default function Lideres() {
  useLandingView('lideres')
  useEffect(() => {
    document.title = 'Lee Tu Biblia — Para líderes de grupos de discipulado'
    scrollTopOnEnter()
  }, [])

  return (
    <div className="relative isolate min-h-[100dvh] bg-app text-ink">
      <LandingStyle />
      <DemoStyle />
      {/* Lámina cálida de página: detrás del header y del hero (una sola pieza). */}
      <LandingGlow />

      <LandingHeader current="/lideres" />

      <main id="contenido" tabIndex={-1} className="outline-none">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section>
        <div className="screen-enter relative mx-auto w-full max-w-[880px] px-6 pb-12 pt-10 text-center sm:pt-14">
          <Eyebrow>Para líderes de grupo</Eyebrow>
          <h1 className="lk-display mx-auto mt-5 max-w-[13em]">
            Cómo usar Lee Tu Biblia <em>con tu grupo</em>
          </h1>
          <p className="lk-lede mx-auto mt-6 max-w-[520px]">
            Cada uno lee en su Biblia. La app les ayuda a leer lo mismo, a ver
            quién va leyendo y a orar unos por otros. Se arma en cinco minutos.
          </p>
          <div className="mx-auto mt-8 max-w-[300px]">
            <AppLink page="lideres" where="hero" className="lk-btn lk-btn-primary w-full">
              Empezar gratis
            </AppLink>
          </div>
        </div>
      </section>

      {/* ── LO QUE HACÉS VOS ─────────────────────────────────── */}
      <Steps
        eyebrow="Vos, una sola vez"
        title="Armá el grupo en 3 pasos"
        steps={[
          [
            'Creá el grupo',
            <>
              En la pestaña Grupos, tocá <b>«Agregar grupo»</b> y ponele un nombre.
            </>,
          ],
          [
            'Elegí qué van a leer',
            <>
              Entrá al grupo y tocá <b>«Elegí un plan para leer juntos»</b>. Empieza hoy,
              día 1 para todos.
            </>,
          ],
          [
            'Invitá a tu gente',
            <>
              Tocá <b>«Invitar»</b> y mandá el link al chat del grupo.
            </>,
          ],
        ]}
      >
        <p className="mt-7 max-w-[560px] text-[0.9375rem] leading-relaxed text-ink-soft">
          Al entrar al grupo, la app te pregunta si compartís tu lectura. Decí que sí: sin eso
          no ves quién leyó ni la semana de cada uno.
        </p>
      </Steps>

      {/* ── LO QUE HACE CADA MIEMBRO ─────────────────────────── */}
      <Steps
        eyebrow="Cada miembro"
        title="Lo que hace cada uno"
        steps={[
          [
            'Abre el link y crea su cuenta',
            'Solo pone su correo: le llega un código para entrar. Sin contraseñas.',
          ],
          [
            'Se suma al plan del grupo',
            <>
              En el grupo toca <b>«Leer este plan con el grupo»</b>. Si ya tenía su propio plan,
              puede sumar este como lectura extra.
            </>,
          ],
          [
            'Toca «Compartir mi lectura»',
            <>
              Al entrar al grupo la app se lo pregunta. Así el grupo ve que leyó (no qué leyó) y
              puede ver la lectura de los demás. Quien lidera ve además sus últimos 7 días, y la app se lo avisa. Si lo saltea, lo activa después desde el grupo.
            </>,
          ],
          [
            'Cada día, lee y marca',
            <>
              Lee en su Biblia los pasajes del día y toca <b>«Marcar como leído»</b>.
            </>,
          ],
        ]}
      >
        <p className="mt-7 max-w-[560px] text-[0.9375rem] leading-relaxed text-ink-soft">
          Tip: mandá estos cuatro pasos al chat junto con el link de invitación.
        </p>
      </Steps>

      {/* ── DURANTE LA SEMANA ────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 pb-4 pt-8">
        <div className="border-t border-hairline pt-12">
          <Eyebrow>Durante la semana</Eyebrow>
          <SectionTitle className="mt-4">Lo que van a ver</SectionTitle>
        </div>
      </section>
      <div className="mx-auto w-full max-w-[1040px] px-6 pb-16 pt-6">
        <div className="in-duo">
          <Week
            title="La lectura del grupo, en su pantalla de siempre"
            demo={<HoyConGruposDemo width={380} />}
          >
            Cada uno ve la lectura del grupo en <b>«Hoy»</b>, junto a la suya. No tiene que
            buscarla en otro lado.
          </Week>

          <Week title="Quién leyó hoy" demo={<SalaGrupoDemo width={380} />}>
            Al entrar al grupo ves, por ejemplo, «Vos y 4 más leyeron hoy». Entre los miembros nunca
            dice quién no leyó: es para alegrarse juntos, no para controlar.
          </Week>

          <Week title="Orar unos por otros" demo={
              <PhoneShot
                shot="orar"
                width={350}
                caption="Orar ahora: un pedido por vez, sin apuro."
                alt="Pantalla Orar ahora de la app: una sola ficha con el título de un pedido de oración y una línea de detalle, el avance «1 de 4» arriba y el botón Siguiente pedido abajo."
              />
            }>
            Cualquiera puede compartir un pedido con el grupo y los demás tocan <b>«Orar»</b>.
            Quien lo pidió va contando cómo sigue, y cuando Dios responde, el pedido se
            vuelve un testimonio del grupo.
          </Week>

          <Week title="Solo para vos: a quién escribirle" demo={<PulsoLiderDemo width={380} />}>
            Al final del grupo, con un candado, ves los últimos 7 días de lectura de cada
            uno. Sirve para mandarle un mensaje de ánimo a quien lo necesite esta semana.
          </Week>
        </div>
      </div>

      {/* ── EN LA REUNIÓN ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-14">
        <div className="band-grupos rounded-card px-7 py-8">
          <Eyebrow tone="grupos">En la reunión</Eyebrow>
          <SectionTitle className="mt-4">Una idea para usarla cuando se juntan</SectionTitle>
          <ul className="mt-6 flex max-w-[600px] flex-col gap-3 text-[1rem] leading-snug text-ink">
            <li>
              <b className="font-semibold">Abran la semana:</b> ¿qué les habló Dios en la lectura?
            </li>
            <li>
              <b className="font-semibold">Repasen los pedidos:</b> cómo siguen y por cuáles oran juntos.
            </li>
            <li>
              <b className="font-semibold">Celebren los testimonios:</b> los pedidos que Dios respondió.
            </li>
          </ul>
        </div>
      </section>

      {/* ── PREGUNTAS ────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-8">
        <div className="border-t border-hairline pt-12">
          <Eyebrow>Preguntas comunes</Eyebrow>
          <h2 className="sr-only">Preguntas comunes de los líderes</h2>
          <dl className="mt-6 grid max-w-[760px] gap-x-10 gap-y-7 sm:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="text-[1.0312rem] font-semibold text-ink">{q}</dt>
                <dd className="mt-1.5 text-[0.9688rem] leading-relaxed text-ink-soft">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── CIERRE ───────────────────────────────────────────── */}
      <section className="lk-closing border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2 className="lk-display mx-auto max-w-[14ch]">
            Empezá hoy con tu grupo
          </h2>
          <p className="lk-lede mx-auto mt-4 max-w-[440px]">
            Creá el grupo, elegí el plan y mandá el link. El resto lo van caminando juntos.
          </p>
          <div className="mx-auto mt-8 max-w-[300px]">
            <AppLink page="lideres" where="cierre" className="lk-btn lk-btn-primary w-full">
              Empezar gratis
            </AppLink>
          </div>
          <p className="mt-4 text-[0.875rem] text-ink-soft">
            ¿Querés ver todo lo que hace la app?{' '}
            <Link to="/ayuda" className="font-semibold text-accent-ink hover:underline">
              Guía completa
            </Link>
          </p>

        </div>
      </section>

      </main>

      {/* ── FOOTER GLOBAL ────────────────────────────────────── */}
      <LandingFooter current="/lideres" />
    </div>
  )
}
