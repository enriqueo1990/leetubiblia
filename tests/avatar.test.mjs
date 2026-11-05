import test from 'node:test'
import assert from 'node:assert/strict'
import { centerSquare, clampOffset, cropRect, clampZoom } from '../src/lib/avatarMath.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`)

test('el recorte por defecto toma el cuadrado del centro', () => {
  assert.deepEqual(centerSquare(4000, 3000), { sx: 500, sy: 0, side: 3000 })
  assert.deepEqual(centerSquare(1080, 1920), { sx: 0, sy: 420, side: 1080 })
})

test('sin mover ni acercar, el encuadre es el cuadrado del centro', () => {
  const r = cropRect(4000, 3000, 300, 1, 0, 0)
  near(r.sx, 500)
  near(r.sy, 0)
  near(r.side, 3000)
})

test('acercar al doble toma la mitad del lado, centrado', () => {
  const r = cropRect(3000, 3000, 300, 2, 0, 0)
  near(r.side, 1500)
  near(r.sx, 750)
  near(r.sy, 750)
})

test('arrastrar nunca deja hueco: el corrimiento se limita', () => {
  // 4000×3000 en un visor de 300: con zoom 1 la imagen mide 400×300 → sobran
  // 50 px a cada lado en x y nada en y.
  assert.deepEqual(clampOffset(4000, 3000, 300, 1, 999, 999), { x: 50, y: 0 })
  assert.deepEqual(clampOffset(4000, 3000, 300, 1, -999, -5), { x: -50, y: 0 })
  // Arrastrado al tope derecho, el recorte empieza en el borde izquierdo.
  near(cropRect(4000, 3000, 300, 1, 50, 0).sx, 0)
})

test('el zoom queda entre 1 y 4', () => {
  assert.equal(clampZoom(0.3), 1)
  assert.equal(clampZoom(9), 4)
  assert.equal(clampZoom(2.5), 2.5)
})
