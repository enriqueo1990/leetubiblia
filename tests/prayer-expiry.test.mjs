import test from 'node:test'
import assert from 'node:assert/strict'
import { expiresAtFor, reviewedPatch } from '../src/lib/prayerExpiry.js'

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0)

test('"forever" no vence', () => {
  assert.equal(expiresAtFor('forever', NOW), null)
})

test('semana vence a los 7 días', () => {
  assert.equal(expiresAtFor('week', NOW), new Date(NOW + 7 * 86400000).toISOString())
})

test('seguir orando un pedido vigente solo reinicia el reloj', () => {
  const patch = reviewedPatch({ duration_type: 'week', expires_at: new Date(NOW + 86400000).toISOString() }, NOW)
  assert.deepEqual(Object.keys(patch), ['last_reviewed_at'])
})

test('seguir orando un pedido vencido renueva su vencimiento', () => {
  const patch = reviewedPatch({ duration_type: 'week', expires_at: new Date(NOW - 86400000).toISOString() }, NOW)
  assert.equal(patch.expires_at, new Date(NOW + 7 * 86400000).toISOString())
})

test('un pedido "forever" sin vencimiento no toca expires_at', () => {
  const patch = reviewedPatch({ duration_type: 'forever', expires_at: null }, NOW)
  assert.equal('expires_at' in patch, false)
})
