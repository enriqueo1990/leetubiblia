import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LandingStyle, LandingGlow, LandingHeader, LandingFooter, Eyebrow } from './landingKit.jsx'
import shotHoy from '../assets/guia-lideres/hoy-con-grupos.png'
import shotSala from '../assets/guia-lideres/sala-grupo.png'
import shotOrar from '../assets/guia-lideres/orar-ahora.png'
import shotLider from '../assets/guia-lideres/pulso-lider.png'

// Landing pública /lideres — cómo usar la app con un grupo pequeño (ver App.jsx,
// fuera del Gate). Es una guía práctica, no una pieza de venta: lo que arma el
// líder, lo que hace cada miembro, lo que se ve en la semana, qué hacer en la
// reunión y las dudas de siempre. Frases cortas y los nombres EXACTOS de los
// botones de la app, para que se pueda seguir con el teléfono en la mano.
// El principio sigue: cada uno lee en su Biblia FÍSICA
// (product-principle-physical-bible); solo se muestra lo positivo.

// Una captura real, enmarcada como pantalla de teléfono (borde + sombra neutra,
// la misma de landingKit: nunca marrón).
function Shot({ src, alt }) {
  return (
    <div className="mx-auto w-[220px] shrink-0 sm:w-[240px]">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-[24px] border border-hairline"
        style={{ boxShadow: '0 24px 60px -24px rgba(28, 28, 30, 0.25)' }}
      />
    </div>
  )
}

