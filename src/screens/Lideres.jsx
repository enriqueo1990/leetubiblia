import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookIcon, HeartIcon, LockIcon } from '../components/icons.jsx'
import { LandingStyle, LandingGlow, LandingHeader, LandingFooter, Eyebrow, IconBadge } from './landingKit.jsx'
import shotPlan from '../assets/guia-lideres/plan-del-grupo.png'
import shotHoy from '../assets/guia-lideres/hoy-con-grupos.png'
import shotSala from '../assets/guia-lideres/sala-grupo.png'
import shotOrar from '../assets/guia-lideres/orar-ahora.png'
import shotLider from '../assets/guia-lideres/pulso-lider.png'

// Landing pública /lideres — LA página del líder de grupo de discipulado (ver
// App.jsx, fuera del Gate). Fusiona las dos páginas antiguas —la "presentación"
// (/grupos-de-discipulado) y el recorrido con capturas (/guia-lideres)— en una
// sola: primero el porqué, después el paso a paso con capturas REALES de la app.
// No es una pieza de venta: es el link que un líder abre para ver qué puede
// hacer con su grupo y para qué le sirve. Mismo lenguaje de diseño vía
// landingKit; el principio sigue: la app acompaña la Biblia FÍSICA
// (product-principle-physical-bible). Todo es opt-in y solo se señala lo
// positivo: nadie queda expuesto.

// Una captura real, enmarcada como pantalla de teléfono (borde + sombra suave).
function Shot({ src, alt }) {
  return (
    <div className="mx-auto w-[248px] shrink-0 sm:w-[268px]">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-[26px] border border-hairline"
        style={{ boxShadow: '0 24px 60px -24px rgba(60,44,28,0.35)' }}
      />
    </div>
  )
}

