import { useCallback, useEffect, useState } from 'react'

// Tamaño de letra de la app: 'normal' (sigue al sistema: en iOS, Dynamic Type vía
// `font: -apple-system-body` en index.css) | 'large' (112,5 %) | 'larger' (125 %).
// Todo el texto va en rem, así que cambiar el font-size de <html> lo escala. Se
// guarda en el dispositivo (como el tema); index.html lo aplica antes de pintar.
const STORAGE_KEY = 'ltb.text_size'
const CLASS = { large: 'text-large', larger: 'text-larger' }

function read() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'large' || v === 'larger' ? v : 'normal'
  } catch {
    return 'normal'
  }
}

function apply(size) {
  const root = document.documentElement
  root.classList.remove('text-large', 'text-larger')
  if (CLASS[size]) root.classList.add(CLASS[size])
}

export function useTextSize() {
  const [textSize, setTextSizeState] = useState(read)

  useEffect(() => {
    apply(textSize)
    try {
      localStorage.setItem(STORAGE_KEY, textSize)
    } catch {
      /* sin storage: el cambio vale solo esta sesión */
    }
  }, [textSize])

  const setTextSize = useCallback((s) => setTextSizeState(s), [])
  return { textSize, setTextSize }
}
