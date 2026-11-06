import test from 'node:test'
import assert from 'node:assert/strict'
import {
  markLandingSeen,
  isSendingPaused,
  buildLandingRow,
  sendLandingEvent,
  recordLandingView,
  recordLandingCta,
  OFF_MS,
} from '../src/lib/landingTrack.js'

function fakeStore(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  }
}

const NOW = Date.UTC(2026, 10, 6, 12)
function deps(over = {}) {
  const calls = []
  const d = {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) })
      return { ok: true, status: 201 }
    },
    store: fakeStore(),
    now: NOW,
    url: 'https://x.supabase.co',
    key: 'eyJ.fake.jwt',
    dev: false,
    device: 'dev-1',
    standalone: false,
    userAgent: 'Mozilla/5.0 test',
    ...over,
  }
  return d
}

test('landing_view: una vez por dispositivo y página', async () => {
  const d = deps()
  assert.equal(await recordLandingView('info', {}, d), true)
  assert.equal(await recordLandingView('info', {}, d), false)
  assert.equal(await recordLandingView('lideres', {}, d), true)
  assert.equal(d.calls.length, 2)
  assert.deepEqual(d.calls.map((c) => c.body.detail.from), ['info', 'lideres'])
})

test('landing_view: la marca persiste entre cargas (mismo store)', () => {
  const s = fakeStore()
  assert.equal(markLandingSeen('ayuda', s), true)
  assert.equal(markLandingSeen('ayuda', s), false)
  assert.equal(markLandingSeen('info', s), true)
})

test('landing_view: no cuenta desde adentro de la app ni la app instalada ni páginas desconocidas', async () => {
  const d = deps()
  assert.equal(await recordLandingView('ayuda', { fromApp: true }, d), false)
  assert.equal(await recordLandingView('info', {}, deps({ standalone: true })), false)
  assert.equal(await recordLandingView('admin', {}, d), false)
  assert.equal(d.calls.length, 0)
  // y desde-la-app no consume la marca: la primera visita real sí cuenta
  assert.equal(await recordLandingView('ayuda', {}, d), true)
})

test('la fila no lleva datos personales: página, ubicación, id anónimo y marca de tiempo', async () => {
  const d = deps()
  await recordLandingCta('lideres', 'hero', d)
  const { url, init, body } = d.calls[0]
  assert.equal(url, 'https://x.supabase.co/rest/v1/boot_diagnostics')
  assert.equal(init.method, 'POST')
  assert.equal(init.keepalive, true)
  assert.equal(init.headers.apikey, 'eyJ.fake.jwt')
  assert.equal(init.headers.Authorization, 'Bearer eyJ.fake.jwt')
  assert.deepEqual(body, {
    user_id: null,
    event: 'landing_cta',
    detail: { from: 'lideres', where: 'hero', device: 'dev-1', ts: NOW },
    standalone: false,
    user_agent: 'Mozilla/5.0 test',
  })
})

test('clave publishable: solo apikey, sin Authorization', async () => {
  const d = deps({ key: 'sb_publishable_abc' })
  await recordLandingCta('info', 'cierre', d)
  assert.equal(d.calls[0].init.headers.Authorization, undefined)
})

test('landing_cta: ubicación acotada y página desconocida ignorada', async () => {
  const d = deps()
  await recordLandingCta('info', 'x'.repeat(100), d)
  assert.equal(d.calls[0].body.detail.where.length, 32)
  assert.equal(await recordLandingCta('otra', 'hero', d), false)
  assert.equal(d.calls.length, 1)
})

test('si la base rechaza los eventos (migración sin aplicar) no rompe y deja de insistir', async () => {
  const d = deps({ fetch: async () => ({ ok: false, status: 400 }) })
  assert.equal(await recordLandingCta('info', 'hero', d), false)
  assert.equal(isSendingPaused(d.store, NOW + 1000), true)
  assert.equal(isSendingPaused(d.store, NOW + OFF_MS + 1), false)
  // mientras dure la pausa no se vuelve a pedir nada
  let hits = 0
  const d2 = { ...d, fetch: async () => (hits++, { ok: true, status: 201 }), now: NOW + 1000 }
  assert.equal(await recordLandingCta('info', 'hero', d2), false)
  assert.equal(hits, 0)
  // pasada la pausa, vuelve a intentar
  assert.equal(await recordLandingCta('info', 'hero', { ...d2, now: NOW + OFF_MS + 1 }), true)
  assert.equal(hits, 1)
})

test('errores de red, store roto o sin configuración: silencio total', async () => {
  const boom = deps({ fetch: async () => { throw new Error('Failed to fetch') } })
  assert.equal(await recordLandingCta('info', 'hero', boom), false)
  assert.equal(isSendingPaused(boom.store, NOW), false) // sin red no se pausa: fue un corte, no un rechazo
  const syncBoom = deps({ fetch: () => { throw new Error('sync') } })
  assert.equal(await recordLandingCta('info', 'hero', syncBoom), false)
  const broken = {
    getItem() { throw new Error('x') },
    setItem() { throw new Error('x') },
  }
  assert.equal(await recordLandingView('info', {}, deps({ store: broken })), true) // sin storage, cuenta igual
  assert.equal(await recordLandingCta('info', 'hero', deps({ url: undefined })), false)
})

test('en desarrollo no se escribe en la base: va al sumidero', async () => {
  const sunk = []
  const d = deps({ dev: true, sink: (row) => sunk.push(row) })
  assert.equal(await recordLandingCta('info', 'hero', d), false)
  assert.equal(d.calls.length, 0)
  assert.equal(sunk[0].event, 'landing_cta')
})

test('buildLandingRow acota el user agent', () => {
  const row = buildLandingRow('landing_view', { from: 'info' }, { device: null, standalone: undefined, userAgent: 'u'.repeat(900), now: 1 })
  assert.equal(row.user_agent.length, 512)
  assert.equal(row.standalone, false)
})

test('sendLandingEvent nunca lanza aunque no haya deps', async () => {
  // sin window (Node): browserDeps falla adentro y se traga
  assert.equal(await sendLandingEvent('landing_view', { from: 'info' }), false)
})
