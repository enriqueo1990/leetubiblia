// Clasifica el error de "enviar código" para decir la verdad al usuario (puro).
//   'offline'     → sin conexión / fallo de red
//   'rateLimited' → demasiados pedidos de código seguidos
//   'notFound'    → (solo modo "ingresar") ese correo no tiene cuenta
//   'generic'     → cualquier otro fallo
// Antes TODO fallo en "ingresar" decía "no encontramos una cuenta", y la persona
// podía terminar creando una duplicada por un corte de red o un límite de envíos.
export function classifySendError(error, { mode, online = true } = {}) {
  const status = error?.status
  const code = error?.code || ''
  const msg = error?.message || ''
  if (
    online === false ||
    error?.name === 'AuthRetryableFetchError' ||
    status === 0 ||
    /failed to fetch|network|load failed/i.test(msg)
  ) {
    return 'offline'
  }
  if (status === 429 || /rate_limit/i.test(code) || /rate limit|too many/i.test(msg)) {
    return 'rateLimited'
  }
  if (
    mode === 'login' &&
    (status === 422 || code === 'otp_disabled' || /signups? not allowed/i.test(msg))
  ) {
    return 'notFound'
  }
  return 'generic'
}