// Sección del recorrido: texto + captura, alternando el lado en desktop.
function Walk({ eyebrow, title, children, shot, alt, side = 'right' }) {
  const left = side === 'left'
  return (
    <div className="border-t border-hairline pt-14 lg:flex lg:items-center lg:gap-16">
      <div className={`lg:flex-1 ${left ? 'lg:order-2' : ''}`}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-4 max-w-[520px] text-[25px] font-bold leading-[1.16] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[29px]">
          {title}
        </h2>
        <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-soft">{children}</p>
      </div>
      <div className={`mt-11 shrink-0 lg:mt-0 ${left ? 'lg:order-1' : ''}`}>
        <Shot src={shot} alt={alt} />
      </div>
    </div>
  )
}

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
      {/* Firma propia de esta página: la franja de capturas REALES en el hero la
          distingue de un vistazo de /info (que es todo texto). Decorativa
          (aria-hidden): las mismas capturas van con su alt más abajo. */}
      <section>
        <div className="screen-enter relative mx-auto w-full max-w-[680px] px-6 pb-14 pt-10 text-center sm:pt-14">
          <Eyebrow>Para líderes de grupo</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-[560px] text-[35px] font-bold leading-[1.13] tracking-[-0.03em] text-ink [text-wrap:balance] sm:text-[44px]">
            Acompañá a tu grupo <span className="whitespace-nowrap text-accent-ink">en la Palabra</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[520px] text-[18px] leading-relaxed text-ink-soft">
            Un recorrido breve —con capturas reales de la app— para que veas qué
            podés hacer con tu grupo de discipulado y cómo te ayuda a acompañar a
            tu gente. La Palabra la lee cada uno en su Biblia; la app sostiene el
            hábito que caminan juntos.
          </p>
          <div aria-hidden="true" className="mt-12 flex items-end justify-center">
            <img
              src={shotHoy}
              alt=""
              className="w-[96px] -rotate-[7deg] rounded-[18px] border border-hairline sm:w-[112px]"
              style={{ boxShadow: '0 22px 50px -22px rgba(60,44,28,0.35)' }}
            />
            <img
              src={shotSala}
              alt=""
              className="relative z-10 -mx-4 w-[112px] rounded-[20px] border border-hairline sm:w-[132px]"
              style={{ boxShadow: '0 26px 60px -22px rgba(60,44,28,0.42)' }}
            />
            <img
              src={shotOrar}
              alt=""
              className="w-[96px] rotate-[7deg] rounded-[18px] border border-hairline sm:w-[112px]"
              style={{ boxShadow: '0 22px 50px -22px rgba(60,44,28,0.35)' }}
            />
          </div>
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

      {/* ── EMPEZAR ES SIMPLE ────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-8">
        <div className="border-t border-hairline pt-12">
          <Eyebrow>Empezar es simple</Eyebrow>
          <h2 className="mt-4 text-[24px] font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
            Tres pasos y el grupo ya camina
          </h2>
          <ol className="mt-8 flex flex-col gap-4">
            {[
              'Creás el grupo en la pestaña Grupos —tocá <b>Agregar grupo</b>— y le ponés nombre.',
              'Compartís el <b>código</b> por WhatsApp; cada uno entra con un toque.',
              'Elegís un <b>plan para leer juntos</b>: arranca hoy como día 1 para todos.',
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="info-num mt-[1px] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white">
                  {i + 1}
                </span>
                <span
                  className="pt-1 text-[16.5px] leading-snug text-ink [&_b]:font-semibold [&_b]:text-accent-ink"
                  dangerouslySetInnerHTML={{ __html: s }}
                />
              </li>
            ))}
          </ol>
          <p className="mt-7 max-w-[520px] text-[16px] leading-relaxed text-ink-soft">
            De ahí en más, esto es lo que van a poder vivir juntos.
          </p>
        </div>
      </section>

      {/* ── RECORRIDO CON CAPTURAS ───────────────────────────── */}
      <section className="mx-auto w-full max-w-[880px] px-6 pb-4">
        <Walk
          eyebrow="El plan, a la medida de cada uno"
          title="Un mismo plan, sin obligar a nadie"
          shot={shotPlan}
          alt="Tarjeta del plan del grupo con las dos opciones: leerlo como plan principal o sumarlo a Hoy como lectura adicional."
          side="right"
        >
          Vos elegís el plan del grupo. Después, cada miembro decide cómo
          sumarse: hacerlo su plan principal —con su racha y su progreso—, o
          seguirlo en Hoy como <b className="font-semibold text-accent-ink">lectura adicional</b>, sin
          soltar el que ya venía leyendo. Así el que recién empieza y el que
          tiene años en la Palabra caminan juntos, cada uno desde donde está.
        </Walk>

        <div className="mt-16">
          <Walk
            eyebrow="En el Hoy de cada uno"
            title="La lectura del grupo, donde ya miran cada día"
            shot={shotHoy}
            alt="Pantalla Hoy con la sección «Con tus grupos» mostrando la lectura del grupo junto a la lectura personal."
            side="left"
          >
            Quien sigue el plan del grupo lo ve en su pantalla Hoy, bajo{' '}
            <b className="font-semibold text-accent-ink">Con tus grupos</b>, al lado de su propia
            lectura. No es una app más para abrir: es la misma rutina de
            siempre, con la lectura compartida a un toque.
          </Walk>
        </div>

        <div className="mt-16">
          <Walk
            eyebrow="El pulso del día"
            title="Quién viene caminando, sin perseguir a nadie"
            shot={shotSala}
            alt="Detalle del grupo con el pulso del día: cuántos leyeron hoy y los pedidos activos."
            side="right"
          >
            En la sala del grupo ves el pulso del día: cuántos leyeron hoy y los
            pedidos que están sosteniendo. Es una señal de vida compartida —solo
            se muestra lo positivo, nunca un «no leyó»— para que sepas por quién
            alegrarte y a quién acercarte con una palabra.
          </Walk>
        </div>

        <div className="mt-16">
          <Walk
            eyebrow="Orar juntos"
            title="Cada pedido, sostenido por todos"
            shot={shotOrar}
            alt="Modo «Orar ahora» recorriendo los pedidos del grupo uno por uno."
            side="left"
          >
            Cada uno comparte sus pedidos y los demás oran por ellos. Con{' '}
            <b className="font-semibold text-accent-ink">Orar ahora</b> los recorrés uno por uno,
            con calma. El autor va contando cómo sigue —«entró a cirugía»,
            «salió bien»— y, cuando Dios responde, el pedido se vuelve testimonio
            para celebrar juntos.
          </Walk>
        </div>

        <div className="mt-16">
          <Walk
            eyebrow="Solo para vos"
            title="Para acompañar, no para vigilar"
            shot={shotLider}
            alt="Vistas exclusivas del líder: el resumen de oración y la lectura de la semana de cada miembro."
            side="right"
          >
            Hay dos vistas que solo ve el líder: la semana de cada quien —los
            últimos siete días— y un resumen de la oración del grupo. No están
            para controlar, sino para que sepas a quién escribirle esta semana
            con un mensaje de ánimo. Y solo aparece quien elige compartir su
            lectura.
          </Walk>
        </div>
      </section>

      {/* ── TRES RECORDATORIOS ───────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-14">
        <div className="band-grupos rounded-card px-7 py-8">
          <Eyebrow>Para tener presente</Eyebrow>
          <div className="mt-6 grid gap-7 sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <IconBadge>
                <BookIcon size={22} />
              </IconBadge>
              <div>
                <h3 className="text-[16px] font-semibold text-ink">La Palabra, en papel</h3>
                <p className="mt-1 text-[14.5px] leading-snug text-ink-soft">
                  La app no muestra el texto bíblico: cada uno lee en su Biblia.
                  Acá vive el hábito que sostienen juntos.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <IconBadge tone="oracion">
                <HeartIcon size={22} />
              </IconBadge>
              <div>
                <h3 className="text-[16px] font-semibold text-ink">Animar, no vigilar</h3>
                <p className="mt-1 text-[14.5px] leading-snug text-ink-soft">
                  El pulso es para acercarte con cariño, no para señalar. Solo se
                  muestra lo positivo; nunca un «no leyó».
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <IconBadge tone="grupos">
                <LockIcon size={22} />
              </IconBadge>
              <div>
                <h3 className="text-[16px] font-semibold text-ink">Todo es opt-in</h3>
                <p className="mt-1 text-[14.5px] leading-snug text-ink-soft">
                  El grupo es cerrado y cada quien elige qué comparte. Nadie
                  queda expuesto por atrasarse.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CIERRE (suave, sin venta) ────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2 className="text-[30px] font-bold tracking-[-0.025em] text-ink sm:text-[36px]">
            Todo esto ya está en la app
          </h2>
          <p className="mx-auto mt-4 max-w-[440px] text-[18px] leading-relaxed text-ink-soft">
            Abrila cuando quieras, creá tu grupo y compartí el código. La app se
            ocupa del ritmo; vos, de tu gente.
          </p>
          <div className="mx-auto mt-8 max-w-[300px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Abrir la app
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

      {/* ── FOOTER GLOBAL ────────────────────────────────────── */}
      <LandingFooter current="/lideres" />
    </div>
  )
}
