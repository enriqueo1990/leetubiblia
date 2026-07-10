// Genera una imagen-tarjeta del logro de plan terminado y la comparte.
// Tema fijo cálido (independiente de claro/oscuro): la imagen sale igual de
// linda en cualquier dispositivo. Sin librerías ni fuentes externas.
import { fmtISODate } from '../i18n/dates.js'

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
  if (!blob) throw new Error('no-blob')
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share(text ? { files: [file], text } : { files: [file] })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'shared' // el usuario canceló
      // si falla el share, caemos a descarga
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
// El espacio duro ( ) no corta: sirve para frases indivisibles como
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

// Mide un bloque de texto (varios sub-textos con su cuerpo y gap previo) sin
// dibujarlo: devuelve la altura total. Deja el ctx.font tocado (no importa,
// siempre se re-setea antes de dibujar).
function measureStack(ctx, textW, items) {
  let h = 0
  for (const it of items) {
    ctx.font = `${it.weight} ${it.size}px ${SANS}`
    h += it.gap + wrapWords(ctx, it.text, textW).length * it.size * it.lh
  }
  return h
}

// Renderiza la ficha imitando la del lector: metadata, pregunta, respuesta y
// —tras un filete— las citas en acento, TODO fluyendo junto como en la app
// (nada anclado a los bordes: el espacio sobrante se reparte alrededor del
// bloque, no se abre un hueco en el medio). Con draw=false sólo mide y devuelve
// el alto del bloque (para elegir el juego de tamaños más grande que entra y
// para centrarlo). Con draw=true pinta desde `top`.
function renderQuestionCard(ctx, pal, { meta, question, answer, refs }, sizes, top, draw) {
  const textW = QSIZE - Q_MARGIN * 2 - Q_PAD * 2
  const x = Q_MARGIN + Q_PAD

  // Bloques de texto en el orden de la ficha. Gaps proporcionales al cuerpo,
  // como la app (mt-2.5 antes de la pregunta, mt-3.5 antes de la respuesta).
  const stack = [
    { text: meta, weight: 500, size: sizes.meta, lh: 1.42, color: pal.soft, gap: 0 },
    { text: question, weight: 600, size: sizes.question, lh: 1.28, color: pal.ink, gap: Math.round(sizes.question * 0.5) },
  ]
  if (answer) {
    stack.push({ text: answer, weight: 400, size: sizes.answer, lh: 1.5, color: pal.ink, gap: Math.round(sizes.answer * 0.8) })
  }

  // Citas: filete + separación + renglones, en acento. Separador con aire para
  // que respiren. El filete cuelga a media distancia sobre el primer renglón.
  const RULE_TO_TEXT = Math.round(sizes.refs * 1.05)
  let refsLines = []
  if (refs.length > 0) {
    ctx.font = `500 ${sizes.refs}px ${SANS}`
    refsLines = wrapWords(ctx, refs.join('   ·   '), textW)
  }

  // Medición: alto total del bloque (lectura + citas con su filete).
  const readingH = measureStack(ctx, textW, stack)
  const refsH = refsLines.length
    ? Math.round(sizes.refs * 1.5) + RULE_TO_TEXT + refsLines.length * sizes.refs * 1.4
    : 0
  const total = readingH + refsH
  if (!draw) return total

  ctx.textAlign = 'left'
  let y = top
  for (const b of stack) {
    y += b.gap
    ctx.font = `${b.weight} ${b.size}px ${SANS}`
    ctx.fillStyle = b.color
    for (const line of wrapWords(ctx, b.text, textW)) {
      ctx.fillText(line, x, y + b.size * 0.8) // baseline ~cap height
      y += b.size * b.lh
    }
  }

  if (refsLines.length > 0) {
    y += Math.round(sizes.refs * 1.5) // aire sobre el filete
    ctx.strokeStyle = pal.hairline
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + textW, y)
    ctx.stroke()
    y += RULE_TO_TEXT
    ctx.font = `500 ${sizes.refs}px ${SANS}`
    ctx.fillStyle = pal.accent
    for (const line of refsLines) {
      ctx.fillText(line, x, y + sizes.refs * 0.8)
      y += sizes.refs * 1.4
    }
  }

  return total
}

