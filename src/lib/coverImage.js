// La portada: la imagen que se comparte de una lectura adicional (o de una nota).
// Cada material tiene su color, como una colección de libros: lomo con el nombre
// a la izquierda, el número en cursiva, la frase en serif editorial (Newsreader),
// y al pie el dato personal y la firma. Variante 'papel': fondo hueso con el lomo
// del color del material. Los textos llegan resueltos en i18n.
import { BRAND_SERIF, ensureBrandFont } from './brandFont.js'
import { coverPalette } from './materialTheme.js'
import { SANS, W, FORMAT_H, SAFE_ZONES, formatOf, makeCanvas, toBlob, wrapWords, makeLogo, fitSize, shareOrDownload } from './canvasKit.js'

const SPINE = 136
const PAD = { top: 92, right: 96, bottom: 80, left: 88 }
const QUOTE_LH = 1.12
const QUOTE_MAX = { post: 104, story: 124 }
const QUOTE_MIN = 46
const NUMBER = 64
const SUB = 27
const FOOT = 27
const GAP = 48 // aire mínimo entre la cabecera, la frase y el pie
const LOGO = 54

function layout(format) {
  const H = FORMAT_H[format]
  const safe = SAFE_ZONES[format]
  const top = Math.max(PAD.top, safe.top)
  const bottom = H - Math.max(PAD.bottom, safe.bottom)
  const x = SPINE + PAD.left
  return { H, top, bottom, x, textW: W - x - PAD.right }
}

const quoteFont = (size) => `500 ${size}px ${BRAND_SERIF}`

function quoteLines(ctx, text, size, width) {
  ctx.font = quoteFont(size)
  ctx.letterSpacing = `${(-0.012 * size).toFixed(2)}px`
  const lines = wrapWords(ctx, text, width)
  ctx.letterSpacing = '0px'
  return lines
}

// Qué entra y con qué cuerpo. Si la frase no entra ni en el cuerpo mínimo, la
// protagonista pasa a ser la pregunta (la respuesta va completa en el carrusel:
// la doctrina no se trunca). `complete` = entró la frase pedida.
function fit(ctx, { number, sub, quote }, format) {
  const L = layout(format)
  ctx.font = `500 ${SUB}px ${SANS}`
  const head = (subText) => {
    const subLines = subText ? wrapWords(ctx, subText, L.textW) : []
    const h = (number ? NUMBER : 0) + (subLines.length ? (number ? 16 : 0) + subLines.length * SUB * 1.3 : 0)
    return { subLines, h }
  }
  const tryQuote = (text, subText) => {
    if (!text) return null
    const { subLines, h } = head(subText)
    const room = L.bottom - L.top - h - FOOT - GAP * 2
    const size = fitSize({
      max: QUOTE_MAX[format],
      min: QUOTE_MIN,
      room,
      measure: (s) => quoteLines(ctx, text, s, L.textW).length * s * QUOTE_LH,
    })
    return size ? { L, subLines, headH: h, size, text, lines: quoteLines(ctx, text, size, L.textW) } : null
  }
  const full = tryQuote(quote, sub)
  if (full) return { ...full, complete: true }
  const asTitle = tryQuote(sub, null)
  if (asTitle) return { ...asTitle, complete: !quote }
  // Ni la pregunta entra (no pasa con el contenido actual): cuerpo mínimo.
  const { subLines, h } = head(null)
  return { L, subLines, headH: h, size: QUOTE_MIN, text: sub ?? '', lines: quoteLines(ctx, sub ?? '', QUOTE_MIN, L.textW), complete: false }
}

// ¿Entra la frase entera en una portada? Decide si se ofrece el carrusel.
export async function coverFits(data, format = 'post') {
  await ensureBrandFont()
  const ctx = document.createElement('canvas').getContext('2d')
  return fit(ctx, data, formatOf(format)).complete
}

