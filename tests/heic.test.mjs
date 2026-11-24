import test from 'node:test'
import assert from 'node:assert/strict'
import { isHeic } from '../src/lib/heic.js'

// Cabecera ISO-BMFF mínima: tamaño (4) + "ftyp" + marca (4).
const ftyp = (brand) => new Uint8Array([0, 0, 0, 24, ...Buffer.from(`ftyp${brand}`, 'latin1'), 0, 0, 0, 0])
const file = (bytes, name, type = '') => new File([bytes], name, { type })

test('HEIC por tipo o por extensión', async () => {
  assert.equal(await isHeic(file(new Uint8Array(4), 'foto', 'image/heic')), true)
  assert.equal(await isHeic(file(new Uint8Array(4), 'foto', 'image/heif')), true)
  assert.equal(await isHeic(file(new Uint8Array(4), 'IMG_0012.HEIC')), true)
  assert.equal(await isHeic(file(new Uint8Array(4), '20261124_101500.heif')), true)
})

test('HEIC sin tipo ni extensión: se reconoce por la cabecera', async () => {
  assert.equal(await isHeic(file(ftyp('heic'), '1000012345')), true)
  assert.equal(await isHeic(file(ftyp('mif1'), '1000012345')), true)
})

test('lo que no es HEIC no dispara el conversor', async () => {
  assert.equal(await isHeic(file(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'foto.jpg', 'image/jpeg')), false)
  assert.equal(await isHeic(file(ftyp('heic'), 'foto.jpg', 'image/jpeg')), false) // el tipo declarado manda
  assert.equal(await isHeic(file(ftyp('isom'), 'video')), false)
  assert.equal(await isHeic(file(new Uint8Array(3), 'roto')), false)
  assert.equal(await isHeic(null), false)
})
