import test from 'node:test'
import assert from 'node:assert/strict'
import { splitDropCap, paragraphs } from '../src/lib/dropCap.js'

test('la capitular es la primera letra', () => {
  assert.deepEqual(splitDropCap('Los fatigosos'), { punct: '', letter: 'L', rest: 'os fatigosos' })
})

test('la puntuación de apertura queda aparte, no es la capitular', () => {
  assert.deepEqual(splitDropCap('¿Cómo comenzaste?'), { punct: '¿', letter: 'C', rest: 'ómo comenzaste?' })
  assert.deepEqual(splitDropCap('«¡Oh, Señor!»'), { punct: '«¡', letter: 'O', rest: 'h, Señor!»' })
})

test('letras acentuadas cuentan como letra', () => {
  assert.equal(splitDropCap('Él es fiel').letter, 'É')
})

test('sin letra al comienzo no hay capitular', () => {
  assert.equal(splitDropCap('1. Primero'), null)
  assert.equal(splitDropCap(''), null)
})

test('párrafos separados por línea en blanco', () => {
  assert.deepEqual(paragraphs('Uno.\n\nDos.\n \nTres.'), ['Uno.', 'Dos.', 'Tres.'])
})
