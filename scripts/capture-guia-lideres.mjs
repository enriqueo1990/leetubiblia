// ============================================================================
// Captura las pantallas demo de /lideres Y de los mocks compartidos de /info y
// /ayuda (landingKit: PhoneMock, GroupMock, PrayerMock eran ilustraciones
// dibujadas; se reemplazan por capturas reales, igual que /lideres) desde la
// app real en dev.
//
// Prerrequisitos:
//   1. Dev server corriendo (npm run dev) — pasar el puerto vía BASE_URL si no
//      es 5173:  BASE_URL=http://localhost:5181 node scripts/capture-guia-lideres.mjs
//   2. Cuenta dev con datos demo: node scripts/seed-testdata.mjs
//      (la cuenta VITE_DEV_EMAIL debe tener nombre demo, acento sepia_base,
//       grupo "Grupo de los martes" con plan de grupo Proverbios seguido en Hoy)
//   3. GROUP_ID del grupo demo (default 12).
//
// Salida: reemplaza los PNG de src/assets/guia-lideres/ y src/assets/mocks/
// (390x844 @2x, o recortadas donde se indica).
// ============================================================================
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const GROUP = process.env.GROUP_ID || '12'
const OUT = 'src/assets/guia-lideres'
const OUT_MOCKS = 'src/assets/mocks'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Busca el primer elemento VISIBLE cuyo texto (sin hijos) matchee exacto.
const finder = (needle) => `[...document.querySelectorAll('*')].find(
  (e) => e.childElementCount === 0 && /^${needle}$/i.test((e.textContent ?? '').trim())
    && e.getBoundingClientRect().height > 0 && e.checkVisibility?.() !== false
)`

async function goAndWait(path, needle) {
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 20000 }, needle)
  await sleep(2200) // splash 1s + settle
}

// 0) Onboarding (perfil headless nuevo): saltar el último paso si aparece.
await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 })
await sleep(4000)
if (await page.evaluate(() => document.body.innerText.includes('Casi listo'))) {
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Entendido')?.click()
  })
  await sleep(2500)
  console.log('· onboarding saltado')
}

// 1) HOY con "Con tus grupos"
await goAndWait('/', 'Con tus grupos')
await page.evaluate(`${finder('Con tus grupos')}?.scrollIntoView({ block: 'center' })`)
await sleep(500)
await page.screenshot({ path: `${OUT}/hoy-con-grupos.png` })
console.log('✓ hoy-con-grupos')

// 2) SALA del grupo (top)
await goAndWait(`/grupos/${GROUP}`, 'Grupo de los martes')
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(400)
await page.screenshot({ path: `${OUT}/sala-grupo.png` })
console.log('✓ sala-grupo')

// 3) PLAN del grupo — recorte de la tarjeta (clip en coords de DOCUMENTO)
await page.evaluate(`${finder('Plan del grupo')}?.scrollIntoView({ block: 'start' })`)
await sleep(600)
const clipY = await page.evaluate(
  `Math.max(0, ${finder('Plan del grupo')}.getBoundingClientRect().top + window.scrollY - 14)`
)
await page.screenshot({ path: `${OUT}/plan-del-grupo.png`, clip: { x: 0, y: clipY, width: 390, height: 253 } })
console.log('✓ plan-del-grupo')

// 4) PULSO del líder (lectura de la semana · solo vos)
await page.evaluate(`${finder('Pablo \\\\(vos\\\\)')}?.scrollIntoView({ block: 'center' })`).catch(() => {})
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(
    (e) => e.childElementCount === 0 && /lectura de la semana/i.test(e.textContent ?? '')
      && e.getBoundingClientRect().height > 0
  )
  el?.scrollIntoView({ block: 'center' })
})
await sleep(500)
await page.screenshot({ path: `${OUT}/pulso-lider.png` })
console.log('✓ pulso-lider')

// 5) ORAR AHORA
await page.goto(BASE + '/orar', { waitUntil: 'networkidle2' })
await sleep(3500)
await page.screenshot({ path: `${OUT}/orar-ahora.png` })
console.log('✓ orar-ahora')

// ── Mocks compartidos de /info y /ayuda (antes ilustrados a mano) ──────────
const { mkdirSync } = await import('node:fs')
mkdirSync(OUT_MOCKS, { recursive: true })

// 6) HOY — recorte SIN "Con tus grupos" (el mock es para el lector general,
//    no específico de grupo): desde arriba hasta el borde de esa sección.
await goAndWait('/', 'Con tus grupos')
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(400)
const hoyClipBottom = await page.evaluate(`${finder('Con tus grupos')}.getBoundingClientRect().top`)
await page.screenshot({
  path: `${OUT_MOCKS}/hoy-lectura.png`,
  clip: { x: 0, y: 0, width: 390, height: Math.round(hoyClipBottom) - 12 },
})
console.log('✓ mocks/hoy-lectura')

// 7) ORACIÓN — lista general de pedidos (tab "Míos")
await goAndWait('/oracion', 'Orar ahora')
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(400)
await page.screenshot({ path: `${OUT_MOCKS}/oracion-lista.png` })
console.log('✓ mocks/oracion-lista')

// 8) GRUPO — misma sala que /lideres, reusada tal cual para /info y /ayuda.
await page.goto(BASE + `/grupos/${GROUP}`, { waitUntil: 'networkidle2' })
await sleep(2200)
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(400)
await page.screenshot({ path: `${OUT_MOCKS}/sala-grupo.png` })
console.log('✓ mocks/sala-grupo')

await browser.close()
console.log('LISTO — revisá src/assets/guia-lideres/ y src/assets/mocks/')
