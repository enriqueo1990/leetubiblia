import { useSyncExternalStore } from 'react'
import {
  canInstallApp,
  requestAppInstall,
  subscribeInstallPrompt,
} from '../lib/installPrompt.js'

// El tercer argumento de useSyncExternalStore es la foto para el servidor y para
// la hidratación: las landings se prerenderizan, así que el primer render NUNCA
// puede saber si el navegador ofreció instalar. Con createRoot (la app privada)
// ese argumento no se usa y el valor sale directo del módulo.
const serverSnapshot = () => false

export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(subscribeInstallPrompt, canInstallApp, serverSnapshot)

  return {
    canInstall,
    promptInstall: requestAppInstall,
  }
}
