import test from 'node:test'
import assert from 'node:assert/strict'
import { carouselSections, paginate, PARA } from '../src/lib/carousel.js'

const label = (r) => r.label

test('párrafos numerados: una sección por párrafo con sus citas', () => {
  const s = carouselSections(
    {
      number: 1,
      answer: '1. Primero.\n\n2. Segundo.',
      refs: [
        { label: 'Juan 1', p: 1 },
        { label: 'Juan 2', p: 2 },
        { label: 'Juan 3', p: 2 },
      ],
    },
    label,
  )
  assert.deepEqual(s, [
    { label: '1.1', paragraphs: ['Primero.'], refs: ['Juan 1'] },
    { label: '1.2', paragraphs: ['Segundo.'], refs: ['Juan 2', 'Juan 3'] },
  ])
})

test('sin numerar: una sola sección con todos los párrafos y todas las citas', () => {
  const s = carouselSections({ number: 3, answer: 'Uno.\n\nDos.', refs: [{ label: 'Juan 1' }] }, label)
  assert.deepEqual(s, [{ label: null, paragraphs: ['Uno.', 'Dos.'], refs: ['Juan 1'] }])
})

// Medida falsa: cada palabra ocupa 1, cada cambio de párrafo 1, las citas 3.
const height = (tokens, refs) => tokens.length + (refs.length ? 3 : 0)
const pagesOf = (sections, room) => paginate(sections, { height, avail: () => room })

test('lo que entra va en una lámina, con sus citas', () => {
  const pages = pagesOf([{ label: '1.1', paragraphs: ['a b c.'], refs: ['Juan 1'] }], 10)
  assert.deepEqual(pages, [{ label: '1.1', part: 0, paragraphs: ['a b c.'], refs: ['Juan 1'], more: false }])
})

test('lo largo sigue en la próxima, cortando en fin de oración', () => {
  const pages = pagesOf([{ label: null, paragraphs: ['a b c d e. f g h i j k l'], refs: [] }], 6)
  assert.deepEqual(
    pages.map((p) => [p.paragraphs, p.more, p.part]),
    [
      [['a b c d e.'], true, 0],
      [['f g h i j k'], true, 1],
      [['l'], false, 2],
    ],
  )
})

test('un fin de oración muy arriba no deja media lámina vacía', () => {
  const pages = pagesOf([{ label: null, paragraphs: ['a b. c d e f g h'], refs: [] }], 6)
  assert.deepEqual(pages[0].paragraphs, ['a b. c d e f'])
})

test('prefiere cortar en un cambio de párrafo (en la segunda mitad de la lámina)', () => {
  const pages = pagesOf([{ label: null, paragraphs: ['a b c d', 'e. f g'], refs: [] }], 6)
  assert.deepEqual(pages[0].paragraphs, ['a b c d'])
  assert.deepEqual(pages[1].paragraphs, ['e. f g'])
})

test('si el texto entra pero las citas no, lo último pasa con ellas', () => {
  const pages = pagesOf([{ label: '1.5', paragraphs: ['a b c. d e'], refs: ['Juan 1'] }], 6)
  assert.equal(pages.length, 2)
  assert.deepEqual(pages[0].refs, [])
  assert.deepEqual(pages[1].paragraphs, ['d e'])
  assert.deepEqual(pages[1].refs, ['Juan 1'])
})

test('las citas nunca se pierden, aunque no entren con ninguna palabra', () => {
  const pages = pagesOf([{ label: '1.1', paragraphs: ['a'], refs: ['Juan 1'] }], 2)
  assert.deepEqual(
    pages.map((p) => [p.paragraphs, p.refs]),
    [
      [['a'], []],
      [[], ['Juan 1']],
    ],
  )
})

test('cada sección arranca lámina nueva y el texto llega entero', () => {
  const sections = [
    { label: '1.1', paragraphs: ['uno dos tres cuatro cinco seis siete'], refs: [] },
    { label: '1.2', paragraphs: ['ocho'], refs: [] },
  ]
  const pages = pagesOf(sections, 4)
  assert.equal(pages.at(-1).label, '1.2')
  const words = pages.flatMap((p) => p.paragraphs.join(' ').split(' ')).filter(Boolean)
  assert.deepEqual(words, 'uno dos tres cuatro cinco seis siete ocho'.split(' '))
  assert.ok(!pages.some((p) => p.paragraphs.some((t) => t.includes(PARA))))
})
