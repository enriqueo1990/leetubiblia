import test from 'node:test'
import assert from 'node:assert/strict'
import { PLAN_ORDER, PLAN_DOORS, DOOR_ORDER, planDoor } from '../src/lib/planCatalog.js'

test('todos los planes del catálogo tienen puerta', () => {
  for (const slug of PLAN_ORDER) {
    assert.ok(PLAN_DOORS[slug], `el plan ${slug} no tiene puerta`)
  }
})

test('las puertas usadas existen en el orden de puertas', () => {
  for (const door of Object.values(PLAN_DOORS)) {
    assert.ok(DOOR_ORDER.includes(door), `puerta desconocida: ${door}`)
  }
})

test('un plan nuevo sin clasificar cae en "más planes" y no desaparece', () => {
  assert.equal(planDoor('plan-que-no-existe'), 'mas')
})
