// Captura pantallas reales de la app (dev server con auto-login de prueba)
// para usarlas dentro de los marcos de teléfono del carrusel.
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
// Saltar el último paso del onboarding (solo marca un flag local).
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('ltb.onboarded_extras', '1')
})

async function waitForText(text, timeout = 30000) {
  await page.waitForFunction(
    (t) => document.body && document.body.innerText.includes(t),
    { timeout },
    text,
  )
}

async function shot(name) {
  await new Promise((r) => setTimeout(r, 900))
  await page.screenshot({ path: resolve(root, `screen-${name}.png`) })
  console.log(`✓ screen-${name}.png`)
}

// 1 · Hoy (sin marcar, con el botón visible)
await page.goto(`${base}/`, { waitUntil: 'networkidle2' })
await waitForText('Marcar como leído', 45000)
await shot('hoy')

// Marcar como leído para que el grupo muestre "leyó hoy".
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Marcar como leído'),
  )
  btn?.click()
})
await new Promise((r) => setTimeout(r, 2500))

// 2 · Detalle del grupo
await page.goto(`${base}/grupos/12`, { waitUntil: 'networkidle2' })
await waitForText('Plan del grupo', 30000)
await shot('grupo')

// 3 · Orar ahora (primera tarjeta)
await page.goto(`${base}/orar`, { waitUntil: 'networkidle2' })
await waitForText('pedido', 30000)
await shot('orar')

// 4 · Materiales
await page.goto(`${base}/materiales`, { waitUntil: 'networkidle2' })
await waitForText('Materiales', 30000)
await shot('materiales')

await browser.close()
