// Puro: el cuadrado más grande centrado dentro de una imagen de w×h (el recorte
// de la foto de perfil).
export function centerSquare(w, h) {
  const side = Math.min(w, h)
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side }
}
