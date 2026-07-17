import { useSyncExternalStore } from 'react'
import {
  canInstallApp,
  getInstallPromptRevision,
  requestAppInstall,
  subscribeInstallPrompt,
} from '../lib/installPrompt.js'

export function useInstallPrompt() {
  useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptRevision,
    () => 0
  )

  return {
    canInstall: canInstallApp(),
    promptInstall: requestAppInstall,
  }
}
