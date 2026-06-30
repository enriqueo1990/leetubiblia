// Genera una imagen-tarjeta del logro de plan terminado y la comparte.
// Tema fijo cálido (independiente de claro/oscuro): la imagen sale igual de
// linda en cualquier dispositivo. Sin librerías ni fuentes externas.

const W = 1080
const H = 1350
const CREAM = '#F5F0E6'
const CREAM_2 = '#EDE6D6'
const INK = '#1C1C1E'
const SOFT = '#6B6760'
const SEPIA = '#A88B6A'

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Ajusta el tamaño de fuente para que el texto entre en maxWidth (hasta 2 líneas).
function fitLines(ctx, text, maxWidth, startSize, font) {
  let size = startSize
  for (; size > 28; size -= 4) {
    ctx.font = `700 ${size}px ${font}`
    const words = text.split(' ')
    const lines = []
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = w
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { lines, size }
    }
  }
  return { lines: [text], size }
}

function fmt(dateISO) {
  if (!dateISO) return null
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// Dibuja la tarjeta y devuelve un Blob PNG.
export async function buildCompletionImage({ planName, daysRead, longestStreak, startedOn, completedOn }) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const SERIF = 'Georgia, "Times New Roman", serif'
  const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif'

  // Fondo cálido con degradé suave.
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, CREAM)
  g.addColorStop(1, CREAM_2)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Marco tipo certificado.
  ctx.strokeStyle = SEPIA
  ctx.globalAlpha = 0.45
  ctx.lineWidth = 3
  roundRect(ctx, 60, 60, W - 120, H - 120, 36)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'

  // Marca arriba.
  ctx.fillStyle = SEPIA
  ctx.font = `600 30px ${SANS}`
  ctx.letterSpacing = '8px'
  ctx.fillText('LEE TU BIBLIA', W / 2, 180)
  ctx.letterSpacing = '0px'

  // Sello circular con check.
  const cx = W / 2
  const cy = 360
  ctx.beginPath()
  ctx.arc(cx, cy, 90, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(168,139,106,0.13)'
  ctx.fill()
  ctx.strokeStyle = SEPIA
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - 38, cy + 4)
  ctx.lineTo(cx - 12, cy + 32)
  ctx.lineTo(cx + 42, cy - 32)
  ctx.stroke()

  // "Terminé de leer"
  ctx.fillStyle = SOFT
  ctx.font = `400 40px ${SANS}`
  ctx.fillText('Terminé de leer', W / 2, 560)

  // Nombre del plan (serif, grande, hasta 2 líneas).
  const { lines, size } = fitLines(ctx, planName, W - 220, 96, SERIF)
  ctx.fillStyle = INK
  ctx.font = `700 ${size}px ${SERIF}`
  const lineH = size * 1.15
  let ty = 560 + 110
  for (const l of lines) {
    ctx.fillText(l, W / 2, ty)
    ty += lineH
  }

  // Bloque de stats.
  const statsY = Math.max(ty + 90, 900)
  const stats = [
    [String(daysRead), daysRead === 1 ? 'día en la Palabra' : 'días en la Palabra'],
    [String(longestStreak), longestStreak === 1 ? 'día de racha máxima' : 'días de racha máxima'],
  ]
  const colW = (W - 240) / 2
  stats.forEach(([big, label], i) => {
    const colX = 120 + colW * i + colW / 2
    ctx.fillStyle = SEPIA
    ctx.font = `700 86px ${SERIF}`
    ctx.fillText(big, colX, statsY)
    ctx.fillStyle = SOFT
    ctx.font = `400 30px ${SANS}`
    ctx.fillText(label, colX, statsY + 50)
  })

  // Separador.
  ctx.strokeStyle = SEPIA
  ctx.globalAlpha = 0.3
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - 120, statsY + 110)
  ctx.lineTo(W / 2 + 120, statsY + 110)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Fechas.
  const desde = fmt(startedOn)
  const hasta = fmt(completedOn)
  if (hasta) {
    ctx.fillStyle = SOFT
    ctx.font = `400 32px ${SANS}`
    const range = desde ? `${desde} — ${hasta}` : hasta
    ctx.fillText(range, W / 2, statsY + 180)
  }

  // Pie.
  ctx.fillStyle = SEPIA
  ctx.font = `400 italic 34px ${SERIF}`
  ctx.fillText('Un día a la vez, en su Palabra', W / 2, H - 130)

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Comparte (o descarga) la imagen del logro. Devuelve 'shared' | 'downloaded'.
export async function shareCompletion(data) {
  const blob = await buildCompletionImage(data)
  if (!blob) throw new Error('no-blob')
  const file = new File([blob], 'lei-mi-plan.png', { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        text: `¡Terminé de leer ${data.planName} en Lee Tu Biblia! 🙏`,
      })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'shared' // el usuario canceló
      // si falla el share, caemos a descarga
    }
  }

  // Fallback: descargar la imagen.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lei-mi-plan.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
