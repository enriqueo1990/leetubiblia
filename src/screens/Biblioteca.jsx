import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LandingStyle,
  LandingGlow,
  LandingHeader,
  LandingFooter,
  Eyebrow,
  SectionTitle,
  AppLink,
} from './landingKit.jsx'
import { scrollTopOnEnter, useLandingView } from './landingHydration.js'
import { INFO_CSS } from './infoStyles.js'
import { BIBLIOTECA_CSS } from './bibliotecaStyles.js'
import { BIBLIOTECA_META, BIBLIOTECA_FAQ, BOOKS, SHELVES, KIND_LABEL, LECTOR_DEMO } from './bibliotecaCopy.js'
import PhoneShot, { PhoneShotStyle } from './PhoneShot.jsx'
import { InfoSprite, Ico, FaqList } from './infoParts.jsx'
import { getMaterial } from '../lib/materials.js'
import { materialTheme } from '../lib/materialTheme.js'

// Landing pública /biblioteca — las «lecturas adicionales» de la app (en la app se
// llaman Biblioteca / materiales de lectura): diez catecismos, confesiones, credos
// y un devocional para sumar a Hoy. Misma familia visual que /info (sistema lk-* de
// landingSystem.js, estilos in-* de infoStyles.js) y estilos propios bb-*.
//
// Principios: la app acompaña la Biblia FÍSICA. Los pasajes de apoyo se muestran
// SOLO como referencias; las pantallas son capturas reales (PhoneShot) y la del
// lector muestra la pregunta 44 del Catecismo de Heidelberg (texto de catecismo de
// dominio público, traducción de esta edición, que no es Escritura; sus pasajes de
// apoyo, solo como referencias). De los demás libros se muestran nombre, año, cantidad y una
// línea de qué son: nunca su texto (las Lecturas matutinas llevan un versículo de
// encabezado, y los catecismos citan los mandamientos y el Padrenuestro).
//
// Prerender: se renderiza en Node (react-dom/server): nada de window/localStorage
// al renderizar. Título, descripción y FAQ salen de bibliotecaCopy.js, la misma
// fuente que usa el build para las meta tags y el FAQPage.

// Tapa de un libro, la de BookCover.jsx dibujada en CSS (el componente de la app usa
// usePreferences y fuentes registradas en runtime, y acá se prerenderiza): color,
// lomo más oscuro a la izquierda, el tipo arriba y el título en la serif de la marca.
// Decorativa: el nombre completo va en texto debajo.
function Cover({ slug, className = '' }) {
  const th = materialTheme(slug)
  return (
    <span
      className={`bb-cover ${className}`}
      aria-hidden="true"
      style={{ '--c': th.c, '--sp': th.spine, '--ink': th.ink, '--soft': th.soft, '--acc': th.acc }}
    >
      <span className="bb-cover-sp" />
      <span className="bb-cover-in">
        {th.kind && <span className="bb-cover-kind">{KIND_LABEL[th.kind]}</span>}
        <span className="bb-cover-title">{th.title}</span>
      </span>
    </span>
  )
}

const WHO = [
  {
    icon: 'book',
    kicker: 'Lectores',
    title: 'Si querés ir más hondo',
    text: 'Ya leés tu Biblia y querés entender mejor lo que creés. Sumá un catecismo: una pregunta por día, con sus pasajes para buscar en tu Biblia.',
  },
  {
    icon: 'people',
    kicker: 'Líderes',
    tone: 'grupos',
    title: 'Si guiás un grupo',
    text: 'Proponé un material para leer junto al plan del grupo. Cada quien lo agrega a su estante y avanza a su ritmo; en la reunión conversan lo que leyeron.',
    link: { to: '/lideres', text: 'Ver la guía para líderes' },
  },
  {
    icon: 'heart',
    kicker: 'Familias',
    title: 'Si hay chicos en casa',
    text: 'El Catecismo para Niños de Spurgeon tiene 48 preguntas de una o dos líneas, fáciles de aprender de memoria.',
  },
]

