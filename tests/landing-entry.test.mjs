import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseLandingEntry,
  initialAuthStep,
  initialMode,
  saveLeaderIntent,
  hasLeaderIntent,
  clearLeaderIntent,
} from '../src/lib/landingEntry.js'
import { clearSessionFlags } from '../src/lib/sessionFlags.js'

function fakeStore(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  }
}
const brokenStore = {
  getItem() {
    throw new Error('SecurityError')
  },
  setItem() {
    throw new Error('SecurityError')
  },
  removeItem() {
    throw new Error('SecurityError')
  },
}

test('parseLandingEntry: lee from, líder y entrar de la URL', () => {
  assert.deepEqual(parseLandingEntry('?from=info'), { from: 'info', leader: false, login: false })
  assert.deepEqual(parseLandingEntry('?from=lideres'), { from: 'lideres', leader: true, login: false })
  assert.deepEqual(parseLandingEntry('?from=ayuda&login=1'), { from: 'ayuda', leader: false, login: true })
  // intent=lider vale con cualquier origen, y solo, sin from
  assert.equal(parseLandingEntry('?from=info&intent=lider').leader, true)
  assert.deepEqual(parseLandingEntry('?intent=lider'), { from: null, leader: true, login: false })
})

test('parseLandingEntry: ignora lo que no conoce', () => {
  assert.equal(parseLandingEntry('?from=facebook').from, null)
  assert.equal(parseLandingEntry('?from=INFO').from, null)
  assert.equal(parseLandingEntry('?intent=otro').leader, false)
  assert.equal(parseLandingEntry('?login=true').login, false)
  assert.deepEqual(parseLandingEntry(''), { from: null, leader: false, login: false })
  assert.deepEqual(parseLandingEntry(undefined), { from: null, leader: false, login: false })
})

const base = { restored: null, inviteCode: '', sessionExpired: false, iosBrowser: false }
const entry = (search) => parseLandingEntry(search)

test('initialAuthStep: sin landing, bienvenida de siempre', () => {
  assert.equal(initialAuthStep({ ...base, entry: entry('') }), 'welcome')
  assert.equal(initialAuthStep({ ...base, entry: entry('?from=privacidad') }), 'welcome')
})

test('initialAuthStep: desde info, lideres, biblioteca o ayuda se saltea la bienvenida', () => {
  for (const from of ['info', 'lideres', 'biblioteca', 'ayuda']) {
    assert.equal(initialAuthStep({ ...base, entry: entry(`?from=${from}`) }), 'explore', from)
  }
})

test('initialAuthStep: en iPhone/Safari se instala primero (mismo orden que startOnboarding)', () => {
  assert.equal(initialAuthStep({ ...base, iosBrowser: true, entry: entry('?from=info') }), 'install')
})

test('initialAuthStep: «Entrar» va derecho al ingreso', () => {
  const e = entry('?from=info&login=1')
  assert.equal(initialAuthStep({ ...base, entry: e }), 'form')
  assert.equal(initialAuthStep({ ...base, iosBrowser: true, entry: e }), 'form')
  assert.equal(initialMode('form', e), 'login')
  assert.equal(initialMode('explore', entry('?from=info')), 'signup')
  assert.equal(initialMode('welcome', entry('')), 'signup')
})

test('initialAuthStep: invitación, sesión vencida y código pendiente tienen prioridad', () => {
  const e = entry('?from=info')
  assert.equal(initialAuthStep({ ...base, inviteCode: 'ABC123', entry: e }), 'welcome')
  assert.equal(initialAuthStep({ ...base, sessionExpired: true, entry: e }), 'welcome')
  assert.equal(initialAuthStep({ ...base, restored: { email: 'a@b.c', mode: 'signup' }, entry: e }), 'code')
})

test('intención de líder: se guarda, vale 3 días y se consume', () => {
  const s = fakeStore()
  const t0 = Date.UTC(2026, 10, 6)
  assert.equal(hasLeaderIntent(s, t0), false)
  assert.equal(saveLeaderIntent(s, t0), true)
  assert.equal(hasLeaderIntent(s, t0 + 60 * 1000), true)
  assert.equal(hasLeaderIntent(s, t0 + 2 * 86400000), true)
  assert.equal(hasLeaderIntent(s, t0 + 4 * 86400000), false)
  clearLeaderIntent(s)
  assert.equal(hasLeaderIntent(s, t0), false)
})

test('intención de líder: un valor roto no cuenta', () => {
  assert.equal(hasLeaderIntent(fakeStore({ 'ltb.leaderIntent': 'abc' })), false)
  assert.equal(hasLeaderIntent(fakeStore({ 'ltb.leaderIntent': '-5' })), false)
})

test('intención de líder: sin localStorage no rompe nada', () => {
  assert.equal(saveLeaderIntent(brokenStore), false)
  assert.equal(hasLeaderIntent(brokenStore), false)
  assert.doesNotThrow(() => clearLeaderIntent(brokenStore))
})

test('cerrar sesión borra la intención de líder', () => {
  const s = fakeStore()
  saveLeaderIntent(s)
  clearSessionFlags('u1', s)
  assert.equal(hasLeaderIntent(s), false)
})
