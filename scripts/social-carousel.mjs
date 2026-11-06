// Carrusel de Facebook/Instagram (1080×1350, 4:5) para anunciar la versión 2.0 de
// Lee Tu Biblia. Mismo sistema visual que las landings (papel, Newsreader, cinta
// marcapáginas) con capturas REALES del teléfono (cuenta demo). Salida: PNG en la
// carpeta indicada (por defecto social/2026-11-v2, fuera de git).
//
// Uso:  node scripts/social-carousel.mjs [carpeta-de-salida]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const OUT = process.argv[2] || join(root, 'social/2026-11-v2')
mkdirSync(OUT, { recursive: true })

const b64 = (p) => readFileSync(join(root, p)).toString('base64')
const shot = (name) => `data:image/webp;base64,${b64(`src/assets/shots/${name}-780.webp`)}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const h = (s) => esc(s).replace(/\n/g, '<br>').replace(/\*(.+?)\*/g, '<em>$1</em>')

const SLIDES = [
  { id: '01-portada', kind: 'cover', eyebrow: 'Novedades · Versión 2.0', title: 'Lee Tu Biblia\n*estrenó cara nueva*', sub: 'Más clara, más tranquila y más tuya.' },
  { id: '02-hoy', shot: 'hoy-claro', eyebrow: 'Tu lectura', title: 'Tu lectura del día,\n*en una pantalla*', sub: 'Ves qué toca leer, lo leés en tu Biblia de papel y lo marcás. Listo.' },
  { id: '03-sin-culpa', shot: 'progreso-claro', eyebrow: 'Tu constancia', title: 'Si te atrasás,\n*seguís donde quedaste*', sub: 'Sin regaños: la app te ayuda a retomar el hilo.' },
  { id: '04-biblioteca', shot: 'biblioteca-claro', eyebrow: 'Biblioteca', title: 'Lecturas para\n*leer despacio*', sub: 'Credos, catecismos y las matutinas de Spurgeon, además de tu Biblia.' },
  { id: '05-oracion', shot: 'oracion-claro', eyebrow: 'Oración', title: 'Orar por tu gente,\n*un pedido por vez*', sub: 'Tu grupo ahora reacciona a los testimonios: 🙏 🙌 ❤️' },
  { id: '06-a-tu-medida', shot: 'hoy-noche', eyebrow: 'A tu medida', title: 'De noche y con\n*la letra que necesitás*', sub: 'Modo noche cuidado y tamaño de letra Normal, Grande o Más grande.' },
  { id: '07-cierre', kind: 'close', eyebrow: 'Gratis y sin publicidad', title: 'Probala,\n*es gratis*', sub: 'Para acompañar tu Biblia de papel, todos los días.', url: 'leetubiblia.com' },
]

const CSS = `
@font-face{font-family:NR;font-style:normal;font-weight:400 500;src:url(data:font/woff2;base64,${b64('public/fonts/newsreader-roman-v1.woff2')}) format("woff2")}
@font-face{font-family:NR;font-style:italic;font-weight:400 500;src:url(data:font/woff2;base64,${b64('public/fonts/newsreader-italic-v1.woff2')}) format("woff2")}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;position:relative;overflow:hidden;background:#FAF8F4;color:#1F1B16;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif}
.glow{position:absolute;inset:0;background:
  radial-gradient(60% 40% at 92% 0%, rgba(255,222,160,.55), transparent 70%),
  radial-gradient(80% 55% at 70% 14%, rgba(91,159,223,.28), transparent 72%),
  radial-gradient(60% 40% at 0% 0%, rgba(91,159,223,.16), transparent 70%)}
.brand{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:18px;font-size:30px;font-weight:700;letter-spacing:-.5px}
.mark{width:64px;height:64px;border-radius:16px;background:#2B6CB0;display:grid;place-items:center}
.pager{position:absolute;right:72px;top:80px;font-size:24px;font-weight:600;color:#5C564D;letter-spacing:1px}
.eyebrow{position:absolute;left:74px;top:178px;display:flex;align-items:center;gap:14px;font-size:24px;font-weight:600;letter-spacing:3.4px;text-transform:uppercase;color:#436A8F}
.eyebrow i{width:15px;height:24px;background:#436A8F;clip-path:polygon(0 0,100% 0,100% 100%,50% 70%,0 100%)}
h1{position:absolute;left:70px;top:222px;width:940px;font:450 96px/1.02 NR,Georgia,serif;letter-spacing:-2.6px}
h1 em{font-style:italic;color:#436A8F}
.sub{position:absolute;left:74px;top:460px;width:880px;font-size:33px;line-height:1.38;color:#5C564D}
.phone{position:absolute;left:50%;top:640px;width:610px;height:1290px;margin-left:-305px;border-radius:70px;background:#16181c;padding:14px;
  box-shadow:0 50px 90px -30px rgba(28,28,30,.45),0 0 0 2px rgba(28,28,30,.35)}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:57px;display:block}
.cover .p1{left:50%;margin-left:-440px;top:700px;width:560px;height:1210px;transform:rotate(-7deg);opacity:.98}
.cover .p2{left:50%;margin-left:-110px;top:610px;width:600px;height:1290px;transform:rotate(4deg)}
.cover h1{font-size:112px;top:236px}
.cover .sub{top:520px;font-size:36px}
.close h1{top:330px;font-size:150px;width:940px}
.close .sub{top:700px;font-size:38px}
.close .eyebrow{top:278px}
.url{position:absolute;left:74px;top:860px;font-size:54px;font-weight:700;letter-spacing:-.5px;color:#2B6CB0}
.pills{position:absolute;left:74px;top:980px;display:flex;gap:18px;flex-wrap:wrap;width:930px}
.pills span{padding:16px 28px;border-radius:999px;background:#fff;border:2px solid #E4DED5;font-size:28px;font-weight:600;color:#436A8F}
`

function slideHtml(s, i) {
  const pager = `${i + 1} / ${SLIDES.length}`
  const common = `<div class="glow"></div>
<div class="brand"><div class="mark"><svg width="50" height="50" viewBox="0 0 64 64"><g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z"/><path d="M32 20v28"/></g></svg></div>Lee Tu Biblia</div>
<div class="pager">${pager}</div>
<div class="eyebrow"><i></i>${esc(s.eyebrow)}</div>
<h1>${h(s.title)}</h1>
<p class="sub">${esc(s.sub)}</p>`
  let body
  if (s.kind === 'cover') {
    body = `<div class="phone p1"><img src="${shot('hoy-noche')}"></div><div class="phone p2"><img src="${shot('hoy-claro')}"></div>`
  } else if (s.kind === 'close') {
    body = `<p class="url">${s.url}</p><div class="pills"><span>Gratis</span><span>Sin publicidad</span><span>En español, inglés y portugués</span></div>`
  } else {
    body = `<div class="phone"><img src="${shot(s.shot)}"></div>`
  }
  return `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body class="${s.kind ?? ''}">${common}${body}</body>`
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 })
  for (const [i, s] of SLIDES.entries()) {
    await page.setContent(slideHtml(s, i), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    const out = join(OUT, `${s.id}.png`)
    await page.screenshot({ path: out, type: 'png' })
    console.log('escrito', out)
  }
} finally {
  await browser.close()
}