const LEGEND = [
  {
    title: 'Dónde vas',
    text: 'Arriba de cada pregunta: el número y el tema del bloque.',
    chips: [LECTOR_DEMO.position, LECTOR_DEMO.block],
  },
  {
    title: 'Qué dice',
    text: 'La pregunta y su respuesta, breves. Los libros más largos, como las confesiones, las dividen en párrafos.',
  },
  {
    title: 'Dónde buscarlo en tu Biblia',
    text: 'Los pasajes de apoyo son referencias, no texto. Cada una abre ese capítulo en tu app de Biblia, o la buscás en la de papel.',
    chips: [...LECTOR_DEMO.refs.slice(0, 3), `+${LECTOR_DEMO.refs.length - 3} más`],
  },
  {
    title: 'Tu marcador',
    text: '«Marcar como leído» lo mueve a la que sigue. Podés volver a las anteriores cuando quieras.',
  },
]

const STEPS = [
  ['Elegís un libro', 'Desde Hoy abrís la Biblioteca y tocás una portada: ves de qué trata y una muestra.'],
  ['Lo sumás a tu estante', 'Con «Agregar a mi estante». Desde ese momento aparece en Hoy, debajo de tu lectura, en «También hoy».'],
  ['Leés a tu ritmo', 'Una pregunta por día, varias de una vez o una pausa. Con «Marcar como leído» el marcador avanza. Sin atraso.'],
  ['Buscás los pasajes', 'Cada lectura trae sus pasajes de apoyo como referencias: los buscás en tu Biblia de papel o los abrís en tu app.'],
]

const EXTRAS = [
  'Una introducción histórica en cada libro',
  'Un índice para ir a cualquier entrada',
  'Compartir una frase como imagen, con la portada de tu libro',
  'Disponible sin conexión después de abrirlo una vez',
]

const NOS = [
  ['No reemplaza tu Biblia.', 'Los pasajes de apoyo son referencias. El texto bíblico lo leés en tu Biblia, la de papel o la de tu app.'],
  ['No reemplaza a tu pastor.', 'Son lecturas para acompañarte. Lo que no entiendas o te inquiete, conversalo con quien te pastorea.'],
  ['No interpreta por vos.', 'Cada texto se presenta con su redacción histórica y una introducción. No le agregamos comentarios nuestros.'],
  ['No impone una tradición.', 'Hay libros de varias tradiciones y ninguno viene activado. Elegís cuáles sumar, y los quitás cuando quieras.'],
  ['No te apura.', 'El marcador espera donde lo dejaste, y las matutinas siempre muestran la de hoy: nada se acumula.'],
]

