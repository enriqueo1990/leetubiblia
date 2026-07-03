// ============================================================================
// Seed de datos de PRUEBA para tu propio usuario (anon key + login de dev).
//
// Qué hace, en orden:
//   1. Inicia sesión con VITE_DEV_EMAIL / VITE_DEV_PASSWORD (del .env / .env.local).
//   2. Activa en tu perfil: share_reading + reflections_enabled (para que la UI
//      muestre lectura y "Mi camino"). Si no tenés plan activo, arranca Proverbios
//      hace 12 días. Si ya tenés uno, lo respeta.
//   3. LIMPIA solo TUS datos de prueba: tus reflexiones y tus pedidos (RLS ya
//      impide tocar los de otros). NO borra tu historial de lectura.
//   4. Siembra: lectura de los últimos días (incl. HOY → "leyó hoy"), reflexiones
//      de una línea realistas, y un set de pedidos (privados, compartidos activos
//      y respondidos con testimonio).
//
// Uso:  node scripts/seed-testdata.mjs
//
// Límite conocido: con la anon key solo se pueden crear filas TUYAS. No se puede
// simular que OTROS miembros leyeron u oraron (esas filas son de ellos).
// ============================================================================

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// --- Parseo simple de .env / .env.local (.local pisa a .env) ---------------
function loadEnv() {
  const env = {}
  for (const file of ['.env', '.env.local']) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      env[m[1]] = v
    }
  }
  return env
}

