// "Tu Biblia, hoy": la foto de tu propia Biblia de papel con una capa encima.
// Es la imagen más propia de la app (la Biblia física es la protagonista) y la
// más auténtica para compartir. La foto se compone en el teléfono y nunca se
// sube a ningún servidor.
//
// Tres capas:
//  - 'dato':   lo que leíste hoy, grande, y dos cifras (días con tu Biblia,
//              días seguidos), como en Strava. Ideal para historias.
//  - 'minimo': fecha y hora, el pasaje y el día, sin más. Tipo BeReal.
//  - 'nota':   tu nota del día en una tarjeta translúcida.
// El texto va del lado que elijas (arriba o abajo) para no tapar la Biblia, y
// siempre sobre una sombra: sobre una página clara o plantas, sin ella no se lee.
import { BRAND_SERIF, ensureBrandFont } from './brandFont.js'
import { SANS, W, FORMAT_H, SAFE_ZONES, formatOf, makeCanvas, toBlob, wrapWords, makeLogo, roundRect, fitSize } from './canvasKit.js'

const M = 96 // margen lateral
const WHITE = '#FFFFFF'
const SOFT = 'rgba(255,255,255,.82)'

// Decodifica la foto respetando la orientación de la cámara (EXIF).
export async function decodePhoto(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* algunos navegadores no aceptan la opción: probamos con <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

// Dibuja la foto cubriendo el lienzo (como object-fit: cover), centrada.
function drawCover(ctx, img, w, h) {
  const iw = img.width ?? img.naturalWidth
  const ih = img.height ?? img.naturalHeight
  const s = Math.max(w / iw, h / ih)
  const dw = iw * s
  const dh = ih * s
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

function scrim(ctx, H, position, extent) {
  const g =
    position === 'top' ? ctx.createLinearGradient(0, 0, 0, H * extent) : ctx.createLinearGradient(0, H, 0, H * (1 - extent))
  g.addColorStop(0, 'rgba(12,9,6,.9)')
  g.addColorStop(0.5, 'rgba(12,9,6,.72)')
  g.addColorStop(1, 'rgba(12,9,6,0)')
  ctx.fillStyle = g
  if (position === 'top') ctx.fillRect(0, 0, W, H * extent)
  else ctx.fillRect(0, H * (1 - extent), W, H * extent)
}

function serifLines(ctx, text, size, width) {
  ctx.font = `500 ${size}px ${BRAND_SERIF}`
  ctx.letterSpacing = `${(-0.015 * size).toFixed(1)}px`
  const lines = wrapWords(ctx, text, width)
  ctx.letterSpacing = '0px'
  return lines
}

function writeLines(ctx, lines, font, size, lh, color, x, y, spacing = 0) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.letterSpacing = `${spacing}px`
  for (const l of lines) {
    ctx.fillText(l, x, y + size * 0.82)
    y += size * lh
  }
  ctx.letterSpacing = '0px'
  return y
}

// Firma: logo calado en blanco + leetubiblia.com.
function brand(ctx, x, y) {
  ctx.drawImage(makeLogo(100, WHITE), x, y, 50, 50)
  ctx.font = `600 30px ${SANS}`
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.fillText('leetubiblia.com', x + 66, y + 35)
}

// data: { passage, day, daysRead, streak, dateLabel, timeLabel, note,
//         labels: { kicker, daysRead, streak, noteKicker, dayN } } (i18n resuelta).
// position: 'top' | 'bottom'. Devuelve un Blob JPEG (es una foto).
export async function buildBiblePhoto({ photo, layer = 'dato', format = 'story', position = 'top', data, scale }) {
  format = formatOf(format)
  await ensureBrandFont()
  const H = FORMAT_H[format]
  const safe = SAFE_ZONES[format]
  const top = Math.max(80, safe.top)
  const bottom = H - Math.max(80, safe.bottom)
  const { canvas, ctx } = makeCanvas(W, H, scale)
  ctx.fillStyle = '#1c1915'
  ctx.fillRect(0, 0, W, H)
  if (photo) drawCover(ctx, photo, W, H)
  const textW = W - M * 2
  const { labels } = data

  if (layer === 'dato') {
    // Cuánto mide el bloque (para ubicarlo arriba o abajo).
    const size = fitSize({ max: 108, min: 60, step: 4, room: 2 * 108 * 1.04, measure: (s) => serifLines(ctx, data.passage, s, textW).length * s * 1.04 }) ?? 60
    const pl = serifLines(ctx, data.passage, size, textW)
    const stats = [
      data.daysRead > 0 && [String(data.daysRead), labels.daysRead],
      data.streak >= 2 && [String(data.streak), labels.streak],
    ].filter(Boolean)
    const blockH = 30 + 22 + pl.length * size * 1.04 + (stats.length ? 56 + 76 + 12 + 26 * 1.2 : 0) + 64 + 50
    scrim(ctx, H, position, Math.min(0.62, (blockH + top + 220) / H))
    let y = position === 'top' ? top : bottom - blockH
    y = writeLines(ctx, [labels.kicker.toUpperCase()], `600 30px ${SANS}`, 30, 1, SOFT, M, y, 3.5) + 22
    y = writeLines(ctx, pl, `500 ${size}px ${BRAND_SERIF}`, size, 1.04, WHITE, M, y, -0.015 * size)
    if (stats.length) {
      y += 56
      stats.forEach(([big, label], i) => {
        const sx = M + i * 360
        ctx.font = `700 76px ${SANS}`
        ctx.letterSpacing = '-1.5px'
        ctx.fillStyle = WHITE
        ctx.fillText(big, sx, y + 76 * 0.8)
        ctx.letterSpacing = '0px'
        ctx.font = `500 26px ${SANS}`
        ctx.fillStyle = SOFT
        ctx.fillText(label, sx, y + 76 + 12 + 26 * 0.85)
      })
      y += 76 + 12 + 26 * 1.2
    }
    brand(ctx, M, y + 64)
  }

  if (layer === 'minimo') {
    const size = 64
    const pl = serifLines(ctx, data.passage, size, textW - 80)
    const blockH = 27 * 1.3 + 14 + pl.length * size * 1.08 + 14 + 26
    scrim(ctx, H, position, Math.min(0.42, (blockH + 260) / H))
    let y = position === 'top' ? top : bottom - blockH
    y = writeLines(ctx, [`${data.dateLabel} · ${data.timeLabel}`], `500 27px ${SANS}`, 27, 1.3, SOFT, M, y) + 14
    y = writeLines(ctx, pl, `500 ${size}px ${BRAND_SERIF}`, size, 1.08, WHITE, M, y, -1) + 14
    writeLines(ctx, [labels.dayN.toUpperCase()], `600 26px ${SANS}`, 26, 1, SOFT, M, y, 2.6)
    ctx.drawImage(makeLogo(112, WHITE), W - M - 56, y - 22, 56, 56)
  }

  if (layer === 'nota') {
    const inner = textW - 120
    const qs = fitSize({ max: 62, min: 40, step: 2, room: 6 * 62 * 1.14, measure: (s) => serifLines(ctx, `«${data.note}»`, s, inner).length * s * 1.14 }) ?? 40
    let ql = serifLines(ctx, `«${data.note}»`, qs, inner)
    if (ql.length > 8) ql = [...ql.slice(0, 7), `${ql[7]}…`]
    ctx.font = `500 27px ${SANS}`
    const metaL = wrapWords(ctx, `${data.passage} · ${labels.dayN}`, inner)
    const cardH = 56 + 25 + 26 + ql.length * qs * 1.14 + 30 + metaL.length * 27 * 1.35 + 38 + 50 + 48
    const x = 64
    const cw = W - 128
    const cy = position === 'top' ? Math.max(64, safe.top) : H - Math.max(64, safe.bottom) - cardH
    // Vidrio: la foto desenfocada dentro de la tarjeta (donde el navegador lo
    // permite) y un tinte oscuro encima; sin blur, el tinte solo alcanza.
    ctx.save()
    roundRect(ctx, x, cy, cw, cardH, 44)
    ctx.clip()
    if (photo && 'filter' in ctx) {
      ctx.filter = 'blur(28px) saturate(1.3)'
      drawCover(ctx, photo, W, H)
      ctx.filter = 'none'
    }
    ctx.fillStyle = 'rgba(28,22,16,.5)'
    ctx.fillRect(x, cy, cw, cardH)
    ctx.restore()
    roundRect(ctx, x, cy, cw, cardH, 44)
    ctx.strokeStyle = 'rgba(255,255,255,.18)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    let y = cy + 56
    y = writeLines(ctx, [labels.noteKicker.toUpperCase()], `600 25px ${SANS}`, 25, 1, 'rgba(255,255,255,.72)', x + 60, y, 2.6) + 26
    y = writeLines(ctx, ql, `500 ${qs}px ${BRAND_SERIF}`, qs, 1.14, WHITE, x + 60, y, -0.6) + 30
    y = writeLines(ctx, metaL, `500 27px ${SANS}`, 27, 1.35, SOFT, x + 60, y) + 38
    // La firma, alineada a la derecha de la tarjeta.
    ctx.font = `600 30px ${SANS}`
    brand(ctx, x + cw - 60 - 66 - ctx.measureText('leetubiblia.com').width, y)
  }

  return toBlob(canvas, 'image/jpeg', 0.9)
}
