import { useEffect, useState, useCallback } from 'react'

// Acentos disponibles. Los hex pintan las muestras del selector; el color vivo de
// la app lo aplica tokens.css vía data-accent (cada key necesita su regla allí).
// Bloque 1: 6 tonos sepia (README). Bloque 2: 6 pasteles para público joven —
// suaves pero con cuerpo suficiente para leerse como texto y fondo de botón.
export const ACCENTS = [
  { key: 'sepia_base', light: '#A88B6A', dark: '#C2A57E', name: 'Sepia' },
  { key: 'sepia_clay', light: '#B08968', dark: '#CBA585', name: 'Arcilla' },
  { key: 'sepia_olive', light: '#8C8A5E', dark: '#ABA876', name: 'Oliva' },
  { key: 'sepia_stone', light: '#9C9080', dark: '#BBB0A0', name: 'Piedra' },
  { key: 'sepia_rose', light: '#B08A86', dark: '#CBA7A2', name: 'Rosa' },
  { key: 'sepia_slate', light: '#7E8A8C', dark: '#9CAAAC', name: 'Pizarra' },
  { key: 'pastel_lavender', light: '#9F8BD4', dark: '#BCA9E6', name: 'Lavanda' },
  { key: 'pastel_pink', light: '#D585A8', dark: '#ECA9C6', name: 'Chicle' },
  { key: 'pastel_mint', light: '#57B795', dark: '#82D0B1', name: 'Menta' },
  { key: 'pastel_sky', light: '#6FA4D8', dark: '#9BC5EC', name: 'Cielo' },
  { key: 'pastel_coral', light: '#E2906C', dark: '#F1B095', name: 'Coral' },
  { key: 'pastel_aqua', light: '#49B0B8', dark: '#79CFD5', name: 'Turquesa' },
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
