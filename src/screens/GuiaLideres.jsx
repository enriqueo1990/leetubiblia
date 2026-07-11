import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookIcon, HeartIcon, LockIcon } from '../components/icons.jsx'
import { LandingStyle, Wordmark, Eyebrow, IconBadge } from './landingKit.jsx'

// Landing pública /guia-lideres — el INSTRUCTIVO paso a paso para el líder de
// grupo de discipulado (ver App.jsx, fuera del Gate). Hermana de
// /grupos-de-discipulado: aquella es el "por qué/qué" (venta); esta es el "cómo"
// (manual operativo), con los pasos reales y los labels que el líder ve en la
// app. Mismo lenguaje de diseño que las demás landings vía landingKit; el
// principio sigue en pie: la app acompaña la Biblia FÍSICA
// (product-principle-physical-bible). Todo es opt-in; solo se señala lo positivo.

// Fases del recorrido del líder. Cada paso nombra el gesto concreto y, entre
// <b>…</b>, el texto EXACTO del botón/sección que aparece en la app (español).
function Phase({ eyebrow, title, intro, children }) {
  return (
    <div className="border-t border-hairline pt-12">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 max-w-[560px] text-[26px] font-bold leading-[1.16] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">
        {title}
      </h2>
      {intro && (
        <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-ink-soft">{intro}</p>
      )}
      <ol className="mt-9 flex flex-col gap-8">{children}</ol>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <li className="flex items-start gap-4">
      <span className="info-num mt-[2px] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="text-[18px] font-semibold text-ink">{title}</h3>
        <div className="mt-1.5 max-w-[560px] text-[16px] leading-relaxed text-ink-soft [&_b]:font-semibold [&_b]:text-accent-ink">
          {children}
        </div>
      </div>
    </li>
  )
}

