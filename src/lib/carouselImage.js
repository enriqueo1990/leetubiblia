// Carrusel (4:5) para lo que no entra en una portada: una confesión de 1689, un
// artículo largo de la Belga, la meditación entera de un devocional. La doctrina
// no se trunca: va completa, repartida en láminas como las páginas de un libro.
// Mismo sistema que la portada (color del material o Papel, lomo, Newsreader):
// portada · una lámina por párrafo (o las que haga falta, "continúa") con sus
// citas · invitación (lo que sigue, la frase y la dirección). Textos en i18n.
import { BRAND_SERIF, ensureBrandFont } from './brandFont.js'
import { coverPalette } from './materialTheme.js'
import { paginate, toParagraphs } from './carousel.js'
import { SANS, W, makeCanvas, toBlob, wrapWords, makeLogo, roundRect, shareOrDownload } from './canvasKit.js'

const H = 1350
const SPINE = 136
const X = SPINE + 88
const RIGHT = 96
const TEXT_W = W - X - RIGHT
const TOP = 92
const BOTTOM = H - 80
const LOGO = 54
const BODY_SIZES = [48, 44, 41, 38] // el más grande con el que la sección entra en una lámina
const BODY_LH = 1.42
const PARA_GAP = 0.55 // en cuerpos
const REFS = 29
const LABEL = 56

function lines(ctx, text, font, width = TEXT_W, spacing = 0) {
  ctx.font = font
  ctx.letterSpacing = `${spacing}px`
  const out = wrapWords(ctx, text, width)
  ctx.letterSpacing = '0px'
  return out
}

const bodyFont = (size) => `400 ${size}px ${BRAND_SERIF}`
const refsFont = `500 ${REFS}px ${SANS}`

