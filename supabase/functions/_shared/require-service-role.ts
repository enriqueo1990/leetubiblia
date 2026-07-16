export function requireServiceRole(req: Request, serviceRole: string): Response | null {
  if (!serviceRole) {
    return new Response(JSON.stringify({ error: 'service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const actual = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${serviceRole}`

  // Comparación de tiempo constante para no filtrar prefijos del secreto.
  const length = Math.max(actual.length, expected.length)
  let different = actual.length ^ expected.length
  for (let i = 0; i < length; i++) {
    different |= (actual.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0)
  }

  if (different !== 0) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}
