import test from 'node:test'
import assert from 'node:assert/strict'
import { centerSquare } from '../src/lib/avatarMath.js'

test('el recorte toma el cuadrado del centro', () => {
  assert.deepEqual(centerSquare(4000, 3000), { sx: 500, sy: 0, side: 3000 })
  assert.deepEqual(centerSquare(1080, 1920), { sx: 0, sy: 420, side: 1080 })
  assert.deepEqual(centerSquare(512, 512), { sx: 0, sy: 0, side: 512 })
})