// Pinta la portada en `ctx`. `reveal` (para el video) controla qué se ve:
// `head`/`foot` son opacidades (0–1) de la cabecera y el pie, y `words` cuántas
// palabras de la frase ya aparecieron (con la última entrando a medias). Sin
// `reveal`, la portada completa.
function paint(ctx, f, pal, { spine, number, personal }, reveal = null) {
  const { L } = f
  const H = L.H
  const head = reveal?.head ?? 1
  const foot = reveal?.foot ?? 1

  ctx.globalAlpha = 1
  ctx.fillStyle = pal.c
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = pal.spine
  ctx.fillRect(0, 0, SPINE, H)

  // Lomo: el nombre en vertical (se lee de abajo hacia arriba, como en un
  // estante) y el logo calado abajo, a la altura del pie.
  if (spine) {
    ctx.save()
    ctx.font = `600 26px ${SANS}`
    ctx.letterSpacing = '7px'
    ctx.fillStyle = pal.spineInk
    let name = spine.toUpperCase()
    const maxLen = L.bottom - L.top - LOGO - 60
    while (name.length > 4 && ctx.measureText(name).width > maxLen) name = `${name.slice(0, -2).trimEnd()}…`
    const len = ctx.measureText(name).width
    ctx.translate(SPINE / 2 + 9, L.top + len)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'left'
    ctx.fillText(name, 0, 0)
    ctx.restore()
  }
  ctx.drawImage(makeLogo(LOGO * 2, pal.spineInk), (SPINE - LOGO) / 2, L.bottom - LOGO + 6, LOGO, LOGO)

  // Cabecera: número en cursiva y la línea de contexto.
  ctx.globalAlpha = head
  let y = L.top
  if (number) {
    ctx.font = `italic 400 ${NUMBER}px ${BRAND_SERIF}`
    ctx.fillStyle = pal.acc
    ctx.textBaseline = 'top'
    ctx.fillText(number, L.x, y)
    y += NUMBER + 16
  }
  ctx.textBaseline = 'alphabetic'
  ctx.font = `500 ${SUB}px ${SANS}`
  ctx.fillStyle = pal.soft
  for (const line of f.subLines) {
    ctx.fillText(line, L.x, y + SUB * 0.85)
    y += SUB * 1.3
  }

  // La frase, centrada en el espacio que queda entre la cabecera y el pie. En
  // el video aparece palabra por palabra, a ritmo de lectura.
  const blockH = f.lines.length * f.size * QUOTE_LH
  const zoneTop = L.top + f.headH + GAP
  const zoneBottom = L.bottom - FOOT - GAP
  let qy = zoneTop + Math.max(0, (zoneBottom - zoneTop - blockH) / 2)
  ctx.font = quoteFont(f.size)
  ctx.letterSpacing = `${(-0.012 * f.size).toFixed(2)}px`
  ctx.fillStyle = pal.ink
  let shown = 0
  for (const line of f.lines) {
    if (!reveal) {
      ctx.globalAlpha = 1
      ctx.fillText(line, L.x, qy + f.size * 0.82)
    } else {
      let x = L.x
      for (const word of line.split(' ')) {
        const a = Math.max(0, Math.min(1, reveal.words - shown))
        if (a > 0) {
          ctx.globalAlpha = a
          ctx.fillText(word, x, qy + f.size * 0.82 + (1 - a) * 10)
        }
        x += ctx.measureText(`${word} `).width
        shown++
      }
    }
    qy += f.size * QUOTE_LH
  }
  ctx.letterSpacing = '0px'

  // Pie: el dato personal a la izquierda, la firma a la derecha.
  ctx.globalAlpha = foot
  ctx.font = `500 ${FOOT}px ${SANS}`
  ctx.fillStyle = pal.soft
  ctx.textAlign = 'right'
  ctx.fillText('leetubiblia.com', W - PAD.right, L.bottom)
  ctx.textAlign = 'left'
  if (personal) {
    ctx.font = `600 ${FOOT}px ${SANS}`
    ctx.fillStyle = pal.acc
    ctx.fillText(personal, L.x, L.bottom)
  }
  ctx.globalAlpha = 1
}

// data: { slug, spine, number, sub, quote, personal }. `spine` es el nombre del
// lomo; `personal` ("Día 23") es opcional. Devuelve un Blob PNG.
export async function buildCoverImage({ slug, spine, number, sub, quote, personal, format = 'post', variant = 'color', scale }) {
  format = formatOf(format)
  await ensureBrandFont()
  const pal = coverPalette(slug, variant)
  const { canvas, ctx } = makeCanvas(W, FORMAT_H[format], scale)
  const f = fit(ctx, { number, sub, quote }, format)
  paint(ctx, f, pal, { spine, number, personal })
  return toBlob(canvas)
}

export async function shareCover({ filename, text, ...data }) {
  const blob = await buildCoverImage(data)
  return shareOrDownload([{ blob, filename }], text)
}

/* ---- Historia animada (video) ----
 * La misma portada, en movimiento: la cabecera entra, la frase aparece palabra
 * por palabra a ritmo de lectura y al final asoman el dato y la firma. Sobria,
 * sin efectos: para Reels y estados, donde el video rinde más que la foto.
 * Se graba en el teléfono (canvas + MediaRecorder) en MP4, el formato que
 * aceptan Instagram y WhatsApp; donde el navegador no graba MP4, no se ofrece. */

const VIDEO_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']

export function videoMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null
  if (!HTMLCanvasElement.prototype.captureStream) return null
  return VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? null
}

// Tiempos (segundos): cabecera, palabras (~3,5 por segundo), pausa con todo.
export function videoTimeline(wordCount) {
  const intro = 0.7
  const perWord = 0.28
  const words = wordCount * perWord
  const hold = 2.2
  return { intro, perWord, words, hold, total: Math.min(14, intro + words + hold) }
}

// Graba la historia animada y devuelve un Blob de video. `onProgress(0–1)`.
export async function recordCoverVideo(data, { onProgress } = {}) {
  const mime = videoMimeType()
  if (!mime) throw new Error('no-video')
  await ensureBrandFont()
  const format = 'story'
  const pal = coverPalette(data.slug, data.variant ?? 'color')
  // A 1×: grabar 2160×3840 en tiempo real es demasiado para un teléfono.
  const { canvas, ctx } = makeCanvas(W, FORMAT_H[format], 1)
  const f = fit(ctx, data, format)
  const wordCount = f.lines.reduce((n, l) => n + l.split(' ').length, 0)
  const tl = videoTimeline(wordCount)

  const stream = canvas.captureStream(30)
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise((resolve) => (rec.onstop = resolve))

  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3)
  paint(ctx, f, pal, data, { head: 0, foot: 0, words: 0 })
  rec.start(250)
  const t0 = performance.now()
  await new Promise((resolve) => {
    const frame = () => {
      const s = (performance.now() - t0) / 1000
      paint(ctx, f, pal, data, {
        head: ease(s / tl.intro),
        words: (s - tl.intro) / tl.perWord,
        foot: ease((s - tl.intro - tl.words) / 0.6),
      })
      onProgress?.(Math.min(1, s / tl.total))
      if (s < tl.total) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
  rec.stop()
  await done
  stream.getTracks().forEach((track) => track.stop())
  return new Blob(chunks, { type: mime.split(';')[0] })
}

export async function shareCoverVideo({ filename, text, onProgress, ...data }) {
  const blob = await recordCoverVideo(data, { onProgress })
  return shareOrDownload([{ blob, filename }], text)
}
