import test from 'node:test'
import assert from 'node:assert/strict'
import { splitSentences, joinSentences } from '../src/lib/sentences.js'

const texts = (s) => splitSentences(s).map((x) => x.text)

test('corta en punto, punto y coma, dos puntos y signos de cierre', () => {
  assert.deepEqual(texts('Uno dos. Tres; cuatro: cinco? Seis!'), ['Uno dos.', 'Tres;', 'cuatro:', 'cinco?', 'Seis!'])
})

test('la comilla de cierre queda con su oración', () => {
  assert.deepEqual(texts('Dijo «sí.» Y se fue.'), ['Dijo «sí.»', 'Y se fue.'])
})

test('cada párrafo arranca oración nueva y conserva su índice', () => {
  const s = splitSentences('Primero sin punto\n\nSegundo.')
  assert.deepEqual(s, [
    { text: 'Primero sin punto', para: 0 },
    { text: 'Segundo.', para: 1 },
  ])
})

test('no corta en abreviaturas ni en el número de un párrafo', () => {
  assert.deepEqual(texts('1. La Escritura, p. ej. la ley, cf. Romanos. Fin.'), [
    '1. La Escritura, p. ej. la ley, cf. Romanos.',
    'Fin.',
  ])
})

test('une un rango en cualquier orden', () => {
  const s = splitSentences('A. B. C.')
  assert.equal(joinSentences(s, 2, 1), 'B. C.')
})