// sections: [{ label, paragraphs, refs }] (ver lib/carousel.js).
// labels: { swipe, more, cont, refsLabel, next, markRead, free }.
// next: título de la próxima entrada (lámina de invitación), o null.
export async function buildCarouselImages({
  slug,
  spine,
  number,
  title,
  coverNote,
  sections,
  next,
  inviteTitle,
  labels,
  personal,
  variant = 'color',
  scale,
}) {
  await ensureBrandFont()
  const pal = coverPalette(slug, variant)
  const measure = document.createElement('canvas').getContext('2d')
  const refsH = (refs) =>
    refs.length ? 40 + REFS * 1.2 + 16 + lines(measure, refs.join(' · '), refsFont).length * REFS * 1.4 : 0

  // Cada sección con el cuerpo más grande que la deja en una sola lámina; si no
  // entra ni en el más chico, se reparte en varias con ese cuerpo.
  const room = BOTTOM - TOP - LABEL - 40 - 60
  const textPages = []
  for (const s of sections) {
    let chosen = null
    for (const size of BODY_SIZES) {
      const height = (tokens, refs) => {
        const paras = toParagraphs(tokens)
        return (
          paras.reduce((h, p, i) => h + (i ? size * PARA_GAP : 0) + lines(measure, p, bodyFont(size)).length * size * BODY_LH, 0) +
          refsH(refs)
        )
      }
      const pages = paginate([s], { height, avail: () => room })
      chosen = { size, pages }
      if (pages.length === 1) break
    }
    for (const p of chosen.pages) textPages.push({ ...p, size: chosen.size })
  }
  const pages = [{ kind: 'cover' }, ...textPages.map((p) => ({ kind: 'text', ...p })), { kind: 'invite' }]

  const blobs = []
  for (const [i, page] of pages.entries()) {
    const { canvas, ctx } = makeCanvas(W, H, scale)
    ctx.fillStyle = pal.c
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = pal.spine
    ctx.fillRect(0, 0, SPINE, H)
    if (spine) {
      ctx.save()
      ctx.font = `600 26px ${SANS}`
      ctx.letterSpacing = '7px'
      ctx.fillStyle = pal.spineInk
      let name = spine.toUpperCase()
      while (name.length > 4 && ctx.measureText(name).width > BOTTOM - TOP - LOGO - 60) name = `${name.slice(0, -2).trimEnd()}…`
      ctx.translate(SPINE / 2 + 9, TOP + ctx.measureText(name).width)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(name, 0, 0)
      ctx.restore()
    }
    ctx.drawImage(makeLogo(LOGO * 2, pal.spineInk), (SPINE - LOGO) / 2, BOTTOM - LOGO + 6, LOGO, LOGO)

    const write = (ls, font, size, lh, color, y, spacing = 0) => {
      ctx.font = font
      ctx.fillStyle = color
      ctx.letterSpacing = `${spacing}px`
      for (const line of ls) {
        ctx.fillText(line, X, y + size * 0.82)
        y += size * lh
      }
      ctx.letterSpacing = '0px'
      return y
    }
    const foot = (text, font, color) => {
      ctx.font = font
      ctx.fillStyle = color
      ctx.textAlign = 'right'
      ctx.fillText(text, W - RIGHT, BOTTOM)
      ctx.textAlign = 'left'
    }
    // Contador "3 / 9" arriba a la derecha (la portada no lo lleva).
    if (page.kind !== 'cover') {
      ctx.font = `500 26px ${SANS}`
      ctx.fillStyle = pal.soft
      ctx.textAlign = 'right'
      ctx.fillText(`${i + 1} / ${pages.length}`, W - RIGHT, TOP + 26)
      ctx.textAlign = 'left'
    }

    if (page.kind === 'cover') {
      let y = TOP
      if (number) {
        ctx.font = `italic 400 64px ${BRAND_SERIF}`
        ctx.fillStyle = pal.acc
        ctx.textBaseline = 'top'
        ctx.fillText(number, X, y)
        ctx.textBaseline = 'alphabetic'
      }
      let size = 104
      let tl = lines(measure, title, `500 ${size}px ${BRAND_SERIF}`, TEXT_W, -1.5)
      while (tl.length > 4 && size > 72) tl = lines(measure, title, `500 ${(size -= 4)}px ${BRAND_SERIF}`, TEXT_W, -1.5)
      const noteL = coverNote ? lines(measure, coverNote, `400 34px ${SANS}`) : []
      const blockH = tl.length * size * 1.04 + (noteL.length ? 36 + noteL.length * 34 * 1.4 : 0)
      y = TOP + 64 + Math.max(40, (BOTTOM - 60 - TOP - 64 - blockH) / 2)
      y = write(tl, `500 ${size}px ${BRAND_SERIF}`, size, 1.04, pal.ink, y, -1.5)
      if (noteL.length) write(noteL, `400 34px ${SANS}`, 34, 1.4, pal.soft, y + 36)
      foot(labels.swipe, `600 32px ${SANS}`, pal.acc)
      if (personal) {
        ctx.font = `600 27px ${SANS}`
        ctx.fillStyle = pal.acc
        ctx.fillText(personal, X, BOTTOM)
      }
    }

    if (page.kind === 'text') {
      let y = TOP
      if (page.label) {
        ctx.font = `italic 400 ${LABEL}px ${BRAND_SERIF}`
        ctx.fillStyle = pal.acc
        ctx.textBaseline = 'top'
        ctx.fillText(page.label, X, y)
        if (page.part > 0) {
          const lw = ctx.measureText(page.label).width
          ctx.font = `500 26px ${SANS}`
          ctx.fillStyle = pal.soft
          ctx.fillText(`· ${labels.cont}`, X + lw + 16, y + 22)
        }
        ctx.textBaseline = 'alphabetic'
      }
      y += LABEL + 40
      for (const [pi, p] of page.paragraphs.entries()) {
        y = write(lines(measure, p, bodyFont(page.size)), bodyFont(page.size), page.size, BODY_LH, pal.ink, y + (pi ? page.size * PARA_GAP : 0))
      }
      if (page.refs.length) {
        y += page.paragraphs.length ? 40 : 0
        y = write([labels.refsLabel.toUpperCase()], `600 23px ${SANS}`, 23, 1.2, pal.soft, y, 2.6) + 16
        // Una lámina de solo citas que tampoco entraría: se cortan con "…".
        let rl = lines(measure, page.refs.join(' · '), refsFont)
        const fit = Math.max(1, Math.floor((BOTTOM - 60 - y) / (REFS * 1.4)))
        if (rl.length > fit) rl = [...rl.slice(0, fit - 1), `${rl[fit - 1]} …`]
        write(rl, refsFont, REFS, 1.4, pal.acc, y)
      }
      if (page.more) foot(labels.more, `500 28px ${SANS}`, pal.soft)
    }

    if (page.kind === 'invite') {
      // Tres cosas: lo que sigue (si hay), la frase, la dirección.
      const tl = lines(measure, inviteTitle, `500 70px ${BRAND_SERIF}`, TEXT_W, -1)
      const nl = next ? lines(measure, next, `600 44px ${SANS}`, TEXT_W - 104, -0.5) : []
      const cardH = next ? 52 + 23 + 20 + nl.length * 44 * 1.16 + 44 + 92 + 48 : 0
      const blockH = cardH + (next ? 96 : 0) + tl.length * 70 * 1.08 + 40 + 46
      let y = TOP + Math.max(0, (BOTTOM - TOP - blockH) / 2)
      if (next) {
        ctx.fillStyle = pal.light ? '#FFFFFF' : 'rgba(255,255,255,0.08)'
        roundRect(ctx, X, y, TEXT_W, cardH, 40)
        ctx.fill()
        if (pal.light) {
          ctx.strokeStyle = 'rgba(0,0,0,0.08)'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        let cy = y + 52
        ctx.save()
        ctx.translate(52, 0) // el contenido de la tarjeta, con su margen interno
        cy = write([labels.next.toUpperCase()], `600 23px ${SANS}`, 23, 1, pal.acc, cy, 2.6) + 20
        cy = write(nl, `600 44px ${SANS}`, 44, 1.16, pal.ink, cy, -0.5)
        ctx.restore()
        cy += 44
        ctx.fillStyle = pal.acc
        roundRect(ctx, X + 52, cy, TEXT_W - 104, 92, 46)
        ctx.fill()
        ctx.font = `600 34px ${SANS}`
        ctx.fillStyle = pal.c
        ctx.textAlign = 'center'
        ctx.fillText(labels.markRead, X + TEXT_W / 2, cy + 58)
        ctx.textAlign = 'left'
        y += cardH + 96
      }
      y = write(tl, `500 70px ${BRAND_SERIF}`, 70, 1.08, pal.ink, y, -1) + 40
      ctx.font = `400 46px ${SANS}`
      ctx.fillStyle = pal.soft
      ctx.fillText(labels.free, X, y + 38)
      const fw = ctx.measureText(`${labels.free} `).width
      ctx.font = `650 46px ${SANS}`
      ctx.fillStyle = pal.acc
      ctx.fillText('leetubiblia.com', X + fw, y + 38)
    }

    blobs.push(await toBlob(canvas))
  }
  return blobs
}

// Comparte (o descarga) el carrusel entero. `filename` sin extensión: cada
// lámina sale numerada ("bautista-1689-1-01.png") para que queden en orden.
export async function shareCarousel({ filename, text, ...data }) {
  const blobs = await buildCarouselImages(data)
  return shareOrDownload(
    blobs.map((blob, i) => ({ blob, filename: `${filename}-${String(i + 1).padStart(2, '0')}.png` })),
    text,
  )
}
