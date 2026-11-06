import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PENDING_CODE_TTL,
  clearPendingCode,
  readPendingCode,
  savePendingCode,
} from '../src/lib/pendingCode.js'
import { clearSessionFlags } from '../src/lib/sessionFlags.js'

function fakeStore(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}
const NOW = Date.UTC(2026, 10, 6)

test('guarda correo y modo, y los recupera dentro de los 15 minutos', () => {
  const s = fakeStore()
  savePendingCode({ email: 'a@b.co', mode: 'signup' }, s, NOW)
  assert.deepEqual(readPendingCode(s, NOW + 5 * 60 * 1000), { email: 'a@b.co', mode: 'signup', sentAt: NOW })
})

test('vence a los 15 minutos y se descarta', () => {
  const s = fakeStore()
  savePendingCode({ email: 'a@b.co', mode: 'login' }, s, NOW)
  assert.equal(readPendingCode(s, NOW + PENDING_CODE_TTL + 1), null)
  assert.equal(s.getItem('ltb.pendingCode'), null)
})

test('datos corruptos o incompletos no reabren nada', () => {
  assert.equal(readPendingCode(fakeStore({ 'ltb.pendingCode': 'no es json' }), NOW), null)
  assert.equal(readPendingCode(fakeStore({ 'ltb.pendingCode': '{"email":"a@b.co","mode":"otro","sentAt":1}' }), NOW), null)
  assert.equal(readPendingCode(fakeStore(), NOW), null)
})

test('clearPendingCode y cerrar sesión lo borran', () => {
  const s = fakeStore()
  savePendingCode({ email: 'a@b.co', mode: 'signup' }, s, NOW)
  clearPendingCode(s)
  assert.equal(readPendingCode(s, NOW), null)
  savePendingCode({ email: 'a@b.co', mode: 'signup' }, s, NOW)
  clearSessionFlags('u', s)
  assert.equal(readPendingCode(s, NOW), null)
})
