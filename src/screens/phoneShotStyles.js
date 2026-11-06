import { FRAME_CSS, dark } from './demoStyles.js'

// CSS de PhoneShot (src/screens/PhoneShot.jsx): una captura real de la app dentro del
// marco de teléfono de los demos (FRAME_CSS en demoStyles.js). Va aparte del marco
// para que una página con demos y capturas no lo repita: DemoStyle (landingDemos.jsx)
// = DEMO_CSS + PS_CSS; PhoneShotStyle = FRAME_CSS + PS_CSS.
//
// Claro / noche sin JS: cada captura trae TRES <picture>:
//  - .ps-auto: elige por prefers-color-scheme con <source media>. Es la que se ve casi
//    siempre y la única que se descarga (en el hero va eager; el resto, lazy).
//  - .ps-light y .ps-dark: siempre lazy y con display:none (un <img> lazy dentro de
//    algo display:none no se descarga). Solo se muestran cuando la página tiene el tema
//    FORZADO distinto del sistema (clases .light/.dark en <html>, como en los demos) o
//    cuando se activa «Ver en noche / Ver en claro» (checkbox .ps-flipbox, :has()). Solo
//    en esos casos se baja la segunda imagen.
export const PS_CSS = `
.ps-screen{aspect-ratio:780/1688}
.ps-pic{display:block; width:100%; height:100%}
.ps-pic img{display:block; width:100%; height:auto}
.ps-light, .ps-dark{display:none}
.in-static.ps-tilt .in-phone{transform:rotate(1.4deg)}
/* Las capturas no traen barra de estado: la isla del marco taparía el saludo o los títulos. */
.ps .in-phone::before{display:none}

/* Tema forzado distinto del sistema */
@media (prefers-color-scheme: light){
  :root.dark .ps-auto{display:none}
  :root.dark .ps-dark{display:block}
}
@media (prefers-color-scheme: dark){
  :root.light .ps-auto{display:none}
  :root.light .ps-light{display:block}
}

/* «Ver en noche»: la captura toma la paleta contraria a la de la página */
.ps:has(.ps-flipbox:checked) .ps-auto{display:none}
.ps:has(.ps-flipbox:checked) .ps-dark{display:block}
.ps:has(.ps-flipbox:checked) .ps-light{display:none}
${dark('.ps:has(.ps-flipbox:checked) .ps-dark', 'display:none')}
${dark('.ps:has(.ps-flipbox:checked) .ps-light', 'display:block')}
`

export const PHONESHOT_CSS = FRAME_CSS + PS_CSS
