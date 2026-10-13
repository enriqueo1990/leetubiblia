import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('el precache incluye el camino crítico hasta Hoy (arranque sin red tras actualizar)', async () => {
  const cfg = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')
  for (const chunk of ['PrivateRoot', 'Hoy', 'useReading', 'vendor-', 'index-']) {
    assert.ok(cfg.includes(chunk), `falta ${chunk} en globPatterns`)
  }
})