export default function GuiaLideres() {
  useEffect(() => {
    document.title = 'Lee Tu Biblia — Guía paso a paso para líderes de grupo'
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
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background:
              'radial-gradient(ellipse 620px 420px at 50% -8%, var(--accent-tint), transparent 70%)',
          }}
        />
        <div className="screen-enter relative mx-auto w-full max-w-[680px] px-6 pb-14 pt-10 text-center sm:pt-16">
          <Eyebrow>Guía para líderes · paso a paso</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-[560px] text-[36px] font-bold leading-[1.13] tracking-[-0.03em] text-ink [text-wrap:balance] sm:text-[44px]">
            Cómo usar la app <span className="whitespace-nowrap text-accent-ink">con tu grupo</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[500px] text-[18px] leading-relaxed text-ink-soft">
            Un recorrido corto, del primer día en adelante: armás el grupo,
            elegís un plan, y guiás la lectura y la oración semana a semana.
            Diez minutos para dejarlo andando.
          </p>
        </div>
      </section>

      {/* ── PASOS ────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 pb-4">
        {/* FASE 1 — armar el grupo */}
        <Phase
          eyebrow="Primero · una sola vez"
          title="Armá el grupo en un minuto"
          intro="Todo esto lo hacés una vez, al principio. Después el grupo camina casi solo."
        >
          <Step n={1} title="Creá el grupo">
            En la pestaña <b>Grupos</b>, tocá <b>Agregar grupo</b> y ponele un
            nombre. Quedás como administrador y la app te da un código para
            invitar.
          </Step>
          <Step n={2} title="Invitá a tu gente">
            Abrí el grupo y tocá <b>Invitar</b>. Compartí el código por WhatsApp
            o donde quieras; cada uno entra con un toque, sin instalar nada raro.
          </Step>
          <Step n={3} title="Elegí un plan para leer juntos">
            En la tarjeta <b>Plan del grupo</b>, tocá{' '}
            <b>Elegí un plan para leer juntos</b> y elegí uno. Arranca hoy como
            día 1 para todos, así leen lo mismo el mismo día. Solo vos, como
            líder, elegís o cambiás el plan del grupo.
          </Step>
        </Phase>

        {/* FASE 2 — que cada uno se sume */}
        <div className="mt-16">
          <Phase
            eyebrow="Después · cada miembro decide"
            title="Que cada uno se sume a su manera"
            intro="Elegir el plan del grupo no obliga a nadie: cada miembro decide cómo sumarse, y si quiere que veas su lectura."
          >
            <Step n={4} title="Cada uno elige cómo leer el plan">
              En su grupo, cada miembro ve la tarjeta del plan con dos caminos:
              <span className="mt-3 block space-y-2.5">
                <span className="block">
                  <b>· Leer este plan con el grupo</b> — pasa a ser su plan
                  principal en Hoy, con racha y progreso. Para quien quiere que
                  el plan del grupo sea su lectura.
                </span>
                <span className="block">
                  <b>· Sumarlo a Hoy como lectura adicional</b> — lo lee además
                  de su propio plan, sin tocar su racha. Ideal para quien ya
                  viene con un plan, o para vos si acompañás varios grupos a la
                  vez.
                </span>
              </span>
            </Step>
            <Step n={5} title="Pediles que compartan su lectura">
              Para que veas el pulso del grupo, cada uno activa{' '}
              <b>Compartir mi lectura con mis grupos</b> en Ajustes. Es recíproco
              y opcional: ves que leyó hoy —no qué leyó—, y solo entre quienes
              comparten. Nadie queda expuesto por atrasarse.
            </Step>
          </Phase>
        </div>

        {/* FASE 3 — la semana */}
        <div className="mt-16">
          <Phase
            eyebrow="Semana a semana"
            title="Leer y orar juntos"
            intro="El ritmo de todos los días: leen en su Biblia, marcan, y sostienen los pedidos de cada uno."
          >
            <Step n={6} title="Lean y compartan pedidos">
              Durante la semana cada uno lee en su Biblia y marca su lectura.
              Para sumar un pedido, en el grupo tocá <b>Compartir un pedido</b>{' '}
              (o el <b>+</b> en la pestaña Oración): los demás lo ven y oran.
            </Step>
            <Step n={7} title="Oren unos por otros">
              Con <b>Orar</b> cada uno marca que está orando por un pedido; con{' '}
              <b>Orar ahora</b> recorren todos los pedidos, uno a uno, con calma.
              El autor va contando cómo sigue —«entró a cirugía», «salió bien»—
              y el grupo acompaña los pedidos largos sin que se apaguen.
            </Step>
            <Step n={8} title="Celebren los testimonios">
              Cuando Dios responde, el pedido se marca como respondido y se
              vuelve <b>testimonio</b>: queda a la vista del grupo para
              celebrarlo juntos cuando se junten.
            </Step>
          </Phase>
        </div>

        {/* FASE 4 — solo el líder */}
        <div className="mt-16">
          <Phase
            eyebrow="Solo para vos"
            title="El pulso del líder"
            intro="Dos vistas que solo ve el administrador, pensadas para acompañar —nunca para vigilar."
          >
            <Step n={9} title="Mirá quién viene leyendo">
              En el grupo ves quién leyó hoy y el historial de los últimos 7 días
              de cada miembro que comparte —bajo <b>Lectura de la semana · solo
              vos lo ves</b>—. Un vistazo te dice a quién escribirle esta semana
              para darle un empujón con cariño.
            </Step>
            <Step n={10} title="Usá el resumen para pastorear">
              El <b>Resumen · solo vos lo ves</b> te da el panorama de la oración
              del grupo: pedidos activos, respondidos y cuántos oraron esta
              semana. Para saber por quién preguntar y a quién animar.
            </Step>
          </Phase>
        </div>
      </section>

      {/* ── TRES RECORDATORIOS ───────────────────────────────── */}
      <section className="mx-auto w-full max-w-[720px] px-6 py-12">
        <div className="rounded-card border border-hairline bg-surface-alt/60 px-7 py-8">
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
              <IconBadge>
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
              <IconBadge>
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

      {/* ── CTA FINAL ────────────────────────────────────────── */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[680px] px-6 py-20 text-center">
          <h2 className="text-[32px] font-bold tracking-[-0.025em] text-ink sm:text-[38px]">
            Listo para empezar
          </h2>
          <p className="mx-auto mt-4 max-w-[420px] text-[18px] leading-relaxed text-ink-soft">
            Creá el grupo, compartí el código y caminen juntos en la Palabra.
          </p>
          <div className="mx-auto mt-8 max-w-[320px]">
            <Link to="/" className="btn btn-primary info-cta block">
              Creá tu grupo gratis
            </Link>
          </div>
          <p className="mt-4 text-[14px] text-ink-soft">
            ¿Querés ver por qué sirve para un grupo de discipulado?{' '}
            <Link
              to="/grupos-de-discipulado"
              className="font-semibold text-accent-ink hover:underline"
            >
              Leé la presentación
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
