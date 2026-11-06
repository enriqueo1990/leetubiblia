// ============================================================================
// Capturas REALES de la app para las landings, desde la cuenta DEMO (la de
// hola@leetubiblia.com, sembrada con datos de ejemplo: «Lucía», plan Cronológico
// día 14, notas y pedidos de ejemplo). NUNCA se usa la cuenta personal de Enrique.
//
// Uso:
//   DEMO_EMAIL=hola@leetubiblia.com DEMO_PASS_FILE=/ruta/a/la/clave.txt \
//   BASE_URL=http://localhost:5183 node scripts/capture-demo.mjs
// El dev server debe estar corriendo SIN autologin (VITE_DEV_EMAIL vacío).
// Inicia sesión con supabase-js (la contraseña vive fuera del repo) e inyecta la
// sesión en localStorage antes de cargar cada pantalla. Solo lectura: no marca
// lecturas ni escribe nada.
// Salida: .shots-raw/<pantalla>-<claro|noche>.png (390×844 a 3×; carpeta fuera de git).
// Después: node scripts/optimize-shots.mjs .shots-raw  → AVIF/WebP en src/assets/shots/.
// ============================================================================
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import puppeteer from 'puppeteer-core'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const f of ['.env', '.env.local']) {
  const p = join(root, f)
  if (!existsSync(p)) continue
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const BASE = process.env.BASE_URL || 'http://localhost:5183'
const EMAIL = process.env.DEMO_EMAIL
const PASS = readFileSync(process.env.DEMO_PASS_FILE, 'utf8').trim()
if (EMAIL !== 'hola@leetubiblia.com') throw new Error('Solo se captura la cuenta demo (hola@leetubiblia.com).')

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS })
if (error) throw new Error('Login falló: ' + error.message)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const storageKey = `sb-${ref}-auth-token`
const session = JSON.stringify(data.session)

const OUT = process.env.SHOTS_OUT || join(root, '.shots-raw')
mkdirSync(OUT, { recursive: true })

const SCREENS = [
  { name: 'hoy', path: '/', wait: 'Marcar como leído', scroll: 0 },
  { name: 'orar', path: '/orar', wait: 'Estoy orando|Oré por esto|Sigamos|Siguiente', scroll: 0, noTabs: true },
  { name: 'oracion', path: '/oracion', wait: 'Orar ahora', scroll: 0 },
  { name: 'progreso', path: '/progreso', wait: 'racha|Racha|días', scroll: 0 },
  { name: 'biblioteca', path: '/materiales', wait: 'Catecismo', scroll: 0 },
  { name: 'lector', path: '/materiales/heidelberg', wait: 'Heidelberg', scroll: 0 },
]

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = new Date().toISOString().slice(0, 10)

for (const mode of ['claro', 'noche']) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: mode === 'noche' ? 'dark' : 'light' }])
  await page.evaluateOnNewDocument(
    (k, s, theme, day, uid) => {
      localStorage.setItem(k, s)
      localStorage.setItem(`ltb.myTime.inviteDismissed.${uid}`, '1') // sin la invitación a «Mi tiempo» detrás de la barra
      localStorage.setItem('ltb.theme_pref', theme)
      localStorage.setItem('ltb.diag.openDay', day) // no contar aperturas de estas capturas
      localStorage.setItem(
        'ltb.diag.funnel',
        JSON.stringify(['ob_welcome', 'ob_install_step', 'ob_explore', 'ob_plan_chosen', 'ob_code_sent', 'ob_code_verified', 'ob_name_saved', 'ob_extras_done', 'ob_first_mark', 'goal_shown', 'goal_open'])
      )
    },
    storageKey,
    session,
    mode === 'noche' ? 'dark' : 'light',
    today,
    data.user.id
  )
  for (const s of SCREENS) {
    await page.goto(BASE + s.path, { waitUntil: 'networkidle2', timeout: 45000 })
    try {
      await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), { timeout: 20000 }, s.wait)
    } catch {
      console.log('· sin texto esperado en', s.name, mode)
    }
    await sleep(2600) // splash + animaciones de entrada
    await page.evaluate((y) => window.scrollTo(0, y), s.scroll)
    await sleep(300)
    await page.screenshot({ path: join(OUT, `${s.name}-${mode}.png`) })
    console.log('✓', s.name, mode)
  }
  await page.close()
}
await browser.close()
