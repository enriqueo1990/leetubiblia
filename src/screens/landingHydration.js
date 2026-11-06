import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

// Las landings se emiten prerenderizadas (ver vite.config.js › ltb-landing-html) y
// React las hidrata. Lo que depende del navegador o de la historia (¿navegador
// interno?, ¿app de tienda?, ¿llegaste desde Ajustes?) NO puede decidirse en el
// primer render sin desajustar la hidratación: esta bandera vale false al
// prerenderizar y durante la hidratación, y true en cuanto el cliente manda.
const noopSubscribe = () => () => {}
export function useClientSide(read) {
  return useSyncExternalStore(noopSubscribe, read, () => false)
}

// Origen interno (state.from de la navegación) leído sin desajustar la hidratación.
export function useAppOrigin() {
  const from = useLocation().state?.from
  const hydrated = useClientSide(() => true)
  return hydrated ? from : undefined
}

// Al entrar a una landing por navegación interna, arriba de todo (el router no
// resetea el scroll). En la carga en frío NO: el HTML ya estaba pintado y el
// navegador puede estar restaurando la posición o yendo a un #ancla.
export function scrollTopOnEnter() {
  if (window.__ltbHydrating) {
    window.__ltbHydrating = false
    return
  }
  window.scrollTo(0, 0)
}
