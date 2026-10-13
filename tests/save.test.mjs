import test from 'node:test'
import assert from 'node:assert/strict'
import { saveOrRevert } from '../src/lib/saveWithRevert.js'

test('guardado exitoso no revierte', async () => {
  let reverted = false
  const ok = await saveOrRevert(async () => ({ error: null }), () => (reverted = true))
  assert.equal(ok, true)
  assert.equal(reverted, false)
})

test('{ error } revierte y devuelve false', async () => {
  let reverted = false
  const ok = await saveOrRevert(async () => ({ error: new Error('x') }), () => (reverted = true))
  assert.equal(ok, false)
  assert.equal(reverted, true)
})

test('una excepción también revierte', async () => {
  let reverted = false
  const ok = await saveOrRevert(async () => { throw new Error('red') }, () => (reverted = true))
  assert.equal(ok, false)
  assert.equal(reverted, true)
})

test('un revert que falla no tapa el resultado', async () => {
  const ok = await saveOrRevert(async () => ({ error: new Error('x') }), () => { throw new Error('boom') })
  assert.equal(ok, false)
})
