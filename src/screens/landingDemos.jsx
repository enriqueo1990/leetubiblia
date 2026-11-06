import { DEMO_CSS } from './demoStyles.js'
import { PS_CSS } from './phoneShotStyles.js'
import { materialTheme } from '../lib/materialTheme.js'

// Demos de pantalla para las landings: la app dibujada en HTML/CSS con datos de
// EJEMPLO y SOLO referencias de capítulos (nunca texto bíblico: la Biblia es la de
// papel). Quedan SOLO las pantallas de las que no hay captura real, porque hacen
// falta otros usuarios: Hoy con la lectura de un grupo, la sala del grupo y el pulso
// del líder. El resto de las pantallas (Hoy, Orar ahora, Oración, Progreso,
// Biblioteca y el lector) son capturas reales: ver PhoneShot.jsx. Cada demo lleva el
// rótulo «Demo con datos de ejemplo», que lo distingue de una captura.
//
// Son estáticos, acompañan el modo claro/noche de la página, no necesitan JS ni se
// mueven. Cada pantalla sigue a la de la app (Hoy.jsx, GroupDetail y groupDetail/*)
// y repite sus cadenas de es.json (groupDetail.*, hoy.*). Si la app cambia, se
// actualiza acá. Los nombres son inventados. Cada demo es un role="img" con su
// descripción: el lector de pantalla recibe el resumen, no la maqueta.
//
// Se renderiza en Node al prerenderizar: nada de window/localStorage acá. La
// página que use un demo monta <DemoStyle /> una vez (incluye el marco y los estilos
// de PhoneShot, así que no hace falta montar PhoneShotStyle además).

export function DemoStyle() {
  return <style dangerouslySetInnerHTML={{ __html: DEMO_CSS + PS_CSS }} />
}

