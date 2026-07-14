import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const root = resolve('marketing/carrusel-oracion-guiada')
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

mkdirSync(root, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 })
await page.goto(`file://${resolve(root, 'carrusel.html')}`, { waitUntil: 'networkidle0' })

const slides = await page.$$('.slide')
for (let i = 0; i < slides.length; i++) {
  await slides[i].screenshot({ path: resolve(root, `lamina-${i + 1}.png`) })
  console.log(`✓ lamina-${i + 1}.png`)
}

await browser.close()
