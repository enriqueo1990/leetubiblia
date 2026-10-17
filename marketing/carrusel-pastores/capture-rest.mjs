// Captura grupo, orar y materiales (screen-hoy.png ya se capturó con capture.mjs).
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const root = resolve('marketing/carrusel-pastores')
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const base = 'http://localhost:5173'

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 })
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('ltb.onboarded_extras', '1')
})

async function waitForText(text, timeout = 60000) {
  await page.waitForFunction(
    (t) => document.body && document.body.innerText.includes(t),
    { timeout },
    text,
  )
}

async function shot(name) {
  await new Promise((r) => setTimeout(r, 1200))
  await page.screenshot({ path: resolve(root, `screen-${name}.png`) })
  console.log(`✓ screen-${name}.png`)
}

await page.goto(`${base}/grupos/12`, { waitUntil: 'networkidle2' })
await waitForText('martes')
await shot('grupo')

await page.goto(`${base}/orar`, { waitUntil: 'networkidle2' })
await waitForText('de 6')
await shot('orar')

await page.goto(`${base}/materiales`, { waitUntil: 'networkidle2' })
await waitForText('Heidelberg')
await shot('materiales')

await browser.close()