// Fecha local (YYYY-MM-DD) a partir de un Date, en la tz de la máquina.
function localDateISO(d) {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const REFLECTIONS = [
  'Hoy me quedé pensando en cómo Dios sostiene incluso cuando no lo veo.',
  'Un versículo me habló directo al miedo que venía cargando.',
  'Me costó concentrarme, pero terminé agradecido de haber abierto la Biblia.',
  'Sentí paz leyendo sobre el descanso que Él ofrece.',
  'Me convenció de perdonar a alguien que venía evitando.',
  'La lectura de hoy me dio ganas de orar más por mi familia.',
  'Entendí un poco mejor la paciencia de Dios conmigo.',
  'Corto pero real: hoy elegí confiar en vez de controlar.',
]

// Pedidos a sembrar. shared_group_id se completa con tu primer grupo.
function prayersFor(groupId) {
  const list = [
    { title: 'Sabiduría para una decisión importante en el trabajo', description: 'Se viene un cambio y no sé qué camino tomar.', visibility: 'shared', duration_type: 'forever' },
    { title: 'Salud de mi mamá', description: 'Está con estudios esta semana.', visibility: 'shared', duration_type: 'week' },
    { title: 'Paciencia con mis hijos', description: null, visibility: 'shared', duration_type: 'forever' },
    { title: 'Mi tiempo a solas con Dios', description: 'Quiero recuperar la constancia.', visibility: 'private', duration_type: 'forever' },
    {
      title: 'Trabajo para mi hermano', description: 'Venía buscando hace meses.',
      visibility: 'shared', duration_type: 'forever',
      status: 'answered', answered_at: daysAgo(5).toISOString(),
      testimony: 'Consiguió empleo después de meses de espera. Dios fue fiel.',
      testimony_shared: true, testimony_shared_at: daysAgo(5).toISOString(),
    },
    {
      title: 'Reconciliación con un amigo', description: null,
      visibility: 'shared', duration_type: 'forever',
      status: 'answered', answered_at: daysAgo(2).toISOString(),
      testimony: 'Pudimos hablar y perdonarnos. Volvimos a ser amigos.',
      testimony_shared: true, testimony_shared_at: daysAgo(2).toISOString(),
    },
  ]
  // Los compartidos necesitan grupo; si no tenés grupo, caen a privado.
  return list.map((p) =>
    p.visibility === 'shared' && !groupId ? { ...p, visibility: 'private' } : p
  )
}

function computeExpiresAt(durationType) {
  if (durationType === 'forever') return null
  const days = { day: 1, week: 7, month: 30 }[durationType]
  return new Date(Date.now() + days * 86400000).toISOString()
}

async function main() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  const email = env.VITE_DEV_EMAIL
  const password = env.VITE_DEV_PASSWORD
  if (!url || !anon) throw new Error('Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env(.local)')
  if (!email || !password) throw new Error('Falta VITE_DEV_EMAIL / VITE_DEV_PASSWORD en .env(.local)')

  const sb = createClient(url, anon, { auth: { persistSession: false } })

  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password })
  if (authErr) throw new Error(`Login falló: ${authErr.message}`)
  const uid = auth.user.id
  console.log(`✓ Sesión iniciada como ${email} (${uid})`)

  // --- Perfil: asegurar flags + plan activo -------------------------------
  const { data: profile } = await sb
    .from('profiles')
    .select('active_plan_id, plan_start_date, timezone')
    .eq('id', uid)
    .single()

  const patch = { share_reading: true, reflections_enabled: true }
  if (!profile?.timezone) patch.timezone = 'America/Argentina/Buenos_Aires'

  let planId = profile?.active_plan_id
  let startDate = profile?.plan_start_date
  if (!planId) {
    const { data: plan } = await sb.from('reading_plans').select('id').eq('slug', 'proverbios').single()
    if (!plan) throw new Error('No hay plan "proverbios" sembrado. Corré primero el seed de planes.')
    planId = plan.id
    startDate = localDateISO(daysAgo(12))
    patch.active_plan_id = planId
    patch.plan_start_date = startDate
    console.log(`  · Sin plan activo → Proverbios desde ${startDate}`)
  }

  const { error: profErr } = await sb.from('profiles').update(patch).eq('id', uid)
  if (profErr) throw new Error(`No se pudo actualizar el perfil: ${profErr.message}`)
  console.log('✓ Perfil: share_reading + reflections_enabled ON')

  // Día actual del plan (regla canónica: (hoy_local − start) + 1).
  const start = new Date(startDate + 'T00:00:00')
  const today = new Date(localDateISO(new Date()) + 'T00:00:00')
  const currentDay = Math.max(1, Math.round((today - start) / 86400000) + 1)
  console.log(`  · Día actual del plan: ${currentDay}`)

  // --- Grupo (para pedidos compartidos) -----------------------------------
  const { data: memberships } = await sb.from('group_members').select('group_id').eq('user_id', uid)
  const groupId = memberships?.[0]?.group_id ?? null
  console.log(groupId ? `  · Grupo para compartir: ${groupId}` : '  · Sin grupo → pedidos "compartidos" caen a privados')

  // --- LIMPIEZA (solo tus datos de prueba) --------------------------------
  const delRef = await sb.from('reading_reflections').delete().eq('user_id', uid).select('id')
  const delPray = await sb.from('prayer_requests').delete().eq('user_id', uid).select('id')
  console.log(`✓ Limpieza: ${delRef.data?.length ?? 0} reflexiones, ${delPray.data?.length ?? 0} pedidos borrados`)

  // --- Lectura: últimos 8 días + HOY --------------------------------------
  const progressRows = []
  for (let i = 7; i >= 0; i--) {
    const day = currentDay - i
    if (day < 1) continue
    const when = i === 0 ? new Date() : new Date(daysAgo(i).setHours(8, 30, 0, 0))
    progressRows.push({ user_id: uid, plan_id: planId, day_number: day, completed_at: when.toISOString() })
  }
  const progRes = await sb
    .from('reading_progress')
    .upsert(progressRows, { onConflict: 'user_id,plan_id,day_number' })
    .select('id')
  if (progRes.error) throw new Error(`Lectura: ${progRes.error.message}`)
  console.log(`✓ Lectura marcada en ${progRes.data.length} días (incl. hoy)`)

  // --- Reflexiones "Mi camino" --------------------------------------------
  const refRows = []
  for (let i = 0; i < REFLECTIONS.length; i++) {
    const day = currentDay - (REFLECTIONS.length - 1 - i)
    if (day < 1) continue
    refRows.push({ user_id: uid, plan_id: planId, day_number: day, body: REFLECTIONS[i] })
  }
  const refRes = await sb
    .from('reading_reflections')
    .upsert(refRows, { onConflict: 'user_id,plan_id,day_number' })
    .select('id')
  if (refRes.error) throw new Error(`Reflexiones: ${refRes.error.message}`)
  console.log(`✓ ${refRes.data.length} reflexiones sembradas`)

  // --- Pedidos de oración --------------------------------------------------
  const prayerRows = prayersFor(groupId).map((p) => ({
    user_id: uid,
    title: p.title,
    description: p.description ?? null,
    visibility: p.visibility,
    shared_group_id: p.visibility === 'shared' ? groupId : null,
    duration_type: p.duration_type,
    expires_at: p.status === 'answered' ? null : computeExpiresAt(p.duration_type),
    status: p.status ?? 'active',
    answered_at: p.answered_at ?? null,
    testimony: p.testimony ?? null,
    testimony_shared: p.testimony_shared ?? false,
    testimony_shared_at: p.testimony_shared_at ?? null,
  }))
  const prayRes = await sb.from('prayer_requests').insert(prayerRows).select('id, status, visibility')
  if (prayRes.error) throw new Error(`Pedidos: ${prayRes.error.message}`)
  const shared = prayRes.data.filter((p) => p.visibility === 'shared').length
  const answered = prayRes.data.filter((p) => p.status === 'answered').length
  console.log(`✓ ${prayRes.data.length} pedidos (${shared} compartidos, ${answered} respondidos con testimonio)`)

  console.log('\n✔ Listo. Recargá la app para ver los datos.')
  await sb.auth.signOut()
}

main().catch((e) => {
  console.error('\n✗ Error:', e.message)
  process.exit(1)
})
