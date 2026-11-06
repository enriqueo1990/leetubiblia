// Solo el service role puede llamar a estas funciones (las invocan pg_cron/pg_net y
// los triggers de la base con `Authorization: Bearer <service_role_key>`).
//
// Se acepta de dos formas:
//  1) el Bearer es EXACTAMENTE el secreto SUPABASE_SERVICE_ROLE_KEY del runtime
//     (comparación de tiempo constante), o
//  2) el Bearer es un JWT cuyo claim `role` es `service_role`. El gateway ya verificó
//     la FIRMA del JWT (verify_jwt = true), así que el claim es confiable: un JWT
//     `anon` o `authenticated` no pasa. Esto cubre el caso en que la clave guardada
//     en el Vault (la que usa el cron) sea el JWT clásico y el runtime exponga otro
//     formato de clave para SUPABASE_SERVICE_ROLE_KEY (aprobado por Enrique,
//     2026-11-06, tras el 401 del primer despliegue).
export function requireServiceRole(req: Request, serviceRole: string): Response | null {
  const actual = req.headers.get('authorization') ?? ''

  if (serviceRole) {
    const expected = `Bearer ${serviceRole}`
    const length = Math.max(actual.length, expected.length)
    let different = actual.length ^ expected.length
    for (let i = 0; i < length; i++) {
      different |= (actual.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0)
    }
    if (different === 0) return null
  }

  if (jwtRole(actual) === 'service_role') return null

  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Claim `role` del payload de un `Bearer <jwt>` (sin verificar la firma: eso lo hace
// el gateway con verify_jwt). null si no es un JWT legible.
function jwtRole(authorization: string): string | null {
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const role = JSON.parse(json)?.role
    return typeof role === 'string' ? role : null
  } catch {
    return null
  }
}
