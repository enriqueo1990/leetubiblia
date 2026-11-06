import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LandingStyle,
  LandingGlow,
  LandingHeader,
  LandingFooter,
  Eyebrow,
  SectionTitle,
  DonateLink,
  AppLink,
} from './landingKit.jsx'
import { scrollTopOnEnter, useLandingView } from './landingHydration.js'
import { CONTACT_EMAIL, MISSION_URL } from '../lib/developer.js'
import { INFO_CSS } from './infoStyles.js'
import { INFO_META, INFO_URL } from './infoCopy.js'
import TodayDemo from './TodayDemo.jsx'
import { DemoStyle } from './landingDemos.jsx'
import { InfoSprite, Ico, PaperBible, InstallGuide, InstallArt, FaqList } from './infoParts.jsx'

// Landing pública /info — página fuera del Gate (ver App.jsx). Le habla a quien
// llega en frío (redes, un pastor pasando el link) antes de decidir crear cuenta.
// Concepto: la app acompaña la Biblia FÍSICA, no la reemplaza
// (product-principle-physical-bible): NUNCA texto bíblico, solo referencias.
// Dirección «Marcapáginas · Luz de mañana» (landings-2027/E-direccion-creativa.md).
//
// Prerender: esto se renderiza en Node (react-dom/server), así que nada de
// window/localStorage al renderizar; lo que depende del aparato va tras hidratar
// (landingHydration.js). Título y descripción salen de infoCopy.js, la misma fuente
// que usa el build para las meta tags.

// Mensaje para pasarle la página a un pastor por WhatsApp (enlace normal, sin JS).
const SHARE_HREF = `https://wa.me/?text=${encodeURIComponent(
  `Mirá esta app gratis para leer la Biblia cada día y acompañar a un grupo: ${INFO_URL}`
)}`

const PLANS = [
  'Marcos en 16 días',
  'Primeros pasos con Jesús',
  'M’Cheyne',
  'Cronológico',
  'Proverbios en 31 días',
  'Semana Santa',
  'Adviento',
]

const GESTOS = [
  ['Te dice qué toca', 'Abrís la app y ves la lectura de hoy: solo referencias, nada más.'],
  ['Abrís tu Biblia', 'La de papel, con su cinta. Ahí está el texto.'],
  ['Leés', 'Sin pantalla de por medio. Cuando termines, volvés.'],
  ['Marcás y seguís', 'Un toque en «Marcar como leído». Si hoy no pudiste, mañana seguimos.'],
]

// Las promesas se pueden comprobar en la app y en /privacidad.
const NOS = [
  ['No reemplazamos tu Biblia.', 'La Biblia es la tuya, la de papel. La app te dice qué leer, lleva tu avance y se hace a un lado.'],
  ['No hay anuncios.', 'Nadie paga por mirarte: la app no vive de tu atención.'],
  ['No te cobramos.', 'Es gratis: sin pruebas, sin suscripción, sin letra chica.'],
  ['No castigamos.', 'Si un día no leés, no se enciende nada rojo. Mañana seguimos.'],
  ['No te comparamos.', 'Sin rankings. Entre miembros de un grupo nadie ve quién no leyó, y cada uno decide qué comparte.'],
  ['No vendemos lo tuyo.', 'Tu diario es solo tuyo, tus oraciones son privadas hasta que las compartís, y podés borrar todo desde la app.'],
]

const LEADER_STEPS = [
  ['Creá el grupo', 'Le ponés un nombre y listo.'],
  ['Elegí el plan', 'Uno de los 13, el mismo para todos.'],
  ['Mandá el link', 'Cada quien se suma desde el link o con el código.'],
]

