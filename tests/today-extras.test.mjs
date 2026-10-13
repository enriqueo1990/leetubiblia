import test from 'node:test'
import assert from 'node:assert/strict'
import { buildExtraRows } from '../src/lib/todayExtrasRows.js'

// t falso: devuelve la clave con los parámetros, para poder afirmar sobre ella.
const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key)

const profile = { active_plan_id: 1, plan_start_date: '2026-01-01' }
const content = (total) => ({
  slug: 'keach',
  name: 'Catecismo de Keach',
  total,
  entries: Array.from({ length: total }, (_, i) => ({ number: i + 1, question: `P${i + 1}` })),
})
const group = (id, extra = {}) => ({
  groupId: id,
  groupName: `G${id}`,
  planId: 9,
  planStartDate: '2026-02-01',
  day: 3,
  totalDays: 40,
  read: false,
  ...extra,
})

test('sin grupos ni materiales devuelve []', () => {
  const rows = buildExtraRows({ groupReadings: [], materials: [], contents: {}, profile, t })
  assert.deepEqual(rows, [])
})

test('descarta el grupo que duplica el plan personal', () => {
  const dup = group(1, { planId: 1, planStartDate: '2026-01-01' })
  const rows = buildExtraRows({ groupReadings: [dup, group(2)], materials: [], contents: {}, profile, t })
  assert.deepEqual(rows.map((r) => r.key), ['group-2'])
})

test('un material completado no aparece', () => {
  const rows = buildExtraRows({
    groupReadings: [],
    materials: [{ slug: 'keach', position: 11 }],
    contents: { keach: content(10) },
    profile,
    t,
  })
  assert.deepEqual(rows, [])
})

test('las filas pendientes van antes que las hechas', () => {
  const rows = buildExtraRows({
    groupReadings: [group(1, { read: true }), group(2)],
    materials: [{ slug: 'keach', position: 2 }],
    contents: { keach: content(10) },
    profile,
    t,
  })
  assert.deepEqual(rows.map((r) => r.key), ['group-2', 'material-keach', 'group-1'])
  assert.deepEqual(rows.map((r) => r.pending), [true, true, false])
})

test('la meta del material es "Pregunta N de M" y trae la pregunta', () => {
  const [row] = buildExtraRows({
    groupReadings: [],
    materials: [{ slug: 'keach', position: 4 }],
    contents: { keach: content(10) },
    profile,
    t,
  })
  assert.equal(row.item.meta, 'materialsToday.questionOf:{"n":4,"total":10}')
  assert.equal(row.item.question, 'P4')
})

test('un material por fecha muestra la lectura de hoy y baja al final al marcarla', () => {
  const now = new Date(2026, 9, 13) // 13 de octubre
  const calContent = {
    slug: 'spurgeon-matutinas',
    name: 'Lecturas matutinas de Spurgeon',
    total: 366,
    entries: Array.from({ length: 366 }, (_, i) => ({ number: i + 1, question: `D${i + 1}` })),
  }
  const base = { groupReadings: [group(1)], contents: { 'spurgeon-matutinas': calContent }, t, locale: 'es', now }

  const open = buildExtraRows({ ...base, materials: [{ slug: 'spurgeon-matutinas' }], profile })
  assert.deepEqual(open.map((r) => r.key), ['group-1', 'material-spurgeon-matutinas'])
  assert.equal(open[1].pending, true)
  assert.equal(open[1].item.question, 'D287') // 13 de octubre = día 287 del año bisiesto

  const readProfile = { ...profile, active_materials: [{ slug: 'spurgeon-matutinas', readOn: '2026-10-13' }] }
  const done = buildExtraRows({
    ...base,
    materials: [{ slug: 'spurgeon-matutinas', readOn: '2026-10-13' }],
    profile: readProfile,
  })
  assert.deepEqual(done.map((r) => r.key), ['group-1', 'material-spurgeon-matutinas'])
  assert.equal(done[1].pending, false)
  assert.equal(done[1].item.meta, 'hoy.read')
})

test('un grupo con tu mismo plan pero otra fecha se marca como samePlan', () => {
  const rows = buildExtraRows({
    groupReadings: [group(1, { planId: 1, planStartDate: '2026-03-01' }), group(2)],
    materials: [],
    contents: {},
    profile,
    t,
  })
  assert.deepEqual(rows.map((r) => [r.key, r.samePlan]), [['group-1', true], ['group-2', false]])
})
