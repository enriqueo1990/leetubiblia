import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BIBLIOTECA_META, BIBLIOTECA_FAQ, BOOKS, SHELVES, LECTOR_DEMO, bibliotecaFaqJsonLd } from '../src/screens/bibliotecaCopy.js'
import { faqAnswerText } from '../src/screens/infoCopy.js'
import { MATERIALS } from '../src/lib/materials.js'
import { materialTheme } from '../src/lib/materialTheme.js'

const json = (slug) => JSON.parse(readFileSync(new URL(`../src/data/materials/${slug}.json`, import.meta.url), 'utf8'))

test('los números de la landing salen de los JSON de los materiales', () => {
  for (const m of MATERIALS) {
    const data = json(m.slug)
    const total = data.entries.reduce((n, b) => n + b.questions.length, 0)
    assert.equal(BOOKS[m.slug]?.total, total, `${m.slug}: entradas`)
    // «129 preguntas», «37 artículos», «35 lecturas»: el número del texto es el total.
    assert.match(BOOKS[m.slug].count, new RegExp(`^${total} `), `${m.slug}: texto de la tapa`)
  }
})

test('los años de la landing son los de las tapas de la app', () => {
  for (const m of MATERIALS) {
    const year = materialTheme(m.slug).year
    assert.equal(BOOKS[m.slug].year, year || (m.slug === 'credos' ? 'Primeros siglos' : ''), m.slug)
  }
})

test('los estantes cubren los diez libros, una sola vez', () => {
  const slugs = SHELVES.flatMap((s) => s.slugs)
  assert.equal(slugs.length, MATERIALS.length)
  assert.deepEqual([...slugs].sort(), MATERIALS.map((m) => m.slug).sort())
})

test('título y descripción únicos y dentro del límite', () => {
  assert.ok(BIBLIOTECA_META.title.length <= 60, `título: ${BIBLIOTECA_META.title.length}`)
  assert.ok(BIBLIOTECA_META.description.length <= 155, `descripción: ${BIBLIOTECA_META.description.length}`)
})

test('el FAQPage repite palabra por palabra el FAQ visible', () => {
  const ld = bibliotecaFaqJsonLd()
  assert.equal(ld['@type'], 'FAQPage')
  assert.equal(ld.mainEntity.length, BIBLIOTECA_FAQ.length)
  BIBLIOTECA_FAQ.forEach((item, i) => {
    assert.equal(ld.mainEntity[i].name, item.q)
    assert.equal(ld.mainEntity[i].acceptedAnswer.text, faqAnswerText(item))
  })
})

test('ninguna cadena de la landing cita texto bíblico: solo referencias', () => {
  const all = JSON.stringify([BIBLIOTECA_FAQ, BOOKS])
  // Las comillas angulares abren una cita; las únicas permitidas son nombres de botones y secciones.
  const quoted = [...all.matchAll(/«([^»]+)»/g)].map((m) => m[1])
  for (const q of quoted) assert.equal(q, 'También hoy', `cita no prevista: ${q}`)
})

test('el demo del lector es la pregunta 4 del Catecismo Menor de Westminster, tal cual', () => {
  const data = json('westminster-menor')
  const block = data.entries.find((b) => b.questions.some((q) => q.number === 4))
  const q = block.questions.find((x) => x.number === 4)
  assert.equal(LECTOR_DEMO.position, `Pregunta 4 de ${BOOKS['westminster-menor'].total}`)
  assert.equal(LECTOR_DEMO.block, block.title)
  assert.equal(LECTOR_DEMO.question, q.question)
  assert.equal(LECTOR_DEMO.answer, q.answer)
  assert.deepEqual(LECTOR_DEMO.refs, q.refs.map((r) => r.label))
})
