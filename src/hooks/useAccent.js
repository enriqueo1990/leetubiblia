import { useEffect, useState, useCallback } from 'react'

// Acentos disponibles. Los hex pintan las muestras del selector; el color vivo de
// la app lo aplica tokens.css vía data-accent (cada key necesita su regla allí).
// Ocho familias con personalidad. `light`/`dark` pintan la muestra suave; los
// botones usan la variante fuerte definida en tokens.css para admitir texto blanco.
export const ACCENTS = [
  { key: 'sepia_base', light: '#A88B6A', dark: '#C2A57E', name: 'Sepia' },
  { key: 'sepia_olive', light: '#8C8A5E', dark: '#ABA876', name: 'Oliva' },
  { key: 'pastel_lavender', light: '#9F8BD4', dark: '#BCA9E6', name: 'Lavanda' },
  { key: 'pastel_pink', light: '#D585A8', dark: '#ECA9C6', name: 'Chicle' },
  { key: 'pastel_mint', light: '#57B795', dark: '#82D0B1', name: 'Menta' },
  { key: 'pastel_sky', light: '#6FA4D8', dark: '#9BC5EC', name: 'Cielo' },
  { key: 'pastel_coral', light: '#E2906C', dark: '#F1B095', name: 'Coral' },
  { key: 'pastel_aqua', light: '#49B0B8', dark: '#79CFD5', name: 'Turquesa' },
]

const STORAGE_KEY = 'ltb.accent'
const DEFAULT = 'sepia_base'
const LEGACY_ACCENTS = {
  sepia_clay: 'sepia_base',
  sepia_stone: 'sepia_base',
  sepia_rose: 'pastel_pink',
  sepia_slate: 'pastel_sky',
}

function normalizeAccent(key) {
  const normalized = LEGACY_ACCENTS[key] ?? key
  return ACCENTS.some((accent) => accent.key === normalized) ? normalized : DEFAULT
}

function applyAccent(key) {
  document.documentElement.setAttribute('data-accent', key)
}

export function useAccent() {
  const [accent, setAccentState] = useState(
    () => normalizeAccent(localStorage.getItem(STORAGE_KEY) || DEFAULT)
  )

  useEffect(() => {
    applyAccent(accent)
    localStorage.setItem(STORAGE_KEY, accent)
  }, [accent])

  const setAccent = useCallback((key) => setAccentState(normalizeAccent(key)), [])

  return { accent, setAccent, accents: ACCENTS }
}
