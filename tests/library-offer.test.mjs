import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestedMaterials, shouldOfferLibraryMoment, SUGGESTED_ORDER } from '../src/lib/libraryOffer.js'

test('sugiere en orden, sin lo que ya está en el estante', () => {
  const profile = { active_materials: [{ slug: 'westminster-menor', position: 3 }] }
  const s = suggestedMaterials(profile, 3)
  assert.equal(s.length, 3)
  assert.ok(!s.includes('westminster-menor'))
  assert.deepEqual(s, SUGGESTED_ORDER.filter((x) => x !== 'westminster-menor').slice(0, 3))
})

test('sin perfil sugiere los primeros', () => {
  assert.deepEqual(suggestedMaterials(null, 2), SUGGESTED_ORDER.slice(0, 2))
})

test('el momento: tercer día, sin materiales, una sola vez', () => {
  assert.equal(shouldOfferLibraryMoment({ streak: 3, activeCount: 0, seen: false }), true)
  assert.equal(shouldOfferLibraryMoment({ streak: 2, activeCount: 0, seen: false }), false)
  assert.equal(shouldOfferLibraryMoment({ streak: 5, activeCount: 1, seen: false }), false)
  assert.equal(shouldOfferLibraryMoment({ streak: 5, activeCount: 0, seen: true }), false)
})
