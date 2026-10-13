import test from 'node:test'
import assert from 'node:assert/strict'
import { computeDateStreak, longestStreak, addDaysISO } from '../src/lib/dateMath.js'
import { totalDaysRead } from '../src/lib/stats.js'

const set = (...d) => new Set(d)

test('racha viva: termina hoy', () => {
  assert.equal(computeDateStreak(set('2026-10-11', '2026-10-12', '2026-10-13'), '2026-10-13'), 3)
})

test('racha viva: hoy todavía no leíste pero ayer sí', () => {
  assert.equal(computeDateStreak(set('2026-10-11', '2026-10-12'), '2026-10-13'), 2)
})

test('racha con hueco se corta', () => {
  assert.equal(computeDateStreak(set('2026-10-09', '2026-10-12', '2026-10-13'), '2026-10-13'), 2)
})

test('racha: fechas de otro plan cuentan (la racha es del usuario)', () => {
  const planActual = ['2026-10-13']
  const otrosPlanes = ['2026-10-11', '2026-10-12']
  assert.equal(computeDateStreak(new Set([...planActual, ...otrosPlanes]), '2026-10-13'), 3)
})

test('racha más larga cruza meses y años bisiestos', () => {
  assert.equal(longestStreak(['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-05']), 3)
  assert.equal(addDaysISO('2024-02-28', 2), '2024-03-01')
})

test('acumulado: sin logros es solo la huella viva', () => {
  const rows = [{ plan_id: 1, completed_on: '2026-10-12' }, { plan_id: 1, completed_on: '2026-10-13' }]
  assert.equal(totalDaysRead({ liveDates: set('2026-10-12', '2026-10-13'), progressRows: rows, completions: [] }), 2)
})

test('acumulado: un logro con el progreso todavía vivo no se duplica', () => {
  const rows = [{ plan_id: 1, completed_on: '2026-09-01' }, { plan_id: 1, completed_on: '2026-09-02' }]
  const comps = [{ plan_id: 1, days_read: 2, completed_on: '2026-09-02' }]
  assert.equal(totalDaysRead({ liveDates: set('2026-09-01', '2026-09-02'), progressRows: rows, completions: comps }), 2)
})

test('acumulado: al renovar, los días del ciclo cerrado se conservan', () => {
  // Plan 1 de 90 días terminado el 2026-09-30 y renovado: sin filas viejas.
  const comps = [{ plan_id: 1, days_read: 90, completed_on: '2026-09-30' }]
  const rowsAfterRenew = [{ plan_id: 1, completed_on: '2026-10-12' }]
  assert.equal(
    totalDaysRead({ liveDates: set('2026-10-12'), progressRows: rowsAfterRenew, completions: comps }),
    91
  )
})