// Bloque de pasos numerados. Los nombres de botones van en <b> (acento).
function Steps({ eyebrow, title, steps, children }) {
  return (
    <section className="mx-auto w-full max-w-[880px] px-6 py-8">
      <div className="border-t border-hairline pt-12">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-4 text-[24px] font-bold tracking-[-0.02em] text-ink sm:text-[27px]">{title}</h2>
        <ol className="mt-8 flex max-w-[600px] flex-col gap-5">
          {steps.map(([head, body], i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="info-num mt-[1px] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-1">
                <span className="block text-[17px] font-semibold leading-snug text-ink">{head}</span>
                <span className="mt-1 block text-[16px] leading-snug text-ink-soft [&_b]:font-semibold [&_b]:text-accent-ink">
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

// Lo que se ve durante la semana: texto corto + captura.
function Week({ title, children, shot, alt, side = 'right' }) {
  const left = side === 'left'
  return (
    <div className="border-t border-hairline pt-12 lg:flex lg:items-center lg:gap-16">
      <div className={`lg:flex-1 ${left ? 'lg:order-2' : ''}`}>
        <h3 className="max-w-[480px] text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-ink sm:text-[24px]">
          {title}
        </h3>
        <p className="mt-4 max-w-[480px] text-[16.5px] leading-relaxed text-ink-soft [&_b]:font-semibold [&_b]:text-accent-ink">
          {children}
        </p>
      </div>
      <div className={`mt-9 shrink-0 lg:mt-0 ${left ? 'lg:order-1' : ''}`}>
        <Shot src={shot} alt={alt} />
      </div>
    </div>
  )
}

const FAQ = [
  ['¿Cuesta algo?', 'No. Es gratis y sin publicidad, para vos y para tu grupo.'],
  [
    '¿La app muestra el texto de la Biblia?',
    'No. Cada uno lee en su Biblia de papel. La app dice qué leer hoy y, si alguien quiere, abre el pasaje en YouVersion o BibleGateway con un toque.',
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
    '¿Quién ve los pedidos de oración?',
    'Solo los miembros del grupo, y solo los pedidos que cada uno elige compartir. Lo demás es privado.',
  ],
  [
    '¿Necesitan instalar algo?',
    'No hace falta: se abre desde el navegador. En el iPhone conviene agregarla a la pantalla de inicio (Compartir › Agregar a inicio) para recibir el recordatorio diario.',
  ],
]

export default function Lideres() {
  useEffect(() => {
    document.title = 'Lee Tu Biblia — Para líderes de grupos de discipulado'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="relative min-h-[100dvh] bg-app text-ink">
      <LandingStyle />
      {/* Lámina cálida de página: detrás del header y del hero (una sola pieza). */}
      <LandingGlow />

      <LandingHeader current="/lideres" />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section>
        <div className="screen-enter relative mx-auto w-full max-w-[680px] px-6 pb-12 pt-10 text-center sm:pt-14">
          <Eyebrow>Para líderes de grupo</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-[580px] text-[34px] font-bold leading-[1.13] tracking-[-0.03em] text-ink [text-wrap:balance] sm:text-[42px]">
            Cómo usar Lee Tu Biblia <span className="text-accent-ink">con tu grupo</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[500px] text-[18px] leading-relaxed text-ink-soft">
            Cada uno lee en su Biblia. La app les ayuda a leer lo mismo, a ver
            quién va leyendo y a orar unos por otros. Se arma en cinco minutos.
          </p>
          <div className="mx-auto mt-8 max-w-[300px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Abrir la app
            </Link>
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
              En la pestaña Grupos, tocá <b>Agregar grupo</b> y ponele un nombre.
            </>,
          ],
          [
            'Elegí qué van a leer',
            <>
              Entrá al grupo y tocá <b>Elegí un plan para leer juntos</b>. Empieza hoy,
              día 1 para todos.
            </>,
          ],
          [
            'Invitá a tu gente',
            <>
              Tocá <b>Invitar</b> y mandá el link al chat del grupo.
            </>,
          ],
        ]}
      >
        <p className="mt-7 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
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
              En el grupo toca <b>Leer este plan con el grupo</b>. Si ya tenía su propio plan,
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
              Lee en su Biblia los pasajes del día y toca <b>Marcar como leído</b>.
            </>,
          ],
        ]}
      >
        <p className="mt-7 max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
          Tip: mandá estos cuatro pasos al chat junto con el link de invitación.
        </p>
      </Steps>

      {/* ── DURANTE LA SEMANA ────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-8">
        <div className="border-t border-hairline pt-12">
          <Eyebrow>Durante la semana</Eyebrow>
          <h2 className="mt-4 text-[24px] font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
            Lo que van a ver
          </h2>
        </div>

        <div className="mt-10">
          <Week
            title="La lectura del grupo, en su pantalla de siempre"
            shot={shotHoy}
            alt="Pantalla Hoy con la lectura del grupo debajo de la lectura personal."
            side="right"
          >
            Cada uno ve la lectura del grupo en <b>Hoy</b>, junto a la suya. No tiene que
            buscarla en otro lado.
          </Week>
        </div>

        <div className="mt-14">
          <Week
            title="Quién leyó hoy"
            shot={shotSala}
            alt="Pantalla del grupo: cuántos leyeron hoy y los pedidos de oración activos."
            side="left"
          >
            Al entrar al grupo ves, por ejemplo, «Vos y 4 más leyeron hoy». Entre los miembros nunca
            dice quién no leyó: es para alegrarse juntos, no para controlar.
          </Week>
        </div>

        <div className="mt-14">
          <Week
            title="Orar unos por otros"
            shot={shotOrar}
            alt="Modo «Orar ahora», que recorre los pedidos de oración uno por uno."
            side="right"
          >
            Cualquiera puede compartir un pedido con el grupo y los demás tocan <b>Orar</b>.
            Quien lo pidió va contando cómo sigue, y cuando Dios responde, el pedido se
            vuelve un testimonio del grupo.
          </Week>
        </div>

        <div className="mt-14">
          <Week
            title="Solo para vos: a quién escribirle"
            shot={shotLider}
            alt="Vistas del líder: resumen de oración y la lectura de los últimos siete días de cada miembro."
            side="left"
          >
            Al final del grupo, con un candado, ves los últimos 7 días de lectura de cada
            uno. Sirve para mandarle un mensaje de ánimo a quien lo necesite esta semana.
          </Week>
        </div>
      </section>

      {/* ── EN LA REUNIÓN ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 py-14">
        <div className="band-grupos rounded-card px-7 py-8">
          <Eyebrow>En la reunión</Eyebrow>
          <h2 className="mt-4 text-[22px] font-bold tracking-[-0.02em] text-ink sm:text-[24px]">
            Una idea para usarla cuando se juntan
          </h2>
          <ul className="mt-6 flex max-w-[600px] flex-col gap-3 text-[16px] leading-snug text-ink">
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
          <dl className="mt-6 grid max-w-[760px] gap-x-10 gap-y-7 sm:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="text-[16.5px] font-semibold text-ink">{q}</dt>
                <dd className="mt-1.5 text-[15.5px] leading-relaxed text-ink-soft">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── CIERRE ───────────────────────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2 className="text-[30px] font-bold tracking-[-0.025em] text-ink sm:text-[34px]">
            Empezá hoy con tu grupo
          </h2>
          <p className="mx-auto mt-4 max-w-[420px] text-[18px] leading-relaxed text-ink-soft">
            Creá el grupo, elegí el plan y mandá el link. El resto lo van caminando juntos.
          </p>
          <div className="mx-auto mt-8 max-w-[300px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Abrir la app
            </Link>
          </div>
          <p className="mt-4 text-[14px] text-ink-soft">
            ¿Querés ver todo lo que hace la app?{' '}
            <Link to="/ayuda" className="font-semibold text-accent-ink hover:underline">
              Guía completa
            </Link>
          </p>

          <p className="mx-auto mt-16 max-w-[460px] text-[17px] italic leading-relaxed text-ink-soft">
            «Y considerémonos unos a otros para estimularnos al amor y a las
            buenas obras.»
          </p>
          <p className="mt-2 text-[13px] text-ink-soft">Hebreos 10:24 · NBLA</p>
        </div>
      </section>

      {/* ── FOOTER GLOBAL ────────────────────────────────────── */}
      <LandingFooter current="/lideres" />
    </div>
  )
}
