import test from 'node:test'
import assert from 'node:assert/strict'
import { passageLine } from '../src/lib/passageLine.js'

const ch = (label, book_usfm, chapter) => ({ label, book_usfm, chapter })

test('capítulos seguidos del mismo libro se juntan', () => {
  const refs = [ch('Salmos 116', 'PSA', 116), ch('Salmos 117', 'PSA', 117), ch('Salmos 118', 'PSA', 118)]
  assert.equal(passageLine(refs, 'es'), 'Salmos 116–118')
})

test('libros distintos van separados, y el idioma cambia el nombre', () => {
  const refs = [ch('Génesis 1', 'GEN', 1), ch('Mateo 1', 'MAT', 1)]
  assert.equal(passageLine(refs, 'es'), 'Génesis 1 · Mateo 1')
  assert.equal(passageLine(refs, 'en'), 'Genesis 1 · Matthew 1')
})

test('un pasaje con versículos no se junta con el capítulo siguiente', () => {
  const refs = [ch('Juan 3:16-21', 'JHN', 3), ch('Juan 4', 'JHN', 4)]
  assert.equal(passageLine(refs, 'es'), 'Juan 3:16-21 · Juan 4')
})

test('más de tres tramos: el resto como +N', () => {
  const refs = [ch('Génesis 1', 'GEN', 1), ch('Mateo 1', 'MAT', 1), ch('Esdras 1', 'EZR', 1), ch('Hechos 1', 'ACT', 1)]
  assert.equal(passageLine(refs, 'es'), 'Génesis 1 · Mateo 1 · Esdras 1 +1')
})
