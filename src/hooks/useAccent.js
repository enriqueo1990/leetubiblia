import { useEffect, useState, useCallback } from 'react'

// Los 6 acentos sepia (README — tabla de tokens). El orden es el de la fila de
// muestras en Ajustes. Los hex se usan para pintar las muestras del selector;
// el color vivo de la app lo aplica tokens.css vía data-accent.
export const ACCENTS = [
  { key: 'sepia_base', light: '#A88B6A', dark: '#C2A57E', name: 'Sepia' },
  { key: 'sepia_clay', light: '#B08968', dark: '#CBA585', name: 'Arcilla' },
  { key: 'sepia_olive', light: '#8C8A5E', dark: '#ABA876', name: 'Oliva' },
  { key: 'sepia_stone', light: '#9C9080', dark: '#BBB0A0', name: 'Piedra' },
  { key: 'sepia_rose', light: '#B08A86', dark: '#CBA7A2', name: 'Rosa' },
  { key: 'sepia_slate', light: '#7E8A8C', dark: '#9CAAAC', name: 'Pizarra' },
]

const STORAGE_KEY = 'ltb.accent'
const DEFAULT = 'sepia_base'

function applyAccent(key) {
  document.documentElement.setAttribute('data-accent', key)
}

export function useAccent() {
  const [accent, setAccentState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT
  )

  useEffect(() => {
    applyAccent(accent)
    localStorage.setItem(STORAGE_KEY, accent)
  }, [accent])

  const setAccent = useCallback((key) => setAccentState(key), [])

  return { accent, setAccent, accents: ACCENTS }
}
