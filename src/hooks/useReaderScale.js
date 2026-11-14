import { useCallback, useEffect, useState } from 'react'

// Tamaño de la letra de lectura (como en Kindle): escala SOLO el texto de los
// libros en el lector (respuesta, meditación, introducción), en cinco pasos. Se
// suma al tamaño general de Ajustes (todo va en rem). Se guarda en el
// dispositivo, como el tema.
export const READER_SCALES = [0.9, 1, 1.12, 1.25, 1.4]
const DEFAULT = 1
const STORAGE_KEY = 'ltb.reader_scale'

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT
    const i = Number(raw)
    return Number.isInteger(i) && i >= 0 && i < READER_SCALES.length ? i : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function useReaderScale() {
  const [step, setStep] = useState(read)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(step))
    } catch {
      /* sin storage: vale solo esta sesión */
    }
  }, [step])

  const smaller = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])
  const larger = useCallback(() => setStep((s) => Math.min(READER_SCALES.length - 1, s + 1)), [])
  return { step, scale: READER_SCALES[step], smaller, larger, steps: READER_SCALES.length }
}
