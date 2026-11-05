import test from 'node:test'
import assert from 'node:assert/strict'
import { myTimeSteps, shouldInviteMyTime, pickMyTime, normalizeMyTime, readLocalMyTime } from '../src/lib/myTime.js'

function fakeStorage(entries = {}) {
  const m = new Map(Object.entries(entries))
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }
}

test('los pasos siguen lo elegido', () => {
  assert.deepEqual(myTimeSteps({ note: true, prayer: true, reflectionsEnabled: true }), ['prepare', 'read', 'note', 'pray', 'done'])
  assert.deepEqual(myTimeSteps({ note: false, prayer: true, reflectionsEnabled: true }), ['prepare', 'read', 'pray', 'done'])
  assert.deepEqual(myTimeSteps({ note: true, prayer: false, reflectionsEnabled: true }), ['prepare', 'read', 'note', 'done'])
})

test('sin el diario activo no se pide la nota', () => {
  assert.deepEqual(myTimeSteps({ note: true, prayer: true, reflectionsEnabled: false }), ['prepare', 'read', 'pray', 'done'])
})

test('la invitación: desde el segundo día, con la lectura pendiente, una vez', () => {
  const base = { enabled: false, dismissed: false, completedCount: 2, doneToday: false }
  assert.equal(shouldInviteMyTime(base), true)
  assert.equal(shouldInviteMyTime({ ...base, completedCount: 1 }), false)
  assert.equal(shouldInviteMyTime({ ...base, doneToday: true }), false)
  assert.equal(shouldInviteMyTime({ ...base, dismissed: true }), false)
  assert.equal(shouldInviteMyTime({ ...base, enabled: true }), false)
})

test('gana la copia más reciente, la de la cuenta a igual fecha', () => {
  const account = { enabled: true, updatedAt: 200 }
  const device = { enabled: false, updatedAt: 100 }
  assert.equal(pickMyTime(account, device).enabled, true)
  assert.equal(pickMyTime({ enabled: false, updatedAt: 50 }, device).enabled, false)
  assert.equal(pickMyTime({ enabled: true }, { enabled: false }).enabled, true)
  assert.equal(pickMyTime(null, undefined).enabled, false)
})

test('normaliza lo que venga y descarta lo raro', () => {
  assert.equal(normalizeMyTime('x'), null)
  assert.deepEqual(normalizeMyTime({ enabled: 'si', note: false }), { enabled: false, note: false, prayer: true, inviteDismissed: false, updatedAt: 0 })
})

test('la copia del aparato respeta la invitación descartada de antes', () => {
  const s = fakeStorage({ 'ltb.myTime.inviteDismissed.u1': '1' })
  assert.equal(readLocalMyTime('u1', s).inviteDismissed, true)
  assert.equal(readLocalMyTime('u2', s), null)
})
