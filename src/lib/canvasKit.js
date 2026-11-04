// Piezas comunes de las imágenes que se comparten (portada, carrusel, foto de
// tu Biblia, plan terminado): medidas y zonas seguras de cada formato, corte de
// líneas, el logo, y el flujo de compartir o descargar.

export const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif'
export const W = 1080

// Formatos: publicación 4:5 (feed, chats y carrusel) e historia 9:16. 'square'
// es el nombre viejo de la publicación (quedó guardado en dispositivos).
export const FORMAT_H = { post: 1350, story: 1920 }
export const formatOf = (format) => (format === 'story' ? 'story' : 'post')

// Zonas que tapa la interfaz de Instagram y WhatsApp en una historia (barras y
// nombre arriba; respuesta abajo). Nada importante se dibuja ahí.
export const SAFE_ZONES = { post: { top: 0, bottom: 0 }, story: { top: 250, bottom: 330 } }

// Supersampling: el lienzo físico duplica los 1080 lógicos. WhatsApp e
// Instagram recomprimen al compartir; partir de 2160 deja el texto nítido.
export const SCALE = 2

export function makeCanvas(w, h, scale = SCALE) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  return { canvas, ctx }
}

export const toBlob = (canvas, type = 'image/png', quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality))

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Corte de línea por palabras (con la fuente ya puesta en ctx). El espacio duro
// (U+00A0) no corta: sirve para frases indivisibles como "Pregunta 1 de 129".
export function wrapWords(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const word of String(text).split(/[ \t\r\n]+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

// Logo calado: contenedor del color pedido y el libro transparente (el fondo se
// ve a través del trazo). Se genera desde los paths del favicon, sin red.
export function makeLogo(sizePx, color = '#FFFFFF') {
  const c = document.createElement('canvas')
  c.width = sizePx
  c.height = sizePx
  const g = c.getContext('2d')
  g.scale(sizePx / 64, sizePx / 64) // los paths viven en el viewBox 64×64
  g.fillStyle = color
  roundRect(g, 0, 0, 64, 64, 14)
  g.fill()
  g.globalCompositeOperation = 'destination-out'
  g.lineWidth = 3
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.stroke(new Path2D('M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z'))
  g.stroke(new Path2D('M32 20v28'))
  return c
}

// Enlace que viaja con cada imagen compartida (en WhatsApp va como texto del
// mensaje; Instagram lo ignora). `ref` dice de dónde salió, para medir qué se
// comparte: 'material', 'nota', 'plan', 'biblia'.
export function shareUrl(ref) {
  return `${window.location.origin}/?ref=${encodeURIComponent(ref)}`
}

// Hoja nativa si el dispositivo comparte archivos (móvil): las imágenes van
// juntas (álbum en WhatsApp, carrusel en Instagram). Si no, se descargan en
// orden (desktop). Cancelar la hoja no es un error. Devuelve 'shared' | 'downloaded'.
export async function shareOrDownload(items, text) {
  if (!items.length || items.some((it) => !it.blob)) throw new Error('no-blob')
  const files = items.map((it) => new File([it.blob], it.filename, { type: it.blob.type || 'image/png' }))

  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share(text ? { files, text } : { files })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'shared' // el usuario canceló
      // si falla el share, caemos a descarga
    }
  }

  for (const [i, it] of items.entries()) {
    // Un respiro entre descargas: algunos navegadores frenan las seguidas.
    if (i) await new Promise((r) => setTimeout(r, 250))
    const url = URL.createObjectURL(it.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = it.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return 'downloaded'
}

// Ajuste de cuerpo: el tamaño más grande (de `max` a `min`, de a `step`) en el
// que `measure(size)` entra en `room`. Devuelve null si ni el mínimo entra.
export function fitSize({ max, min, step = 2, room, measure }) {
  for (let size = max; size >= min; size -= step) if (measure(size) <= room) return size
  return null
}
