import { useSyncExternalStore } from 'react'
import {
  getAppUpdateSnapshot,
  subscribeToAppUpdate,
} from '../lib/appUpdate.js'

export function useAppUpdate() {
  return useSyncExternalStore(
    subscribeToAppUpdate,
    getAppUpdateSnapshot,
    () => false
  )
}
