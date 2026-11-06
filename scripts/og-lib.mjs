// Imagen Open Graph (1200×630) de una landing, con el sistema «Marcapáginas · Luz de
// mañana»: papel claro, resplandor Cielo con un hilo de sol, titular en Newsreader
// (la misma subsetada de las landings, public/fonts) con el énfasis en cursiva y
// la cinta marcapáginas. Se rasteriza con Chrome (puppeteer-core, ya en deps) y no
// con sharp porque librsvg no lee woff2. Solo escribe el PNG de salida.
//
// Uso: import { renderOg } from './og-lib.mjs' (ver og-info.mjs y og-lideres.mjs).
// Los hex vienen de src/styles/tokens.css (Cielo, claro).
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const font = (name) =>
  readFileSync(fileURLToPath(new URL(`../public/fonts/${name}`, import.meta.url))).toString('base64')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// title: \n separa líneas y *…* marca el énfasis (cursiva en el acento).
export async function renderOg({ eyebrow, title, sub, url, out, size = 88, shot = null }) {
  // shot: ruta de una captura real (390×844 a 2×/3×). Con captura, el teléfono sangra
  // por el borde derecho/inferior y el texto se acota a la izquierda (sin cinta).
  const shotUri = shot ? `data:image/${shot.endsWith('.png') ? 'png' : 'webp'};base64,${readFileSync(shot).toString('base64')}` : null
  const fs = shot ? Math.round(size * 0.8) : size
  const textW = shot ? 700 : 940
  const h1 = esc(title).replace(/\n/g, '<br>').replace(/\*(.+?)\*/g, '<em>$1</em>')
  const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:NR;font-style:normal;font-weight:400 500;src:url(data:font/woff2;base64,${font('newsreader-roman-v1.woff2')}) format("woff2")}
@font-face{font-family:NR;font-style:italic;font-weight:400 500;src:url(data:font/woff2;base64,${font('newsreader-italic-v1.woff2')}) format("woff2")}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;position:relative;overflow:hidden;background:#FAF8F4;color:#1F1B16;
  font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif}
.glow{position:absolute;inset:0;background:
  radial-gradient(46% 62% at 94% 4%, rgba(255,222,160,.55), transparent 70%),
  radial-gradient(62% 80% at 82% 20%, rgba(91,159,223,.30), transparent 72%),
  radial-gradient(50% 60% at 4% 0%, rgba(91,159,223,.16), transparent 70%)}
.ribbon{display:${shot ? 'none' : 'block'};position:absolute;right:120px;top:0;width:54px;height:300px;background:#5B9FDF;
  clip-path:polygon(0 0,100% 0,100% 100%,50% 90%,0 100%)}
.ribbon::after{content:"";position:absolute;left:0;top:0;width:14px;height:100%;background:rgba(0,0,0,.14)}
.brand{position:absolute;left:80px;top:66px;display:flex;align-items:center;gap:18px;font-size:27px;font-weight:700;letter-spacing:-.5px}
.mark{width:60px;height:60px;border-radius:15px;background:#2B6CB0;display:grid;place-items:center}
.eyebrow{position:absolute;left:82px;top:196px;display:flex;align-items:center;gap:14px;font-size:20px;font-weight:600;letter-spacing:3.2px;text-transform:uppercase;color:#436A8F}
.eyebrow i{width:13px;height:20px;background:#436A8F;clip-path:polygon(0 0,100% 0,100% 100%,50% 70%,0 100%)}
h1{position:absolute;left:78px;top:238px;width:${textW}px;font:450 ${fs}px/1.02 NR,Georgia,serif;letter-spacing:-2px}
h1 em{font-style:italic;color:#436A8F}
.sub{position:absolute;left:82px;top:${shot ? 436 : 452}px;width:${shot ? 640 : 960}px;font-size:25px;line-height:1.4;color:#5C564D}
.url{position:absolute;left:82px;bottom:48px;font-size:21px;font-weight:600;letter-spacing:.3px;color:#436A8F}

.phone{position:absolute;right:84px;top:56px;width:292px;height:632px;border-radius:46px;background:#16181c;padding:9px;
  transform:rotate(3deg);transform-origin:50% 100%;box-shadow:0 30px 60px -20px rgba(28,28,30,.40),0 0 0 1.5px rgba(28,28,30,.35)}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:37px;display:block}
</style><div class="glow"></div><div class="ribbon"></div>${shotUri ? `<div class="phone"><img src="${shotUri}"></div>` : ''}
<div class="brand"><div class="mark"><svg width="48" height="48" viewBox="0 0 64 64"><g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 20C28 16.7 22.2 16 12 16v28c10.2 0 16 .7 20 4 4-3.3 9.8-4 20-4V16c-10.2 0-16 .7-20 4Z"/><path d="M32 20v28"/></g></svg></div>Lee Tu Biblia</div>
<div class="eyebrow"><i></i>${esc(eyebrow)}</div>
<h1>${h1}</h1>
<p class="sub">${esc(sub)}</p>
<p class="url">${esc(url)}</p>`
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: out, type: 'png' })
  } finally {
    await browser.close()
  }
  console.log('escrito', out)
}
