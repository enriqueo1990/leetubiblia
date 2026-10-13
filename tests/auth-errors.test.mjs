import test from 'node:test'
import assert from 'node:assert/strict'
import { classifySendError } from '../src/lib/authErrors.js'

test('sin red se reporta como offline, también en modo ingresar', () => {
  assert.equal(classifySendError({ message: 'x' }, { mode: 'login', online: false }), 'offline')
  assert.equal(classifySendError({ name: 'AuthRetryableFetchError', status: 0 }, { mode: 'login' }), 'offline')
})

test('429 es límite de envíos, no "no existe la cuenta"', () => {
  assert.equal(
    classifySendError({ status: 429, code: 'over_email_send_rate_limit' }, { mode: 'login' }),
    'rateLimited'
  )
})

test('422 en ingresar es "no hay cuenta"', () => {
  assert.equal(
    classifySendError({ status: 422, message: 'Signups not allowed for otp' }, { mode: 'login' }),
    'notFound'
  )
})

test('un 422 al crear cuenta NO es "no encontrada"', () => {
  assert.equal(classifySendError({ status: 422, message: 'invalid' }, { mode: 'signup' }), 'generic')
})

test('error desconocido es genérico', () => {
  assert.equal(classifySendError({ status: 500 }, { mode: 'login' }), 'generic')
})
