import test from 'node:test'
import assert from 'node:assert/strict'
import { isExtrasDone, markExtrasDone, clearSessionFlags } from '../src/lib/sessionFlags.js'

function fakeStore(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  }
}
const NOW = Date.UTC(2026, 9, 13)
const old = { created_at: new Date(NOW - 10 * 86400000).toISOString() }
const fresh = { created_at: new Date(NOW - 60 * 1000).toISOString() }

test('la bandera es por usuario', () => {
  const s = fakeStore()
  markExtrasDone('a', s)
  assert.equal(isExtrasDone('a', fresh, s, NOW), true)
  assert.equal(isExtrasDone('b', fresh, s, NOW), false)
})

test('una cuenta nueva NO hereda la bandera vieja global del dispositivo', () => {
  const s = fakeStore({ 'ltb.onboarded_extras': '1' })
  assert.equal(isExtrasDone('nueva', fresh, s, NOW), false)
})

test('una cuenta con más de 2 días sí migra la bandera vieja a su clave', () => {
  const s = fakeStore({ 'ltb.onboarded_extras': '1' })
  assert.equal(isExtrasDone('vieja', old, s, NOW), true)
  assert.equal(s.getItem('ltb.onboarded_extras.vieja'), '1')
})

test('cerrar sesión limpia la bandera del usuario y el plan pendiente', () => {
  const s = fakeStore({ 'ltb.onboarded_extras.a': '1', 'ltb.pendingPlan': '{"planId":3}' })
  clearSessionFlags('a', s)
  assert.equal(s.getItem('ltb.onboarded_extras.a'), null)
  assert.equal(s.getItem('ltb.pendingPlan'), null)
})
