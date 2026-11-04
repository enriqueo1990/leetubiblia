// Imagen del plan terminado (4:5): el logro, en el mismo sistema que las
// portadas — la paleta de la marca (oscuro cálido con sepia), el lomo con el
// nombre del plan, el título en Newsreader y las dos cifras que lo cuentan.
// Los textos llegan con `t`/`locale` (este módulo no es un componente).
import { fmtISODate } from '../i18n/dates.js'
import { BRAND_SERIF, ensureBrandFont } from './brandFont.js'
import { coverPalette } from './materialTheme.js'
import { SANS, W, makeCanvas, toBlob, wrapWords, makeLogo, shareOrDownload, shareUrl } from './canvasKit.js'

const H = 1350
const SPINE = 136
const X = SPINE + 88
const RIGHT = 96
const TEXT_W = W - X - RIGHT
const TOP = 92
const BOTTOM = H - 80
const LOGO = 54

export async function buildCompletionImage({ planName, daysRead, longestStreak, startedOn, completedOn, t, locale, scale }) {
  await ensureBrandFont()
  const pal = coverPalette(null, 'color')
  const { canvas, ctx } = makeCanvas(W, H, scale)

  ctx.fillStyle = pal.c
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = pal.spine
  ctx.fillRect(0, 0, SPINE, H)

  // Lomo: el nombre del plan, como en un estante.
  ctx.save()
  ctx.font = `600 26px ${SANS}`
  ctx.letterSpacing = '7px'
  ctx.fillStyle = pal.spineInk
  let name = planName.toUpperCase()
  while (name.length > 4 && ctx.measureText(name).width > BOTTOM - TOP - LOGO - 60) name = `${name.slice(0, -2).trimEnd()}…`
  ctx.translate(SPINE / 2 + 9, TOP + ctx.measureText(name).width)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(name, 0, 0)
  ctx.restore()
  ctx.drawImage(makeLogo(LOGO * 2, pal.spineInk), (SPINE - LOGO) / 2, BOTTOM - LOGO + 6, LOGO, LOGO)

  // "Terminé de leer" en cursiva, y el plan grande.
  ctx.font = `italic 400 64px ${BRAND_SERIF}`
  ctx.fillStyle = pal.acc
  ctx.textBaseline = 'top'
  ctx.fillText(t('shareImage.finishedReading'), X, TOP)
  ctx.textBaseline = 'alphabetic'

  let size = 112
  const titleLines = () => {
    ctx.font = `500 ${size}px ${BRAND_SERIF}`
    ctx.letterSpacing = `${(-0.015 * size).toFixed(1)}px`
    const ls = wrapWords(ctx, planName, TEXT_W)
    ctx.letterSpacing = '0px'
    return ls
  }
  let tl = titleLines()
  while (tl.length > 3 && size > 72) {
    size -= 6
    tl = titleLines()
  }
  let y = TOP + 64 + 150
  ctx.font = `500 ${size}px ${BRAND_SERIF}`
  ctx.letterSpacing = `${(-0.015 * size).toFixed(1)}px`
  ctx.fillStyle = pal.ink
  for (const l of tl) {
    ctx.fillText(l, X, y + size * 0.82)
    y += size * 1.04
  }
  ctx.letterSpacing = '0px'

  // Las dos cifras, como en Strava: el dato manda, la etiqueta acompaña.
  const statsY = Math.max(y + 110, 820)
  const stats = [
    [String(daysRead), t('shareImage.dayInWord', { count: daysRead })],
    [String(longestStreak), t('shareImage.dayMaxStreak', { count: longestStreak })],
  ]
  stats.forEach(([big, label], i) => {
    const sx = X + i * (TEXT_W / 2)
    ctx.font = `700 120px ${SANS}`
    ctx.letterSpacing = '-3px'
    ctx.fillStyle = pal.ink
    ctx.fillText(big, sx, statsY)
    ctx.letterSpacing = '0px'
    ctx.font = `500 30px ${SANS}`
    ctx.fillStyle = pal.soft
    ctx.fillText(label, sx, statsY + 52)
  })

  // Fechas, y al pie la frase de la marca y la firma.
  const dateOpts = { day: 'numeric', month: 'short', year: 'numeric' }
  const desde = fmtISODate(startedOn, locale, dateOpts)
  const hasta = fmtISODate(completedOn, locale, dateOpts)
  if (hasta) {
    ctx.font = `500 30px ${SANS}`
    ctx.fillStyle = pal.soft
    ctx.fillText(desde ? `${desde} — ${hasta}` : hasta, X, statsY + 140)
  }
  ctx.font = `italic 400 34px ${BRAND_SERIF}`
  ctx.fillStyle = pal.acc
  ctx.fillText(t('shareImage.footer'), X, BOTTOM - 4)
  ctx.font = `500 27px ${SANS}`
  ctx.fillStyle = pal.soft
  ctx.textAlign = 'right'
  ctx.fillText('leetubiblia.com', W - RIGHT, BOTTOM)
  ctx.textAlign = 'left'

  return toBlob(canvas)
}

// Comparte (o descarga) la imagen del logro. Devuelve 'shared' | 'downloaded'.
export async function shareCompletion(data) {
  const blob = await buildCompletionImage(data)
  const text = `${data.t('shareImage.shareText', { plan: data.planName })}\n${shareUrl('plan')}`
  return shareOrDownload([{ blob, filename: 'lei-mi-plan.png' }], text)
}