export default function Biblioteca() {
  useLandingView('biblioteca')
  useEffect(() => {
    document.title = BIBLIOTECA_META.title
    scrollTopOnEnter()
  }, [])

  return (
    <div className="in-page bb-page relative isolate min-h-[100dvh] bg-app text-ink">
      <LandingStyle />
      <PhoneShotStyle />
      <style dangerouslySetInnerHTML={{ __html: INFO_CSS + BIBLIOTECA_CSS }} />
      <InfoSprite />
      <LandingGlow />

      <LandingHeader current="/biblioteca" />

      <main id="contenido" tabIndex={-1} className="in-main outline-none">
        {/* ── HERO ──────────────────────────────────────────────── */}
        <section className="in-hero" id="inicio">
          <div className="lk-wrap in-hero-grid">
            <div>
              <Eyebrow>Biblioteca</Eyebrow>
              <h1 className="lk-display in-hero-h1 bb-h1 in-enter">
                Para leer despacio, <em>además de tu Biblia</em>.
              </h1>
              <p className="lk-lede in-hero-lede in-enter in-enter-2">
                Diez lecturas de la tradición cristiana para sumar a tu día: credos, catecismos, confesiones y un
                devocional para cada mañana. Las agregás a tu estante y aparecen en Hoy, junto a tu lectura.
              </p>
              <div className="in-hero-cta in-enter in-enter-3">
                <AppLink page="biblioteca" where="hero" className="lk-btn lk-btn-primary">
                  Empezar gratis
                </AppLink>
                <a href="#estantes" className="lk-textlink inline-flex min-h-11 items-center gap-1">
                  Ver los diez libros <Ico name="down" />
                </a>
              </div>
              <p className="in-micro in-enter in-enter-4">
                <b>Gratis</b> · entrás con tu correo, sin contraseña · sin publicidad
              </p>
              <p className="in-trust in-enter in-enter-5">
                <span>Textos históricos de dominio público</span>
                <span>Sin calendario ni atraso</span>
                <span>En español</span>
              </p>
            </div>

            <div className="bb-hero-shot in-enter in-enter-2">
              <PhoneShot
                shot="biblioteca"
                priority
                tilt
                width={310}
                caption="La Biblioteca: tu estante y los libros para agregar."
                alt="Pantalla Biblioteca de la app: «En tu estante», con las portadas del Catecismo de Heidelberg y del Catecismo Menor de Westminster y su avance, y debajo «Para agregar», con las portadas de los Credos de la iglesia antigua, la Confesión Belga y los Cánones de Dort."
              />
            </div>
          </div>
        </section>

        {/* ── QUÉ ES Y PARA QUIÉN ───────────────────────────────── */}
        <section className="in-sec" id="que-es">
          <div className="lk-wrap">
            <div className="in-sec-head in-rv">
              <Eyebrow>Qué es</Eyebrow>
              <SectionTitle>
                Una biblioteca <em>que vos elegís</em>.
              </SectionTitle>
              <p className="in-lede">
                Son textos que muchas generaciones de creyentes han leído para aprender la fe: los credos antiguos,
                catecismos y confesiones de la Reforma, y un devocional para cada mañana del año. Cada uno abre con
                una introducción histórica y se lee de a poco.
              </p>
            </div>

            <div className="bb-who">
              {WHO.map((w, i) => (
                <article key={w.title} className={`bb-card in-rv ${i > 0 ? `in-rv-${Math.min(i + 1, 3)}` : ''}`}>
                  <div className={`in-k ${w.tone === 'grupos' ? 'in-grupos' : ''}`}>
                    <Ico name={w.icon} />
                    {w.kicker}
                  </div>
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                  {w.link && (
                    <Link to={w.link.to} className={`lk-textlink bb-card-link ${w.tone === 'grupos' ? 'in-textlink-grupos' : ''}`}>
                      {w.link.text}
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── EL LECTOR (demo) ──────────────────────────────────── */}
        <section className="in-sec bb-band" id="lector">
          <div className="lk-wrap bb-reader">
            <div className="in-rv">
              <Eyebrow>Cómo se lee</Eyebrow>
              <SectionTitle>
                Cada lectura, <em>una ficha</em>.
              </SectionTitle>
              <p className="in-lede">
                Una pregunta por vez, con lo justo para leerla en un rato. Los pasajes quedan como referencias: el
                texto está en tu Biblia.
              </p>
              <ul className="bb-legend">
                {LEGEND.map((l) => (
                  <li key={l.title}>
                    <b>{l.title}</b>
                    <span>{l.text}</span>
                    {l.chips && (
                      <ul className="in-chips bb-chips" aria-label={l.title}>
                        {l.chips.map((c, i) => (
                          <li key={c} className={`in-chip ${i === l.chips.length - 1 && /^\+/.test(c) ? 'in-n' : ''}`}>
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bb-reader-demo in-rv in-rv-2">
              <PhoneShot
                shot="lector"
                width={320}
                caption="Una pregunta del Catecismo de Heidelberg, como se lee en la app."
                alt="Lector de la Biblioteca: la ficha de la pregunta 44 del Catecismo de Heidelberg, con su número, el bloque al que pertenece, la pregunta y la respuesta, una fila de pasajes de apoyo como referencias, y debajo los botones Marcar como leído y Anterior."
              />
            </div>
          </div>
        </section>

        {/* ── LOS DIEZ LIBROS ───────────────────────────────────── */}
        <section className="in-sec" id="estantes">
          <div className="lk-wrap">
            <div className="in-sec-head in-rv">
              <Eyebrow>Los diez libros</Eyebrow>
              <SectionTitle>
                Elegí por dónde <em>empezar</em>.
              </SectionTitle>
              <p className="in-lede">
                Ninguno viene activado: agregás los que querés. Si no sabés cuál, la app sugiere empezar por el
                Catecismo Menor de Westminster, las Lecturas matutinas o los Credos.
              </p>
            </div>

            <div className="bb-shelves">
              {SHELVES.map((shelf) => (
                <section key={shelf.id} className={`bb-shelf in-rv ${shelf.slugs.length === 1 ? 'bb-solo' : ''}`} aria-labelledby={`bb-s-${shelf.id}`}>
                  <header className="bb-shelf-head">
                    <h3 className="lk-h4" id={`bb-s-${shelf.id}`}>
                      {shelf.title}
                    </h3>
                    <p>{shelf.note}</p>
                  </header>
                  <ul className="bb-books">
                    {shelf.slugs.map((slug) => {
                      const book = BOOKS[slug]
                      return (
                        <li key={slug} className="bb-book">
                          <Cover slug={slug} />
                          <div className="bb-book-t">
                            <h4>{getMaterial(slug).name}</h4>
                            <p className="bb-book-m">{[book.year, book.count].filter(Boolean).join(' · ')}</p>
                            <p className="bb-book-b">{book.blurb}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <p className="in-micro bb-note">
              Las tradiciones no coinciden en todo, y la app no te dice cuál es «la correcta». Los materiales están en
              español.
            </p>
          </div>
        </section>

        {/* ── CÓMO SE USA ───────────────────────────────────────── */}
        <section className="in-sec bb-band" id="como-se-usa">
          <div className="lk-wrap bb-use">
            <div>
              <div className="in-rv">
                <Eyebrow>Cómo se usa</Eyebrow>
                <SectionTitle>
                  Tu estante, <em>a tu ritmo</em>.
                </SectionTitle>
              </div>
              <ol className="bb-steps">
                {STEPS.map(([title, desc], i) => (
                  <li key={title} className={`in-rv ${i > 0 ? `in-rv-${Math.min(i + 1, 3)}` : ''}`}>
                    <b>{title}</b>
                    <span>{desc}</span>
                  </li>
                ))}
              </ol>
              <ul className="bb-extras in-rv" aria-label="Además">
                {EXTRAS.map((e) => (
                  <li key={e}>
                    <Ico name="plus" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bb-use-demo in-rv in-rv-2">
              <PhoneShot
                shot="hoy"
                width={310}
                caption="Los libros de tu estante aparecen en Hoy, bajo tu lectura."
                alt="Pantalla Hoy de la app: el plan Cronológico en el día 14 y, en «También hoy», el Catecismo de Heidelberg y el Catecismo Menor de Westminster con su portada y su avance, y un acceso a la Biblioteca."
              />
            </div>
          </div>
        </section>

        {/* ── LO QUE NO HACE ────────────────────────────────────── */}
        <section className="in-sec in-nots" id="no-hacemos">
          <div className="lk-wrap">
            <div className="in-nots-grid">
              <div className="in-nots-head in-rv">
                <Eyebrow>Nuestras reglas</Eyebrow>
                <SectionTitle>
                  Lo que la Biblioteca no hace, <em>a propósito</em>.
                </SectionTitle>
                <p className="in-lede in-sub">Una lectura para acompañar tu Biblia tiene que saber cuál es su lugar.</p>
              </div>
              <ul className="in-nolist">
                {NOS.map(([title, desc]) => (
                  <li key={title} className="in-rv">
                    <span className="in-no" aria-hidden="true">
                      No
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── PREGUNTAS ─────────────────────────────────────────── */}
        <section className="in-sec" id="preguntas">
          <div className="lk-wrap">
            <div className="in-sec-head in-center in-rv">
              <Eyebrow>Preguntas</Eyebrow>
              <SectionTitle>Lo que más nos preguntan.</SectionTitle>
            </div>
            <FaqList items={BIBLIOTECA_FAQ} />
          </div>
        </section>

        {/* ── CIERRE ────────────────────────────────────────────── */}
        <section className="lk-closing" aria-labelledby="cierre">
          <div className="lk-wrap in-closing-in">
            <h2 className="lk-display" id="cierre">
              Tu Biblia primero. <em>Después, un libro más</em>.
            </h2>
            <p className="in-lede">Empezá con tu plan de lectura y sumá un libro a tu estante cuando quieras.</p>
            <AppLink page="biblioteca" where="cierre" className="lk-btn lk-btn-primary lk-btn-lg">
              Empezar gratis
            </AppLink>
            <p className="in-micro">
              <b>Gratis</b> · entrás con tu correo, sin contraseña · sin publicidad
            </p>
          </div>
        </section>
      </main>

      <LandingFooter current="/biblioteca" />
    </div>
  )
}
