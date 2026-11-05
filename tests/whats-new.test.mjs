import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowWhatsNew } from '../src/lib/whatsNew.js'

const base = { seenAccount: null, seenLocal: null, accountCreatedAt: '2026-05-20T12:00:00Z', version: '2027.1', since: '2026-11-06' }

test('a quien ya usaba la app y no las vio, sí', () => {
  assert.equal(shouldShowWhatsNew(base), true)
})

test('una sola vez: vistas en la cuenta o en este aparato, no', () => {
  assert.equal(shouldShowWhatsNew({ ...base, seenAccount: '2027.1' }), false)
  assert.equal(shouldShowWhatsNew({ ...base, seenLocal: '2027.1' }), false)
  assert.equal(shouldShowWhatsNew({ ...base, seenAccount: '2026.9' }), true)
})

test('a una cuenta nueva (desde la versión), no: para ella no hay nada "nuevo"', () => {
  assert.equal(shouldShowWhatsNew({ ...base, accountCreatedAt: '2026-11-07T09:00:00Z' }), false)
  assert.equal(shouldShowWhatsNew({ ...base, accountCreatedAt: null }), false)
})
