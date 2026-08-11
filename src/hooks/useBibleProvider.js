import { useEffect, useState, useCallback } from 'react'

// Proveedor externo para abrir pasajes (Ajustes → Proveedor de Biblia). Los
// labels son nombres propios (no se traducen), igual que LOCALES en useLocale.
export const BIBLE_PROVIDERS = [
  { key: 'youversion', label: 'YouVersion' },
  { key: 'biblegateway', label: 'BibleGateway' },
]

const STORAGE_KEY = 'ltb.bibleProvider'
const DEFAULT_PROVIDER = 'youversion'

export function useBibleProvider() {
  const [bibleProvider, setBibleProviderState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_PROVIDER
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, bibleProvider)
  }, [bibleProvider])

  const setBibleProvider = useCallback((key) => {
    if (BIBLE_PROVIDERS.some((p) => p.key === key)) setBibleProviderState(key)
  }, [])

  return { bibleProvider, setBibleProvider, bibleProviders: BIBLE_PROVIDERS }
}