export default function Info() {
  useLandingView('info')
  useEffect(() => {
    document.title = INFO_META.title
    scrollTopOnEnter()
  }, [])

  return (
    <div className="in-page relative isolate min-h-[100dvh] bg-app text-ink">
      <LandingStyle />
      <DemoStyle />
      <style dangerouslySetInnerHTML={{ __html: INFO_CSS }} />
      <InfoSprite />
      {/* Resplandor «luz de mañana»: nace detrás del header y baña también el hero. */}
      <LandingGlow />

      <LandingHeader current="/info" />

      <main id="contenido" tabIndex={-1} className="in-main outline-none">
        {/* ── HERO + DEMO VIVO ──────────────────────────────────── */}
        <section className="in-hero" id="inicio">
          <div className="lk-wrap in-hero-grid">
            <div>
              <Eyebrow>Compañero de lectura</Eyebrow>
              <h1 className="lk-display in-hero-h1 in-enter">
                Tu Biblia de papel, <em>cada mañana</em>.
              </h1>
              <p className="lk-lede in-hero-lede in-enter in-enter-2">
                Lee Tu Biblia te dice qué toca leer hoy, cuida tu hábito sin culpa y se hace a un lado: el texto lo leés
                vos, en tu Biblia.
              </p>
              <div className="in-hero-cta in-enter in-enter-3">
                <AppLink page="info" where="hero" className="lk-btn lk-btn-primary">
                  Empezar gratis
                </AppLink>
                <a href="#app" className="lk-textlink inline-flex min-h-11 items-center gap-1">
                  Cómo funciona <Ico name="down" />
                </a>
              </div>
              <p className="in-micro in-enter in-enter-4">
                <b>Gratis</b> · entrás con tu correo, sin contraseña · sin publicidad
              </p>
              <p className="in-trust in-enter in-enter-5">
                <span>Hecha por un pastor misionero</span>
                <span>En español, inglés y portugués</span>
                <span>Se instala sin tiendas</span>
              </p>
            </div>

            <TodayDemo />
          </div>
        </section>

        {/* ── LA IDEA + CUATRO GESTOS ───────────────────────────── */}
        <section className="in-sec" id="app">
          <div className="lk-wrap">
            <div className="in-idea">
              <PaperBible />
              <div className="in-rv in-rv-2">
                <Eyebrow>La idea</Eyebrow>
                <h2 className="lk-h2">
                  El texto vive en tus páginas. <em>Acá vive el hábito.</em>
                </h2>
                <p className="in-lede">
                  Lee Tu Biblia no es otro lector para la pantalla. Es el marcapáginas que te recuerda por dónde ibas,
                  te dice qué toca hoy y te deja seguir con tu día.
                </p>
                <p className="in-lede">
                  ¿Preferís leer en el teléfono? Con un toque abrís el pasaje en YouVersion o BibleGateway.
                </p>
              </div>
            </div>

            <div className="in-gestos">
              <h3 className="lk-h3 in-rv">Tu mañana, en cuatro gestos.</h3>
              <ol className="in-steps">
                {GESTOS.map(([title, desc], i) => (
                  <li key={title} className={`in-rv ${i > 0 ? `in-rv-${Math.min(i + 1, 3)}` : ''}`}>
                    <b>{title}</b>
                    <span>{desc}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── QUÉ INCLUYE (bento) ───────────────────────────────── */}
        <section className="in-sec in-bento-sec" id="incluye">
          <div className="lk-wrap">
            <div className="in-sec-head">
              <Eyebrow>Qué incluye</Eyebrow>
              <SectionTitle>
                Qué hace por vos, <em>cada día</em>.
              </SectionTitle>
              <p className="in-lede">Todo en la misma app, y todo gratis.</p>
            </div>

            <div className="in-bento" role="region" aria-label="Lo que incluye Lee Tu Biblia" tabIndex={0}>
              <article className="in-tile in-t-plan in-rv">
                <span className="in-big" aria-hidden="true">
                  13
                </span>
                <div>
                  <div className="in-k">
                    <Ico name="book" />
                    Planes
                  </div>
                  <h3>13 planes, uno a la vez</h3>
                  <p>
                    Desde Marcos en 16 días hasta toda la Biblia en un año. Elegís uno y lo leés a tu ritmo, en tu
                    Biblia.
                  </p>
                </div>
                <ul className="in-chips in-viz" aria-label="Algunos planes">
                  {PLANS.map((p) => (
                    <li key={p} className="in-chip">
                      {p}
                    </li>
                  ))}
                  <li className="in-chip in-n">+6 más</li>
                </ul>
              </article>

              <article className="in-tile in-t-racha in-rv in-rv-2">
                <div>
                  <div className="in-k">
                    <Ico name="chart" />
                    Racha
                  </div>
                  <h3>Un día en blanco no es una derrota</h3>
                  <p>Si te atrasás, te ofrece seguir desde donde quedaste. Sin avisos rojos.</p>
                </div>
                <div className="in-week in-viz" role="img" aria-label="Una semana de ejemplo: un solo día en blanco entre los leídos">
                  <span><i />L</span>
                  <span><i />M</span>
                  <span><i />M</span>
                  <span><i className="in-gap" />J</span>
                  <span><i />V</span>
                  <span><i />S</span>
                  <span><i className="in-today" />D</span>
                </div>
              </article>

              <article className="in-tile in-t-camino in-rv">
                <div>
                  <div className="in-k">
                    <Ico name="pencil" />
                    Mi camino
                  </div>
                  <h3>Una línea por día</h3>
                  <p>Anotá lo que te habló. Es privado: solo tuyo.</p>
                </div>
                <div className="in-note in-viz">
                  <small>Día 14 · tu nota</small>
                  <q>Me quedé pensando en esperar sin apurarme.</q>
                </div>
              </article>

              <article className="in-tile in-t-oracion in-rv in-rv-2">
                <div>
                  <div className="in-k in-oracion">
                    <Ico name="heart" />
                    Oración
                  </div>
                  <h3>Orar, acompañado</h3>
                  <p>Pedidos propios o compartidos, y testimonios cuando Dios responde.</p>
                </div>
                <div className="in-req in-viz">
                  <b>Por la operación de mi tío Raúl</b>
                  <div className="in-row">
                    <span className="in-pill hs-oracion">Estoy orando</span>
                    <span className="in-hands">
                      <i aria-hidden="true" style={{ background: '#57B795' }}>A</i>
                      <i aria-hidden="true" style={{ background: '#5B9FDF' }}>M</i>
                      <i aria-hidden="true" style={{ background: '#E2906C' }}>L</i>
                      <span>3 oran con vos</span>
                    </span>
                  </div>
                </div>
              </article>

              <article className="in-tile in-t-mat in-rv in-rv-3">
                <div>
                  <div className="in-k">
                    <Ico name="book" />
                    Materiales
                  </div>
                  <h3>Para leer despacio</h3>
                  <p>Catecismos, confesiones y las lecturas matutinas de Spurgeon.</p>
                  <Link to="/biblioteca" className="lk-textlink in-tile-link">
                    Conocé la Biblioteca
                  </Link>
                </div>
                <div className="in-covers in-viz" aria-hidden="true">
                  <div className="in-cover in-a"><small>Catecismo</small>Heidelberg</div>
                  <div className="in-cover in-b"><small>Catecismo</small>Westminster</div>
                  <div className="in-cover in-c"><small>Devocional</small>Spurgeon</div>
                </div>
              </article>

              <article className="in-tile in-t-medida in-rv">
                <div>
                  <div className="in-k">
                    <Ico name="text" />
                    A tu medida
                  </div>
                  <h3>Letra grande, si la necesitás</h3>
                  <p>Probalo: el tamaño llega hasta el 125 %.</p>
                </div>
                <div className="in-size in-viz">
                  <div className="in-seg" role="radiogroup" aria-label="Tamaño de letra del ejemplo">
                    <label><input type="radio" name="in-size" className="in-sz1" defaultChecked /><span>Normal</span></label>
                    <label><input type="radio" name="in-size" className="in-sz2" /><span>Grande</span></label>
                    <label><input type="radio" name="in-size" className="in-sz3" /><span>Más</span></label>
                  </div>
                  <p className="in-size-sample">
                    Hoy: Génesis <b>8 · 9 · 10 · 11</b>
                  </p>
                  <ul>
                    <li><Ico name="wifi" />La lectura de hoy se ve aun sin conexión</li>
                    <li><Ico name="bell" />Recordatorio a tu hora</li>
                  </ul>
                </div>
              </article>

              <article className="in-tile in-t-grupo in-rv in-rv-2">
                <div className="in-split">
                  <div>
                    <div className="in-k in-grupos">
                      <Ico name="people" />
                      Grupos
                    </div>
                    <h3>Un grupo, una misma lectura</h3>
                    <p>
                      Todos leen el mismo plan. Entre miembros solo se ve lo bueno: nunca dice quién no leyó. Cada uno
                      decide qué comparte.
                    </p>
                  </div>
                  <div className="in-pulse">
                    <div className="in-avatars" aria-hidden="true">
                      <i style={{ background: '#57B795' }}>A</i>
                      <i style={{ background: '#5B9FDF' }}>M</i>
                      <i style={{ background: '#E2906C' }}>L</i>
                      <i style={{ background: '#9F8BD4' }}>S</i>
                      <i style={{ background: '#49B0B8' }}>J</i>
                      <i className="in-more">+7</i>
                    </div>
                    <div className="in-head">
                      <b>Jóvenes</b>
                      <span>9 de 12 leyeron esta semana</span>
                    </div>
                    <div className="in-bar" role="img" aria-label="9 de 12, un 75 por ciento">
                      <i />
                    </div>
                    <ul className="in-mini">
                      <li>
                        <Ico name="book" />
                        <span>
                          Lectura del grupo<small>Marcos 4</small>
                        </span>
                      </li>
                      <li>
                        <Ico name="heart" />
                        <span>
                          Pedidos compartidos<small>3 activos · 1 testimonio</small>
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>
            <p className="in-micro" style={{ marginTop: 4 }}>
              Los nombres y los datos de las tarjetas son de ejemplo.
            </p>
          </div>
        </section>

        {/* ── LO QUE NO HACEMOS + QUIÉN HACE LEE TU BIBLIA ──────── */}
        <section className="in-sec in-nots" id="no-hacemos">
          <div className="lk-wrap">
            <div className="in-nots-grid">
              <div className="in-nots-head in-rv">
                <Eyebrow>Nuestras reglas</Eyebrow>
                <SectionTitle>
                  Lo que no hacemos, <em>a propósito</em>.
                </SectionTitle>
                <p className="in-lede in-sub">
                  Una app para la mañana tiene que ser tranquila. Estas son las reglas que nos pusimos.
                </p>
              </div>
              <ul className="in-nolist">
                {NOS.map(([title, desc]) => (
                  <li key={title} className="in-rv">
                    <span className="in-no" aria-hidden="true">No</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="in-who in-rv" aria-labelledby="quien">
              <div className="in-face" aria-hidden="true">
                <i>E</i>
                <i>T</i>
              </div>
              <div>
                <h3 id="quien">Quién hace Lee Tu Biblia</h3>
                <p>
                  <b>Somos Enrique y Tamara, misioneros.</b> Enrique, pastor, hizo esta app para que leer la Biblia cada
                  día sea más fácil, y la seguimos mejorando con lo que nos escriben. Es gratis porque vivimos de los
                  aportes de quienes sostienen nuestra misión; si querés dar una mano, hay una donación discreta, y si
                  no, usala tranquilo. Lo que nos escribas, lo leemos nosotros.
                </p>
                <p className="in-sign">Enrique y Tamara</p>
                <p className="in-links">
                  <a className="lk-textlink" href={MISSION_URL} target="_blank" rel="noopener noreferrer">
                    Conocé nuestra misión
                  </a>
                  <DonateLink className="in-linkbtn lk-textlink" />
                  <a className="lk-textlink" href={`mailto:${CONTACT_EMAIL}`}>
                    Escribinos
                  </a>
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* ── PARA LÍDERES (resumen; el detalle vive en /lideres) ─ */}
        <section className="in-sec in-leaders" id="lideres">
          <div className="lk-wrap in-lead-grid">
            <div className="in-rv">
              <Eyebrow tone="grupos">Para líderes</Eyebrow>
              <h2 className="lk-h2">
                Si guiás un grupo, <em>no lo dejes solo entre reuniones</em>.
              </h2>
              <p className="in-lede">
                Todos leen el mismo plan en su Biblia. Vos ves a quién animar esta semana y los pedidos de oración dejan
                de perderse en el chat.
              </p>
              <div className="in-lead-cta">
                <Link to="/lideres" className="lk-btn in-btn-grupos">
                  Ver la guía para líderes
                </Link>
                <a className="lk-textlink in-textlink-grupos in-lead-link" href={SHARE_HREF} target="_blank" rel="noopener noreferrer">
                  Mandale esta página a tu pastor
                </a>
              </div>
            </div>
            <div className="in-lcard in-rv in-rv-2">
              <p className="in-lcard-h">Se arma en tres pasos</p>
              <ol className="in-lsteps">
                {LEADER_STEPS.map(([title, desc]) => (
                  <li key={title}>
                    <b>{title}</b>
                    <span>{desc}</span>
                  </li>
                ))}
              </ol>
              <p className="in-lcard-f">
                <Ico name="lock" />
                <span>Cada persona decide qué comparte con el grupo.</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── INSTALAR ──────────────────────────────────────────── */}
        <section className="in-sec" id="instalar">
          <div className="lk-wrap in-install-grid">
            <div className="in-rv">
              <Eyebrow>Sin tiendas</Eyebrow>
              <SectionTitle>
                Instalala <em>en tu teléfono</em>.
              </SectionTitle>
              <p className="in-lede">No pasa por ninguna tienda: se instala desde esta página, en 3 pasos.</p>
              <InstallGuide />
            </div>
            <InstallArt />
          </div>
        </section>

        {/* ── PREGUNTAS ─────────────────────────────────────────── */}
        <section className="in-sec" id="preguntas" style={{ paddingTop: 0 }}>
          <div className="lk-wrap">
            <div className="in-sec-head in-center in-rv">
              <Eyebrow>Preguntas</Eyebrow>
              <SectionTitle>Lo que más nos preguntan.</SectionTitle>
            </div>
            <FaqList />
          </div>
        </section>

        {/* ── CIERRE ────────────────────────────────────────────── */}
        <section className="lk-closing" aria-labelledby="cierre">
          <div className="lk-wrap in-closing-in">
            <h2 className="lk-display" id="cierre">
              Esta mañana, <em>abrí tu Biblia</em>.
            </h2>
            <p className="in-lede">Nosotros te decimos por dónde seguir.</p>
            <AppLink page="info" where="cierre" className="lk-btn lk-btn-primary lk-btn-lg">
              Empezar gratis
            </AppLink>
            <p className="in-micro">
              <b>Gratis</b> · entrás con tu correo, sin contraseña · sin publicidad
            </p>
          </div>
        </section>
      </main>

      {/* ── FOOTER GLOBAL ────────────────────────────────────── */}
      <LandingFooter current="/info" />
    </div>
  )
}
