// Matemática pura de la foto de perfil: el recorte por defecto (el cuadrado del
// centro) y el encuadre que elige la persona en la hoja de recorte.
//
// Encuadre: la imagen (w×h píxeles) se muestra dentro de un visor cuadrado de
// V px. Con zoom 1 la imagen "cubre" el visor (su lado corto mide V); el zoom la
// agranda. (x, y) es cuánto se corrió la imagen desde el centro, en px del
// visor. Nunca queda hueco: el corrimiento se limita para que la imagen siempre
// tape el visor entero.

export function centerSquare(w, h) {
  const side = Math.min(w, h)
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side }
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

const scaleFor = (w, h, V, zoom) => (V / Math.min(w, h)) * zoom

// El corrimiento permitido para un zoom: lo que sobra de imagen a cada lado.
export function clampOffset(w, h, V, zoom, x, y) {
  const s = scaleFor(w, h, V, zoom)
  const maxX = Math.max(0, (w * s - V) / 2)
  const maxY = Math.max(0, (h * s - V) / 2)
  // `+ 0` convierte un -0 en 0.
  return { x: Math.min(maxX, Math.max(-maxX, x)) + 0, y: Math.min(maxY, Math.max(-maxY, y)) + 0 }
}

// El cuadrado de la imagen original que se ve en el visor.
export function cropRect(w, h, V, zoom, x, y) {
  const s = scaleFor(w, h, V, zoom)
  const left = V / 2 - (w * s) / 2 + x
  const top = V / 2 - (h * s) / 2 + y
  const side = V / s
  return { sx: -left / s, sy: -top / s, side }
}

// Cómo se dibuja la imagen dentro del visor (para la vista previa).
export function displayBox(w, h, V, zoom, x, y) {
  const s = scaleFor(w, h, V, zoom)
  return { width: w * s, height: h * s, left: V / 2 - (w * s) / 2 + x, top: V / 2 - (h * s) / 2 + y }
}

export const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
