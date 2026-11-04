import test from 'node:test'
import assert from 'node:assert/strict'
import { myTimeSteps, shouldInviteMyTime } from '../src/lib/myTime.js'

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
