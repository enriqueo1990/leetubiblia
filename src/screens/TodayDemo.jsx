import { useId } from 'react'

// Demo vivo de la pantalla Hoy para las landings: el teléfono dibujado en HTML/CSS
// (estilos en infoStyles.js, clases `in-*`), con datos de EJEMPLO y SOLO
// referencias de capítulos —nunca texto bíblico—. Sin estado de React ni JS:
//  - «Marcar como leído» es un <label> de un checkbox real (operable con teclado);
//    al marcarlo, el CSS (:has) dibuja el check, pasa la barra a «Leído hoy», sube la
//    racha y «También hoy» cede el lugar a «Tu día».
//  - «Ver en noche / Ver en claro» es otro checkbox que le da al demo la paleta
//    contraria a la de la página.
// Las cadenas son las de la app (hoy.markRead, hoy.day.*, hoy.alsoToday,
// hoy.streakDays, myTime.done.bye). Los dos estados están siempre en el DOM; el
// inactivo se oculta con `visibility`, así el lector de pantalla no lee ambos.
// Se renderiza en Node al prerenderizar: no leas window/localStorage acá.

const Chev = () => (
  <svg className="in-chev" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
)

const IconPeople = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c.4-3 2.6-4.6 5.5-4.6s5.1 1.6 5.5 4.6" />
    <circle cx="17" cy="9.5" r="2.3" />
    <path d="M16.5 14.6c2.4-.2 3.8 1 4.2 3.4" />
  </svg>
)
const IconBook = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 6.5C10.2 5.2 7.8 4.7 4 5v12c3.8-.3 6.2.2 8 1.5m0-12c1.8-1.3 4.2-1.8 8-1.5v12c-3.8-.3-6.2.2-8 1.5m0-12v12" />
  </svg>
)
const IconHeart = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
  </svg>
)
const IconChart = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 20V11M12 20V5M19 20v-6" />
  </svg>
)

export default function TodayDemo() {
  const readId = useId()
  const flipId = useId()

  return (
    <div className="in-demo" role="group" aria-label="Demo de la pantalla Hoy, con datos de ejemplo">
      <div className="in-phone">
        <div className="in-screen">
          <div className="in-sc">
            <input id={readId} type="checkbox" className="in-read" aria-label="Marcar como leído (demo)" />
            <div className="in-sc-status" aria-hidden="true">
              <span>7:12</span>
              <i />
            </div>
            <div className="in-sc-body">
              <div className="in-sc-greet">
                <span>Buen día, Lucía</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                  <circle cx="16" cy="7" r="2" />
                  <circle cx="8" cy="17" r="2" />
                </svg>
              </div>

              <div className="in-sc-card">
                <div className="in-sc-plan">
                  Cronológico
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div className="in-sc-dayrow">
                  <span>Día 14</span>
                  <span className="in-sc-streak">
                    <span className="in-s-before">
                      <span aria-hidden="true">✦ </span>6 días seguidos
                    </span>
                    <span className="in-s-after">
                      <span aria-hidden="true">✦ </span>7 días seguidos
                    </span>
                  </span>
                </div>
                <div className="in-sc-prog" aria-hidden="true">
                  <i />
                </div>
                <p className="in-sc-ref">Génesis</p>
                <div className="in-sc-chips" role="group" aria-label="Capítulos 8, 9, 10 y 11">
                  <b>8</b>
                  <b>9</b>
                  <b>10</b>
                  <b>11</b>
                </div>
                <p className="in-sc-hint">Buscá estos pasajes en tu Biblia. Cuando termines, marcá el día.</p>
              </div>

              <div className="in-sc-swap">
                <div className="in-sc-also">
                  <p className="in-sc-label">También hoy</p>
                  <div className="in-sc-rows">
                    <div className="in-sc-row">
                      <span className="in-ic">
                        <IconPeople />
                      </span>
                      <span>
                        <b>Jóvenes · lectura del grupo</b>
                        <small>Marcos 4</small>
                      </span>
                      <Chev />
                    </div>
                    <div className="in-sc-row">
                      <span className="in-ic in-m">
                        <IconBook />
                      </span>
                      <span>
                        <b>Catecismo de Heidelberg</b>
                        <small>Domingo 14</small>
                      </span>
                      <Chev />
                    </div>
                  </div>
                </div>
                <div className="in-sc-day" aria-live="polite">
                  <p className="in-sc-label">Tu día</p>
                  <div className="in-sc-rows">
                    <div className="in-sc-row">
                      <span className="in-dot in-on">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7" />
                        </svg>
                      </span>
                      <b>Leíste tu lectura</b>
                      <Chev />
                    </div>
                    <div className="in-sc-row">
                      <span className="in-dot" />
                      <b>¿Qué te habló hoy?</b>
                      <Chev />
                    </div>
                    <div className="in-sc-row">
                      <span className="in-dot" />
                      <span>
                        <b>Orar por un pedido</b>
                        <small>Por la operación de mi tío</small>
                      </span>
                      <Chev />
                    </div>
                  </div>
                  <p className="in-sc-foot">
                    <em>
                      <span aria-hidden="true">✦ </span>14 días leídos
                    </em>{' '}
                    · Nos vemos mañana.
                  </p>
                </div>
              </div>
            </div>

            <div className="in-sc-bar">
              <label className="in-btn-mark" htmlFor={readId}>
                <span className="in-b-before">Marcar como leído</span>
                <span className="in-b-after" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path pathLength="1" d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                  Leído hoy
                </span>
              </label>
            </div>
            <div className="in-sc-tabs" aria-hidden="true">
              <span className="in-on">
                <IconBook />
                Hoy
              </span>
              <span>
                <IconHeart />
                Oración
              </span>
              <span>
                <IconPeople />
                Grupos
              </span>
              <span>
                <IconChart />
                Progreso
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="in-demo-cap">
        <span>Demo con datos de ejemplo. Tocá «Marcar como leído».</span>
        <label className="in-flip" htmlFor={flipId}>
          <input id={flipId} type="checkbox" className="in-flipbox" />
          <svg className="in-ico in-i-sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
          </svg>
          <svg className="in-ico in-i-moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />
          </svg>
          <span className="in-l-light">Ver en noche</span>
          <span className="in-l-dark">Ver en claro</span>
        </label>
      </div>
    </div>
  )
}
