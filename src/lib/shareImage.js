// Genera una imagen-tarjeta del logro de plan terminado y la comparte.
// Tema fijo cálido (independiente de claro/oscuro): la imagen sale igual de
// linda en cualquier dispositivo. Sin librerías ni fuentes externas.
import { fmtISODate } from '../i18n/dates.js'
import { paginate, toParagraphs } from './carousel.js'

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

// Dibuja la tarjeta y devuelve un Blob PNG. `t`/`locale` vienen de usePreferences
// (este módulo no es un componente, no puede llamar al hook él mismo).
export async function buildCompletionImage({
  planName,
  daysRead,
  longestStreak,
  startedOn,
  completedOn,
  t,
  locale,
}) {
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
  ctx.fillText(t('shareImage.finishedReading'), W / 2, 560)

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
    [String(daysRead), t('shareImage.dayInWord', { count: daysRead })],
    [String(longestStreak), t('shareImage.dayMaxStreak', { count: longestStreak })],
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
  const dateOpts = { day: 'numeric', month: 'short', year: 'numeric' }
  const desde = fmtISODate(startedOn, locale, dateOpts)
  const hasta = fmtISODate(completedOn, locale, dateOpts)
  if (hasta) {
    ctx.fillStyle = SOFT
    ctx.font = `400 32px ${SANS}`
    const range = desde ? `${desde} — ${hasta}` : hasta
    ctx.fillText(range, W / 2, statsY + 180)
  }

  // Pie.
  ctx.fillStyle = SEPIA
  ctx.font = `400 italic 34px ${SERIF}`
  ctx.fillText(t('shareImage.footer'), W / 2, H - 130)

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Comparte (o descarga) la imagen del logro. Devuelve 'shared' | 'downloaded'.
export async function shareCompletion(data) {
  const blob = await buildCompletionImage(data)
  return shareOrDownload(blob, 'lei-mi-plan.png', data.t('shareImage.shareText', { plan: data.planName }))
}

// Flujo común: hoja nativa si el dispositivo comparte archivos (móvil);
// si no, descarga (desktop). Cancelar la hoja no es un error.
async function shareOrDownload(blob, filename, text) {
  return shareOrDownloadAll([{ blob, filename }], text)
}

// Lo mismo con varias imágenes (carrusel): la hoja nativa las manda juntas
// (álbum en WhatsApp, carrusel en Instagram); en desktop se descargan en orden.
async function shareOrDownloadAll(items, text) {
  if (!items.length || items.some((it) => !it.blob)) throw new Error('no-blob')
  const files = items.map((it) => new File([it.blob], it.filename, { type: 'image/png' }))

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

/* ---- Tarjeta de pregunta de catecismo (cuadrada, para redes) ----
 *
 * La ficha del lector redibujada en 1080×1080 (formato universal de redes),
 * con la misma anatomía que en pantalla — metadata callada, pregunta semibold,
 * respuesta, citas tras un filete — y el ícono + "leetubiblia.com" como firma.
 * A diferencia de la imagen de logro (tema fijo), acá la tarjeta sale con los
 * tokens VIVOS del tema: modo claro/oscuro y acento del usuario — compartís
 * la ficha tal como la ves (decisión de Enrique, 2026-07-10). */

const QSIZE = 1080
const Q_MARGIN = 56 // fondo visible alrededor de la tarjeta (fino: la ficha manda)
const Q_PAD = 72 // padding interno mínimo de la tarjeta (p-5 de la ficha, escalado)

// Resuelve tokens CSS a colores concretos. getComputedStyle sobre una custom
// property puede devolver expresiones sin computar (--accent-ink es un
// color-mix); pasarla por `color` de un elemento real obliga a resolverla.
function resolveTheme() {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const get = (name) => {
    probe.style.color = `var(${name})`
    return getComputedStyle(probe).color
  }
  const pal = {
    bg: get('--bg-app'),
    surface: get('--surface'),
    ink: get('--text-primary'),
    soft: get('--text-soft'),
    hairline: get('--hairline'),
    accent: get('--accent-ink'),
  }
  probe.remove()
  return pal
}

// ¿El fondo es oscuro? Define la separación de la tarjeta: sombra en claro,
// filete claro en oscuro (la sombra negra desaparece sobre #000) — mismo
// criterio que --shadow-card en tokens.css.
function isDarkColor(rgb) {
  const m = String(rgb).match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (!m) return false
  return (Number(m[1]) * 299 + Number(m[2]) * 587 + Number(m[3]) * 114) / 1000 < 128
}

// Corte de línea por palabras (una medida de fuente ya seteada en ctx).
// El espacio duro (U+00A0) no corta: sirve para frases indivisibles como
// "Pregunta 1 de 129" en la metadata.
function wrapWords(ctx, text, maxWidth) {
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

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif'

const SERIF = 'Georgia, "Times New Roman", serif'

/* ---- Estilos de tarjeta (como los diseños de quote de Kindle) ----
 *
 * Cada estilo es una dirección visual completa, no solo una paleta:
 *  - ficha:   la ficha del lector tal cual, con los tokens VIVOS del tema
 *             (modo y acento del usuario) — "mi ficha, como la veo".
 *  - clasico: editorial en serif sobre crema, centrado, sin tarjeta — el tema
 *             cálido fijo de la marca (como la imagen de logro). Siempre luce,
 *             tenga la app como la tenga el usuario.
 *  - noche:   oscuro dramático fijo, pregunta en sepia sobre negro cálido,
 *             sin tarjeta — pensado para historias.
 *  - moderno: para el público joven (el mismo al que apuntan los acentos
 *             pasteles de la app): degradé pastel diagonal, tarjeta blanca de
 *             radio generoso, pregunta extra-bold, metadata en mayúsculas
 *             espaciadas y las citas como chips.
 *  - vibrante: la hermana intensa del moderno — texto blanco directo sobre un
 *             degradé cálido coral→frambuesa, sin tarjeta (nativo de
 *             historias), chips translúcidos y el logo calado en blanco.
 * El orden acá es el orden de presentación en la hoja de compartir. */
export const QUOTE_STYLES = ['ficha', 'clasico', 'noche', 'moderno', 'vibrante']

function styleSpec(style) {
  switch (style) {
    case 'clasico':
      return {
        card: false,
        align: 'center',
        fontQ: SERIF,
        weightQ: 700,
        fontA: SERIF,
        weightA: 400,
        gradient: ['#F5F0E6', '#EDE6D6'],
        pal: { bg: '#F5F0E6', surface: '#FFFFFF', ink: '#1C1C1E', soft: '#6B6760', hairline: '#CFC6B2', accent: '#A88B6A' },
      }
    case 'noche':
      return {
        card: false,
        align: 'left',
        fontQ: SANS,
        weightQ: 600,
        fontA: SANS,
        weightA: 400,
        questionInAccent: true,
        pal: { bg: '#12100D', surface: '#1C1A16', ink: '#F2F2F7', soft: '#9A968E', hairline: '#33302A', accent: '#C2A57E' },
      }
    case 'moderno':
      return {
        card: true,
        cardRadius: 52,
        align: 'left',
        fontQ: SANS,
        weightQ: 800,
        fontA: SANS,
        weightA: 400,
        metaCaps: true,
        refsChips: true,
        // Degradé diagonal con los pasteles de la app (lavanda → cielo).
        gradient: ['#C3B2EA', '#9BC5EC'],
        gradientDiagonal: true,
        // La firma va al pie SOBRE el degradé pastel; el logo calado en blanco
        // se integra mejor ahí que el ícono sepia (consistente con la estética
        // de la app: blanco sobre los acentos claros, ver tokens.css).
        firmaWhite: true,
        pal: {
          bg: '#C3B2EA',
          surface: '#FFFFFF',
          ink: '#241E35',
          soft: '#6F6693',
          hairline: '#E4DEF3',
          accent: '#7C6BB8',
          chipTint: 'rgba(124, 107, 184, 0.12)',
        },
      }
    case 'vibrante':
      return {
        card: false,
        align: 'left',
        fontQ: SANS,
        weightQ: 800,
        fontA: SANS,
        weightA: 400,
        metaCaps: true,
        refsChips: true,
        // Degradé cálido coral → frambuesa (pasteles coral/pink de la app,
        // profundizados para que el blanco lea bien encima).
        gradient: ['#D97E63', '#BE6C9C'],
        gradientDiagonal: true,
        firmaWhite: true, // logo calado en blanco + texto blanco
        pal: {
          bg: '#D97E63',
          surface: '#FFFFFF',
          ink: '#FFFFFF',
          soft: 'rgba(255, 255, 255, 0.82)',
          hairline: 'rgba(255, 255, 255, 0.4)',
          accent: '#FFFFFF',
          chipTint: 'rgba(255, 255, 255, 0.22)',
        },
      }
    default: // ficha
      return {
        card: true,
        align: 'left',
        fontQ: SANS,
        weightQ: 600,
        fontA: SANS,
        weightA: 400,
        pal: null, // vivo: se resuelve de los tokens de la app
      }
  }
}

// Margen horizontal del texto en los estilos SIN tarjeta (el texto respira
// directo sobre el fondo, así que necesita más aire que la ficha).
const FREE_MARGIN = 110

// Logo calado en blanco, generado desde los paths del favicon: contenedor
// blanco y el libro transparente — el fondo (degradé) se ve a través del
// trazo. Para estilos con firma en blanco (vibrante). `sizePx` es físico.
function makeWhiteIcon(sizePx) {
  const c = document.createElement('canvas')
  c.width = sizePx
  c.height = sizePx
  const g = c.getContext('2d')
  g.scale(sizePx / 64, sizePx / 64) // los paths viven en el viewBox 64×64
  g.fillStyle = '#FFFFFF'
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

// Renderiza el bloque de contenido según el estilo: metadata, pregunta,
// respuesta y —tras un filete— las citas en acento, todo fluyendo junto (nada
// anclado a los bordes: el aire sobrante se reparte alrededor del bloque).
// Con draw=false sólo mide y devuelve el alto (para elegir el juego de tamaños
// más grande que entra y para centrar). Con draw=true pinta desde `top`.
function renderQuoteBlock(ctx, spec, pal, { meta, question, answer, refs }, sizes, top, draw) {
  const marginX = spec.card ? Q_MARGIN + Q_PAD : FREE_MARGIN
  const textW = QSIZE - marginX * 2
  const centered = spec.align === 'center'
  const x = centered ? QSIZE / 2 : marginX

  // Bloques en el orden de la ficha. Gaps proporcionales al cuerpo, como la
  // app (mt-2.5 antes de la pregunta, mt-3.5 antes de la respuesta).
  // metaCaps (estilo moderno): mayúsculas espaciadas, un toque más chico.
  const stack = [
    {
      text: spec.metaCaps ? meta.toUpperCase() : meta,
      font: `${spec.metaCaps ? 600 : 500} ${spec.metaCaps ? Math.round(sizes.meta * 0.82) : sizes.meta}px ${SANS}`,
      size: spec.metaCaps ? Math.round(sizes.meta * 0.82) : sizes.meta,
      lh: 1.42,
      color: pal.soft,
      gap: 0,
      spacing: spec.metaCaps ? 3 : 0,
    },
    {
      text: question,
      font: `${spec.weightQ} ${sizes.question}px ${spec.fontQ}`,
      size: sizes.question,
      lh: 1.28,
      color: spec.questionInAccent ? pal.accent : pal.ink,
      gap: Math.round(sizes.question * 0.5),
    },
  ]
  if (answer) {
    stack.push({
      text: answer,
      font: `${spec.weightA} ${sizes.answer}px ${spec.fontA}`,
      size: sizes.answer,
      lh: 1.5,
      color: pal.ink,
      gap: Math.round(sizes.answer * 0.8),
    })
  }

  // Citas. Dos tratamientos: chips (estilo moderno — cada cita en su pill,
  // acomodadas en filas) o nota al pie con filete (el resto: corto y centrado
  // como ornamento en los estilos centrados; cruzando la columna en los
  // alineados a la izquierda, como en la app).
  const REFS_GAP = Math.round(sizes.refs * 1.5) // aire sobre el bloque de citas
  const RULE_TO_TEXT = Math.round(sizes.refs * 1.05)
  let refsLines = []
  let chipRows = []
  const chipH = Math.round(sizes.refs * 2)
  const chipPadX = Math.round(sizes.refs * 0.9)
  const chipGap = 16
  if (refs.length > 0) {
    if (spec.refsChips) {
      ctx.font = `600 ${sizes.refs}px ${SANS}`
      let row = []
      let used = 0
      for (const label of refs) {
        const w = Math.ceil(ctx.measureText(label).width) + chipPadX * 2
        if (row.length && used + chipGap + w > textW) {
          chipRows.push(row)
          row = []
          used = 0
        }
        row.push({ label, w })
        used += (row.length > 1 ? chipGap : 0) + w
      }
      if (row.length) chipRows.push(row)
    } else {
      ctx.font = `500 ${sizes.refs}px ${SANS}`
      refsLines = wrapWords(ctx, refs.join('   ·   '), textW)
    }
  }

  // setSpacing: tracking del texto (metadata del estilo moderno). En canvas es
  // ctx.letterSpacing (Chrome 99+ / Safari 17+); donde no existe, no pasa nada.
  const setSpacing = (px) => {
    ctx.letterSpacing = `${px}px`
  }

  let total = 0
  for (const b of stack) {
    ctx.font = b.font
    setSpacing(b.spacing || 0)
    total += b.gap + wrapWords(ctx, b.text, textW).length * b.size * b.lh
  }
  setSpacing(0)
  if (refsLines.length) total += REFS_GAP + RULE_TO_TEXT + refsLines.length * sizes.refs * 1.4
  if (chipRows.length) total += REFS_GAP + chipRows.length * chipH + (chipRows.length - 1) * chipGap
  if (!draw) return total

  ctx.textAlign = centered ? 'center' : 'left'
  let y = top
  for (const b of stack) {
    y += b.gap
    ctx.font = b.font
    setSpacing(b.spacing || 0)
    ctx.fillStyle = b.color
    for (const line of wrapWords(ctx, b.text, textW)) {
      ctx.fillText(line, x, y + b.size * 0.8) // baseline ~cap height
      y += b.size * b.lh
    }
  }
  setSpacing(0)

  if (refsLines.length > 0) {
    y += REFS_GAP
    ctx.strokeStyle = pal.hairline
    ctx.lineWidth = 2
    ctx.beginPath()
    if (centered) {
      ctx.moveTo(QSIZE / 2 - 90, y)
      ctx.lineTo(QSIZE / 2 + 90, y)
    } else {
      ctx.moveTo(x, y)
      ctx.lineTo(x + textW, y)
    }
    ctx.stroke()
    y += RULE_TO_TEXT
    ctx.font = `500 ${sizes.refs}px ${SANS}`
    ctx.fillStyle = pal.accent
    for (const line of refsLines) {
      ctx.fillText(line, x, y + sizes.refs * 0.8)
      y += sizes.refs * 1.4
    }
  }

  if (chipRows.length > 0) {
    y += REFS_GAP
    ctx.font = `600 ${sizes.refs}px ${SANS}`
    for (const row of chipRows) {
      let cx = marginX
      for (const chip of row) {
        ctx.fillStyle = pal.chipTint ?? 'rgba(0, 0, 0, 0.06)'
        roundRect(ctx, cx, y, chip.w, chipH, chipH / 2)
        ctx.fill()
        ctx.fillStyle = pal.accent
        ctx.fillText(chip.label, cx + chipPadX, y + chipH / 2 + sizes.refs * 0.34)
        cx += chip.w + chipGap
      }
      y += chipH + chipGap
    }
  }

  ctx.textAlign = 'left'
  return total
}

// Ícono de la app para la firma. Si no carga (offline sin caché), devuelve null
// y la firma sale solo con el texto — nunca frenar el share por el adorno. Ojo:
// NO usar img.decode(), que en Chromium puede no resolver nunca con respuestas
// de caché (304) y dejaría el share colgado; onload + timeout de gracia.
function loadAppIcon() {
  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(ok ? img : null)
    }
    const timer = setTimeout(() => done(img.complete && img.naturalWidth > 0), 1500)
    img.onload = () => done(true)
    img.onerror = () => done(false)
    img.src = '/icons/icon-192.png'
    if (img.complete && img.naturalWidth > 0) done(true)
  })
}

// Geometría vertical de la tarjeta: la firma va pegada al fondo y el contenido
// se centra en el espacio sobre ella. En los estilos con tarjeta, la tarjeta es
// DINÁMICA —abraza su contenido, como en la app—; sin tarjeta el texto flota
// directo sobre el fondo.
function questionGeometry(H, spec) {
  const ICON = 48 // alto del ícono de la firma
  const CARD_TO_FIRMA = 26 // aire mínimo entre el contenido y la firma
  // Base de la firma al borde: mismo margen que los costados.
  const firmaMidY = H - Q_MARGIN - ICON / 2
  const zoneBottom = firmaMidY - ICON / 2 - CARD_TO_FIRMA // techo de la firma
  const zoneTop = spec.card ? Q_MARGIN : FREE_MARGIN
  const innerH = zoneBottom - zoneTop - (spec.card ? Q_PAD * 2 : 0) // contenido máximo
  return { ICON, firmaMidY, zoneBottom, zoneTop, innerH }
}

// Tipografía a escala fija de la app (ficha 13/20/17/15 escalada al lienzo):
// el primer juego ES la proporción de pantalla. Los siguientes solo bajan
// de cuerpo para que el contenido largo entre — nunca se agranda.
const QUOTE_SIZES = [
  { meta: 34, question: 52, answer: 44, refs: 39 },
  { meta: 32, question: 48, answer: 41, refs: 36 },
  { meta: 30, question: 44, answer: 37, refs: 34 },
  { meta: 29, question: 41, answer: 34, refs: 32 },
  { meta: 28, question: 38, answer: 31, refs: 30 },
]

// Elige qué entra en la tarjeta y con qué cuerpo. `complete` = la respuesta
// entró entera (con o sin citas).
function fitQuestion(ctx, spec, pal, { meta, question, answer, refs }, H) {
  const { innerH } = questionGeometry(H, spec)
  const fits = (c, s) => renderQuoteBlock(ctx, spec, pal, c, s, 0, false) <= innerH
  const tryFit = (content, complete) => {
    const sizes = QUOTE_SIZES.find((s) => fits(content, s))
    return sizes ? { content, sizes, complete } : null
  }
  // 1ª etapa: todo, bajando de cuerpo si hace falta.
  let fit = tryFit({ meta, question, answer, refs }, true)
  // 2ª etapa: soltar las citas antes que la respuesta (en la imagen son
  // decoración; en la app son links). Respuestas largas con muchas citas
  // (p. ej. Heidelberg 1) caen acá.
  if (!fit && refs.length > 0) fit = tryFit({ meta, question, answer, refs: [] }, true)
  // 3ª etapa: sólo la pregunta como protagonista + sus citas — la respuesta te
  // espera en la app (o en el carrusel). Truncar doctrina no es opción.
  if (!fit) fit = tryFit({ meta, question, answer: null, refs }, !answer)
  // 4ª etapa, red de seguridad: sólo la pregunta. Capítulos con decenas de
  // citas (1689) no entran ni sin la respuesta; nunca se dibuja fuera.
  if (!fit) {
    const content = { meta, question, answer: null, refs: [] }
    fit = tryFit(content, !answer) ?? { content, sizes: QUOTE_SIZES[QUOTE_SIZES.length - 1], complete: !answer }
  }
  return fit
}

// ¿Entra la respuesta entera en una sola tarjeta? (Medición pura, sin dibujar.)
// Decide si la hoja de compartir ofrece el carrusel.
export function fitsInOneImage({ meta, question, answer, refs = [], format = 'square', style = 'ficha' }) {
  const spec = styleSpec(style)
  const pal = spec.pal ?? resolveTheme()
  const ctx = document.createElement('canvas').getContext('2d')
  return fitQuestion(ctx, spec, pal, { meta, question, answer, refs }, format === 'story' ? 1920 : QSIZE).complete
}

// Dibuja la tarjeta de una pregunta y devuelve un Blob PNG.
// `meta` ya viene armada ("Catecismo de Heidelberg · Pregunta 1 de 129") y
// `refs` son etiquetas resueltas por idioma ("Juan 1", …): la i18n es de quien llama.
// `format`: 'square' (1080×1080, chats y feed) o 'story' (1080×1920, estados
// e historias). El ancho no cambia — solo la columna vertical disponible.
// `style`: uno de QUOTE_STYLES ('ficha' | 'clasico' | 'noche').
export async function buildQuestionImage({ meta, question, answer, refs = [], format = 'square', style = 'ficha' }) {
  const H = format === 'story' ? 1920 : QSIZE
  // Supersampling 2×: el lienzo físico duplica los 1080 lógicos y todo se
  // dibuja escalado. Las plataformas (WhatsApp/Instagram) recomprimen al
  // compartir; partir de 2160 deja el texto nítido después de esa pasada.
  // Toda la geometría de acá para abajo sigue pensada en unidades de 1080.
  const SCALE = 2
  const spec = styleSpec(style)
  const pal = spec.pal ?? resolveTheme()
  const dark = isDarkColor(pal.bg)

  // (Los estilos firmaWhite generan su logo localmente: no cargan nada.)
  const icon = spec.firmaWhite ? null : await loadAppIcon()
  const iconOk = icon != null

  const canvas = document.createElement('canvas')
  canvas.width = QSIZE * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  const { zoneTop, zoneBottom, firmaMidY, ICON } = questionGeometry(H, spec)
  const { content, sizes } = fitQuestion(ctx, spec, pal, { meta, question, answer, refs }, H)

  // Fondo: plano (tokens de la app / noche), degradé vertical (clásico) o
  // diagonal (moderno).
  if (spec.gradient) {
    const g = spec.gradientDiagonal
      ? ctx.createLinearGradient(0, 0, QSIZE, H)
      : ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, spec.gradient[0])
    g.addColorStop(1, spec.gradient[1])
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = pal.bg
  }
  ctx.fillRect(0, 0, QSIZE, H)

  const blockH = renderQuoteBlock(ctx, spec, pal, content, sizes, 0, false)

  if (spec.card) {
    // Ficha dinámica: alto = contenido + padding, centrada verticalmente en el
    // espacio sobre la firma (sin subir del margen superior). Separación como
    // .card en tokens.css: sombra apenas perceptible en claro; en oscuro un
    // filete claro sutil — la sombra no existe sobre negro.
    const radius = spec.cardRadius ?? 38
    const cardH = Math.min(blockH + Q_PAD * 2, zoneBottom - Q_MARGIN)
    const cardY = Q_MARGIN + Math.max(0, (zoneBottom - Q_MARGIN - cardH) / 2)
    ctx.save()
    if (!dark) {
      // shadowBlur/offset son en píxeles físicos (el transform no los escala):
      // multiplicar por SCALE para que la sombra se vea igual que a 1×.
      ctx.shadowColor = 'rgba(0, 0, 0, 0.07)'
      ctx.shadowBlur = 10 * SCALE
      ctx.shadowOffsetY = 2 * SCALE
    }
    ctx.fillStyle = pal.surface
    roundRect(ctx, Q_MARGIN, cardY, QSIZE - Q_MARGIN * 2, cardH, radius)
    ctx.fill()
    ctx.restore()
    if (dark) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 2
      roundRect(ctx, Q_MARGIN, cardY, QSIZE - Q_MARGIN * 2, cardH, radius)
      ctx.stroke()
    }
    renderQuoteBlock(ctx, spec, pal, content, sizes, cardY + Q_PAD, true)
  } else {
    // Sin tarjeta: el bloque flota centrado sobre el fondo.
    const top = zoneTop + Math.max(0, (zoneBottom - zoneTop - blockH) / 2)
    renderQuoteBlock(ctx, spec, pal, content, sizes, top, true)
  }

  // Firma: ícono de la app + leetubiblia.com, centrados como grupo — callada,
  // la invitación es la tarjeta. En estilos firmaWhite el logo va calado en
  // blanco (generado localmente: nunca depende de la red).
  ctx.font = `500 32px ${SANS}`
  // Con logo blanco, el texto de la firma también va blanco (en Moderno pal.soft
  // es violeta y desentonaría junto al logo calado).
  ctx.fillStyle = spec.firmaWhite ? 'rgba(255, 255, 255, 0.92)' : pal.soft
  const brand = 'leetubiblia.com'
  const midY = firmaMidY // pegada al fondo (base a Q_MARGIN del borde)
  const firmaIcon = spec.firmaWhite ? makeWhiteIcon(ICON * SCALE) : iconOk ? icon : null
  if (firmaIcon) {
    const gap = 16
    const textW = ctx.measureText(brand).width
    const startX = (QSIZE - (ICON + gap + textW)) / 2
    ctx.drawImage(firmaIcon, startX, midY - ICON / 2, ICON, ICON)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(brand, startX + ICON + gap, midY)
  } else {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(brand, QSIZE / 2, midY)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Comparte (o descarga) la tarjeta de una pregunta. Devuelve 'shared' | 'downloaded'.
// `format` viaja dentro de `data` hacia buildQuestionImage.
export async function shareQuestion({ filename, ...data }) {
  const blob = await buildQuestionImage(data)
  return shareOrDownload(blob, filename)
}

/* ---- Carrusel (4:5) para lo que no entra en una tarjeta ----
 *
 * Una confesión de 1689 o un artículo largo de la Belga no entran enteros en
 * una imagen, y la doctrina no se trunca: en vez de recortar, se reparte en
 * láminas de 1080×1350 (el formato de carrusel de Instagram), como las páginas
 * de un libro. Portada con el título · una lámina por párrafo (o las que haga
 * falta, "continúa") con sus citas al pie · invitación a leetubiblia.com.
 * Mismos estilos que la tarjeta; las citas van siempre como texto (en chips no
 * entrarían las de un párrafo de 1689). Los textos llegan resueltos en i18n. */

const CAROUSEL_H = 1350
const CS = { meta: 30, label: 34, body: 36, refs: 29 }
const CBODY_LH = 1.5
const CPARA_GAP = Math.round(CS.body * 0.6)

// sections: [{ label, paragraphs, refs }] (ver lib/carousel.js).
// labels: { swipe, more, cont, inviteKicker, inviteText, inviteFree }.
// Devuelve un Blob PNG por lámina. `scale` 2 para compartir, 1 para la vista previa.
export async function buildCarousel({ meta, title, coverNote, sections, inviteTitle, labels, style = 'ficha', scale = 2 }) {
  const W = QSIZE
  const H = CAROUSEL_H
  const spec = styleSpec(style)
  const pal = spec.pal ?? resolveTheme()
  const dark = isDarkColor(pal.bg)
  const { ICON, firmaMidY, zoneBottom } = questionGeometry(H, spec)
  const marginX = spec.card ? Q_MARGIN + Q_PAD : FREE_MARGIN
  const textW = W - marginX * 2
  const top = spec.card ? Q_MARGIN + Q_PAD : FREE_MARGIN
  const bottom = spec.card ? zoneBottom - Q_PAD : zoneBottom
  const centered = spec.align === 'center'
  const x = centered ? W / 2 : marginX
  const titleColor = spec.questionInAccent ? pal.accent : pal.ink

  // El ícono sepia va en la firma de los estilos sin logo blanco y en la
  // invitación de los estilos con tarjeta (blanco sobre tarjeta blanca no se ve).
  const appIcon = !spec.firmaWhite || spec.card ? await loadAppIcon() : null

  const metaText = spec.metaCaps ? meta.toUpperCase() : meta
  const metaFont = `${spec.metaCaps ? 600 : 500} ${CS.meta}px ${SANS}`
  const bodyFont = `${spec.weightA} ${CS.body}px ${spec.fontA}`
  const refsFont = `500 ${CS.refs}px ${SANS}`
  const labelFont = `700 ${CS.label}px ${SANS}`

  const measure = document.createElement('canvas').getContext('2d')
  const linesOf = (text, font) => {
    measure.font = font
    return wrapWords(measure, text, textW)
  }
  const headH = CS.meta * 1.42 + 34 // metadata + aire debajo
  const labelH = CS.label * 1.3 + 22
  const refsH = (refs) =>
    refs.length
      ? Math.round(CS.refs * 1.5) + Math.round(CS.refs * 1.05) + linesOf(refs.join(' · '), refsFont).length * CS.refs * 1.4
      : 0
  const paragraphsH = (paragraphs) =>
    paragraphs.reduce((h, p, i) => h + (i ? CPARA_GAP : 0) + linesOf(p, bodyFont).length * CS.body * CBODY_LH, 0)

  const textPages = paginate(sections, {
    height: (tokens, refs) => paragraphsH(toParagraphs(tokens)) + refsH(refs),
    // La etiqueta ("1.1", "1.1 · continúa") ocupa lugar; el pie "sigue →" vive
    // en el margen inferior, como "Deslizá →".
    avail: (s) => bottom - top - headH - (s.label ? labelH : 0) - CS.body,
  })
  const pages = [{ kind: 'cover' }, ...textPages.map((p) => ({ kind: 'text', ...p })), { kind: 'invite' }]

  const blobs = []
  for (const [i, page] of pages.entries()) {
    const canvas = document.createElement('canvas')
    canvas.width = W * scale
    canvas.height = H * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    if (spec.gradient) {
      const g = spec.gradientDiagonal ? ctx.createLinearGradient(0, 0, W, H) : ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, spec.gradient[0])
      g.addColorStop(1, spec.gradient[1])
      ctx.fillStyle = g
    } else {
      ctx.fillStyle = pal.bg
    }
    ctx.fillRect(0, 0, W, H)

    // Tarjeta de alto fijo: todas las láminas iguales, como páginas.
    if (spec.card) {
      const radius = spec.cardRadius ?? 38
      ctx.save()
      if (!dark) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.07)'
        ctx.shadowBlur = 10 * scale
        ctx.shadowOffsetY = 2 * scale
      }
      ctx.fillStyle = pal.surface
      roundRect(ctx, Q_MARGIN, Q_MARGIN, W - Q_MARGIN * 2, zoneBottom - Q_MARGIN, radius)
      ctx.fill()
      ctx.restore()
      if (dark) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.lineWidth = 2
        roundRect(ctx, Q_MARGIN, Q_MARGIN, W - Q_MARGIN * 2, zoneBottom - Q_MARGIN, radius)
        ctx.stroke()
      }
    }

    ctx.textAlign = centered ? 'center' : 'left'
    const write = (lines, font, size, lh, color, y, spacing = 0) => {
      ctx.font = font
      ctx.fillStyle = color
      ctx.letterSpacing = `${spacing}px`
      for (const line of lines) {
        ctx.fillText(line, x, y + size * 0.8)
        y += size * lh
      }
      ctx.letterSpacing = '0px'
      return y
    }
    // Pie a la derecha de la tarjeta ("Deslizá →", "sigue →").
    const foot = (text, font, color) => {
      ctx.font = font
      ctx.fillStyle = color
      ctx.textAlign = centered ? 'center' : 'right'
      ctx.fillText(text, centered ? W / 2 : W - marginX, bottom - 8)
      ctx.textAlign = centered ? 'center' : 'left'
    }
    const writeMeta = () => write([metaText], metaFont, CS.meta, 1.42, pal.soft, top, spec.metaCaps ? 3 : 0)

    if (page.kind === 'cover') {
      writeMeta()
      const tFont = `${spec.weightQ} 76px ${spec.fontQ}`
      const tLines = linesOf(title, tFont)
      const noteLines = coverNote ? linesOf(coverNote, `400 34px ${SANS}`) : []
      const blockH = tLines.length * 76 * 1.15 + (noteLines.length ? 30 + noteLines.length * 34 * 1.4 : 0)
      let y = top + (bottom - top - blockH) / 2
      y = write(tLines, tFont, 76, 1.15, titleColor, y)
      if (noteLines.length) write(noteLines, `400 34px ${SANS}`, 34, 1.4, pal.soft, y + 30)
      foot(labels.swipe, `600 34px ${SANS}`, pal.accent)
    }

    if (page.kind === 'text') {
      let y = writeMeta() + 34
      if (page.label) {
        const label = page.part > 0 ? `${page.label} · ${labels.cont}` : page.label
        y = write([label], labelFont, CS.label, 1.3, pal.accent, y) + 22
      }
      for (const [pi, p] of page.paragraphs.entries()) {
        y = write(linesOf(p, bodyFont), bodyFont, CS.body, CBODY_LH, pal.ink, y + (pi ? CPARA_GAP : 0))
      }
      if (page.refs.length) {
        if (page.paragraphs.length) {
          y += Math.round(CS.refs * 1.5)
          ctx.strokeStyle = pal.hairline
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(centered ? W / 2 - 90 : x, y)
          ctx.lineTo(centered ? W / 2 + 90 : x + textW, y)
          ctx.stroke()
          y += Math.round(CS.refs * 1.05)
        }
        // Una lámina de solo citas que tampoco entraría: se cortan con "…"
        // (en la imagen son guía de lectura, no doctrina).
        let lines = linesOf(page.refs.join(' · '), refsFont)
        const room = Math.floor((bottom - CS.body - y) / (CS.refs * 1.4))
        if (lines.length > room) lines = [...lines.slice(0, Math.max(1, room) - 1), `${lines[Math.max(1, room) - 1]} …`]
        write(lines, refsFont, CS.refs, 1.4, pal.accent, y)
      }
      if (page.more) foot(labels.more, `500 30px ${SANS}`, pal.soft)
    }

    if (page.kind === 'invite') {
      const big = 150
      const tFont = `${spec.weightQ} 60px ${spec.fontQ}`
      const kLines = linesOf(labels.inviteKicker, `500 34px ${SANS}`)
      const tLines = linesOf(inviteTitle, tFont)
      const bLines = linesOf(labels.inviteText, `400 36px ${SANS}`)
      const blockH =
        big + 56 + kLines.length * 34 * 1.4 + 12 + tLines.length * 60 * 1.2 + 28 + bLines.length * 36 * 1.45 + 64 + 34 * 1.4 + 12 + 64 * 1.2
      let y = top + Math.max(0, (bottom - top - blockH) / 2)
      const iconImg = spec.firmaWhite && !spec.card ? makeWhiteIcon(big * scale) : appIcon
      if (iconImg) {
        const iconX = centered ? W / 2 - big / 2 : marginX
        ctx.save()
        roundRect(ctx, iconX, y, big, big, big * 0.22)
        ctx.clip()
        ctx.drawImage(iconImg, iconX, y, big, big)
        ctx.restore()
      }
      y += big + 56
      y = write(kLines, `500 34px ${SANS}`, 34, 1.4, pal.soft, y) + 12
      y = write(tLines, tFont, 60, 1.2, titleColor, y) + 28
      y = write(bLines, `400 36px ${SANS}`, 36, 1.45, pal.soft, y) + 64
      y = write([labels.inviteFree], `500 34px ${SANS}`, 34, 1.4, pal.soft, y) + 12
      write(['leetubiblia.com'], `800 64px ${SANS}`, 64, 1.2, pal.accent, y)
    }

    // Firma + contador "3/10". En la invitación la dirección ya es protagonista:
    // queda solo el contador.
    ctx.font = `500 32px ${SANS}`
    ctx.fillStyle = spec.firmaWhite ? 'rgba(255, 255, 255, 0.92)' : pal.soft
    ctx.textBaseline = 'middle'
    if (page.kind !== 'invite') {
      const brand = 'leetubiblia.com'
      const fIcon = spec.firmaWhite ? makeWhiteIcon(ICON * scale) : appIcon
      const gap = fIcon ? ICON + 16 : 0
      const startX = (W - (gap + ctx.measureText(brand).width)) / 2
      if (fIcon) ctx.drawImage(fIcon, startX, firmaMidY - ICON / 2, ICON, ICON)
      ctx.textAlign = 'left'
      ctx.fillText(brand, startX + gap, firmaMidY)
    }
    ctx.textAlign = 'right'
    ctx.fillText(`${i + 1}/${pages.length}`, W - Q_MARGIN - 8, firmaMidY)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    blobs.push(await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')))
  }
  return blobs
}

// Comparte (o descarga) el carrusel entero. `filename` sin extensión: cada
// lámina sale numerada ("bautista-1689-1-01.png") para que queden en orden.
export async function shareCarousel({ filename, ...data }) {
  const blobs = await buildCarousel(data)
  return shareOrDownloadAll(
    blobs.map((blob, i) => ({ blob, filename: `${filename}-${String(i + 1).padStart(2, '0')}.png` })),
  )
}
