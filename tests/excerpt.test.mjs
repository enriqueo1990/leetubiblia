import test from 'node:test'
import assert from 'node:assert/strict'
import { excerpt } from '../src/lib/excerpt.js'

test('un texto corto queda igual', () => {
  assert.equal(excerpt('Hola mundo.'), 'Hola mundo.')
})

test('toma solo el primer párrafo', () => {
  assert.equal(excerpt('Primero.\n\nSegundo.'), 'Primero.')
})

test('un párrafo largo se corta en límite de palabra con puntos suspensivos', () => {
  const long = 'palabra '.repeat(100).trim()
  const out = excerpt(long, 50)
  assert.ok(out.endsWith('…'))
  assert.ok(out.length <= 51)
  assert.equal(out.includes('palabr…'), false)
})

test('null o vacío devuelve cadena vacía', () => {
  assert.equal(excerpt(null), '')
})
