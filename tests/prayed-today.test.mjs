import test from 'node:test'
import assert from 'node:assert/strict'
import { prayedRecordForToday, readPrayedToday, markPrayedToday } from '../src/lib/prayedToday.js'

function fakeStorage() {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }
}

test('un registro vale solo para el día de hoy', () => {
  assert.deepEqual(prayedRecordForToday({ date: '2026-11-04', title: 'Paz' }, '2026-11-04'), { date: '2026-11-04', title: 'Paz' })
  assert.equal(prayedRecordForToday({ date: '2026-11-03', title: 'Paz' }, '2026-11-04'), null)
  assert.equal(prayedRecordForToday(null, '2026-11-04'), null)
  assert.equal(prayedRecordForToday('x', '2026-11-04'), null)
})

test('marcar y leer en el mismo dispositivo', () => {
  const s = fakeStorage()
  assert.equal(readPrayedToday('u1', s), null)
  markPrayedToday('u1', 'Salud de mi mamá', s)
  assert.equal(readPrayedToday('u1', s)?.title, 'Salud de mi mamá')
  assert.equal(readPrayedToday('u2', s), null)
})