// ── Íconos (mismo trazo que la app; el tamaño lo pone el CSS de cada contenedor) ──
const Svg = ({ children, className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
)
export const IconPeople = () => (
  <Svg>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c.4-3 2.6-4.6 5.5-4.6s5.1 1.6 5.5 4.6" />
    <circle cx="17" cy="9.5" r="2.3" />
    <path d="M16.5 14.6c2.4-.2 3.8 1 4.2 3.4" />
  </Svg>
)
export const IconBook = () => (
  <Svg>
    <path d="M12 6.5C10.2 5.2 7.8 4.7 4 5v12c3.8-.3 6.2.2 8 1.5m0-12c1.8-1.3 4.2-1.8 8-1.5v12c-3.8-.3-6.2.2-8 1.5m0-12v12" />
  </Svg>
)
export const IconHeart = () => (
  <Svg>
    <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
  </Svg>
)
export const IconChart = () => (
  <Svg>
    <path d="M5 20V11M12 20V5M19 20v-6" />
  </Svg>
)
const IconChev = () => (
  <svg className="in-chev" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
)
const IconSliders = () => (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
)
const IconPencil = () => (
  <Svg>
    <path d="M4 20l1-4L16.5 4.5a2 2 0 012.8 2.8L7.8 18.8 4 20zM14.5 6.5l3 3" />
  </Svg>
)
const IconShare = () => (
  <Svg>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
  </Svg>
)
const IconPlus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
const IconCheck = () => (
  <Svg>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
)
const IconLock = () => (
  <Svg>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Svg>
)

const TABS = [
  ['Hoy', IconBook],
  ['Oración', IconHeart],
  ['Grupos', IconPeople],
  ['Progreso', IconChart],
]
function Tabs({ on }) {
  return (
    <div className="in-sc-tabs" aria-hidden="true">
      {TABS.map(([label, Icon], i) => (
        <span key={label} className={i === on ? 'in-on' : undefined}>
          <Icon />
          {label}
        </span>
      ))}
    </div>
  )
}

// El marco: teléfono + leyenda. `alt` es lo que oye el lector de pantalla;
// `caption` lo que lee quien mira (una frase corta de lo que muestra). `tab` marca la
// pestaña activa (omitirlo = sin barra de pestañas, como el modo foco de Orar ahora).
// `width` fija el ancho máximo en px (el teléfono escala entero, todo va en --u).
function DemoFrame({ alt, caption, time = '7:12', tab, width = 340, children }) {
  return (
    <figure className="in-demo in-static in-demo-fig" style={{ '--demo-w': `${width}px` }}>
      <div className="in-phone" role="img" aria-label={`Demo con datos de ejemplo. ${alt}`}>
        <div className="in-screen">
          <div className="in-sc">
            <div className="in-sc-status" aria-hidden="true">
              <span>{time}</span>
              <i />
            </div>
            {children}
            {tab != null && <Tabs on={tab} />}
          </div>
        </div>
      </div>
      <figcaption className="in-demo-cap">
        <b>{caption}</b>
        <span>Demo con datos de ejemplo</span>
      </figcaption>
    </figure>
  )
}

// ── Hoy ────────────────────────────────────────────────────────────────

// Los pasajes del día en la serif de la marca: el libro en tinta y el capítulo en
// el acento (PassageList). Son referencias: el texto queda en la Biblia de papel.
function Passages({ refs }) {
  return (
    <div className="in-sc-pass">
      {refs.map(([book, n]) => (
        <p key={`${book}${n}`}>
          {book} <span>{n}</span>
        </p>
      ))}
    </div>
  )
}

function ReadingCard({ plan, day, streak, pct, refs, hint }) {
  return (
    <div className="in-sc-card">
      <div className="in-sc-plan">
        {plan}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <div className="in-sc-dayrow">
        <span>Día {day}</span>
        {streak && (
          <span className="in-sc-streak">
            <span aria-hidden="true">✦ </span>
            {streak}
          </span>
        )}
      </div>
      <div className="in-sc-prog" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
      <Passages refs={refs} />
      {hint && <p className="in-sc-hint">{hint}</p>}
    </div>
  )
}

function Greeting() {
  return (
    <div className="in-sc-greet">
      <span>Buen día, Lucía</span>
      <IconSliders />
    </div>
  )
}

function MarkBar() {
  return (
    <div className="in-sc-bar">
      <div className="in-btn-mark">
        <span className="in-b-before">Marcar como leído</span>
      </div>
    </div>
  )
}

// Fila de un grupo en «También hoy»: ícono y nombre, los pasajes debajo y a la
// derecha el día del plan del grupo (TodayExtraRows).
function GroupRow({ name, refs, meta }) {
  return (
    <div className="in-sc-row in-sc-grow">
      <span>
        <b>
          <IconPeople />
          {name}
        </b>
        <small>{refs}</small>
      </span>
      <span className="in-sc-meta">{meta}</span>
      <IconChev />
    </div>
  )
}

// Fila de un material de la Biblioteca: su portada, el nombre y una barra de avance.
function MaterialRow({ name, pct, meta, slug }) {
  return (
    <div className="in-sc-row in-sc-mrow">
      <span className="in-sc-cover" aria-hidden="true" style={{ background: materialTheme(slug).c }} />
      <span>
        <b>{name}</b>
        <span className="in-sc-mbar" style={{ '--w': `${pct}%` }}>
          <i />
          <em>{meta}</em>
        </span>
      </span>
    </div>
  )
}

// Hoy con la lectura del grupo debajo de la propia (lo que ve cada miembro).
export function HoyConGruposDemo({ width }) {
  return (
    <DemoFrame
      width={width}
      tab={0}
      caption="Hoy: tu lectura y, debajo, la de cada grupo."
      alt="Pantalla Hoy: arriba tu lectura personal, los capítulos 8 a 11 de Génesis, y debajo, en «También hoy», la lectura de dos grupos con el día de su plan y un material de la Biblioteca."
    >
      <div className="in-sc-body in-fade">
        <Greeting />
        <ReadingCard
          plan="Cronológico"
          day={14}
          streak="6 días seguidos"
          pct={4}
          refs={[['Génesis', 8], ['Génesis', 9], ['Génesis', 10], ['Génesis', 11]]}
        />
        <div className="in-sc-extras">
          <p className="in-sc-label">También hoy</p>
          <div className="in-sc-rows">
            <GroupRow name="Grupo de los martes" refs="Proverbios 3" meta="Día 3 de 31" />
            <GroupRow name="Jóvenes" refs="Marcos 4" meta="Día 4 de 16" />
            <MaterialRow slug="heidelberg" name="Catecismo de Heidelberg" pct={22} meta="28 de 129" />
          </div>
        </div>
      </div>
      <MarkBar />
    </DemoFrame>
  )
}

// ── Grupo ──────────────────────────────────────────────────────────────

function Avatars({ initials }) {
  return (
    <span className="in-sc-avs" aria-hidden="true">
      {initials.map((x) => (
        <i key={x}>{x}</i>
      ))}
    </span>
  )
}

// La sala del grupo vista por quien lidera: el pulso de hoy, el plan en común y los
// pedidos compartidos con «Estoy orando».
export function SalaGrupoDemo({ width }) {
  return (
    <DemoFrame
      width={width}
      tab={2}
      time="20:30"
      caption="La sala del grupo: el pulso de hoy, el plan en común y la oración compartida."
      alt="Sala del grupo de los martes: cinco personas, «Vos y 4 más leyeron hoy», el plan Proverbios en 31 días en el día 3 y dos pedidos de oración compartidos."
    >
      <div className="in-sc-body in-fade">
        <div className="in-sc-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
          Grupos
        </div>
        <div className="in-sc-hd">
          <h2 className="in-sc-title">
            <span>Grupo de los martes</span>
            <IconPencil />
          </h2>
          <span className="in-sc-fab">
            <IconShare />
          </span>
        </div>
        <p className="in-sc-meta2">5 caminando juntos · liderás el grupo</p>

        <div className="in-sc-pulse">
          <p className="in-sc-sl">Hoy</p>
          <div>
            <IconBook />
            <span>Vos y 4 más leyeron hoy</span>
          </div>
          <div>
            <IconHeart />
            <span>
              <b>2</b> orando · <b>3</b> pedidos activos
            </span>
          </div>
        </div>

        <div className="in-sc-sec">
          <p className="in-sc-sl">Plan del grupo</p>
          <span className="in-sc-act">Cambiar</span>
        </div>
        <div className="in-sc-c in-sc-pad">
          <p className="in-sc-pt">Proverbios en 31 días</p>
          <p className="in-sc-ps">Día 3 de 31</p>
          <p className="in-sc-ok">
            <IconCheck />
            Lo estás leyendo con el grupo
          </p>
        </div>

        <div className="in-sc-sec">
          <p className="in-sc-sl">Oración</p>
          <span className="in-sc-act">
            <IconPlus />
            Compartir un pedido
          </span>
        </div>
        <div className="in-sc-c">
          <div>
            <div className="in-sc-pr">
              <p className="in-sc-pt">Sabiduría para una decisión importante</p>
              <p className="in-sc-pd">Se viene un cambio en el trabajo y no sé qué camino tomar.</p>
              <div className="in-sc-pf">
                <span>
                  Mateo ·
                  <Avatars initials={['S', 'T']} />2 orando
                </span>
                <span className="in-sc-pill">Estoy orando</span>
              </div>
            </div>
          </div>
          <div>
            <div className="in-sc-pr">
              <p className="in-sc-pt">Salud de mi mamá</p>
              <p className="in-sc-pd">Esta semana le hacen unos estudios.</p>
              <div className="in-sc-pf">
                <span>Sofía · nadie todavía</span>
                <span className="in-sc-pill">Estoy orando</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}

const WEEK = ['S', 'D', 'L', 'M', 'M', 'J', 'V'] // siete días terminando hoy (viernes)
const MEMBERS = [
  { name: 'Lucía', me: true, week: [1, 1, 0, 1, 1, 1, 1] },
  { name: 'Mateo', week: [1, 1, 1, 1, 0, 1, 1] },
  { name: 'Sofía', week: [0, 1, 1, 0, 1, 1, 1] },
  { name: 'Tomás', week: [0, 0, 1, 1, 0, 0, 0] },
  { name: 'Valentina', week: [1, 1, 1, 1, 1, 1, 1] },
]

// Lo que ve solo quien lidera, más abajo en el grupo: el resumen de oración y la
// lectura de los últimos siete días de cada miembro que la comparte.
export function PulsoLiderDemo({ width }) {
  return (
    <DemoFrame
      width={width}
      tab={2}
      time="20:31"
      caption="Solo para vos: los últimos siete días de lectura de cada miembro."
      alt="Más abajo en el grupo, solo para quien lidera: un resumen de oración con tres pedidos activos y dos respondidos, y una grilla con los últimos siete días de lectura de Lucía, Mateo, Sofía, Tomás y Valentina."
    >
      <div className="in-sc-body in-fade">
        <div className="in-sc-sec" style={{ marginTop: 'calc(6*var(--u))' }}>
          <p className="in-sc-sl">Miembros · 5</p>
        </div>
        <div className="in-sc-c">
          <div className="in-sc-mem">
            <span className="in-ava">L</span>
            <span>
              Lucía <em>(vos)</em>
              <small>Lidera el grupo</small>
            </span>
            <span className="in-sc-chip">
              <IconCheck />
              Leyó hoy
            </span>
          </div>
          <div className="in-sc-mem">
            <span className="in-ava">M</span>
            <span>Mateo</span>
            <span className="in-sc-chip">
              <IconCheck />
              Leyó hoy
            </span>
          </div>
        </div>

        <div className="in-sc-c" style={{ marginTop: 'calc(18*var(--u))' }}>
          <div className="in-sc-pad" style={{ padding: 'calc(18*var(--u)) calc(18*var(--u)) calc(16*var(--u))' }}>
            <div className="in-sc-lock">
              <IconLock />
              <p className="in-sc-sl">Resumen · solo vos lo ves</p>
            </div>
            <div className="in-sc-stats">
              <div>
                <b>3</b>
                <span>Pedidos activos</span>
              </div>
              <div>
                <b>2</b>
                <span>Respondidos</span>
              </div>
              <div>
                <b>4</b>
                <span>Orando esta semana</span>
              </div>
            </div>
            <div className="in-sc-meter" aria-hidden="true">
              <i />
            </div>
            <p className="in-sc-note">40% de los pedidos del grupo ya fueron respondidos.</p>
          </div>
          <div className="in-sc-pad" style={{ padding: 'calc(18*var(--u)) calc(18*var(--u)) calc(16*var(--u))' }}>
            <p className="in-sc-sl">Lectura de la semana</p>
            <div className="in-sc-week">
              <div className="in-sc-wr">
                <span />
                <div className="in-sc-dots">
                  {WEEK.map((d, i) => (
                    <i key={i} className={`in-L ${i === 6 ? 'in-now' : ''}`}>
                      {d}
                    </i>
                  ))}
                </div>
              </div>
              {MEMBERS.map((m) => (
                <div key={m.name} className="in-sc-wr">
                  <span>
                    {m.name}
                    {m.me && <em> (vos)</em>}
                  </span>
                  <div className="in-sc-dots">
                    {m.week.map((r, i) => (
                      <i key={i} className={r ? 'in-r' : undefined} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="in-sc-note">
              Cada punto es un día en que esa persona marcó su lectura. Solo aparecen quienes comparten.
            </p>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
