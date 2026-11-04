import test from 'node:test'
import assert from 'node:assert/strict'
import { dayPeriod, firstName } from '../src/lib/dayLight.js'

const at = (h) => new Date(2026, 10, 4, h, 30)

test('la luz sigue la hora: mañana, tarde, noche', () => {
  assert.equal(dayPeriod(at(5)), 'morning')
  assert.equal(dayPeriod(at(11)), 'morning')
  assert.equal(dayPeriod(at(12)), 'afternoon')
  assert.equal(dayPeriod(at(19)), 'afternoon')
  assert.equal(dayPeriod(at(20)), 'night')
  assert.equal(dayPeriod(at(2)), 'night')
})

test('el saludo usa solo el primer nombre', () => {
  assert.equal(firstName('Enrique García'), 'Enrique')
  assert.equal(firstName('  Ana '), 'Ana')
  assert.equal(firstName(''), null)
  assert.equal(firstName(null), null)
})