// Dibuja la tarjeta de una pregunta y devuelve un Blob PNG.
// `meta` ya viene armada ("Catecismo de Heidelberg · Pregunta 1 de 129") y
// `refs` son etiquetas resueltas por idioma ("Juan 1", …): la i18n es de quien llama.
// `format`: 'square' (1080×1080, chats y feed) o 'story' (1080×1920, estados
// e historias). El ancho no cambia — solo la columna vertical disponible.
export async function buildQuestionImage({ meta, question, answer, refs = [], format = 'square' }) {
  const H = format === 'story' ? 1920 : QSIZE
  const pal = resolveTheme()
  const dark = isDarkColor(pal.bg)

  // Ícono de la app para la firma. Si no carga (offline sin caché), la firma
  // sale solo con el texto — nunca frenar el share por el adorno. Ojo: NO usar
  // img.decode(), que en Chromium puede no resolver nunca con respuestas de
  // caché (304) y dejaría el share colgado; onload + timeout de gracia.
  const icon = await new Promise((resolve) => {
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
  const iconOk = icon != null

  const canvas = document.createElement('canvas')
  canvas.width = QSIZE
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Geometría vertical: la firma va pegada al fondo y la ficha es DINÁMICA —
  // abraza su contenido, como en la app — y se centra en el espacio sobre la
  // firma. El fondo respira alrededor; nada de estirar la ficha ni inflar la
  // tipografía.
  const BOTTOM_MARGIN = Q_MARGIN // base de la firma al borde: mismo margen que los costados de la ficha
  const ICON = 48 // alto del ícono de la firma
  const CARD_TO_FIRMA = 26 // aire mínimo entre la ficha y la firma
  const firmaMidY = H - BOTTOM_MARGIN - ICON / 2
  const zoneBottom = firmaMidY - ICON / 2 - CARD_TO_FIRMA // techo de la firma
  const innerH = zoneBottom - Q_MARGIN - Q_PAD * 2 // contenido máximo posible

  // Tipografía a escala fija de la app (ficha 13/20/17/15 escalada al lienzo):
  // el primer juego ES la proporción de pantalla. Los siguientes solo bajan
  // de cuerpo para que el contenido largo entre — nunca se agranda.
  const attempts = [
    { meta: 34, question: 52, answer: 44, refs: 39 },
    { meta: 32, question: 48, answer: 41, refs: 36 },
    { meta: 30, question: 44, answer: 37, refs: 34 },
    { meta: 29, question: 41, answer: 34, refs: 32 },
    { meta: 28, question: 38, answer: 31, refs: 30 },
  ]
  const fits = (c, s) => renderQuestionCard(ctx, pal, c, s, 0, false) <= innerH
  let content = { meta, question, answer, refs }
  let sizes = attempts.find((s) => fits(content, s))
  // 2ª etapa: soltar las citas antes que la respuesta (en la imagen son
  // decoración; en la app son links). Respuestas largas con muchas citas
  // (p. ej. Heidelberg 1) caen acá.
  if (!sizes && refs.length > 0) {
    const noRefs = { meta, question, answer, refs: [] }
    sizes = attempts.find((s) => fits(noRefs, s))
    if (sizes) content = noRefs
  }
  // 3ª etapa: sólo la pregunta como protagonista + sus citas — la respuesta te
  // espera en la app (respuestas excepcionales, p. ej. Heidelberg 92). Truncar
  // doctrina no es opción.
  if (!sizes) {
    content = { meta, question, answer: null, refs }
    sizes = attempts.find((s) => fits(content, s)) || attempts[attempts.length - 1]
  }

  // Fondo plano de la app (--bg-app), como detrás de la ficha real.
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, 0, QSIZE, H)

  // Ficha dinámica: alto = contenido + padding, centrada verticalmente en el
  // espacio sobre la firma (sin subir del margen superior).
  const blockH = renderQuestionCard(ctx, pal, content, sizes, 0, false)
  const cardH = Math.min(blockH + Q_PAD * 2, zoneBottom - Q_MARGIN)
  const cardY = Q_MARGIN + Math.max(0, (zoneBottom - Q_MARGIN - cardH) / 2)

  // Separación como .card en tokens.css: sombra apenas perceptible en claro
  // (0 1px 4px al 7%, acá escalada); en oscuro un filete claro sutil — la
  // sombra no existe sobre negro.
  ctx.save()
  if (!dark) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.07)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 2
  }
  ctx.fillStyle = pal.surface
  roundRect(ctx, Q_MARGIN, cardY, QSIZE - Q_MARGIN * 2, cardH, 38)
  ctx.fill()
  ctx.restore()
  if (dark) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 2
    roundRect(ctx, Q_MARGIN, cardY, QSIZE - Q_MARGIN * 2, cardH, 38)
    ctx.stroke()
  }

  renderQuestionCard(ctx, pal, content, sizes, cardY + Q_PAD, true)

  // Firma: ícono de la app + leetubiblia.com, centrados como grupo — callada,
  // la invitación es la tarjeta.
  ctx.font = `500 32px ${SANS}`
  ctx.fillStyle = pal.soft
  const brand = 'leetubiblia.com'
  const midY = firmaMidY // pegada al fondo (base a BOTTOM_MARGIN del borde)
  if (iconOk) {
    const gap = 16
    const textW = ctx.measureText(brand).width
    const startX = (QSIZE - (ICON + gap + textW)) / 2
    ctx.drawImage(icon, startX, midY - ICON / 2, ICON, ICON)
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
